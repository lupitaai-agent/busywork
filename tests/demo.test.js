// The website demo (website/assets/demo.js): the tools open already filled in, with Busy itself or (when the
// Workshop tour asks) the pretend studio, kept for the tab only, never asking for a folder, never installable.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, APP } = require('./harness.js');

const DEMO = path.join(APP, '..', 'website', 'assets', 'demo.js');

function demoPage(search) {
  const win = load([DEMO, 'shared/core.js', 'shared/projects.js'], { before: (w) => { if (search) w.location.search = search; } });
  // Scripts the page would load by tag (the examples) run straight into the sandbox.
  win.BW.loadScript = async (src) => vm.runInContext(fs.readFileSync(path.join(APP, src.replace(/^(\.\.\/)*/, '')), 'utf8'), win);
  win.BW.runRecurring = async () => {};
  return win;
}

test('the demo opens on Busy itself, without asking for a folder', async () => {
  const win = demoPage();
  const { BW } = win;
  await BW.boot({});
  assert.equal(BW.store.kind, 'demo');
  assert.equal(BW.settings.businessName, 'Busy');
  assert.equal(BW.settings.brandColor, '#FFC93C');
  assert.ok((await BW.store.all('clients')).length >= 4);
  assert.ok((await BW.store.all('invoices')).length >= 5);
  assert.ok((await BW.store.all('projects')).length >= 2);
  assert.ok((await BW.store.all('mktplan')).length >= 5);
  const [profile] = await BW.store.all('mktprofile');
  assert.ok(profile.assets.some((a) => /Tuck/.test(a.name)), "Busy's own brand assets are in the profile");
  assert.ok(win.sessionStorage.getItem('bw.demo.busy.seeded'));
  assert.equal(win.sessionStorage.getItem('bw.demo.which'), 'busy');
  assert.equal(win.localStorage.length, 0, 'nothing in lasting browser storage');
});

test('the tour asks for the pretend studio, and the choice lasts for the tab', async () => {
  const win = demoPage('?example=studio');
  await win.BW.boot({});
  assert.equal(win.BW.settings.businessName, 'Studio Noor');
  assert.ok((await win.BW.store.all('clients')).some((c) => c.name === 'Bakkerij De Gouden Korst'));
  assert.ok(win.sessionStorage.getItem('bw.demo.seeded'));
  // Another tool in the same tab, opened without the question in its address: still the studio.
  const copy = (w) => { for (let i = 0; i < win.sessionStorage.length; i++) { const k = win.sessionStorage.key(i); w.sessionStorage.setItem(k, win.sessionStorage.getItem(k)); } };
  const next = load([DEMO, 'shared/core.js'], { before: copy });
  next.BW.runRecurring = async () => {};
  next.BW.loadScript = async () => { throw new Error('should not load an example again'); };
  await next.BW.boot({});
  assert.equal((await next.BW.store.settings()).businessName, 'Studio Noor');
});

test('both examples live side by side in one tab', async () => {
  const studio = demoPage('?example=studio');
  await studio.BW.boot({});
  const busy = load([DEMO, 'shared/core.js', 'shared/projects.js'], { before: (w) => {
    w.location.search = '?example=busy';
    for (let i = 0; i < studio.sessionStorage.length; i++) { const k = studio.sessionStorage.key(i); w.sessionStorage.setItem(k, studio.sessionStorage.getItem(k)); }
  } });
  busy.BW.loadScript = async (src) => vm.runInContext(fs.readFileSync(path.join(APP, src.replace(/^(\.\.\/)*/, '')), 'utf8'), busy);
  busy.BW.runRecurring = async () => {};
  await busy.BW.boot({});
  assert.equal(busy.BW.settings.businessName, 'Busy');
  assert.equal((await busy.BW.store.all('clients')).filter((c) => c.name === 'Bakkerij De Gouden Korst').length, 0, "the studio's clients are not Busy's");
});

test('the demo keeps changes for the tab, across tools, and fills itself only once', async () => {
  const first = demoPage();
  await first.BW.boot({});
  await first.BW.store.put('clients', { name: 'Added in the demo' });
  // Another tool in the same tab: same sessionStorage, no second example business.
  const second = load([DEMO, 'shared/core.js']);
  for (let i = 0; i < first.sessionStorage.length; i++) { const k = first.sessionStorage.key(i); second.sessionStorage.setItem(k, first.sessionStorage.getItem(k)); }
  second.BW.runRecurring = async () => {};
  second.BW.loadScript = async () => { throw new Error('should not load examples again'); };
  await second.BW.boot({});
  const names = (await second.BW.store.all('clients')).map((c) => c.name);
  assert.ok(names.includes('Added in the demo'));
  assert.equal(names.filter((n) => n === 'Winkeliersvereniging Lombok').length, 1);
});

test('the demo driver keeps the storage contract', async () => {
  const win = demoPage();
  const d = await win.BW_HOST.driver();
  for (const m of ['readJSON', 'writeJSON', 'list', 'readFile', 'writeFile', 'listFiles', 'removeFile']) assert.equal(typeof d[m], 'function', m);
  assert.equal(win.BW_HOST.installable, false);
});
