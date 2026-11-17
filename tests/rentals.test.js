// Busy Rentals (shared/rentals.js): the country packs, what is due for a home, copies owed to the tenant,
// deposits, the rent ledger, the rent review, the landlord's year and the tax year's totals.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

async function rentals() { const { BW } = await busywork(['shared/rentals.js']); return BW; }
const T = '2026-11-16';

test('every country pack is complete: each duty has an id, words, a rhythm and an official source with https', async () => {
  const R = (await rentals()).rentals;
  for (const [code, p] of Object.entries(R.PACKS)) {
    assert.ok(p.name && p.currency && /^\d{4}-\d\d-\d\d$/.test(p.checked), code);
    const ids = new Set();
    for (const d of p.duties) {
      assert.ok(d.id && d.what && d.emoji && ['home', 'tenancy'].includes(d.per), `${code}.${d.id}`);
      assert.ok(d.every || d.start || d.md || /^\d{4}-\d\d-\d\d$/.test(d.due || ''), `${code}.${d.id} has a rhythm or a deadline`);
      assert.match(d.source, /^https:\/\//, `${code}.${d.id} source`);
      assert.ok(!ids.has(d.id), `${code}.${d.id} once`); ids.add(d.id);
    }
    for (const y of p.year) assert.ok(/^\d\d-\d\d$/.test(y.md) && /^https:\/\//.test(y.source), `${code} year ${y.what}`);
    assert.ok((p.deposit.capWeeks || p.deposit.capMonths) && p.deposit.capWhat, `${code} deposit cap, in numbers and in words`);
    for (const k of p.know || []) assert.ok(k.what && /^https:\/\//.test(k.source), `${code} good to know: ${k.what}`);
    assert.match(p.rentReview.source, /^https:\/\//);
  }
  assert.deepEqual(Object.keys(R.PACKS), ['england', 'nl', 'de']);
});

test('which country a home follows: its own, the landlord’s, then the language; unknown gets none', async () => {
  const R = (await rentals()).rentals;
  assert.equal(R.countryOf({ country: 'nl' }, { country: 'England' }, 'en'), 'nl');
  assert.equal(R.countryOf({}, { country: 'United Kingdom' }, 'nl'), 'england');
  assert.equal(R.countryOf({ country: 'Deutschland' }, {}, 'en'), 'de');
  assert.equal(R.countryOf({}, {}, 'de'), 'de');
  assert.equal(R.countryOf({}, {}, 'es'), '', 'Spain has no pack yet');
  // "Another country" is a choice, not a blank: it never falls back to the language's country.
  assert.equal(R.countryOf({}, { country: 'other' }, 'en'), '', 'a landlord elsewhere, English screen: no pack');
  assert.equal(R.countryOf({ country: 'other' }, { country: 'nl' }, 'nl'), '', 'a home elsewhere of a Dutch landlord: no pack');
  assert.equal(R.countryOf({ country: 'Spain' }, { country: 'england' }, 'en'), '', 'a named country without a pack');
  assert.equal(R.countryOf({ country: '' }, { country: 'nl' }, 'en'), 'nl', 'a blank home still follows the landlord');
});

test('what is due for a home in England: the gas check yearly, its copy within 28 days, the start-of-tenancy checks', async () => {
  const R = (await rentals()).rentals;
  const home = { id: 'h', name: 'Flat 2' }, ten = [{ id: 't', homeId: 'h', start: '2026-03-01', rent: 1200 }];
  const checks = [{ homeId: 'h', duty: 'gas', last: '2025-12-01' }, { homeId: 'h', duty: 'eicr', last: '2024-01-10', handedOverAt: '2024-01-20' }, { homeId: 'h', duty: 'alarms', tenancyId: 't', last: '2026-03-01' }];
  const d = R.dutiesFor(home, 'england', ten, checks, T), by = Object.fromEntries(d.map((x) => [x.duty.id, x]));
  assert.equal(by.gas.date, '2026-12-01'); assert.equal(by.gas.state, 'soon');
  assert.deepEqual(plain(by.gas.handOver), { state: 'owed', by: '2026-03-01', left: -260 }, 'a check from before the tenancy: the copy is owed by the day they moved in');
  assert.equal(by.eicr.date, '2029-01-10'); assert.equal(by.eicr.handOver.state, 'owed', 'the copy of 2024 went to whoever lived there then, not to this tenant');
  const during = R.dutiesFor(home, 'england', ten, [{ homeId: 'h', duty: 'gas', last: '2026-10-30' }], T).find((x) => x.duty.id === 'gas');
  assert.deepEqual(plain(during.handOver), { state: 'owed', by: '2026-11-27', left: 11 }, 'a check during the tenancy: within 28 days');
  assert.equal(by.epc.state, 'unknown', 'never recorded');
  assert.equal(by.alarms.state, 'done');
  assert.equal(by.righttorent.state, 'overdue', 'due on the tenancy start, not recorded');
  assert.equal(by.licence, undefined, 'optional duties only when chosen for the home');
  assert.ok(R.dutiesFor(Object.assign({ duties: ['licence'] }, home), 'england', ten, checks, T).some((x) => x.duty.id === 'licence'));
  assert.equal(d[0].state, 'overdue', 'overdue first');
});

test('a yearly statement falls on its date: Germany by 31 December, the Netherlands by 30 June', async () => {
  const R = (await rentals()).rentals;
  const st = (code, id, start, checks, today = T) => { const x = R.dutiesFor({ id: 'h', duties: ['service'] }, code, [{ id: 't', homeId: 'h', start, rent: 900 }], checks, today).find((d) => d.duty.id === id); return [x.date, x.state]; };
  // Germany: the statement for a year is due by 31 December of the next year.
  assert.deepEqual(st('de', 'statement', '2025-03-01', []), ['2026-12-31', 'soon'], 'the first one, for 2025');
  assert.deepEqual(st('de', 'statement', '2024-01-01', []), ['2025-12-31', 'overdue'], 'never sent: the one for 2024 is overdue');
  assert.deepEqual(st('de', 'statement', '2024-01-01', [], '2027-01-01'), ['2025-12-31', 'overdue'], 'a missed date stays overdue, it does not roll on to next year');
  assert.deepEqual(st('de', 'statement', '2024-01-01', [{ homeId: 'h', duty: 'statement', last: '2026-11-01' }]), ['2027-12-31', 'ok'], 'sent this year: next year’s');
  assert.deepEqual(st('de', 'statement', '2024-01-01', [{ homeId: 'h', duty: 'statement', last: '2026-02-10' }]), ['2027-12-31', 'ok'], 'sent early in the year: still next year’s, not this December again');
  assert.deepEqual(st('de', 'statement', '2024-01-01', [{ homeId: 'h', duty: 'statement', last: '2025-12-20' }], '2026-01-05'), ['2026-12-31', 'ok']);
  assert.deepEqual(st('de', 'statement', '2026-11-01', []), ['2027-12-31', 'ok'], 'a tenancy that started this year: nothing due this December');
  // The Netherlands: by 30 June, for the year before.
  assert.deepEqual(st('nl', 'service', '2026-02-01', []), ['2027-06-30', 'ok'], 'started this year: the first one is for 2026, by 30 June 2027');
  assert.deepEqual(st('nl', 'service', '2025-03-01', [], '2026-07-01'), ['2026-06-30', 'overdue'], 'missed 30 June');
  assert.deepEqual(st('nl', 'service', '2024-01-01', [{ homeId: 'h', duty: 'service', last: '2026-06-25' }], '2026-06-26'), ['2027-06-30', 'ok']);
  assert.deepEqual(st('nl', 'service', '2024-01-01', [{ homeId: 'h', duty: 'service', last: '2025-08-20' }], '2026-05-01'), ['2026-06-30', 'soon'], 'sent late last year: this year’s is still to come');
  // A statement another tenant got, or one from before this tenancy, is not this tenant's.
  assert.deepEqual(st('de', 'statement', '2025-03-01', [{ homeId: 'h', duty: 'statement', tenancyId: 'earlier', last: '2026-10-01' }]), ['2026-12-31', 'soon']);
  assert.deepEqual(st('de', 'statement', '2025-03-01', [{ homeId: 'h', duty: 'statement', last: '2025-02-01' }]), ['2026-12-31', 'soon']);
  assert.equal(R.dutiesFor({ id: 'empty' }, 'de', [{ id: 't', homeId: 'h', start: '2024-01-01', rent: 900 }], [], T).some((x) => x.duty.id === 'statement'), false, 'no tenancy, no statement');
  // The words stay as careful as the dates: the notes say "for the year before" and "of the next year", no more.
  assert.match(R.pack('nl').duties.find((d) => d.id === 'service').note, /^By 30 June, for the year before\./);
  assert.match(R.pack('de').duties.find((d) => d.id === 'statement').note, /by 31 December of the next year/);
});

test('deposits: the cap per country, the date to protect it in England, the date to return it in the Netherlands', async () => {
  const R = (await rentals()).rentals;
  assert.equal(R.depositCap('england', { rent: 1300 }), 1500, '5 weeks of £1,300 a month');
  assert.equal(R.depositCap('nl', { rent: 1000 }), 2000);
  assert.equal(R.depositCap('de', { rent: 800 }), 2400);
  assert.equal(R.depositCap('england', { rent: 300, rentPer: 'week' }), 1500);
  assert.equal(R.depositCap('england', { rent: 1000, rentPer: 'week' }), 6000, '6 weeks when the rent is £50,000 a year or more');
  assert.equal(R.depositCap('england', { rent: 961, rentPer: 'week' }), 4805, 'just under £50,000 a year: 5 weeks');
  const e = R.depositState('england', { start: '2026-11-01', rent: 1300, deposit: 1600 }, T);
  assert.equal(e.over, true); assert.equal(e.protectBy, '2026-12-01'); assert.equal(e.protectLeft, 15);
  assert.equal(R.depositState('england', { start: '2026-11-01', rent: 1300, deposit: 1500, depositProtectedAt: '2026-11-03' }, T).protectBy, undefined);
  const n = R.depositState('nl', { start: '2025-01-01', rent: 1000, deposit: 2000, endedAt: '2026-11-10' }, T);
  assert.equal(n.over, false); assert.equal(n.returnBy, '2026-11-24');
  assert.equal(R.depositState('nl', { start: '2025-01-01', rent: 1000, deposit: 2000, endedAt: '2026-11-10', deductions: 'cleaning' }, T).returnBy, '2026-12-10');
  assert.ok(R.depositState('de', { start: '2025-01-01', rent: 800, deposit: 2400, endedAt: '2026-11-10' }, T).returnWhat, 'Germany: no fixed date, the words say so');
});

test('the rent ledger: what was due, what was paid, what is late', async () => {
  const R = (await rentals()).rentals;
  const t = { id: 't', start: '2026-08-15', rent: 1000, payDay: 1 };
  const pays = [{ tenancyId: 't', month: '2026-08', amount: 1000 }, { tenancyId: 't', month: '2026-09', amount: 1000 }, { tenancyId: 't', month: '2026-10', amount: 400 }, { tenancyId: 'x', month: '2026-11', amount: 1000 }];
  const s = R.rentStatus(t, pays, T);
  assert.deepEqual(plain(s.months.map((m) => [m.month, m.paid, m.open, m.late])), [['2026-08', 1000, 0, false], ['2026-09', 1000, 0, false], ['2026-10', 400, 600, true], ['2026-11', 0, 1000, true]]);
  assert.equal(s.open, 1600); assert.equal(s.monthsLate, 2);
  assert.equal(R.rentStatus(Object.assign({}, t, { payDay: 28 }), pays, T).monthsLate, 1, 'November is not late before its payment day');
  assert.equal(R.rentDue(Object.assign({}, t, { endedAt: '2026-09-30' }), '2026-11').length, 2, 'no rent after the end');
});

test('the rent review: the earliest date per country', async () => {
  const R = (await rentals()).rentals;
  assert.equal(R.rentReviewFrom('england', { start: '2026-03-01' }), '2027-03-01');
  assert.equal(R.rentReviewFrom('de', { start: '2025-01-01', lastRentChange: '2025-06-01' }), '2026-09-01', '15 months in Germany');
});

test('the landlord’s year and everything coming up across homes', async () => {
  const R = (await rentals()).rentals;
  const y = R.yearDates('england', T);
  assert.equal(y[0].date, '2027-01-31'); assert.ok(!y.some((x) => /Making Tax Digital/.test(x.what)), 'quarterly updates only when they apply');
  assert.equal(R.yearDates('england', T, { mtd: true }).filter((x) => /Making Tax Digital/.test(x.what)).length, 4);
  const homes = [{ id: 'h', name: 'Flat 2', country: 'england' }], tenancies = [{ id: 't', homeId: 'h', start: '2026-11-01', rent: 1300, deposit: 1500 }];
  const up = R.upcoming({ homes, tenancies, checks: [{ homeId: 'h', duty: 'gas', last: '2025-12-10' }] }, {}, 'en', T, 60);
  const kinds = up.map((x) => x.kind);
  assert.ok(kinds.includes('deposit') && kinds.includes('duty') && kinds.includes('handover'));
  assert.ok(up.every((x, i) => !i || up[i - 1].date <= x.date), 'by date');
});

test('the tax year: rent received and costs per home, England from 6 April', async () => {
  const R = (await rentals()).rentals;
  assert.deepEqual(plain(R.taxYearRange('england', '2026')), ['2026-04-06', '2027-04-05']);
  const homes = [{ id: 'h' }], tenancies = [{ id: 't', homeId: 'h' }];
  const payments = [{ tenancyId: 't', date: '2026-04-01', amount: 1000 }, { tenancyId: 't', date: '2026-05-01', amount: 1000 }];
  const costs = [{ homeId: 'h', date: '2026-06-01', amount: 120, kind: 'repairs' }, { homeId: 'h', date: '2026-07-01', amount: 80, kind: 'insurance' }];
  const [r] = R.taxYear('england', '2026', { homes, tenancies, payments, costs });
  assert.equal(r.rent, 1000, 'April 1 belongs to the year before');
  assert.deepEqual(plain(r.costs), { repairs: 120, insurance: 80 }); assert.equal(r.net, 800);
});

test('letters to tenants: every template filled, with what is unknown left in brackets', async () => {
  const R = (await rentals()).rentals;
  for (const l of ['en', 'nl', 'de', 'es', 'it', 'pt-br']) for (const t of R.LETTERS) { const x = R.LETTER_TEXT[l][t.id]; assert.ok(x && x[0] && x[1].includes('{{me.name}}'), `${l}.${t.id}`); assert.ok(!/[—–]/.test(x[1]), `${l}.${t.id} has no long dashes`); }
  const f = R.fillLetter('welcome', 'nl', { s: { ownerName: 'Marieke de Vries', phone: '06 1234 5678' }, home: { name: 'De flat', address: 'Oudegracht 2', city: 'Utrecht' }, t: { tenants: 'Noor Visser', rent: 1100, payDay: 1 }, today: '2026-11-16' });
  assert.equal(f.lang, 'nl'); assert.match(f.body, /Beste Noor Visser/); assert.match(f.body, /Oudegracht 2, Utrecht/); assert.match(f.body, /\[email\]/, 'unknown details stay in brackets');
  assert.equal(R.fillLetter('access', 'england', { t: {}, today: '2026-11-16' }).lang, 'en');
  assert.equal(R.fillLetter('access', '', { t: {}, today: '2026-11-16' }).lang, 'en', 'another country: English');
});

test('check-in against check-out: a room that got worse is marked; a room in only one report says so', async () => {
  const R = (await rentals()).rentals;
  const a = { rooms: [{ room: 'Kitchen', condition: 'good' }, { room: 'Bathroom', condition: 'fair' }, { room: 'Hallway', condition: 'good' }] };
  const b = { rooms: [{ room: 'Kitchen', condition: 'fair' }, { room: 'Bathroom', condition: 'fair' }, { room: 'Study', condition: 'good' }] };
  const c = R.compareReports(a, b);
  assert.deepEqual(plain(c.map((x) => [x.room, x.worse, x.missing])), [['Kitchen', true, false], ['Bathroom', false, false], ['Hallway', false, true], ['Study', false, true]]);
  assert.equal(R.compareReports(a, { rooms: [{ room: 'Kitchen', condition: '' }] })[0].worse, false, 'no condition yet: nothing to say');
});

test('a one-off deadline: German heat meters by 31 December 2026, only where chosen, done once recorded', async () => {
  const R = (await rentals()).rentals;
  const home = { id: 'h', duties: ['heatmeters'] };
  const d = R.dutiesFor(home, 'de', [], [], T).find((x) => x.duty.id === 'heatmeters');
  assert.equal(d.date, '2026-12-31'); assert.equal(d.state, 'soon');
  assert.equal(R.dutiesFor({ id: 'h' }, 'de', [], [], T).some((x) => x.duty.id === 'heatmeters'), false, 'optional: only where heating is shared and billed by use');
  const done = R.dutiesFor(home, 'de', [], [{ homeId: 'h', duty: 'heatmeters', last: '2026-11-01' }], T).find((x) => x.duty.id === 'heatmeters');
  assert.equal(done.state, 'done');
  assert.equal(R.dutiesFor(home, 'de', [], [], '2027-01-05').find((x) => x.duty.id === 'heatmeters').state, 'overdue');
});

test('every letter in six languages: the same fields filled in, the same number of [brackets], no long dashes', async () => {
  const R = (await rentals()).rentals;
  assert.deepEqual(plain(R.LETTER_LANGS.map((l) => l[0])), ['en', 'nl', 'de', 'es', 'it', 'pt-br']);
  const fields = (x) => (x.match(/\{\{[\w.]+\}\}/g) || []).sort().join(' ');
  const brackets = (x) => (x.match(/\[[^\]]+\]/g) || []).length;
  for (const t of R.LETTERS) {
    const en = R.LETTER_TEXT.en[t.id];
    for (const [l] of R.LETTER_LANGS) {
      const x = R.LETTER_TEXT[l][t.id];
      assert.ok(x && x[0] && x[1], `${l}.${t.id} exists`);
      assert.equal(fields(x[0] + x[1]), fields(en[0] + en[1]), `${l}.${t.id}: the same {{fields}} as the English`);
      assert.equal(brackets(x[1]), brackets(en[1]), `${l}.${t.id}: as many [brackets] as the English`);
      assert.ok(!/[\u2014\u2013]/.test(x[0] + x[1]), `${l}.${t.id}: no long dashes`);
    }
  }
});

test("the letter's language: the home's country by default, else the app's; a tenancy's own choice wins", async () => {
  const R = (await rentals()).rentals;
  assert.equal(R.letterLang('england', 'nl'), 'en');
  assert.equal(R.letterLang('nl', 'en'), 'nl');
  assert.equal(R.letterLang('de', 'es'), 'de');
  assert.equal(R.letterLang('', 'it'), 'it', 'another country: the app\'s language');
  assert.equal(R.letterLang('', 'xx'), 'en');
  assert.equal(R.letterLangFor('nl', { letterLang: 'es' }, 'en'), 'es', 'the tenant prefers Spanish');
  const f = R.fillLetter('deposit', 'nl', { s: { ownerName: 'Femke' }, home: { address: 'Beukenlaan 7' }, t: { tenants: 'Lucas', deposit: 1960, letterLang: 'pt-br' }, today: '2026-11-16' });
  assert.equal(f.lang, 'pt-br'); assert.match(f.body, /Prezado\(a\) Lucas/); assert.match(f.body, /1\.960,00/, 'the amount in the letter\'s own format, in euros as in the Netherlands');
  assert.equal(R.fillLetter('welcome', 'nl', { t: { letterLang: 'de' }, lang: 'it', today: '2026-11-16' }).lang, 'it', 'an explicit choice wins');
});

// ---------- after the code review of 17 November 2026 ----------

test('a typed amount: one separator with exactly three digits after it is thousands', async () => {
  const R = (await rentals()).rentals;
  assert.equal(R.amount('1.250'), 1250, 'Dutch and German thousands');
  assert.equal(R.amount('1,000'), 1000, 'English thousands');
  assert.equal(R.amount('1.250.000'), 1250000); assert.equal(R.amount('12,345,678'), 12345678);
  assert.equal(R.amount('€ 1.250'), 1250); assert.equal(R.amount('£1,250.50'), 1250.5); assert.equal(R.amount('1.250,50'), 1250.5);
  assert.equal(R.amount('12,5'), 12.5); assert.equal(R.amount('12.50'), 12.5); assert.equal(R.amount('950'), 950); assert.equal(R.amount('0.125'), 0.125);
  assert.equal(R.amount(1250.5), 1250.5); assert.equal(R.amount(''), 0); assert.equal(R.amount('abc'), 0); assert.equal(R.amount(null), 0);
  // and the ledger, the deposit and the tax year all read what was typed that way
  assert.equal(R.rentDue({ start: '2026-11-01', rent: '1.250' }, '2026-11')[0].amount, 1250);
  assert.equal(R.depositState('nl', { start: '2026-11-01', rent: '1.250', deposit: '2.500' }, T).over, false);
  assert.equal(R.rentStatus({ id: 't', start: '2026-10-01', rent: '1,000' }, [{ tenancyId: 't', amount: '1.000' }], '2026-10-20').open, 0);
  assert.equal(R.taxYear('nl', '2026', { homes: [{ id: 'h' }], costs: [{ homeId: 'h', date: '2026-03-01', amount: '1.250' }] })[0].totalCosts, 1250);
});

test('the pay day: the month’s last day when the month has no such day, and whole days 1 to 31 only', async () => {
  const R = (await rentals()).rentals;
  const dues = (payDay, to) => plain(R.rentDue({ start: '2026-10-01', rent: 1000, payDay }, to).map((m) => m.due));
  assert.deepEqual(dues(31, '2027-02'), ['2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  assert.deepEqual(dues(30, '2027-02').slice(-1), ['2027-02-28']);
  assert.deepEqual(dues(29, '2027-02').slice(-2), ['2027-01-29', '2027-02-28']);
  assert.equal(R.rentDue({ start: '2028-02-01', rent: 1000, payDay: 30 }, '2028-02')[0].due, '2028-02-29', 'a leap year');
  // paid up to October: on 29 November a rent due on the 30th is not late yet, on 1 December it is
  const t = { id: 'p', start: '2026-10-01', rent: 1000, payDay: 31 }, paid = [{ tenancyId: 'p', month: '2026-10', amount: 1000 }];
  assert.equal(R.rentStatus(t, paid, '2026-11-29').monthsLate, 0);
  assert.equal(R.rentStatus(t, paid, '2026-11-30').monthsLate, 0, 'not late on the pay day itself');
  assert.equal(R.rentStatus(t, paid, '2026-12-01').monthsLate, 1);
  for (const [typed, day] of [['15', 15], [' 7 ', 7], [31, 31], ['0', 1], ['-5', 1], ['32', 1], ['1.5', 1], [1.5, 1], ['abc', 1], ['', 1], [undefined, 1]]) assert.equal(R.payDay({ payDay: typed }), day, `pay day ${typed}`);
  assert.equal(R.rentDue({ start: '2026-08-15', rent: 1000, payDay: 1 }, '2026-09')[0].due, '2026-08-15', 'the first rent is never due before the tenancy starts');
});

test('a rent change keeps history: earlier months keep the rent they had', async () => {
  const R = (await rentals()).rentals;
  const t0 = { id: 't', start: '2026-01-01', rent: 1000, payDay: 1 };
  const t = R.changeRent(t0, 1100, '2026-07-01');
  assert.equal(t0.rents, undefined, 'the tenancy it was given is not changed');
  assert.deepEqual(plain(t.rents), [{ from: '2026-01-01', rent: 1000 }, { from: '2026-07-01', rent: 1100 }]);
  assert.equal(t.rent, 1100); assert.equal(t.lastRentChange, '2026-07-01');
  assert.equal(R.rentAt(t, '2026-06-30'), 1000); assert.equal(R.rentAt(t, '2026-07-01'), 1100); assert.equal(R.rentAt(t, '2025-01-01'), 1000, 'before the first entry: the first rent');
  assert.equal(R.rentAt(t0, '2020-01-01'), 1000, 'no history: always the rent');
  // every month paid at the rent of its own time: nothing open, nothing late
  const pays = []; for (let m = 1; m <= 11; m++) pays.push({ tenancyId: 't', month: `2026-${String(m).padStart(2, '0')}`, amount: m >= 7 ? 1100 : 1000 });
  const s = R.rentStatus(t, pays, T);
  assert.equal(s.open, 0); assert.equal(s.monthsLate, 0);
  assert.deepEqual(plain(s.months.map((m) => m.amount)), [1000, 1000, 1000, 1000, 1000, 1000, 1100, 1100, 1100, 1100, 1100]);
  // a third rent, a change on the same date again (a correction), one recorded out of order
  const t3 = R.changeRent(t, 1150, '2027-01-01');
  assert.equal(t3.rents.length, 3); assert.equal(t3.rent, 1150);
  assert.equal(R.rentNow(t3, T).amount, 1100, 'a rent that applies from a later date is not charged or shown before it');
  assert.equal(R.changeRent(t3, 1175, '2027-01-01').rents.length, 3); assert.equal(R.changeRent(t3, 1175, '2027-01-01').rent, 1175);
  const mid = R.changeRent(t, 1050, '2026-04-01');
  assert.deepEqual(plain(mid.rents.map((x) => x.rent)), [1000, 1050, 1100]); assert.equal(mid.rent, 1100, 'the latest entry stays the current rent'); assert.equal(mid.lastRentChange, '2026-07-01');
  // "Rent" in the tenancy form is a correction of the current figure: the latest entry follows it
  const typed = Object.assign({}, t, { rent: '1.120' });
  assert.equal(R.rentAt(typed, '2026-08-01'), 1120); assert.equal(R.rentAt(typed, '2026-03-01'), 1000);
  assert.deepEqual(plain(R.syncRent(typed).rents), [{ from: '2026-01-01', rent: 1000 }, { from: '2026-07-01', rent: 1120 }]);
  // taken back: the rent is what it was before; a history of one entry is none
  const back = R.dropRent(t);
  assert.equal(back.rent, 1000); assert.deepEqual(plain(back.rents), []); assert.equal(back.lastRentChange, '');
  assert.equal(R.dropRent(t3).rent, 1100); assert.equal(R.dropRent(t3).lastRentChange, '2026-07-01');
  // nonsense changes nothing
  assert.equal(R.changeRent(t0, 0, '2026-07-01').rents, undefined); assert.equal(R.changeRent(t0, 1100, 'soon').rent, 1000);
  assert.equal(R.rentReviewFrom('england', t), '2027-07-01', 'the review counts from the last change');
  assert.equal(R.monthlyRent(t), 1100); assert.equal(R.monthlyRent(t, '2026-03-01'), 1000);
});

test('a running balance: payments fill the oldest month first', async () => {
  const R = (await rentals()).rentals;
  const t = { id: 'o', start: '2026-09-01', rent: 1000, payDay: 1 };
  let s = R.rentStatus(t, [{ tenancyId: 'o', month: '2026-09', amount: 1000 }, { tenancyId: 'o', month: '2026-10', amount: 2000 }], T);
  assert.equal(s.open, 0, 'October and November paid in one go'); assert.equal(s.monthsLate, 0);
  assert.deepEqual(plain(s.months.map((m) => [m.month, m.paid, m.open, m.received])), [['2026-09', 1000, 0, 1000], ['2026-10', 1000, 0, 2000], ['2026-11', 1000, 0, 0]]);
  s = R.rentStatus(t, [{ tenancyId: 'o', date: '2026-08-28', amount: 1000 }, { tenancyId: 'o', month: '2026-10', amount: 1000 }, { tenancyId: 'o', month: '2026-11', amount: 1000 }], T);
  assert.equal(s.open, 0, 'the first rent paid before the start, without a month, counts');
  s = R.rentStatus(t, [{ tenancyId: 'o', month: '2026-09', amount: 4500 }], T);
  assert.equal(s.open, 0); assert.equal(s.credit, 1500, 'paid ahead of everything due this month'); assert.equal(s.paid, 4500);
  s = R.rentStatus(t, [{ tenancyId: 'o', month: '2026-11', amount: 1000 }], T);
  assert.deepEqual(plain(s.months.map((m) => [m.month, m.open, m.late])), [['2026-09', 0, false], ['2026-10', 1000, true], ['2026-11', 1000, true]], 'a payment noted for November first settles September');
  assert.equal(s.open, 2000); assert.equal(s.monthsLate, 2);
  s = R.rentStatus(t, [{ tenancyId: 'o', month: '2026-09', amount: 1000 }, { tenancyId: 'o', month: '2026-10', amount: 1000 }], '2026-11-01');
  assert.equal(s.open, 0, 'November is open but not late on its pay day'); assert.equal(s.months[2].open, 1000); assert.equal(s.months[2].late, false);
  assert.equal(R.rentStatus(t, [{ tenancyId: 'o', amount: 0.1 }, { tenancyId: 'o', amount: 0.2 }, { tenancyId: 'o', amount: 999.7 }], '2026-09-15').open, 0, 'cents add up');
  // an ended tenancy's arrears do not go away
  const gone = { id: 'e', start: '2026-06-01', endedAt: '2026-09-30', rent: 800, payDay: 1 };
  s = R.rentStatus(gone, [{ tenancyId: 'e', amount: 2400 }], T);
  assert.equal(s.months.length, 4); assert.equal(s.open, 800); assert.equal(s.monthsLate, 1);
  assert.equal(R.lateText(s), '1 month late'); assert.equal(R.lateText({ per: 'month', monthsLate: 3 }), '3 months late');
});

test('a weekly rent: charged on every pay day (the weekday of the start), so a tenant who pays every week is never late', async () => {
  const { BW } = await busywork(['shared/rentals.js']), R = BW.rentals;
  const w = { id: 'w', start: '2026-01-01', rent: 300, rentPer: 'week' };   // a Thursday
  const pays = []; for (let d = '2026-01-02'; d <= '2026-11-13'; d = BW.addDays(d, 7)) pays.push({ tenancyId: 'w', date: d, amount: 300 });
  let s = R.rentStatus(w, pays, '2026-11-17');
  assert.equal(s.open, 0); assert.equal(s.monthsLate, 0); assert.equal(s.weeksLate, 0); assert.equal(s.per, 'week');
  const due = R.rentDue(w, '2026-11');
  assert.deepEqual(plain(due.slice(0, 2).map((m) => [m.month, m.amount, m.dues.length, m.due])), [['2026-01', 1500, 5, '2026-01-01'], ['2026-02', 1200, 4, '2026-02-05']], 'five Thursdays in January, four in February');
  assert.equal(due.reduce((n, m) => n + m.dues.length, 0), 48, 'every Thursday of the eleven months, once');
  // two weeks missed: two weeks late, in one month
  s = R.rentStatus(w, pays.slice(0, -2), '2026-11-17');
  assert.equal(s.open, 600); assert.equal(s.weeksLate, 2); assert.equal(s.monthsLate, 1); assert.equal(R.lateText(s), '2 weeks late');
  assert.equal(R.lateText({ per: 'week', weeksLate: 1 }), '1 week late');
  // on a pay day itself that week is not late yet
  assert.equal(R.rentStatus(w, pays, '2026-11-19').weeksLate, 0); assert.equal(R.rentStatus(w, pays, '2026-11-20').weeksLate, 1);
  // no rent after the tenancy ended, and a weekly rent that changed
  assert.equal(R.rentDue(Object.assign({}, w, { endedAt: '2026-01-20' }), '2026-03').reduce((n, m) => n + m.dues.length, 0), 3);
  const up = R.changeRent(w, 320, '2026-02-01');
  assert.deepEqual(plain(R.rentDue(up, '2026-02').map((m) => m.amount)), [1500, 1280]);
  // the monthly figure stays for totals and the deposit cap; the screens and letters say the weekly amount
  assert.equal(R.monthlyRent(w), 1300); assert.deepEqual(plain(R.rentNow(w, T)), { amount: 300, per: 'week' }); assert.deepEqual(plain(R.rentNow({ rent: 950 }, T)), { amount: 950, per: 'month' });
  const f = R.fillLetter('welcome', 'england', { s: { ownerName: 'Ann' }, home: { name: 'Flat 2' }, t: w, today: T });
  assert.match(f.body, /The rent is £300\.00 a week, due every Thursday\./); assert.doesNotMatch(f.body, /a month/);
  assert.match(R.fillLetter('welcome', 'nl', { t: w, today: T }).body, /€\s?300,00 per week, te betalen elke donderdag\./);
  assert.match(R.fillLetter('welcome', 'england', { t: { tenants: 'Bo', rent: 900, payDay: 31 }, today: T }).body, /£900\.00 a month, due on day 31 of each month/);
  // the weekly line can only take the monthly line's place while that line stands in the letter as written here
  for (const [l] of R.LETTER_LANGS) { assert.ok(R.LETTER_TEXT[l].welcome[1].includes(R.LETTER_WEEKLY[l][0]), `${l}: the monthly rent line is in the welcome letter`); assert.match(R.LETTER_WEEKLY[l][1], /\{\{t\.rent\}\}.*\{\{t\.payWeekday\}\}/, l); }
});

test('a duty done at the start of a tenancy: another tenant’s check does not count; the home’s own stays done', async () => {
  const R = (await rentals()).rentals;
  const by = (list) => Object.fromEntries(list.map((x) => [x.duty.id, x]));
  const ten = [{ id: 'A', homeId: 'h', start: '2026-10-01', endedAt: '2026-10-31', rent: 1000 }, { id: 'B', homeId: 'h', start: '2026-11-10', rent: 1000 }];
  let d = by(R.dutiesFor({ id: 'h' }, 'england', ten, [{ homeId: 'h', tenancyId: 'A', duty: 'righttorent', last: '2026-10-01' }], T));
  assert.equal(d.righttorent.state, 'overdue', 'checked for tenant A six weeks ago: still to do for tenant B'); assert.equal(d.righttorent.check, null);
  d = by(R.dutiesFor({ id: 'h' }, 'england', ten, [{ homeId: 'h', tenancyId: 'A', duty: 'righttorent', last: '2026-10-01' }, { homeId: 'h', tenancyId: 'B', duty: 'righttorent', last: '2026-11-08' }], T));
  assert.equal(d.righttorent.state, 'done'); assert.equal(d.righttorent.check.tenancyId, 'B');
  d = by(R.dutiesFor({ id: 'h' }, 'england', ten, [{ homeId: 'h', duty: 'alarms', last: '2026-11-01' }, { homeId: 'h', duty: 'righttorent', last: '2026-08-01' }], T));
  assert.equal(d.alarms.state, 'done', 'without a tenancy on the record: up to 60 days before the start counts'); assert.equal(d.righttorent.state, 'overdue', 'longer ago does not');
  const one = [{ id: 'A', homeId: 'h', start: '2025-06-01', rent: 1000 }];
  d = by(R.dutiesFor({ id: 'h', duties: ['permit'] }, 'nl', one, [{ homeId: 'h', duty: 'permit', last: '2024-01-15' }, { homeId: 'h', duty: 'points', last: '2025-03-01' }], T));
  assert.equal(d.permit.state, 'done', 'a permit of the home, got before the tenancy, stays done'); assert.equal(d.points.state, 'done');
  assert.equal(R.pack('nl').duties.find((x) => x.id === 'points').per2, undefined);
});

test('the tenant’s copy: none owed for an empty home; a copy an earlier tenant got is still owed to the new one', async () => {
  const R = (await rentals()).rentals;
  const gas = (tenancies, check) => R.dutiesFor({ id: 'h' }, 'england', tenancies, [Object.assign({ homeId: 'h', duty: 'gas' }, check)], T).find((x) => x.duty.id === 'gas').handOver;
  const ten = [{ id: 'A', homeId: 'h', start: '2025-01-01', endedAt: '2026-09-30', rent: 1000 }, { id: 'B', homeId: 'h', start: '2026-11-01', rent: 1000 }];
  assert.equal(gas([], { last: '2026-11-10' }), null, 'nobody lives there');
  assert.equal(gas(ten.slice(0, 1), { last: '2026-11-10' }), null, 'the tenant has left');
  assert.equal(R.upcoming({ homes: [{ id: 'h', country: 'england' }], tenancies: [], checks: [{ homeId: 'h', duty: 'gas', last: '2026-11-10' }] }, {}, 'en', T, 60).filter((x) => x.kind === 'handover').length, 0);
  assert.deepEqual(plain(gas(ten, { last: '2026-06-01', handedOverAt: '2026-06-05' })), { state: 'owed', by: '2026-11-01', left: -15 }, 'given in June, to tenant A');
  assert.deepEqual(plain(gas(ten, { last: '2026-06-01', handedOverAt: '2026-06-05', handedOverTo: 'A' })), { state: 'owed', by: '2026-11-01', left: -15 });
  assert.deepEqual(plain(gas(ten, { last: '2026-06-01', handedOverAt: '2026-10-28', handedOverTo: 'B' })), { state: 'given', date: '2026-10-28' }, 'given to tenant B before they moved in');
  assert.deepEqual(plain(gas(ten, { last: '2026-06-01', handedOverAt: '2026-11-02' })), { state: 'given', date: '2026-11-02' }, 'no name on the record, given after B moved in');
  assert.equal(gas(ten, { last: '2026-11-05', handedOverAt: '2026-11-06', handedOverTo: 'A' }).state, 'owed', 'the record says it went to someone else');
  // a duty at the start of the tenancy counts its days from the start; a record for this tenancy is this tenant's
  const de = (check) => R.dutiesFor({ id: 'h' }, 'de', [{ id: 'B', homeId: 'h', start: '2026-11-10', rent: 900 }], [Object.assign({ homeId: 'h', duty: 'confirm' }, check)], T).find((x) => x.duty.id === 'confirm').handOver;
  assert.deepEqual(plain(de({ last: '2026-11-05' })), { state: 'owed', by: '2026-11-24', left: 8 }, 'the move-in confirmation: within 14 days of moving in');
  assert.equal(de({ last: '2026-11-05', tenancyId: 'B', handedOverAt: '2026-11-05' }).state, 'given');
  // asked without a tenancy at all (three arguments), a copy is judged as before
  assert.deepEqual(plain(R.handOverState({ handOver: 28 }, { last: '2025-12-01' }, T)), { state: 'owed', by: '2025-12-29', left: -322 });
  assert.equal(R.handOverState({ handOver: 28 }, { last: '2025-12-01', handedOverAt: '2025-12-03' }, T).state, 'given');
  assert.equal(R.handOverState({}, { last: '2025-12-01' }, T), null, 'a duty without a copy');
});

test('the deposit: “protect it” goes once it is protected or returned; the cap at exactly £50,000 a year', async () => {
  const R = (await rentals()).rentals;
  const old = { id: 't', homeId: 'h', start: '2022-01-01', rent: 1000, deposit: 1000, endedAt: '2024-01-31', depositReturnedAt: '2024-02-05' };
  assert.equal(R.depositState('england', old, T).protectBy, undefined, 'returned in 2024: nothing left to protect');
  assert.equal(R.upcoming({ homes: [{ id: 'h', country: 'england' }], tenancies: [old], checks: [] }, {}, 'en', T, 30).filter((x) => x.kind === 'deposit').length, 0);
  assert.equal(R.depositState('england', Object.assign({}, old, { depositReturnedAt: '' }), T).protectBy, '2022-01-31', 'ended but not returned and never protected: still said');
  assert.equal(R.depositState('england', { start: '2026-11-01', depositReceived: '2026-10-20', rent: 1000, deposit: 1000 }, T).protectBy, '2026-11-19', '30 days from the day it was received');
  assert.equal(R.depositState('nl', Object.assign({}, old, { depositReturnedAt: '' }), T).protectBy, undefined, 'no such duty in the Netherlands');
  // 6 weeks from exactly £50,000 a year, 5 weeks a penny under
  assert.equal(R.depositCap('england', { rent: 50000, rentPer: 'year' }), 5769.23, 'exactly £50,000 a year: 6 weeks');
  assert.equal(R.depositCap('england', { rent: 49999.99, rentPer: 'year' }), 4807.69, 'a penny under: 5 weeks');
  assert.equal(R.depositCap('england', { rent: 4166.67 }), 5769.24); assert.equal(R.depositCap('england', { rent: 4166.66 }), 4807.68);
  assert.equal(R.depositState('england', { start: '2026-11-01', rent: 250, rentPer: 'week', deposit: 1250, depositProtectedAt: '2026-11-02' }, T).over, false, 'exactly at the cap is not over it');
  assert.equal(R.depositState('england', { start: '2026-11-01', rent: 250, rentPer: 'week', deposit: 1250.01, depositProtectedAt: '2026-11-02' }, T).over, true);
});

test('England’s register is optional until it has opened for the home’s region', async () => {
  const R = (await rentals()).rentals;
  const reg = R.pack('england').duties.find((d) => d.id === 'register');
  assert.equal(reg.optional, true); assert.equal(reg.changing, true); assert.equal(reg.every, 12);
  assert.match(reg.note, /from 15 December 2026/); assert.match(reg.note, /tick this once it has opened/, 'the note says when to tick it');
  const ids = (home) => R.dutiesFor(home, 'england', [], [], T).map((x) => x.duty.id);
  assert.equal(ids({ id: 'h', duties: [] }).includes('register'), false, 'a new English home is not told to sort it out');
  assert.equal(ids({ id: 'h', duties: ['register'] }).includes('register'), true);
  assert.ok(!R.upcoming({ homes: [{ id: 'h', country: 'england', duties: [] }], tenancies: [], checks: [] }, {}, 'en', T, 366).some((x) => x.duty === 'register'));
});

test('the tax year: England’s runs from 6 April to 5 April; each home in its own country’s year and money', async () => {
  const R = (await rentals()).rentals;
  const one = { homes: [{ id: 'h' }], tenancies: [{ id: 't', homeId: 'h' }], costs: [{ homeId: 'h', date: '2026-04-05', amount: 1, kind: 'repairs' }, { homeId: 'h', date: '2026-04-06', amount: 10, kind: 'repairs' }, { homeId: 'h', date: '2027-04-05', amount: 100 }, { homeId: 'h', date: '2027-04-06', amount: 1000 }],
    payments: [{ tenancyId: 't', date: '2026-04-05', amount: 1 }, { tenancyId: 't', date: '2026-04-06', amount: 10 }, { tenancyId: 't', date: '2027-04-05', amount: 100 }, { tenancyId: 't', date: '2027-04-06', amount: 1000 }] };
  const [e] = R.taxYear('england', '2026', one);
  assert.equal(e.rent, 110, '6 April 2026 up to and including 5 April 2027'); assert.equal(e.totalCosts, 110); assert.deepEqual(plain(e.costs), { repairs: 10, other: 100 });
  assert.equal(R.taxYear('england', '2025', one)[0].rent, 1); assert.equal(R.taxYear('england', '2027', one)[0].rent, 1000);
  const [n] = R.taxYear('nl', '2026', { homes: [{ id: 'h' }], tenancies: [{ id: 't', homeId: 'h' }], payments: [{ tenancyId: 't', date: '2025-12-31', amount: 1 }, { tenancyId: 't', date: '2026-01-01', amount: 10 }, { tenancyId: 't', date: '2026-12-31', amount: 100 }, { tenancyId: 't', date: '2027-01-01', amount: 1000 }] });
  assert.equal(n.rent, 110, 'the calendar year');
  assert.equal(R.taxYearOf('england', '2026-04-05'), '2025'); assert.equal(R.taxYearOf('england', '2026-04-06'), '2026'); assert.equal(R.taxYearOf('nl', '2026-04-05'), '2026');
  assert.equal(R.taxYearLabel('england', '2026'), '2026-27'); assert.equal(R.taxYearLabel('de', '2026'), '2026');
  assert.equal(R.taxYear('nl', '2026', { homes: [{ id: 'h' }], costs: [{ homeId: 'h', date: '2026-01-01', amount: '0,1' }, { homeId: 'h', date: '2026-01-01', amount: 0.2 }] })[0].totalCosts, 0.3);

  // a Dutch landlord with a flat in England too, a cost for no home, and a cost of a home that is gone
  const homes = [{ id: 'h1', country: 'england' }, { id: 'h2', country: 'nl' }], tenancies = [{ id: 't1', homeId: 'h1' }, { id: 't2', homeId: 'h2' }, { id: 't3', homeId: 'gone' }];
  const payments = [{ tenancyId: 't2', date: '2026-02-01', amount: 1000 }, { tenancyId: 't1', date: '2026-02-01', amount: 800 }, { tenancyId: 't1', date: '2026-05-01', amount: 900 }, { tenancyId: 't3', date: '2026-03-01', amount: 50 }];
  const costs = [{ date: '2026-06-01', amount: 500, kind: 'legal' }, { homeId: 'gone', date: '2026-06-01', amount: 70, kind: 'repairs' }, { homeId: 'h1', date: '2026-06-02', amount: 10 }, { homeId: 'h2', date: '2026-03-01', amount: 40, kind: 'insurance' }];
  const blocks = R.taxYears('2026', { homes, tenancies, payments, costs }, { country: 'nl', currency: 'EUR' }, 'nl');
  assert.deepEqual(plain(blocks.map((b) => [b.code, b.currency, b.label, b.from, b.to])), [['england', 'GBP', '2026-27', '2026-04-06', '2027-04-05'], ['nl', 'EUR', '2026', '2026-01-01', '2026-12-31']]);
  assert.deepEqual(plain(blocks[0].rows.map((r) => [r.home.id, r.rent, r.totalCosts])), [['h1', 900, 10]], 'the English flat: rent from 6 April only');
  assert.deepEqual(plain(blocks[1].rows.map((r) => [r.home.id, r.rent, r.totalCosts])), [['h2', 1000, 40]]);
  assert.equal(blocks[0].noHome, null);
  assert.deepEqual(plain([blocks[1].noHome.home, blocks[1].noHome.rent, blocks[1].noHome.costs, blocks[1].noHome.net]), [null, 50, { legal: 500, repairs: 70 }, -520], 'nothing recorded is left out: it is “no home”, in the landlord’s own year');
  const all = blocks.flatMap((b) => b.rows.concat(b.noHome ? [b.noHome] : []));
  assert.equal(all.reduce((s, r) => s + r.totalCosts, 0), 620, 'every cost of the year is in a total');
  // a landlord elsewhere: the calendar year in their own currency; no homes yet: still one block
  const es = R.taxYears('2026', { homes: [{ id: 'h', country: 'other' }], costs: [{ homeId: 'h', date: '2026-05-01', amount: 30 }] }, { country: 'other', currency: 'USD' }, 'en');
  assert.deepEqual(plain(es.map((b) => [b.code, b.currency, b.from, b.rows[0].totalCosts])), [['', 'USD', '2026-01-01', 30]]);
  assert.equal(R.taxYears('2026', {}, { country: 'england' }, 'en').length, 1);
  assert.equal(R.currencyOf('england', { currency: 'EUR' }), 'GBP'); assert.equal(R.currencyOf('', { currency: 'USD' }), 'USD');
});

test('check-in against check-out by the rooms’ names: two rooms with one name are matched in order', async () => {
  const R = (await rentals()).rentals;
  const a = { rooms: [{ room: 'Another room', condition: 'good' }, { room: 'Another room', condition: 'good' }, { room: 'Study', condition: 'good' }] };
  const b = { rooms: [{ room: 'Another room', condition: 'good' }, { room: 'Another room', condition: 'poor' }, { room: ' study ', condition: 'fair' }, { room: 'Loft', condition: 'good' }] };
  const c = R.compareReports(a, b);
  assert.deepEqual(plain(c.map((x) => [x.room, x.worse, x.missing])), [['Another room', false, false], ['Another room', true, false], ['Study', true, false], ['Loft', false, true]]);
  assert.equal(c[1].end, b.rooms[1], 'each row carries the very room it is about'); assert.equal(c[3].start, null);
  assert.deepEqual(plain(R.compareReports(null, { rooms: [{ room: 'Hall', condition: 'good' }] }).map((x) => [x.room, x.missing])), [['Hall', true]]);
});

test('file names: the tenant and the date are in them, and a name never climbs out of its folder', async () => {
  const R = (await rentals()).rentals;
  const s = { ownerName: 'Ann' }, home = { name: 'Flat 2' };
  const letter = (tenants, today, id) => R.fileName(R.fillLetter('deposit', 'england', { s, home, t: { tenants, deposit: 900 }, today }).title, tenants, today, id);
  assert.equal(letter('Bo', T, 'ab12'), 'Your deposit Bo 2026-11-16 ab12');
  assert.notEqual(letter('Bo', T, 'ab12'), letter('Cy', T, 'cd34'), 'two tenants');
  assert.notEqual(letter('Bo', '2026-01-10', 'ab12'), letter('Bo', T, 'ab12'), 'two dates');
  assert.notEqual(R.fileName('Rent receipt', '', 'Bo', '2026-10'), R.fileName('Rent receipt', '', 'Cy', '2026-10'), 'two homes without a name');
  assert.equal(R.fileName('..'), 'Busy Rentals'); assert.equal(R.fileName('../..', 'x'), 'x'); assert.equal(R.fileName('???'), 'Busy Rentals'); assert.equal(R.fileName('.hidden'), 'hidden');
  assert.equal(R.fileName('Flat 1/2: rear', null, '', 'check-in'), 'Flat 12 rear check-in');
  const long = R.fileName('A very long title of a letter that goes on and on about the repair at the flat in Utrecht', 'Yara Smit & Daan Kok', '2026-11-16', 'zz99');
  assert.ok(long.length <= 80 && long.endsWith('Yara Smit & Daan Kok 2026-11-16 zz99'), 'a long title is cut, not what tells two files apart');
});
