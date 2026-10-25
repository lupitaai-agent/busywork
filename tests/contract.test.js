// The contract around the apps: the data schema, the example business, the seams a shell can
// replace (platform, entitlements) and the problem report.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { busywork, load, plain, APP } = require('./harness.js');

const ROOT = path.join(APP, '..');
const read = (f) => fs.readFileSync(f, 'utf8');
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.js') && e.name !== 'library.js') out.push(p);
  }
  return out;
}

test('every collection the code uses is in the schema and in DATA.md', async () => {
  const { BW } = await busywork(['shared/schema.js']);
  const dirs = [APP, path.join(ROOT, '..', 'busywork-olaf', 'app')].filter((d) => fs.existsSync(d));
  const used = new Set();
  for (const f of dirs.flatMap((d) => walk(d))) {
    for (const m of read(f).matchAll(/BW\.store\.(?:all|get|put|putMany|remove|removeWhere|replaceAll)\(\s*'([a-z-]+)'/g)) used.add(m[1]);
    for (const m of read(f).matchAll(/\[((?:\s*'[a-z-]+',?)+)\]\.map\(\(n\) =>\s*BW\.store\.all\(n\)\)/g)) for (const n of m[1].match(/[a-z-]+/g)) used.add(n);
  }
  const known = Object.keys(BW.schema.COLLECTIONS);
  for (const n of used) assert.ok(known.includes(n), `${n} is used but not in shared/schema.js`);
  const doc = read(path.join(ROOT, 'DATA.md'));
  for (const n of known) assert.ok(doc.includes('`' + n + '`'), `${n} is not described in DATA.md`);
});

test('the example business fits the schema', async () => {
  const { BW } = await busywork(['shared/schema.js', 'shared/examples.js']);
  await BW.examples.load();
  const problems = [];
  for (const n of await BW.store.collections()) {
    const v = await BW.store.all(n);
    for (const r of Array.isArray(v) ? v : [v]) problems.push(...BW.schema.check(n, r));
  }
  assert.deepEqual(problems, []);
});

test('the example business points only at records that exist, and can be removed again', async () => {
  const { BW } = await busywork(['shared/schema.js', 'shared/examples.js']);
  await BW.store.put('clients', { name: 'A real client' });
  await BW.examples.load();
  const all = {};
  for (const n of await BW.store.collections()) all[n] = await BW.store.all(n);
  for (const [n, list] of Object.entries(all)) {
    if (!Array.isArray(list)) continue;
    const fields = BW.schema.COLLECTIONS[n].fields;
    for (const r of list) for (const [k, t] of Object.entries(fields)) {
      if (!t.startsWith('ref:') || !r[k]) continue;
      assert.ok((all[t.slice(4)] || []).some((x) => x.id === r[k]), `${n}.${k} points at a missing ${t.slice(4)} record`);
    }
  }
  assert.ok(await BW.examples.present());
  await BW.examples.remove();
  assert.equal(await BW.examples.present(), false);
  const left = await BW.store.all('clients');
  assert.equal(left.length, 1, 'the real client stays');
});

test('schema check catches what it should and allows unknown fields', async () => {
  const { BW } = await busywork(['shared/schema.js']);
  assert.deepEqual(plain(BW.schema.check('clients', { id: 'a', name: 'A', somethingNew: 1 })), []);
  assert.equal(BW.schema.check('clients', { name: 'A' }).length, 1);
  assert.equal(BW.schema.check('invoices', { id: 'a', items: 'nope', reverseCharge: 'yes' }).length, 2);
  assert.deepEqual(plain(BW.schema.check('expenses', { id: 'e', amount: '12,50' })), [], 'numbers typed as text are fine');
});

test('a shell can replace the platform functions', async () => {
  const opened = [];
  const { BW } = await busywork([], { host: { platform: { kind: 'desktop', openUrl: (u) => opened.push(u), copy: async () => true } } });
  assert.equal(BW.platform.kind, 'desktop');
  BW.openUrl('https://example.com');
  assert.deepEqual(opened, ['https://example.com']);
  assert.equal(await BW.copy('x'), true);
  assert.equal(typeof BW.platform.download, 'function', 'what the shell does not replace stays');
});

test('apps use the platform, not the browser, for links and the clipboard', () => {
  const offenders = walk(APP).filter((f) => !f.endsWith(path.join('shared', 'core.js')))
    .filter((f) => /navigator\.clipboard\.writeText|window\.open\(/.test(read(f)));
  assert.deepEqual(offenders.map((f) => path.relative(APP, f)), []);
});

test('entitlements: Olaf is paid, and a shell can answer instead (licence, store receipt)', async () => {
  const { BW } = await busywork();
  BW.olafInstalled = async () => 'demo';
  assert.equal(await BW.entitlements.edition('olaf'), 'demo');
  assert.equal(await BW.entitlements.has('olaf'), false);
  assert.equal(await BW.entitlements.has('anything-else'), false);
  const shell = await busywork([], { host: { entitlements: { edition: async (f) => (f === 'olaf' ? 'full' : null) } } });
  assert.equal(await shell.BW.entitlements.has('olaf'), true);
});

test('the problem report counts records, copies none, and hides keys and folder names', async () => {
  const win = await busywork([], { page: '/Users/Jane Doe/Documents/Busywork/apps/invoices/index.html' });
  const { BW } = win;
  BW.olafInstalled = async () => null;
  await BW.store.put('clients', { name: 'Secret Client BV', email: 'secret@example.com' });
  const err = new Error('Request failed for sk-ant-api03-abcdef');
  err.stack = 'Error: x\n    at save (file:///Users/Jane%20Doe/Documents/Busywork/apps/invoices/app.js:10:5)';
  BW.problems.note('error', err);
  const rep = await BW.diagnostics();
  const text = JSON.stringify(rep);
  assert.equal(rep.collections.clients, 1);
  assert.ok(!text.includes('Secret Client'), 'no records');
  assert.ok(!text.includes('sk-ant-api03'), 'no key');
  assert.ok(!text.includes('Jane'), 'no folder names');
  assert.equal(rep.page, 'apps/invoices/index.html');
  assert.match(rep.problems[0].stack, /at save \(apps\/invoices\/app\.js:10:5\)/);
  assert.equal(rep.version, BW.version);
});

test('every page loads the scripts it needs in a working order', () => {
  const pages = [path.join(APP, 'index.html'), ...fs.readdirSync(path.join(APP, 'apps')).map((a) => path.join(APP, 'apps', a, 'index.html'))].filter((p) => fs.existsSync(p));
  for (const p of pages) {
    const srcs = [...read(p).matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
    for (const s of srcs) if (!/^https?:/.test(s)) assert.ok(fs.existsSync(path.join(path.dirname(p), s)), `${path.relative(APP, p)} loads missing ${s}`);
    const core = srcs.findIndex((s) => s.endsWith('shared/core.js'));
    assert.ok(core >= 0, `${path.relative(APP, p)} loads core.js`);
    for (const s of ['ai.js', 'mkt-dash.js', 'mkt-insights.js', 'mkt-content.js', 'examples.js']) {
      const i = srcs.findIndex((x) => x.endsWith('shared/' + s));
      if (i >= 0) assert.ok(i > core, `${path.relative(APP, p)} loads ${s} after core.js`);
    }
  }
});

test('the app never reaches anywhere but Anthropic', () => {
  // Only the AI client calls fetch (the proxy transport goes where a shell says). The offline
  // worker re-fetches the site's own files, and only those.
  const callers = walk(APP).filter((f) => /\bfetch\(/.test(read(f))).map((f) => path.relative(APP, f));
  assert.deepEqual(callers, [path.join('shared', 'ai.js'), 'sw.js']);
  assert.match(read(path.join(APP, 'sw.js')), /new URL\(req\.url\)\.origin !== location\.origin\) return;/);
  assert.match(read(path.join(APP, 'shared', 'ai.js')), /const API = 'https:\/\/api\.anthropic\.com\/v1\/messages';/);
});

test('core.js loads in a bare sandbox without touching the network', () => {
  const win = load(['shared/core.js'], { fetch: () => { throw new Error('network'); } });
  assert.equal(typeof win.BW.boot, 'function');
});

test('names the owner typed are escaped in forms', async () => {
  const { BW } = await busywork();
  const evil = '<img src=x onerror=alert(1)>';
  const html = BW.fieldsHtml([
    { k: 'p', label: 'Project', type: 'select', options: [['a"b', evil]] },
    { k: 'c', label: 'Client', type: 'chips', options: [['x', evil]] },
    { k: 'n', label: 'Name' }, { k: 't', label: 'Notes', type: 'textarea' },
  ], { n: evil, t: evil });
  assert.ok(!html.includes('<img'), html);
  assert.ok(html.includes('value="a&quot;b"'));
  assert.ok(BW.fieldsHtml([{ k: 'c', label: 'Colour', type: 'chips', html: true, options: [['x', '<span class="swatch"></span>']] }], {}).includes('<span class="swatch">'));
});

// Every tool page: scripts only from Busywork's own files, no inline script, network only to Anthropic.
const STRICT = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.anthropic.com; object-src 'none'; base-uri 'none'; form-action 'none'";
test('every tool page carries the strict security policy and no inline script', () => {
  const olaf = path.join(ROOT, '..', 'busywork-olaf', 'app', 'index.html');
  const pages = [path.join(APP, 'index.html'), ...fs.readdirSync(path.join(APP, 'apps')).map((a) => path.join(APP, 'apps', a, 'index.html')), olaf].filter((p) => fs.existsSync(p));
  for (const p of pages) {
    const html = read(p);
    const csp = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];
    assert.equal(csp, STRICT, `${path.relative(ROOT, p)} has the strict policy`);
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), `${path.relative(ROOT, p)}: the policy comes before any script`);
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), `${path.relative(ROOT, p)} has an inline script`);
    assert.ok(!/\son[a-z]+="/.test(html), `${path.relative(ROOT, p)} has an inline event handler`);
  }
});

// Two function declarations with the same name in one script: the later one silently replaces the
// earlier, so buttons call the wrong thing (this happened to Olaf's project buttons).
test('no script declares the same function name twice', () => {
  const dirs = [APP, path.join(ROOT, '..', 'busywork-olaf', 'app')].filter((d) => fs.existsSync(d));
  const dupes = [];
  for (const f of dirs.flatMap((d) => walk(d))) {
    const seen = new Map();
    for (const m of read(f).matchAll(/^([ \t]*)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
      const key = m[1].length + ':' + m[2];
      if (seen.has(key)) dupes.push(`${path.relative(ROOT, f)}: ${m[2]}`); else seen.set(key, true);
    }
  }
  assert.deepEqual(dupes, []);
});

// The homepage showcase picture is position: sticky. overflow hidden (or auto) on html or body turns
// one of them into its own scroll box, and the picture then scrolls away with the page. Use clip.
test('the website never makes html or body a scroll box', () => {
  for (const f of ['website/assets/site.css', 'app/shared/brand.css']) {
    const css = read(path.join(ROOT, f));
    for (const m of css.matchAll(/(^|[},]\s*)((?:html|body)[^{,]*)(?:,[^{]*)?\{([^}]*)\}/gm)) {
      assert.ok(!/overflow(-x|-y)?\s*:\s*(hidden|auto|scroll)/.test(m[3]), `${f}: ${m[2].trim()} { ${m[3].trim()} }`);
    }
  }
});
