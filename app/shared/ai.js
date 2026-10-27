/* The Studio's line to Claude, using the owner's own API key straight from the browser.
   Raw HTTP on purpose: the tools run from a downloaded folder with no build step or libraries,
   so the official SDK can't be bundled. The request shape follows the Messages API reference.
   The key lives in this browser only (never in the shared business folder) and is sent only to Anthropic. */
(function () {
  'use strict';
  const BW = window.BW;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private window */ } },
  };

  // Prices per million tokens (Anthropic API list prices). Haiku's cache-read price is an estimate.
  const MODELS = [
    { id: 'claude-opus-5-5', name: 'Best quality', model: 'Claude Opus 5.5', input: 4, output: 20, cacheRead: 0.2, web: 'web_search_20260209', fetch: 'web_fetch_20260209', fallbacks: true },
    { id: 'claude-sonnet-5-5', name: 'Balanced', model: 'Claude Sonnet 5.5', input: 2, output: 10, cacheRead: 0.2, web: 'web_search_20260209', fetch: 'web_fetch_20260209', fallbacks: true },
    { id: 'claude-haiku-5-5', name: 'Fast and cheap', model: 'Claude Haiku 5.5', input: 0.1, output: 0.5, cacheRead: 0.01, web: 'web_search_20250305', fetch: null, fallbacks: false },
  ];

  const API = 'https://api.anthropic.com/v1/messages';
  // How a request reaches Claude. `direct` goes from this browser to Anthropic with the owner's own
  // key: the only way today. `proxy(url)` sends the same request to a server that holds the key
  // instead (a hosted Busy, an office server), so no key is needed in the browser. A shell can
  // bring its own through window.BW_HOST.aiTransport. A transport is
  //   { name, needsKey, send(body, { key, beta, signal }) -> a fetch Response with the API's SSE stream }
  const transports = {
    direct: {
      name: 'direct', needsKey: true,
      send(body, { key, beta, signal }) {
        const headers = {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2026-10-21',
          'anthropic-dangerous-direct-browser-access': 'true',
        };
        if (beta) headers['anthropic-beta'] = beta;
        return fetch(API, { method: 'POST', headers, body: JSON.stringify(body), signal });
      },
    },
    proxy: (url) => ({
      name: 'proxy', needsKey: false,
      send(body, { beta, signal }) {
        const headers = { 'content-type': 'application/json', 'anthropic-version': '2026-10-21' };
        if (beta) headers['anthropic-beta'] = beta;
        return fetch(url, { method: 'POST', credentials: 'include', headers, body: JSON.stringify(body), signal });
      },
    }),
  };

  const month = () => new Date().toISOString().slice(0, 7);
  const spend = () => { try { return JSON.parse(ls.get('bw.aiSpend') || '{}'); } catch (e) { return {}; } };

  const ai = {
    MODELS,
    transports,
    transport: (window.BW_HOST && window.BW_HOST.aiTransport) || transports.direct,
    get key() { return ls.get('bw.claudeKey') || ''; },
    set key(v) { ls.set('bw.claudeKey', (v || '').trim()); },
    get model() { return MODELS.find((m) => m.id === ls.get('bw.claudeModel')) || MODELS[0]; },
    set model(id) { ls.set('bw.claudeModel', id); },
    get cap() { return Number(ls.get('bw.aiCap')) || 0; },
    set cap(v) { ls.set('bw.aiCap', v ? String(v) : ''); },
    ready() { return !this.transport.needsKey || /^sk-ant-/.test(this.key); },
    spentThisMonth() { return spend()[month()] || 0; },
    spendLog() { return spend(); },

    // Cost of one response in US dollars, from the usage the API reports.
    cost(usage, m) {
      m = m || this.model;
      if (!usage) return 0;
      const per = (n, price) => (n || 0) / 1e6 * price;
      // Web searches are billed per search on top of tokens ($10 per 1,000).
      const searches = (usage.server_tool_use && usage.server_tool_use.web_search_requests) || 0;
      return per(usage.input_tokens, m.input) + per(usage.cache_creation_input_tokens, m.input * 1.25)
        + per(usage.cache_read_input_tokens, m.cacheRead) + per(usage.output_tokens, m.output) + searches * 0.01;
    },
    // Anthropic's own web tools for this model: they run on Anthropic's side, so nothing local is reached.
    webTools(m, { fetch = true, maxUses = 5 } = {}) {
      m = m || this.model;
      const list = [{ type: m.web, name: 'web_search', max_uses: maxUses }];
      if (fetch && m.fetch) list.push({ type: m.fetch, name: 'web_fetch', max_uses: maxUses });
      return list;
    },
    addSpend(usd) { const s = spend(); s[month()] = (s[month()] || 0) + usd; ls.set('bw.aiSpend', JSON.stringify(s)); },

    /*
     * Sends one turn and streams the answer.
     *   system: array of text blocks (stable first: foundation, playbook, then brand profile)
     *   messages: the conversation so far, assistant turns kept exactly as returned
     *   web: allow web search
     *   onText(chunk), onStatus(text): live updates for the screen
     * Resolves to { text, content, usage, cost, stopReason }. The caller appends
     * { role: 'assistant', content } to keep the conversation going.
     */
    async run({ system, messages, web, onText, onStatus, signal, maxTokens = 16000 }) {
      this.checkReady();
      const m = this.model;
      const convo = messages.slice();
      let text = '', usageTotal = null, last = null;
      // A server-side tool (web search) can pause a long turn; continuing it means sending the
      // partial assistant turn back as-is. Three continuations is plenty for a marketing task.
      for (let round = 0; round < 4; round++) {
        last = await this.once({ m, system, messages: convo, web, onText: (t) => { text += t; if (onText) onText(t); }, onStatus, signal, maxTokens });
        usageTotal = addUsage(usageTotal, last.usage);
        if (last.stopReason !== 'pause_turn') break;
        convo.push({ role: 'assistant', content: last.content });
        if (onStatus) onStatus('Still researching…');
      }
      const cost = this.cost(usageTotal, m);
      this.addSpend(cost);
      if (last.stopReason === 'refusal') throw new Error('Claude declined this request. Try rephrasing it.');
      // The assistant turn to keep is everything produced across continuations.
      const content = convo.slice(messages.length).filter((x) => x.role === 'assistant').flatMap((x) => x.content).concat(last.content);
      return { text, content, usage: usageTotal, cost, stopReason: last.stopReason, model: m.id };
    },

    checkReady() {
      if (!this.ready()) throw new Error('Add your Claude API key first (⚙️ AI settings).');
      if (this.cap && this.spentThisMonth() >= this.cap) throw new Error(`You reached your monthly AI limit of $${this.cap}. Raise it in ⚙️ AI settings.`);
    },

    /* One request, streamed. `tools` adds the caller's own tools (Olaf's file tools); `web` adds
       Anthropic's web search. Resolves to { content, usage, stopReason } with the assistant
       content exactly as sent, so it can go back into the conversation unchanged. */
    async once({ m, system, messages, web, tools, onText, onStatus, signal, maxTokens, effort = 'medium' }) {
      m = m || this.model;
      const body = {
        model: m.id,
        max_tokens: maxTokens,
        stream: true,
        system,
        messages,
        output_config: { effort },
        cache_control: { type: 'ephemeral' },
      };
      const toolList = (tools || []).concat(web ? [{ type: m.web, name: 'web_search', max_uses: 5 }] : []);
      if (toolList.length) body.tools = toolList;
      let beta = null;
      // Server-side fallback: if a safety classifier declines, Anthropic re-runs it on a suitable model.
      if (m.fallbacks) { body.fallbacks = 'default'; beta = 'server-side-fallback-2026-07-01'; }

      let res;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await this.transport.send(body, { key: this.key, beta, signal });
        if (res.status !== 429 && res.status !== 529 && res.status < 500) break;
        const wait = Number(res.headers.get('retry-after')) * 1000 || 2000 * (attempt + 1);
        if (onStatus) onStatus('Claude is busy, trying again in a moment…');
        await new Promise((r) => setTimeout(r, Math.min(wait, 15000)));
      }
      if (!res.ok) throw new Error(await explain(res));

      const blocks = [], partial = {};
      let usage = {}, stopReason = null;
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let cut;
        while ((cut = buf.indexOf('\n\n')) >= 0) {
          const raw = buf.slice(0, cut); buf = buf.slice(cut + 2);
          const line = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
          switch (ev.type) {
            case 'message_start': usage = Object.assign({}, ev.message.usage); break;
            case 'content_block_start': {
              const b = JSON.parse(JSON.stringify(ev.content_block));
              if (b.type === 'server_tool_use' || b.type === 'tool_use') {
                partial[ev.index] = '';
                if (onStatus) onStatus(b.name === 'web_search' ? '🔎 Searching the web…' : b.name === 'web_fetch' ? '🌐 Reading a page…' : '🛠️ ' + b.name.replace(/_/g, ' ') + '…');
              }
              blocks[ev.index] = b;
              break;
            }
            case 'content_block_delta': {
              const b = blocks[ev.index], d = ev.delta;
              if (d.type === 'text_delta') { b.text = (b.text || '') + d.text; if (onText) onText(d.text); }
              else if (d.type === 'input_json_delta') partial[ev.index] += d.partial_json;
              else if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
              else if (d.type === 'signature_delta') b.signature = d.signature;
              else if (d.type === 'citations_delta') (b.citations = b.citations || []).push(d.citation);
              break;
            }
            case 'content_block_stop':
              if (partial[ev.index] != null) { try { blocks[ev.index].input = partial[ev.index] ? JSON.parse(partial[ev.index]) : {}; } catch (e) { blocks[ev.index].input = {}; } delete partial[ev.index]; }
              if (blocks[ev.index] && blocks[ev.index].type === 'web_search_tool_result' && onStatus) onStatus('Reading what I found…');
              break;
            case 'message_delta':
              if (ev.delta && ev.delta.stop_reason) stopReason = ev.delta.stop_reason;
              if (ev.usage) Object.assign(usage, ev.usage);
              break;
            case 'error': throw new Error((ev.error && ev.error.message) || 'Claude stopped with an error.');
            default: break;
          }
        }
      }
      return { content: blocks.filter(Boolean), usage, stopReason };
    },

    // Checks the key with the smallest possible request.
    async test() {
      const r = await this.run({ system: [{ type: 'text', text: 'Reply with the single word: ready' }], messages: [{ role: 'user', content: 'ping' }], maxTokens: 64 });
      return r.text.trim();
    },
  };

  function addUsage(a, b) {
    if (!a) return Object.assign({}, b);
    const out = Object.assign({}, a);
    for (const k of ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens']) out[k] = (a[k] || 0) + (b[k] || 0);
    const s = (x) => (x && x.server_tool_use && x.server_tool_use.web_search_requests) || 0;
    if (s(a) || s(b)) out.server_tool_use = { web_search_requests: s(a) + s(b) };
    return out;
  }

  async function explain(res) {
    let msg = '';
    try { const j = await res.json(); msg = (j.error && j.error.message) || ''; } catch (e) { /* not JSON */ }
    if (res.status === 401) return 'Claude did not accept this API key. Check it in ⚙️ AI settings.';
    if (res.status === 403) return 'This API key is not allowed to do that. ' + msg;
    if (res.status === 429) return 'Too many requests right now, or your Claude account hit a limit. Try again in a minute.';
    if (res.status === 400 && /credit|balance/i.test(msg)) return 'Your Claude account has no credit left. Add credit at console.anthropic.com.';
    return `Claude returned an error (${res.status}). ${msg}`.trim();
  }

  ai.addUsage = addUsage;
  BW.ai = ai;

  // The shared AI settings window (key, model, monthly limit), used by the Studio, Olaf and Ivy.
  ai.settings = function ({ onSave } = {}) {
    const { $, $$, esc } = BW;
    const box = document.createElement('div');
    const draw = () => {
      const log = Object.entries(BW.ai.spendLog()).sort().reverse().slice(0, 6);
      box.innerHTML = `
        <div class="idea"><span class="e">🔒</span><div>Your key is stored <b>only in this browser on this computer</b>, never in your folder, and is sent only to Anthropic. You pay Anthropic directly for what you use. New to this? <button type="button" class="link" data-guide>Follow the step-by-step guide</button>.</div></div>
        <label class="field" style="margin-bottom:14px"><span>Claude API key</span><input class="in" type="password" data-key value="${esc(BW.ai.key)}" placeholder="sk-ant-…" autocomplete="off"></label>
        <div class="field"><span>Model</span></div>
        <div class="model-cards">${BW.ai.MODELS.map((m) => `<button type="button" data-model="${m.id}" aria-pressed="${BW.ai.model.id === m.id}"><b>${m.name}</b><small>${m.model}</small><small>$${m.input} in · $${m.output} out per million tokens</small></button>`).join('')}</div>
        <p class="faint" style="font-size:.85rem;margin:8px 0 14px">Best quality is the default. A typical skill answer costs a few cents; Fast and cheap costs a fraction of that.</p>
        <label class="field"><span>Monthly limit in US dollars (optional)</span><input class="in" inputmode="decimal" data-cap value="${BW.ai.cap || ''}" placeholder="e.g. 20"><em>Busy stops sending AI requests when you reach it.</em></label>
        <p style="margin-top:14px"><b>This month:</b> $${BW.ai.spentThisMonth().toFixed(2)}${log.length > 1 ? ` · ${log.slice(1).map(([m, v]) => `${m}: $${v.toFixed(2)}`).join(' · ')}` : ''}</p>
        <p class="faint" style="font-size:.82rem;margin-top:6px">Costs are estimates from the token counts Claude reports. Check console.anthropic.com for exact billing.</p>`;
      $$('[data-model]', box).forEach((b) => b.onclick = () => { BW.ai.model = b.dataset.model; draw(); });
      $('[data-guide]', box).onclick = () => { dlg.close(); BW.ai.setup({ onDone: onSave }); };
    };
    let dlg;
    draw();
    dlg = BW.modal({ title: '🤖 AI settings', body: box, wide: true, actions: [
      { label: 'Test the key', onClick: async () => { BW.ai.key = $('[data-key]', box).value; try { const r = await BW.ai.test(); BW.toast(`Connected! Claude says: ${esc(r)}`, '✅'); } catch (e) { BW.error(e); } return false; } },
      { label: 'Save', kind: 'primary', onClick: () => { BW.ai.key = $('[data-key]', box).value; BW.ai.cap = BW.num($('[data-cap]', box).value); BW.toast('AI settings saved', '🤖'); if (onSave) onSave(); } },
    ] });
  };


  // What a typical conversation costs on a model: about 30,000 tokens read (your files and the chat so
  // far) and 2,000 written. An estimate to set expectations, from the list prices above.
  ai.perChat = (m) => (30000 * m.input + 2000 * m.output) / 1e6;
  const usd = (v) => (v < 0.01 ? '<$0.01' : '$' + v.toFixed(2));

  // The setup guide: from "what is an API key?" to a tested connection, one step at a time. Used by
  // Olaf and Ivy the first time, and from AI settings. The same steps are on the website
  // (busy.com.ai/help/claude-key.html) for people who want to read them first.
  //   who: the expert's name; onDone(): called once the key works.
  ai.setup = function ({ who = 'Your AI expert', onDone } = {}) {
    const { $, esc } = BW;
    const open = (url) => BW.openUrl(url);
    const box = document.createElement('div');
    const best = MODELS[0], mid = MODELS[1];
    const steps = [
      { t: `Connect ${esc(who)} to Claude`, b: `
        <p>${esc(who)} thinks with <b>Claude</b>, the AI made by Anthropic. You connect it with your own <b>API key</b>: a long password that lets this browser talk to Claude for you. It takes about five minutes, once.</p>
        <div class="idea" style="margin-top:14px"><span class="e">💡</span><div><b>Good to know</b><br>
          • A Claude chat subscription (Pro or Max) does <b>not</b> include API use. The API is a separate, pay-as-you-go account.<br>
          • You pay Anthropic directly, only for what you use. A typical conversation costs about <b>${usd(ai.perChat(mid))}</b> on Balanced or <b>${usd(ai.perChat(best))}</b> on Best quality (an estimate).<br>
          • Your key stays <b>in this browser on this computer</b> and is only ever sent to Anthropic. Busy never sees it.</div></div>
        <p style="margin-top:14px">You need: an email address and a payment card. Prefer to read it all first? <button type="button" class="link" data-web>The same guide on busy.com.ai</button>.</p>` },
      { t: '1 · Make a Claude Console account', b: `
        <ol class="steps-list"><li>Open <b>console.anthropic.com</b> (the button below opens it in a new tab).</li>
          <li>Sign up with your email or Google account, and confirm your email.</li>
          <li>If it asks what you’ll build, anything is fine: “personal use” is a good answer.</li></ol>
        <p style="margin-top:14px"><button type="button" class="btn" data-console>↗ Open console.anthropic.com</button></p>
        <p class="faint" style="margin-top:10px">Already have an account? Sign in and go to the next step.</p>` },
      { t: '2 · Add a little credit', b: `
        <ol class="steps-list"><li>In the console, open <b>Settings → Billing</b> (it may be called <b>Plans &amp; Billing</b>).</li>
          <li>Add a card and buy credit. The smallest amount is enough to start, about $5.</li>
          <li>Leave <b>auto-reload off</b> if you want to never pay more than you put in.</li></ol>
        <div class="idea" style="margin-top:14px"><span class="e">🛡️</span><div>Want a hard ceiling? Under <b>Settings → Limits</b> you can set a monthly spend limit at Anthropic. Busy also has its own monthly limit, which you set in the last step.</div></div>` },
      { t: '3 · Create your API key', b: `
        <ol class="steps-list"><li>Open <b>Settings → API keys</b> and click <b>Create key</b>.</li>
          <li>Name it something you’ll recognise, like <b>Busy ${esc(who)}</b>.</li>
          <li><b>Copy the key now.</b> It starts with <code>sk-ant-</code> and is shown only once. Lost it? No problem: delete it and create a new one.</li></ol>
        <div class="idea" style="margin-top:14px"><span class="e">🔒</span><div>Treat it like a password: don’t email it or put it in a shared document. Busy keeps it in this browser only, not in your folder.</div></div>` },
      { t: '4 · Paste it here', b: `
        <label class="field"><span>Your Claude API key</span><input class="in" type="password" data-key value="${esc(ai.key)}" placeholder="sk-ant-…" autocomplete="off"></label>
        <label class="field" style="margin-top:12px"><span>Monthly limit in Busy, in US dollars</span><input class="in" inputmode="decimal" data-cap value="${ai.cap || 10}"><em>Busy stops sending requests when you reach it. You can change it any time in AI settings.</em></label>
        <div data-result style="margin-top:14px"></div>`, test: true },
      { t: 'You’re connected 🎉', b: `
        <p>Claude answered, so ${esc(who)} is ready. Your key is saved in this browser on this computer.</p>
        <ul class="steps-list" style="margin-top:12px"><li>On another computer, paste the same key again (or make a second key).</li>
          <li>Change the model or your monthly limit any time in <b>⚙️ AI settings</b>.</li>
          <li>See exactly what you spent at console.anthropic.com → Usage.</li></ul>` },
    ];
    const PASTE = steps.findIndex((s) => s.test), DONE = steps.length - 1;
    let i = ai.ready() ? PASTE : 0, m; // a key already there: straight to testing it
    const draw = () => {
      const s = steps[i];
      box.innerHTML = `<div class="setup-dots" aria-hidden="true">${steps.map((_, n) => `<i class="${n <= i ? 'on' : ''}"></i>`).join('')}</div><h3 style="margin:10px 0 12px">${s.t}</h3>${s.b}`;
      const c = $('[data-console]', box); if (c) c.onclick = () => open('https://console.anthropic.com');
      const w = $('[data-web]', box); if (w) w.onclick = () => open(BW.siteUrl + '/claude-key.html');
      const k = $('[data-key]', box); if (k) setTimeout(() => k.focus(), 30);
      foot();
    };
    const test = async () => {
      const k = $('[data-key]', box).value.trim(), out = $('[data-result]', box);
      if (!/^sk-ant-/.test(k)) { out.innerHTML = '<p class="faint">⚠️ That doesn’t look like a Claude key: it should start with <code>sk-ant-</code>. Copy it again from the console.</p>'; return; }
      ai.key = k; ai.cap = BW.num($('[data-cap]', box).value);
      out.innerHTML = '<p class="faint">⏳ Saying hello to Claude…</p>';
      try { await ai.test(); i = DONE; draw(); if (onDone) onDone(); } catch (e) {
        const msg = String((e && e.message) || e);
        const tip = /credit/i.test(msg) ? 'Add credit in step 2, wait a minute, then try again.'
          : /accept/i.test(msg) ? 'Copy the whole key again: it’s long, and one missing letter is enough.'
          : /Failed to fetch|NetworkError|network/i.test(msg) ? 'Check your internet connection, then try again.' : 'Try again in a minute.';
        out.innerHTML = `<div class="idea"><span class="e">🤔</span><div><b>${esc(msg)}</b><br>${tip}</div></div>`;
      }
    };
    const foot = () => {
      const f = $('.modal-foot', m.el); f.innerHTML = '';
      const btn = (label, kind, fn) => { const b = document.createElement('button'); b.className = 'btn' + (kind ? ' btn-' + kind : ''); b.textContent = label; b.onclick = fn; f.append(b); };
      if (i > 0 && i < DONE) btn('Back', 'ghost', () => { i--; draw(); });
      if (i < PASTE) btn(i === 0 ? 'Let’s start' : 'Done, next', 'primary', () => { i++; draw(); });
      if (i === PASTE) btn('Test and save', 'primary', test);
      if (i === DONE) btn('Done', 'primary', () => m.close());
    };
    m = BW.modal({ title: '🔌 Connect to Claude', body: box, wide: true });
    draw();
  };
})();
