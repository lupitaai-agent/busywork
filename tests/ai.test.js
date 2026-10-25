// The Claude client: what is sent, to where, how the stream is read, retries, costs, the transport
// seam, and the markdown renderer that shows the answers. No network: fetch is replaced.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

// A streamed answer as the API sends it, cut into small pieces to test reading across chunks.
function sse(events, piece = 7) {
  const text = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  let at = 0;
  return new Response(new ReadableStream({ pull(c) { if (at >= bytes.length) return c.close(); c.enqueue(bytes.slice(at, at += piece)); } }), { status: 200 });
}
const answer = (parts, stop = 'end_turn') => sse([
  { type: 'message_start', message: { usage: { input_tokens: 1000, output_tokens: 1, cache_read_input_tokens: 0 } } },
  ...parts.flatMap((p, i) => p.type === 'text'
    ? [{ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } }, ...p.chunks.map((t) => ({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: t } })), { type: 'content_block_stop', index: i }]
    : [{ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: 't' + i, name: p.name, input: {} } }, ...p.json.map((j) => ({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: j } })), { type: 'content_block_stop', index: i }]),
  { type: 'message_delta', delta: { stop_reason: stop }, usage: { output_tokens: 500 } },
  { type: 'message_stop' },
]);

async function claude(responses, opts = {}) {
  const calls = [];
  const win = await busywork(['shared/ai.js'], Object.assign({
    fetch: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); const r = responses.shift(); return typeof r === 'function' ? r() : r; },
  }, opts));
  win.BW.ai.key = 'sk-ant-test-0000';
  return { BW: win.BW, calls, win };
}

test('a request goes to Anthropic only, with the key, version and streaming', async () => {
  const { BW, calls } = await claude([answer([{ type: 'text', chunks: ['Hel', 'lo'] }])]);
  const r = await BW.ai.once({ system: [{ type: 'text', text: 'You help.' }], messages: [{ role: 'user', content: 'Hi' }] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
  const h = calls[0].init.headers;
  assert.equal(h['x-api-key'], 'sk-ant-test-0000');
  assert.equal(h['anthropic-version'], '2026-10-21');
  assert.equal(h['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(calls[0].body.stream, true);
  assert.equal(calls[0].body.model, 'claude-opus-5-5');
  assert.equal(r.content[0].text, 'Hello');
  assert.equal(r.stopReason, 'end_turn');
  assert.equal(r.usage.output_tokens, 500);
});

test('fallbacks ask for the beta on models that have it, and not on Haiku', async () => {
  const { BW, calls } = await claude([answer([{ type: 'text', chunks: ['a'] }]), answer([{ type: 'text', chunks: ['b'] }])]);
  await BW.ai.once({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls[0].body.fallbacks, 'default');
  assert.equal(calls[0].init.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  BW.ai.model = 'claude-haiku-5-5';
  await BW.ai.once({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls[1].body.fallbacks, undefined);
  assert.equal(calls[1].init.headers['anthropic-beta'], undefined);
});

test('tool input arrives in pieces and is put back together', async () => {
  const { BW } = await claude([answer([{ type: 'tool_use', name: 'write_file', json: ['{"pa', 'th":"a.md","con', 'tent":"é ✓"}'] }], 'tool_use')]);
  const r = await BW.ai.once({ messages: [{ role: 'user', content: 'x' }], tools: [{ name: 'write_file', input_schema: { type: 'object' } }] });
  assert.deepEqual(plain(r.content[0].input), { path: 'a.md', content: 'é ✓' });
  assert.equal(r.stopReason, 'tool_use');
});

test('a paused turn continues, and the answer is one assistant turn', async () => {
  const { BW, calls } = await claude([answer([{ type: 'text', chunks: ['Part one. '] }], 'pause_turn'), answer([{ type: 'text', chunks: ['Part two.'] }])]);
  const r = await BW.ai.run({ system: [], messages: [{ role: 'user', content: 'Research' }] });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.messages.at(-1).role, 'assistant', 'the paused turn is sent back as-is');
  assert.equal(r.text, 'Part one. Part two.');
  assert.equal(r.content.length, 2);
  assert.ok(BW.ai.spentThisMonth() > 0, 'the spend is counted');
});

test('busy servers are retried; a bad key gets a plain explanation', async () => {
  const busy = () => new Response('{}', { status: 529, headers: { 'retry-after': '0.001' } });
  const { BW, calls } = await claude([busy, answer([{ type: 'text', chunks: ['ok'] }])]);
  const r = await BW.ai.once({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls.length, 2);
  assert.equal(r.content[0].text, 'ok');
  const bad = await claude([new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 })]);
  await assert.rejects(bad.BW.ai.once({ messages: [{ role: 'user', content: 'x' }] }), /did not accept this API key/);
});

test('no key, no request; the monthly limit stops spending', async () => {
  const { BW, calls } = await claude([]);
  BW.ai.key = '';
  await assert.rejects(BW.ai.run({ messages: [] }), /API key/);
  BW.ai.key = 'sk-ant-test-0000';
  BW.ai.cap = 1; BW.ai.addSpend(1.5);
  await assert.rejects(BW.ai.run({ messages: [] }), /monthly AI limit/);
  assert.equal(calls.length, 0);
});

test('cost follows the list prices, cache and web searches included', async () => {
  const { BW } = await busywork(['shared/ai.js']);
  const opus = BW.ai.MODELS.find((m) => m.id === 'claude-opus-5-5');
  const usd = BW.ai.cost({ input_tokens: 1e6, output_tokens: 1e5, cache_read_input_tokens: 1e6, cache_creation_input_tokens: 0, server_tool_use: { web_search_requests: 3 } }, opus);
  assert.equal(Math.round(usd * 1000) / 1000, 4 + 2 + 0.2 + 0.03);
});

test('a shell or a hosted version can send requests through its own transport, without a key', async () => {
  const sent = [];
  const win = await busywork(['shared/ai.js'], { host: { aiTransport: { name: 'office', needsKey: false, send: async (body) => { sent.push(body); return answer([{ type: 'text', chunks: ['via office'] }]); } } } });
  const { BW } = win;
  assert.equal(BW.ai.key, '');
  assert.ok(BW.ai.ready());
  const r = await BW.ai.once({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(r.content[0].text, 'via office');
  assert.equal(sent[0].model, 'claude-opus-5-5');
});

test('the proxy transport sends no key', async () => {
  const calls = [];
  const win = await busywork(['shared/ai.js'], { fetch: async (url, init) => { calls.push({ url, init }); return answer([{ type: 'text', chunks: ['x'] }]); } });
  win.BW.ai.transport = win.BW.ai.transports.proxy('https://office.example/claude');
  await win.BW.ai.once({ messages: [{ role: 'user', content: 'x' }] });
  assert.equal(calls[0].url, 'https://office.example/claude');
  assert.equal(calls[0].init.headers['x-api-key'], undefined);
});

test('markdown answers are escaped: no HTML from the model reaches the page', async () => {
  const { BW } = await busywork(['shared/ai.js']);
  const html = BW.md('Hi <img src=x onerror=alert(1)> **bold** [link](javascript:alert(1))\n\n| a | b |\n|-|-|\n| 1 | <b>2</b> |');
  assert.ok(!/<img/i.test(html), 'no raw tags');
  assert.ok(!/href="javascript:/i.test(html), 'no script links');
  assert.match(html, /<b>bold<\/b>/);
  assert.match(html, /<table/);
  assert.match(html, /&lt;b&gt;2&lt;\/b&gt;/);
});

test('markdown with stray pipes finishes (it used to loop forever)', async () => {
  const { BW } = await busywork(['shared/ai.js']);
  const html = BW.md('| just a pipe\n|\n| a | b\nend');
  assert.match(html, /end/);
});
