// The small helpers every app leans on: numbers, money, dates, invoice maths, numbering, CSV.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

test('numbers typed the Dutch or the English way', async () => {
  const { BW } = await busywork();
  assert.equal(BW.num('1.234,56'), 1234.56);
  assert.equal(BW.num('1,234.56'), 1234.56);
  assert.equal(BW.num('12,5'), 12.5);
  assert.equal(BW.num('€ 9.95'), 9.95);
  assert.equal(BW.num(''), 0);
  assert.equal(BW.num(7), 7);
});

test('dates move by days, months and years without drifting', async () => {
  const { BW } = await busywork();
  assert.equal(BW.addDays('2026-02-27', 3), '2026-03-02');
  assert.equal(BW.addDays('2026-01-10', -10), '2025-12-31');
  assert.equal(BW.addPeriod('2026-01-31', 'month'), '2026-02-28', 'the last day of a short month');
  assert.equal(BW.addPeriod('2024-02-29', 'year'), '2025-02-28');
  assert.equal(BW.addPeriod('2026-11-15', 'quarter'), '2027-02-15');
  assert.equal(BW.addPeriod('2026-05-01', 'week', 2), '2026-05-15');
  assert.match(BW.today(), /^\d{4}-\d\d-\d\d$/);
});

test('invoice totals add up in cents, per VAT rate, after discount', async () => {
  const { BW } = await busywork();
  const t = BW.invoiceTotals({ discount: 10, items: [{ qty: 3, price: 0.1, vat: 21 }, { qty: '2', price: '19,99', vat: 9 }, { qty: 1, price: 100, vat: 0 }] });
  assert.equal(t.lines, 140.28);
  assert.equal(t.subtotal, 126.25);
  assert.equal(t.discount, 14.03);
  assert.deepEqual(plain(t.vat), [{ rate: 21, base: 0.27, amount: 0.06 }, { rate: 9, base: 35.98, amount: 3.24 }]);
  assert.equal(t.total, 129.55);
  const rc = BW.invoiceTotals({ reverseCharge: true, items: [{ qty: 1, price: 500, vat: 21 }] });
  assert.equal(rc.vatTotal, 0, 'reverse charge: no VAT');
  assert.equal(rc.total, 500);
});

test('payments and the balance still open', async () => {
  const { BW } = await busywork();
  const inv = { status: 'sent', items: [{ qty: 1, price: 100, vat: 21 }], payments: [{ date: '2026-01-02', amount: '21,00' }] };
  assert.equal(BW.balanceOf(inv), 100);
  assert.equal(BW.balanceOf({ status: 'paid', items: inv.items }), 0);
});

test('invoice numbers count up per year and per kind', async () => {
  const { BW } = await busywork();
  const list = [{ kind: 'invoice', number: '2026-007' }, { kind: 'invoice', number: '2025-031' }, { kind: 'quote', number: 'Q2026-002' }, { kind: 'invoice', number: 'odd' }];
  assert.equal(BW.nextNumber(list, 'invoice', '2026'), '2026-008');
  assert.equal(BW.nextNumber(list, 'quote', '2026'), 'Q2026-003');
  assert.equal(BW.nextNumber(list, 'credit', '2026'), 'C2026-001');
  assert.equal(BW.nextNumber(list, 'invoice', '2027'), '2027-001');
});

test('CSV round trip with commas, quotes, newlines and semicolon files', async () => {
  const { BW } = await busywork();
  const rows = [['name', 'note'], ['Café "Morgenrood"', 'a, b\nc']];
  assert.deepEqual(plain(BW.csv.parse(BW.csv.stringify(rows))), rows);
  assert.deepEqual(plain(BW.csv.parse('﻿a;b\r\n1;2\r\n')).slice(0, 2), [['a', 'b'], ['1', '2']]);
});

test('escaping makes text safe inside HTML', async () => {
  const { BW } = await busywork();
  assert.equal(BW.esc('<img src=x onerror="a">&\''), '&lt;img src=x onerror=&quot;a&quot;&gt;&amp;&#39;');
  assert.equal(BW.esc(null), '');
});

test('VAT rates come from the settings, without doubles', async () => {
  const { BW } = await busywork();
  BW.settings.vatRates = '21; 9, 0 9';
  assert.deepEqual(plain(BW.vatRates()), [21, 9, 0]);
});
