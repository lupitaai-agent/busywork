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
  const fixed = { name: 'Energy', end: '2026-11-27', renews: 'rolling', notice: 1, noticeUnit: 'month' };
  assert.equal(H.cancelBy(fixed, T), '', 'a fixed term that becomes cancel any time has no deadline to cancel by');
  assert.equal(H.contractState(fixed, T), 'term', 'but its end is the date to compare deals');
  assert.deepEqual(plain(H.decisions([fixed], T).map((d) => [d.kind, d.by])), [['term', '2026-11-27']]);
  assert.equal(H.decisionText(H.decisions([fixed], T)[0]), 'Fixed term ends: Energy');
  assert.equal(H.cancelBy({ end: '2027-01-31', renews: 'no', notice: 1 }, T), '', 'one that just ends needs nothing');
  assert.equal(H.contractState({ end: '2027-01-31', renews: 'no' }, T), 'ok');
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
  assert.deepEqual(plain(BW.suiteApps().map((a) => a.id)), ['papers', 'contracts', 'upkeep', 'inventory', 'letters', 'moving', 'binder', 'costs', 'juno']);
  assert.equal(BW.SUITES.house.key, ':house'); assert.equal(BW.SUITES.house.home, 'home.html');
});

// ---------- Busy Home 2.1: the whole household, shared costs, the renewal check ----------
test('the first members come from what the household typed: people and pets, any number, each with a colour', async () => {
  const H = (await house()).house;
  const m = plain(H.seedMembers('Sam de Boer', 'Noor, Mila (8), Opa Jan and Biscuit the dog; Minoes de kat'));
  assert.deepEqual(m.map((x) => [x.name, x.kind]), [['Sam', 'person'], ['Noor', 'person'], ['Mila', 'person'], ['Opa Jan', 'person'], ['Biscuit', 'pet'], ['Minoes', 'pet']]);
  assert.equal(m[2].notes, '8');
  assert.equal(m[4].species, 'dog'); assert.equal(m[5].species, 'cat');
  assert.equal(new Set(m.map((x) => x.colour)).size, 6, 'six members, six colours');
  assert.equal(H.seedMembers('Sam', 'Sam, sam').length, 1, 'nobody twice');
  assert.deepEqual(plain(H.seedMembers('', '')), []);
  // Nobody is dropped, and a pet needs more than a word that happens to be an animal.
  const odd = plain(H.seedMembers('', 'Cat, Leo; Hans Vogel, Larry Bird; O’Malley the cat; onze hond Max; Rex (dog); Kat en Vis'));
  assert.deepEqual(odd.map((x) => [x.name, x.kind]), [['Cat', 'person'], ['Leo', 'person'], ['Hans Vogel', 'person'], ['Larry Bird', 'person'], ['O’Malley', 'pet'], ['Max', 'pet'], ['Rex', 'pet'], ['Kat', 'person'], ['Vis', 'person']]);
  assert.equal(odd[6].species, 'dog'); assert.equal(odd[6].notes, undefined, 'the note that said "dog" is used up');
  // The same names give the same ids, so seeding twice (two renders, two computers) makes nobody twice.
  assert.deepEqual(plain(H.seedMembers('Sam', 'Noor').map((x) => x.id)), ['m-sam', 'm-noor']);
  assert.deepEqual(plain(H.seedMembers('Sam', 'Noor')), plain(H.seedMembers('Sam', 'Noor')));
});

test('a member who leaves: kept while in the shared costs, and their name comes off what they looked after', async () => {
  const BW = await house(), H = BW.house;
  assert.equal(H.memberInCosts('c', [{ paidBy: 'a', among: ['a', 'b'] }], []), false);
  assert.equal(H.memberInCosts('c', [{ paidBy: 'a', among: ['a', 'c'] }], []), true, 'shares a cost');
  assert.equal(H.memberInCosts('c', [{ paidBy: 'c', among: ['a', 'b'] }], []), true, 'paid one');
  assert.equal(H.memberInCosts('c', [{ paidBy: 'a', among: [] }], []), true, 'an older cost shared by everyone');
  assert.equal(H.memberInCosts('c', [], [{ from: 'c', to: 'a', amount: 5 }]), true, 'settled something');
  await BW.store.putMany('papers', [{ id: 'p1', title: 'Passport', who: 'c', private: 'yes' }, { id: 'p2', title: 'Lease', who: 'a', private: 'yes' }]);
  await BW.store.putMany('upkeep', [{ id: 'u1', task: 'Boiler', who: 'c' }]);
  await H.forgetMember('c');
  const papers = await BW.store.all('papers');
  assert.equal(papers.find((p) => p.id === 'p1').who, ''); assert.equal(papers.find((p) => p.id === 'p1').private, '', 'seen by everyone again, or nobody could find it');
  assert.equal(papers.find((p) => p.id === 'p2').who, 'a'); assert.equal(papers.find((p) => p.id === 'p2').private, 'yes');
  assert.equal((await BW.store.all('upkeep'))[0].who, '');
});

test('the tray guesses the kind from the file name, in six languages, without false friends', async () => {
  const H = (await house()).house;
  for (const n of ['Belastingaanslag 2026.pdf', '2026_tax_return.pdf', 'ING_bank_statement.pdf', 'Steuerbescheid.pdf', 'Imposta comunale.pdf', 'Receita Federal 2026.pdf', 'Banco extracto.pdf']) assert.equal(H.trayKind(n), 'money', n);
  for (const n of ['Receita médica.pdf', 'Tasse Geburtstag Foto.jpg', 'Impostazioni router.pdf', 'Bankstel garantie.pdf', 'Steuerung Heizung.pdf']) assert.equal(H.trayKind(n), 'other', n);
  assert.equal(H.trayKind('paspoort-noor.jpg'), 'id'); assert.equal(H.trayKind('Home_insurance_policy.pdf'), 'insurance');
});

test('who looks after what: by member, by nobody, and an old typed name still shows', async () => {
  const H = (await house()).house;
  const members = [{ id: 'a', name: 'Sam', kind: 'person', colour: 'sky' }, { id: 'b', name: 'Noor', kind: 'person' }, { id: 'c', name: 'Mila', kind: 'person' }, { id: 'p', name: 'Biscuit', kind: 'pet' }];
  const contracts = [{ id: 1, who: 'a' }, { id: 2, who: 'b' }, { id: 3 }], upkeep = [{ id: 4, who: 'a' }, { id: 5, who: 'the neighbour' }];
  assert.equal(H.whoName(members, 'b'), 'Noor');
  assert.equal(H.whoName(members, 'the neighbour'), 'the neighbour');
  assert.deepEqual(plain(H.lookedAfterBy(contracts, 'a').map((x) => x.id)), [1]);
  assert.deepEqual(plain(H.lookedAfterBy(contracts, 'nobody').map((x) => x.id)), [3]);
  const l = H.loads(members, { contracts, upkeep });
  assert.deepEqual(plain(l.rows.map((r) => [r.member.name, r.items.length])), [['Sam', 2], ['Noor', 1], ['Mila', 0]], 'pets carry nothing');
  assert.equal(l.nobody.length, 2); assert.equal(l.total, 5);
  assert.equal(H.people(members).length, 3); assert.equal(H.pets(members).length, 1);
});

test('a pet says when its next vaccination is due', async () => {
  const H = (await house()).house;
  const pet = { name: 'Biscuit', kind: 'pet', care: [{ what: 'Rabies', last: '2025-12-01', every: 12 }, { what: 'Check-up', next: '2026-11-10' }, { what: 'No date' }] };
  assert.deepEqual(plain(H.petDue(pet, T).map((d) => [d.what, d.date, d.left])), [['Check-up', '2026-11-10', 14], ['Rabies', '2026-12-01', 35]]);
});

test('shared costs: split between any number of people, to the cent', async () => {
  const H = (await house()).house;
  const members = [{ id: 'a', name: 'Sam', kind: 'person', share: 60 }, { id: 'b', name: 'Noor', kind: 'person', share: 40 }, { id: 'c', name: 'Opa', kind: 'person', share: 0 }, { id: 'p', name: 'Biscuit', kind: 'pet' }];
  assert.deepEqual(plain(H.owedParts({ amount: 100, split: 'equal' }, members)), { a: 3334, b: 3333, c: 3333 }, 'three people, the spare cent to the first');
  assert.deepEqual(plain(H.owedParts({ amount: 90, split: 'equal', among: ['a', 'b'] }, members)), { a: 4500, b: 4500 });
  assert.deepEqual(plain(H.owedParts({ amount: 100, split: 'income' }, members)), { a: 6000, b: 4000, c: 0 });
  assert.deepEqual(plain(H.owedParts({ amount: 50, split: 'shares', shares: { a: 1, b: 1, c: 3 } }, members)), { a: 1000, b: 1000, c: 3000 });
  assert.deepEqual(plain(H.owedParts({ amount: 10, split: 'shares', shares: {} }, members)), { a: 334, b: 333, c: 333 }, 'no weights: equal');
  assert.deepEqual(plain(H.owedParts({ amount: 10, among: ['p'] }, members)), {}, 'pets pay nothing');
  const costs = [{ amount: 120, paidBy: 'a', split: 'equal' }, { amount: 30, paidBy: 'b', split: 'equal', among: ['a', 'b'] }, { amount: 9, paidBy: 'x' }];
  const net = H.balance(costs, [], members);
  assert.deepEqual(plain(net), { a: 6500, b: -2500, c: -4000 });
  assert.equal(Object.values(net).reduce((s, v) => s + v, 0), 0, 'it always adds up to nothing');
  assert.deepEqual(plain(H.settleUp(net)), [{ from: 'c', to: 'a', amount: 40 }, { from: 'b', to: 'a', amount: 25 }]);
  const after = H.balance(costs, [{ from: 'c', to: 'a', amount: 40 }, { from: 'b', to: 'a', amount: 25 }], members);
  assert.deepEqual(plain(after), { a: 0, b: 0, c: 0 });
  assert.deepEqual(plain(H.settleUp(after)), []);
  assert.equal(H.costsOfMonth([{ date: '2026-10-03' }, { date: '2026-11-01' }], '2026-10').length, 1);
});

test('the renewal check: this year against last year, and when to start comparing energy deals', async () => {
  const H = (await house()).house;
  assert.deepEqual(plain(H.renewalChange({ cost: 660, lastCost: 600, per: 'year' })), { monthly: 5, yearly: 60, pct: 10, up: true });
  assert.equal(H.renewalChange({ cost: 55, lastCost: 60, per: 'month' }).up, false);
  assert.equal(H.renewalChange({ cost: 55, per: 'month' }), null);
  assert.equal(H.compareFrom({ kind: 'energy', end: '2027-01-31' }, T), '2026-12-13');
  assert.equal(H.compareFrom({ kind: 'phone', end: '2027-01-31' }, T), '');
});

test('everyone or just mine: mine and nobody’s, never someone else’s; private papers stay with their owner', async () => {
  const H = (await house()).house;
  const members = [{ id: 'a', name: 'Sam', kind: 'person' }, { id: 'b', name: 'Noor', kind: 'person' }];
  const list = [{ id: 1, who: 'a' }, { id: 2, who: 'b' }, { id: 3 }, { id: 4, who: 'the garage' }];
  assert.deepEqual(plain(H.forView(list, members, 'a', 'mine').map((x) => x.id)), [1, 3, 4]);
  assert.equal(H.forView(list, members, 'a', 'all').length, 4);
  assert.equal(H.forView(list, members, '', 'mine').length, 4, 'a computer that has not said who it is sees everything');
  assert.equal(H.forView(list, [members[0]], 'a', 'mine').length, 4, 'a household of one sees everything');
  const papers = [{ id: 1, private: true, who: 'a' }, { id: 2, private: true, who: 'b' }, { id: 3 }];
  assert.deepEqual(plain(H.visiblePapers(papers, 'a').map((p) => p.id)), [1, 3]);
  assert.equal(H.visiblePapers(papers, '').length, 3, 'a computer that has not said who it is sees everything, its own papers too');
});

test('tax time: the next deadline per country, when the season opens, and which year it is for', async () => {
  const H = (await house()).house;
  assert.deepEqual(plain(H.taxDates('nl', '2026-11-16')), { due: '2027-05-01', opens: '2027-03-01', left: 166, open: false, year: '2026' });
  assert.deepEqual(plain(H.taxDates('nl', '2026-03-10')), { due: '2026-05-01', opens: '2026-03-01', left: 52, open: true, year: '2025' });
  assert.deepEqual(plain(H.taxDates('uk', '2026-11-16')), { due: '2027-01-31', opens: '2026-04-06', left: 76, open: true, year: '2025-26' });
  assert.equal(H.taxDates('de', '2026-11-16').due, '2027-07-31');
  assert.equal(H.taxDates('de', '2026-11-16').year, '2026');
  assert.equal(H.taxDates('it', '2026-11-16').due, '2027-09-30');
  assert.equal(H.taxYearOf('uk', '2026-11-16'), '2026-27'); assert.equal(H.taxYearOf('uk', '2026-04-05'), '2025-26'); assert.equal(H.taxYearOf('nl', '2026-11-16'), '2026');
  assert.equal(H.taxCountry({ country: 'Deutschland' }, 'en'), 'de');
  assert.equal(H.taxCountry({ country: '' }, 'pt-br'), 'br');
  assert.equal(H.taxCountry({ taxCountry: 'es', country: 'Italia' }, 'nl'), 'es');
  // It never guesses: English without a country, a country Busy has no dates for, or "Not for me" give none.
  assert.equal(H.taxCountry({}, 'en'), '');
  assert.equal(H.taxCountry({ country: 'United Kingdom' }, 'en'), 'uk');
  assert.equal(H.taxCountry({ country: 'england' }, 'nl'), 'uk');
  assert.equal(H.taxCountry({ country: 'Ireland' }, 'en'), '');
  assert.equal(H.taxCountry({ country: 'United States' }, 'en'), '');
  assert.equal(H.taxCountry({ country: 'België' }, 'nl'), '');
  assert.equal(H.taxCountry({ country: 'Österreich' }, 'de'), '', 'Austria has other dates');
  assert.equal(H.taxCountry({ taxCountry: 'none', country: 'Nederland' }, 'nl'), '', 'switched off on the Tax time page');
  assert.equal(H.taxCountry({ taxCountry: 'uk' }, 'en'), 'uk', 'chosen on the Tax time page');
  assert.equal(H.taxPapers([{ taxYear: '2026' }, { taxYear: 2026 }, { taxYear: '2025' }, {}], '2026').length, 2);
  for (const t of Object.values(H.TAX)) { assert.ok(t.gather.length && t.keep.length && /^https:\/\//.test(t.link)); }
});

test('the dates list knows pets, energy deals and the tax return', async () => {
  const H = (await house()).house;
  const members = [{ id: 'p', name: 'Biscuit', kind: 'pet', species: 'dog', care: [{ what: 'Rabies', last: '2025-12-01', every: 12 }] }];
  const contracts = [{ id: 'e', name: 'Energy', kind: 'energy', end: '2027-01-02', renews: 'no' }];
  const up = H.upcoming({ members, contracts, tax: 'uk' }, T, 120);
  assert.deepEqual(plain(up.map((x) => [x.app, x.text, x.date])), [
    ['contracts', 'Compare energy deals: Energy', '2026-11-14'], ['people', 'Biscuit: Rabies', '2026-12-01'], ['tax', 'Tax return: Self Assessment', '2027-01-31']]);
  assert.equal(up[1].href, 'home-people.html');
  assert.deepEqual(plain(H.upcoming({ contracts }, '2026-12-01', 60).map((x) => [x.text, x.date])), [['Energy deal ends: Energy', '2027-01-02']], 'once comparing has started, the end date shows');
});

test('the demo household fits the schema, has more than two people, and every "who" points at a member', async () => {
  const { BW } = await busywork(['shared/schema.js', 'shared/house.js', 'shared/house-examples.js']);
  await BW.houseExamples.load();
  const all = {}, problems = [];
  for (const n of await BW.store.collections()) {
    all[n] = await BW.store.all(n);
    for (const r of Array.isArray(all[n]) ? all[n] : [all[n]]) problems.push(...BW.schema.check(n, r));
  }
  assert.deepEqual(problems, []);
  const H = BW.house, ids = new Set(all.members.map((m) => m.id));
  assert.ok(H.people(all.members).length > 2, 'a household bigger than a couple');
  // Upkeep may keep a name typed before 2.1 ("the neighbour's ladder"); documents and contracts point at members.
  for (const n of ['papers', 'contracts']) for (const r of all[n]) if (r.who) assert.ok(ids.has(r.who), `${n}: ${r.title || r.name} is looked after by a member`);
  assert.ok(all.upkeep.some((r) => ids.has(r.who)) && all.upkeep.some((r) => r.who && !ids.has(r.who)), 'both kinds of who in upkeep');
  const net = H.balance(all.costs, all.settlements, all.members);
  assert.equal(Object.values(net).reduce((s, v) => s + v, 0), 0);
  assert.ok(H.settleUp(net).length > 0, 'the demo has something to settle');
});

test('"Drop here" is made once in folder mode, on whichever Home page opens first, and never rewritten', async () => {
  const BW = await house(), H = BW.house;
  const writes = [];
  const drv = BW.drivers.memory({});
  const write = drv.writeFile;
  drv.kind = 'folder';
  drv.writeFile = async (p, b, o) => { writes.push(p); return write(p, b, o); };
  BW.useDriver(drv);
  await H.ensureDrop();
  assert.deepEqual(writes, ['Drop here/.busy'], 'made on the first page');
  H._dropMade = false; // the next page load
  await H.ensureDrop();
  assert.deepEqual(writes, ['Drop here/.busy'], 'already there: not written again (no needless cloud sync)');
  const other = (await house());
  const mem = other.drivers.memory({}), seen = [];
  const w2 = mem.writeFile; mem.writeFile = async (p, b, o) => { seen.push(p); return w2(p, b, o); };
  other.useDriver(mem);
  await other.house.ensureDrop();
  assert.deepEqual(seen, [], 'not in try-out or browser mode');
});
