// Busy Home (shared/house.js): when documents expire, when contracts renew and the last day to cancel,
// when upkeep is due, inventory totals, letters filled from the household's details, the moving plan
// and the dashboard's list of what's coming up. Plus the suite plumbing in core.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

async function house() { const { BW } = await busywork(['shared/house.js']); return BW; }
const T = '2026-10-27';

test('a contract that renews itself rolls on by its term, and the last day to cancel comes before the end by the notice period', async () => {
  const H = (await house()).house;
  const c = { name: 'Home insurance', end: '2026-01-31', renews: 'yes', renewMonths: 12, notice: 1, noticeUnit: 'month' };
  assert.equal(H.nextEnd(c, T), '2027-01-31');
  assert.equal(H.cancelBy(c, T), '2026-12-31');
  assert.equal(H.contractState(c, T), 'ok', 'more than 45 days to go');
  assert.equal(H.contractState(c, '2026-12-01'), 'decide');
  assert.equal(H.cancelBy(Object.assign({}, c, { notice: 30, noticeUnit: 'day' }), T), '2027-01-01');
  assert.equal(H.cancelBy({ end: '2027-03-31', notice: 2, noticeUnit: 'week' }, T), '2027-03-17');
  assert.equal(H.nextEnd({ end: '2026-06-30', renews: 'no' }, T), '2026-06-30');
  assert.equal(H.contractState({ end: '2026-06-30', renews: 'no' }, T), 'ended');
  assert.equal(H.nextEnd({ end: '2025-06-30', renews: 'rolling', notice: 1 }, T), '', 'cancel any time: no end until notice');
  assert.equal(H.contractState({ end: '2025-06-30', renews: 'rolling', notice: 1 }, T), 'rolling');
  assert.equal(H.endsIfCancelledToday({ notice: 1, noticeUnit: 'month' }, T), '2026-11-27');
  assert.equal(H.contractState(Object.assign({}, c, { cancelledAt: '2026-10-01', end: '2027-01-31' }), T), 'cancelled');
  const due = H.decisions([c, Object.assign({}, c, { id: 'b', name: 'Gym', end: '2026-12-15', notice: 1 })], T);
  assert.deepEqual(plain(due.map((d) => [d.contract.name, d.by, d.left])), [['Gym', '2026-11-15', 19]]);
  assert.equal(Math.round(H.monthly({ cost: 120, per: 'year' })), 10);
});

test('documents warn before they expire, passports earliest; upkeep is due from the last time it was done', async () => {
  const H = (await house()).house;
  const papers = [{ id: 'p', title: 'Passport Noor', kind: 'id', expires: '2027-02-01' }, { id: 'i', title: 'Car insurance', kind: 'insurance', expires: '2027-02-01' },
    { id: 'o', title: 'Old ID', kind: 'id', expires: '2026-10-01', replaced: true }, { id: 'r', title: 'Lease', kind: 'house', reviewAt: '2026-11-10' }];
  assert.deepEqual(plain(H.expiring(papers, T).map((e) => [e.paper.id, e.left])), [['r', 14], ['p', 97]], 'the passport warns 120 days ahead, insurance 60; replaced documents never');
  assert.equal(H.when(97), 'in 3 months'); assert.equal(H.when(-3), '3 days ago'); assert.equal(H.when(0), 'today');
  const job = { task: 'Service the boiler', every: 12, last: '2025-11-10' };
  assert.equal(H.nextDue(job, T), '2026-11-10'); assert.equal(H.jobState(job, T), 'soon');
  assert.equal(H.jobState({ every: 3, last: '2026-05-01' }, T), 'overdue');
  const done = H.markDone(Object.assign({}, job, { next: '2026-11-01' }), T, 'All fine', '95');
  assert.equal(done.last, T); assert.equal(done.next, ''); assert.equal(done.log[0].cost, 95);
  assert.equal(H.nextDue(done, T), '2027-10-27');
});

test('inventory totals by room, warranties ending, and the dashboard lists everything with a date, soonest first', async () => {
  const H = (await house()).house;
  const items = [{ id: 'tv', name: 'TV', room: 'Living room', price: 900, value: 600, warrantyUntil: '2026-11-20', receipt: 'x' }, { id: 'bike', name: 'Bike', room: 'Garage', price: 1200 }];
  const t = H.totals(items);
  assert.equal(t.total, 1800); assert.equal(t.rooms['Living room'], 600); assert.equal(t.missing, 1, 'one thing without a receipt or photo');
  const up = H.upcoming({ papers: [{ id: 'p', title: 'Passport', kind: 'id', expires: '2026-12-01' }], contracts: [{ id: 'g', name: 'Gym', end: '2026-12-15', notice: 1 }],
    upkeep: [{ id: 'u', task: 'Smoke alarms', every: 3, last: '2026-08-01' }], inventory: items, moves: [{ id: 'm', date: '2026-11-30', to: 'Utrecht' }] }, T);
  assert.deepEqual(plain(up.map((x) => x.app)), ['upkeep', 'contracts', 'inventory', 'moving', 'papers']);
  assert.equal(up[0].text, 'Smoke alarms');
});

test('letters fill in the household, the addressee and the contract, and leave what is unknown in brackets', async () => {
  const BW = await house(), H = BW.house;
  const tpl = H.LETTERS.find((l) => l.id === 'cancel');
  const out = H.fill(tpl.body, { me: H.me({ ownerName: 'Sam Jansen', address: 'Oudegracht 1', postcode: '3511 AA', city: 'Utrecht' }), to: { name: 'Fit & Co' }, c: { name: 'Gym membership', end: '2026-12-15' }, today: T });
  assert.match(out, /^Sam Jansen\nOudegracht 1\n3511 AA Utrecht/);
  assert.match(out, /Fit & Co\n\[address\]/);
  assert.match(H.fill('{{to.name}}\n{{to.address}}', { to: { name: 'Fit & Co', address: 'Fit & Co\nSportlaan 1' } }), /^Fit & Co\nSportlaan 1$/, 'the name is not written twice');
  assert.match(out, /Utrecht, 27 October 2026/);
  assert.match(out, /Reference: \[reference\]/);
  assert.match(out, /15 December 2026/);
  assert.ok(H.LETTERS.every((l) => l.id && l.name && l.body.includes('{{me.name}}')), 'every letter is signed');
  const tasks = H.moveTasks({ date: '2026-12-01' });
  assert.equal(tasks[0].due, '2026-10-06'); assert.equal(tasks.at(-1).due, '2026-12-31');
});

test('the Home suite has its own tools, folder key and details', async () => {
  const { BW } = await busywork(['shared/house.js']);
  BW.suite = 'house';
  assert.deepEqual(plain(BW.suiteApps().map((a) => a.id)), ['papers', 'contracts', 'upkeep', 'inventory', 'letters', 'moving', 'binder', 'juno']);
  assert.equal(BW.SUITES.house.key, ':house'); assert.equal(BW.SUITES.house.home, 'home.html');
});
