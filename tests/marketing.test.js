// Marketing numbers worked out from invoices and the Client Book, and the content calendar export.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork } = require('./harness.js');

const FILES = ['shared/examples.js', 'shared/mkt-dash.js', 'shared/mkt-insights.js', 'shared/qr.js', 'shared/mkt-content.js'];

async function studio() {
  const win = await busywork(FILES);
  await win.BW.examples.load();
  return win;
}

test('new customers are counted in the month of their first invoice, drafts and quotes left out', async () => {
  const { BW } = await busywork(FILES);
  const m = BW.today().slice(0, 7);
  const prev = BW.addPeriod(m + '-01', 'month', -1);
  await BW.store.putMany('clients', [{ id: 'a', name: 'A', source: 'Instagram' }, { id: 'b', name: 'B', source: 'Recommendation' }, { id: 'c', name: 'C' }]);
  await BW.store.putMany('invoices', [
    { kind: 'invoice', status: 'paid', clientId: 'a', issueDate: prev, items: [{ qty: 1, price: 100, vat: 21 }] },
    { kind: 'invoice', status: 'sent', clientId: 'a', issueDate: m + '-02', items: [{ qty: 1, price: 50, vat: 21 }] },
    { kind: 'invoice', status: 'sent', clientId: 'b', issueDate: m + '-03', items: [{ qty: 2, price: 100, vat: 21 }] },
    { kind: 'invoice', status: 'draft', clientId: 'c', issueDate: m + '-04', items: [{ qty: 1, price: 999, vat: 21 }] },
    { kind: 'quote', status: 'sent', clientId: 'c', issueDate: m + '-04', items: [{ qty: 1, price: 999, vat: 21 }] },
  ]);
  const d = await BW.mktInsights.load();
  const c = BW.mktInsights.compute(d);
  assert.equal(c.cur.fresh, 1, 'B is new this month; A came last month; C has no real invoice');
  assert.equal(c.prev.fresh, 1);
  assert.equal(c.cur.revenue, 250, 'revenue before VAT');
  assert.equal(c.cur.fromNew, 200);
  assert.equal(c.new12, 2);
  assert.equal(c.src.Instagram, 1);
  assert.equal(c.src.Recommendation, 1);
  assert.equal(c.customersEver, 2);
});

test('the example studio gives numbers and observations to act on', async () => {
  const { BW } = await studio();
  const d = await BW.mktInsights.load();
  const c = BW.mktInsights.compute(d);
  assert.equal(c.per.length, 12);
  assert.ok(c.new12 >= 3);
  const obs = BW.mktInsights.observations(d, c);
  assert.ok(obs.length > 0);
  for (const o of obs) assert.ok(o.text && o.icon, 'each observation has text and an icon');
});

test('the content calendar exports valid iCalendar, lines folded at 75 bytes', async () => {
  let file;
  const { BW } = await busywork(FILES, { host: { platform: { download: (blob, name) => { file = { blob, name }; } } } });
  const long = 'Nieuw in de winkel 🚲✨: de zomerservice voor € 49, inclusief banden oppompen, ketting smeren; kom langs!\nTot zaterdag, Piet';
  BW.mktContent.download([{ id: 'p1', date: '2026-11-03', title: 'Zomerservice', channel: 'Instagram', text: long }], 'posts.ics');
  assert.equal(file.name, 'posts.ics');
  const text = await file.blob.text();
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\n') && text.endsWith('END:VCALENDAR\r\n'));
  const lines = text.split('\r\n').slice(0, -1);
  for (const l of lines) assert.ok(Buffer.byteLength(l, 'utf8') <= 75, `too long: ${l}`);
  const unfolded = text.replace(/\r\n /g, '');
  assert.match(unfolded, /DTSTART;VALUE=DATE:20261103/);
  assert.match(unfolded, /DTEND;VALUE=DATE:20261104/);
  assert.ok(unfolded.includes('DESCRIPTION:' + long.replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')), 'the post survives folding intact');
});

test('suggested posts are added once, not twice in the same month', async () => {
  const { BW } = await busywork(FILES);
  const list = [{ date: '2026-11-03', title: 'Open day', channel: 'Instagram' }, { date: 'not a date', title: 'Broken' }];
  assert.equal(await BW.mktContent.addMany(list, 'studio'), 1);
  assert.equal(await BW.mktContent.addMany(list, 'studio'), 0);
  const items = await BW.store.all('mktcontent');
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'idea');
});
