// The demo landlord (shared/rentals-examples.js): fits the schema, and shows every part of Busy Rentals with
// something in it: a running tenancy with a month open, an ended one with a deposit to return, a check-out that
// is worse than the check-in somewhere, an unknown certificate, letters and a tax year with numbers.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

test('the demo landlord fits the schema and every part of Busy Rentals has something to show', async () => {
  const { BW } = await busywork(['shared/schema.js', 'shared/rentals.js', 'shared/rentals-examples.js']);
  await BW.rentalsExamples.load();
  const all = {}, problems = [];
  for (const n of await BW.store.collections()) {
    all[n] = await BW.store.all(n);
    for (const r of Array.isArray(all[n]) ? all[n] : [all[n]]) problems.push(...BW.schema.check(n, r));
  }
  assert.deepEqual(problems, []);
  const R = BW.rentals, s = BW.rentalsExamples.settings, today = BW.today();
  assert.ok([...all.homes, ...all.tenancies, ...all.checks, ...all.rentpayments].every((r) => r.example === true), 'every record is marked as an example');
  const ids = new Set(all.homes.map((h) => h.id)), tids = new Set(all.tenancies.map((t) => t.id));
  for (const n of ['tenancies', 'checks', 'reports', 'rentcosts']) for (const r of all[n]) assert.ok(ids.has(r.homeId), `${n} points at a home`);
  for (const n of ['rentpayments', 'reports', 'rentletters']) for (const r of all[n]) assert.ok(tids.has(r.tenancyId), `${n} points at a tenancy`);

  const [running, ended] = ['Flat Utrecht', 'Flat Amersfoort'].map((name) => all.tenancies.find((t) => t.homeId === all.homes.find((h) => h.name === name).id));
  assert.equal(R.countryOf(all.homes[0], s, 'en'), 'nl');
  const st = R.rentStatus(running, all.rentpayments, today);
  assert.equal(st.months.filter((m) => m.open > 0).length, 1, 'one month still to come in, this month');
  assert.equal(R.rentStatus(ended, all.rentpayments, today).open, 0, 'the ended tenancy paid every month');
  // the rent went up two months ago: the months before keep the old rent, and nothing is open because of it
  assert.deepEqual(plain(running.rents.map((x) => x.rent)), [1200, 1250]); assert.equal(running.rent, 1250);
  assert.deepEqual(plain([...new Set(st.months.map((m) => m.amount))]), [1200, 1250]); assert.equal(st.months.filter((m) => m.amount === 1250).length, 3);
  assert.equal(st.months.filter((m) => m.late && m.month < today.slice(0, 7)).length, 0, 'no earlier month is late');
  assert.match(all.rentletters.find((l) => l.template === 'welcome').body, /1\.200,00/, 'the welcome letter says the rent of the day it was written');
  const dep = R.depositState('nl', ended, today);
  assert.ok(dep.returnBy > today, 'the deposit is still to return, by a date to come');
  assert.equal(R.depositState('nl', running, today).over, false, 'deposits within the cap');

  const cmp = R.compareReports(...['in', 'out'].map((k) => all.reports.find((r) => r.kind === k)));
  assert.deepEqual(plain(cmp.filter((x) => x.worse).map((x) => x.room)), ['Kitchen']);
  const dutiesA = R.dutiesFor(all.homes[1], 'nl', all.tenancies, all.checks, today);
  assert.equal(dutiesA.find((d) => d.duty.id === 'label').state, 'unknown', 'Amersfoort’s energy label was never found');
  const dutiesU = R.dutiesFor(all.homes[0], 'nl', all.tenancies, all.checks, today);
  assert.ok(dutiesU.every((d) => d.state !== 'overdue'), 'Utrecht is in order');
  assert.ok(dutiesU.every((d) => !d.handOver || d.handOver.state === 'given'), 'and its tenants have every copy');
  const blocks = R.taxYears(today.slice(0, 4), { homes: all.homes, tenancies: all.tenancies, payments: all.rentpayments, costs: all.rentcosts }, s, 'en');
  assert.deepEqual(plain(blocks.map((b) => [b.code, b.currency, b.rows.length, b.noHome])), [['nl', 'EUR', 2, null]], 'one country, one block, nothing without a home');

  assert.ok(all.rentletters.every((l) => l.lang === 'nl' && !/\{\{/.test(l.body)), 'letters filled, in Dutch');
  const [y] = R.taxYear('nl', today.slice(0, 4), { homes: all.homes, tenancies: all.tenancies, payments: all.rentpayments, costs: all.rentcosts });
  assert.ok(y.rent > 0 && y.totalCosts > 0, 'the tax year has numbers');
});
