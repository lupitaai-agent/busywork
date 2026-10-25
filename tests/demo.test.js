// The website demo (website/assets/demo.js): the tools open already filled with the pretend studio,
// kept for the tab only, never asking for a folder, never installable.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { load, APP } = require('./harness.js');

const DEMO = path.join(APP, '..', 'website', 'assets', 'demo.js');

function demoPage() {
  const win = load([DEMO, 'shared/core.js', 'shared/projects.js']);
  // Scripts the page would load by tag (examples.js) run straight into the sandbox.
  win.BW.loadScript = async (src) => vm.runInContext(fs.readFileSync(path.join(APP, src.replace(/^(\.\.\/)*/, '')), 'utf8'), win);
  win.BW.runRecurring = async () => {};
  return win;
}

test('the demo opens with the pretend studio, without asking for a folder', async () => {
  const win = demoPage();
  const { BW } = win;
  await BW.boot({});
  assert.equal(BW.store.kind, 'demo');
  assert.equal(BW.settings.businessName, 'Studio Noor');
  assert.ok((await BW.store.all('clients')).length >= 4);
  assert.ok((await BW.store.all('invoices')).length >= 5);
  assert.ok((await BW.store.all('projects')).length >= 2);
  assert.ok((await BW.store.all('mktplan')).length >= 5);
  assert.ok(win.sessionStorage.getItem('bw.demo.seeded'));
  assert.equal(win.localStorage.length, 0, 'nothing in lasting browser storage');
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
  assert.equal(names.filter((n) => n === 'Bakkerij De Gouden Korst').length, 1);
});

test('the demo driver keeps the storage contract', async () => {
  const win = demoPage();
  const d = await win.BW_HOST.driver();
  for (const m of ['readJSON', 'writeJSON', 'list', 'readFile', 'writeFile', 'listFiles', 'removeFile']) assert.equal(typeof d[m], 'function', m);
  assert.equal(win.BW_HOST.installable, false);
});
