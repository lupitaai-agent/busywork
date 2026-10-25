// Storage: the driver contract, saving, data versions and their update steps, read-only mode, backups.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, load, plain } = require('./harness.js');

test('every driver keeps the same contract', async () => {
  const { BW } = await busywork();
  const methods = ['readJSON', 'writeJSON', 'list', 'readFile', 'writeFile', 'listFiles', 'removeFile'];
  for (const [name, make] of Object.entries(BW.drivers)) {
    const d = name === 'folder' ? make({ name: 'x' }) : make();
    assert.ok(d.kind && d.label, `${name} has kind and label`);
    for (const m of methods) assert.equal(typeof d[m], 'function', `${name}.${m}`);
  }
});

test('put adds ids and times, keeps fields it does not know, and remove works', async () => {
  const { BW } = await busywork();
  const rec = await BW.store.put('clients', { name: 'Studio Blauw', future: { from: 'a newer version' } });
  assert.ok(rec.id && rec.createdAt && rec.updatedAt);
  const again = await BW.store.get('clients', rec.id);
  again.name = 'Studio Blauw BV';
  await BW.store.put('clients', again);
  const all = await BW.store.all('clients');
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'Studio Blauw BV');
  assert.deepEqual(plain(all[0].future), { from: 'a newer version' });
  assert.equal(await BW.store.removeWhere('clients', (r) => r.name.startsWith('Studio')), 1);
  assert.equal((await BW.store.all('clients')).length, 0);
});

test('saves made at the same moment do not lose each other', async () => {
  const { BW } = await busywork();
  await Promise.all(Array.from({ length: 25 }, (_, i) => BW.store.put('tasks', { title: 'Task ' + i })));
  assert.equal((await BW.store.all('tasks')).length, 25);
});

test('what the store returns is a copy: changing it saves nothing', async () => {
  const { BW } = await busywork();
  await BW.store.put('stock', { name: 'Mugs', qty: 3 });
  (await BW.store.all('stock'))[0].qty = 99;
  assert.equal((await BW.store.all('stock'))[0].qty, 3);
});

test('a new business starts at the current data version', async () => {
  const { BW } = await busywork();
  const r = await BW.migrate();
  assert.equal(r.status, 'current');
  const meta = await BW.store.all('meta');
  assert.equal(meta.dataVersion, BW.DATA_VERSION);
  assert.equal(meta.savedBy, BW.version);
});

test('data from before versions existed counts as version 1', async () => {
  const { BW } = await busywork([], { seed: { clients: [{ id: 'a', name: 'Old client' }] } });
  const d = BW.drivers.memory({ clients: [{ id: 'a', name: 'Old client' }] });
  const r = await BW.migrate(d, [], 1);
  assert.equal(r.version, 1);
  assert.equal((await d.readJSON('meta')).dataVersion, 1);
});

test('update steps run once, in order, after a backup of how things were', async () => {
  const { BW } = await busywork();
  const d = BW.drivers.memory({ meta: { dataVersion: 1 }, invoices: [{ id: 'i1', lines: [{ qty: 1 }] }] });
  const ran = [];
  const steps = [
    { to: 3, async run(db) { ran.push(3); const s = await db.read('settings', {}); s.flag = true; await db.write('settings', s); } },
    { to: 2, async run(db) { ran.push(2); const l = await db.read('invoices', []); l.forEach((i) => { i.items = i.items || i.lines; delete i.lines; }); await db.write('invoices', l); } },
  ];
  const r = await BW.migrate(d, steps, 3);
  assert.deepEqual(ran, [2, 3]);
  assert.equal(r.status, 'updated');
  assert.equal((await d.readJSON('meta')).dataVersion, 3);
  assert.deepEqual(plain((await d.readJSON('invoices'))[0].items), [{ qty: 1 }]);
  const backups = await d.listFiles('backups');
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^before-update-v1-/);
  const copy = JSON.parse(await (await d.readFile('backups/' + backups[0])).text());
  assert.ok(copy.invoices[0].lines, 'the backup has the data as it was before');
  assert.equal((await BW.migrate(d, steps, 3)).status, 'current', 'nothing runs twice');
  assert.deepEqual(ran, [2, 3]);
});

test('a step that fails leaves the version at the last finished step', async () => {
  const { BW } = await busywork();
  const d = BW.drivers.memory({ meta: { dataVersion: 1 }, clients: [] });
  const steps = [{ to: 2, async run() {} }, { to: 3, async run() { throw new Error('half way'); } }];
  await assert.rejects(BW.migrate(d, steps, 3), /half way/);
  assert.equal((await d.readJSON('meta')).dataVersion, 2);
});

test('data saved by a newer Busywork can be read but not changed', async () => {
  const win = load(['shared/core.js'], { host: { driver: async () => null } });
  const { BW } = win;
  const d = BW.drivers.memory({ meta: { dataVersion: 99 }, clients: [{ id: 'c', name: 'Kept safe' }] });
  assert.equal((await BW.migrate(d)).status, 'newer');
});

test('boot opens newer data read-only and says so', async () => {
  const d0 = { meta: { dataVersion: 99 }, settings: { businessName: 'Future BV' }, clients: [{ id: 'c', name: 'Kept safe' }] };
  let drv;
  const win = load(['shared/core.js'], { host: { driver: async () => (drv = win.BW.drivers.memory(d0)) } });
  const { BW } = win;
  BW.runRecurring = async () => {};
  await BW.boot({});
  assert.match(BW.store.readOnly, /newer Busywork/);
  assert.equal((await BW.store.all('clients'))[0].name, 'Kept safe');
  await assert.rejects(BW.store.put('clients', { name: 'New' }), /newer Busywork/);
  await assert.rejects(BW.store.saveSettings({ businessName: 'x' }), /newer Busywork/);
  assert.equal((await drv.readJSON('clients')).length, 1);
});

test('a backup has every collection and says which release made it', async () => {
  const { BW } = await busywork();
  await BW.migrate();
  await BW.store.put('clients', { name: 'A' });
  const snap = await BW.snapshot();
  assert.equal(snap._busywork, 1);
  assert.equal(snap._app, BW.version);
  assert.equal(snap.clients.length, 1);
  assert.equal(snap.meta.dataVersion, BW.DATA_VERSION);
});

test('a shell can bring its own driver', async () => {
  let made = 0;
  const win = load(['shared/core.js'], { host: { driver: async () => { made++; return win.BW.drivers.memory({ settings: { businessName: 'Shell BV' } }); } } });
  const { BW } = win;
  BW.runRecurring = async () => {};
  await BW.boot({});
  assert.equal(made, 1);
  assert.equal(BW.store.kind, 'memory');
  assert.equal(BW.settings.businessName, 'Shell BV');
});
