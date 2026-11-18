// Busy Kitchen (shared/kitchen.js with its data, fridge dictionary and swaps): the six kitchens are complete in every
// language, what you type in any of the six languages finds the right dishes, the food calendar reads its dates,
// the conversions add up, the kitchen gear filters, and every kitchen has its ingredients abroad.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { busywork, plain } = require('./harness.js');

let WIN;
async function kitchen() {
  WIN = await busywork(['shared/kitchen-data.js', 'shared/kitchen-words.js', 'shared/kitchen-swaps.js', 'shared/kitchen.js']);
  return WIN.BW.kitchen;
}
const LANGS = ['nl', 'de', 'es', 'it', 'pt-br'];

test('six kitchens, 1,886 dishes, each dish in one of them with a name and its key ingredients', async () => {
  const K = await kitchen();
  assert.deepEqual(plain(K.kitchens.map((k) => k.id)), ['nl', 'de', 'es', 'it', 'pt', 'en']);
  assert.equal(K.dishes.length, 1886);
  const ids = new Set();
  for (const d of K.dishes) {
    assert.ok(K.kitchen(d.k), `${d.id} belongs to a kitchen`);
    assert.ok(d.name && d.ing, `${d.id} has a name and ingredients`);
    assert.ok(!ids.has(d.id), `${d.id} once`); ids.add(d.id);
  }
  for (const k of K.kitchens) {
    assert.ok(k.name && k.line && k.say, k.id);
    assert.ok(k.story.length >= 2, `${k.id} story`);
    assert.ok(k.pictures.length >= 4, `${k.id} pictures`);
    assert.ok(k.calendar.length >= 10 && k.regions.length >= 5 && k.customs.length >= 5, `${k.id} calendar, regions, customs`);
  }
});

test('the kitchens’ names, lines, stories and every picture caption exist in the five other languages', async () => {
  const K = await kitchen();
  const all = plain(WIN.BW_KITCHEN.i18n);
  for (const lang of LANGS) {
    const L = all[lang];
    assert.ok(L, lang);
    for (const k of K.kitchens) {
      const t = L.kitchens[k.id];
      assert.ok(t && t.name && t.line && t.say && t.story.length === k.story.length, `${lang} ${k.id}`);
      for (const p of k.pictures) assert.ok(L.captions[p.id], `${lang} caption ${p.id}`);
    }
  }
});

test('the fridge dictionary: every name in the six languages leads to one English name', async () => {
  const K = await kitchen();
  for (const row of WIN.BW_KITCHEN_WORDS) assert.equal(row.length, 6, row[0]);
  assert.equal(K.canon('aardappelen'), 'potato');
  assert.equal(K.canon('Kartoffeln'), 'potato');
  assert.equal(K.canon('batatas'), 'potato');
  assert.equal(K.canon('carne picada'), 'minced beef');
  assert.equal(K.canon('Räucherwurst'), 'smoked sausage');
  assert.equal(K.canon('something new'), 'something new');
  // Everyday words added in Fable's check (18 November 2026).
  assert.equal(K.canon('kipfilet'), 'chicken');
  assert.equal(K.canon('Hühnchen'), 'chicken');
  assert.equal(K.canon('rode kool'), 'red cabbage');
  assert.equal(K.canon('quiabo'), 'okra');
  assert.equal(K.canon('chuchu'), 'chayote');
  assert.ok(K.match(['collards', 'ham hock']).some((m) => m.item.id === 'eng191'), 'collards find the collard greens');
});

test('what you have finds the closest dishes, in English or in Dutch, and a dish of staples is no answer', async () => {
  const K = await kitchen();
  for (const have of [['potatoes', 'eggs', 'onion'], ['aardappelen', 'eieren', 'uien']]) {
    const found = K.match(have);
    const tortilla = found.find((f) => f.item.name === 'Tortilla de patatas');
    assert.ok(tortilla && tortilla.missing.length === 0, `${have}: the tortilla needs nothing more`);
    for (const f of found) assert.ok(f.need.length >= 2, `${f.item.name} needs at least two real ingredients`);
    for (let i = 1; i < found.length; i++) assert.ok(found[i - 1].missing.length <= found[i].missing.length, 'fewest missing first');
  }
  // one kitchen only, and your own recipes
  assert.ok(K.match(['potatoes', 'eggs', 'onion'], { kitchen: 'it' }).every((f) => f.item.k === 'it'));
  const mine = K.match(['kale', 'potatoes'], { kitchen: 'mine', recipes: [{ id: 'r', name: 'Oma’s stamppot', ingredients: '1 kg potatoes\n500 g curly kale\n1 rookworst' }] });
  assert.deepEqual(plain(mine.map((f) => [f.kind, f.item.id, f.missing.length])), [['recipe', 'r', 1]]);
});

test('without an oven, baked dishes step aside; one pot only keeps the stews and soups', async () => {
  const K = await kitchen();
  assert.equal(K.fits({ type: 'Cake', name: 'Appeltaart' }, { oven: false }), false);
  assert.equal(K.fits({ type: 'Cake', name: 'Appeltaart' }, { oven: false, airfryer: true }), true);
  assert.equal(K.fits({ type: 'Stew', name: 'Hachee' }, { oven: true, onepot: true }), true);
  assert.equal(K.fits({ type: 'Main', name: 'Schnitzel' }, { oven: true, onepot: true }), false);
});

test('the food calendar reads its dates: days, months, and feasts named in words', async () => {
  const K = await kitchen();
  assert.deepEqual(plain(K.whenMonths('5–6 Jan', 'Reyes')), [{ m: 0, d: 5 }]);
  assert.deepEqual(plain(K.whenMonths('Carnival (Feb/Mar)').map((x) => x.m)), [1, 2]);
  // What the calendar shows never holds a bare dash for "no feast" (Fable's check, 18 November 2026).
  for (const c of K.calendar()) for (const f of ['feast', 'when', 'what']) assert.doesNotMatch(c[f] || '', /—/, `${c.k} ${c.when} ${f}`);
  assert.deepEqual(plain(K.whenMonths('Advent').map((x) => x.m)), [11]);
  const dec = K.thisWeek('', '2026-12-20');
  assert.ok(dec.length > 5 && dec.every((c) => c.months.some((x) => x.m === 11)), 'December’s food in December');
});

test('conversions: Fahrenheit, gas marks, fan ovens and cups', async () => {
  const K = await kitchen();
  assert.equal(K.toC(350), 177);
  assert.equal(K.toF(180), 356);
  assert.equal(K.gasOf(180), 4);
  assert.equal(K.fan(180), 160);
  assert.equal(K.CUP.flour, 125);
});

test('ingredients abroad: every kitchen has its swaps, in six languages, and a missing ingredient finds its swap', async () => {
  const K = await kitchen();
  for (const k of K.kitchens) assert.ok(K.swapsOf(k.id).length >= 4, `${k.id} has swaps`);
  for (const s of K.SWAPS) assert.ok(s.name.length === 6 && s.use.length === 6 && s.match, s.name[0]);
  assert.match(K.swapFor('rookworst').use, /kielbasa/);
  assert.match(K.swapFor('Spanish queso fresco').use, /[Ff]eta/);
  assert.equal(K.swapFor('potatoes'), null);
});

test('the house recipes: every language file holds the same dishes, each recipe complete, each note a paragraph', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const read = (lang) => { const box = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'shared', 'kitchen', `recipes-${lang}.js`), 'utf8'), box); return box.window.BW_KITCHEN_RECIPES; };
  const en = read('en');
  const K = await kitchen();
  const ids = Object.keys(en);
  assert.ok(ids.length > 1000, `${ids.length} recipes`);
  const allergens = new Set(['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs']);
  for (const id of ids) {
    const r = en[id];
    assert.ok(K.dish(id), `${id} is a dish of the six kitchens`);
    if (r.k === 'n') { assert.ok(r.n.length > 60, `${id} note`); continue; }
    assert.ok(r.i.length >= 2 && r.st.length >= 3, `${id} has ingredients and steps`);
    assert.ok(r.s || r.y, `${id} serves or makes`);
    assert.ok(r.a.every((a) => allergens.has(a)), `${id} allergens`);
  }
  for (const lang of ['nl', 'de', 'es', 'it', 'pt-br']) {
    const L = read(lang);
    assert.deepEqual(Object.keys(L).sort(), ids.slice().sort(), `${lang} has the same dishes`);
    for (const id of ids) if (en[id].k === 'r') assert.equal(L[id].i.length, en[id].i.length, `${lang} ${id} ingredients`);
  }
  // Amounts at a new size, the way a cook writes them.
  assert.equal(K.amount(1, 'tbsp', 1.5), '1½');
  assert.equal(K.amount(150, 'g', 1.5), '230');
  assert.equal(K.amount(null, '', 2), '');
});

test('allergens never get lost: notes keep theirs, a copy in the Recipe Box keeps the Contains line', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const read = (lang) => { const box = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'app', 'shared', 'kitchen', `recipes-${lang}.js`), 'utf8'), box); return box.window.BW_KITCHEN_RECIPES; };
  const en = read('en');
  // Things people buy carry allergens too (a stroopwafel, a malt drink, a cheese), and the screen shows them.
  const notes = Object.values(en).filter((r) => r.k === 'n');
  assert.ok(notes.length > 50 && notes.every((r) => Array.isArray(r.a)), 'every note has its allergens');
  assert.ok(notes.filter((r) => r.a.length).length > 40, 'most notes name some');
  // Fixed in Fable's check (18 November 2026): marshmallow creme has egg white, Italian wafer paper (ostia) has wheat.
  assert.ok(en.eng176.a.includes('eggs'), 'eng176 eggs');
  assert.ok(en.ita54.a.includes('gluten'), 'ita54 gluten');
  const K = await kitchen();
  const el = { innerHTML: '' };
  K.showRecipe(el, { k: 'n', n: 'Bought at the cheese counter and eaten in thin slices.', a: ['milk'] });
  assert.match(el.innerHTML, /Contains:<\/b> milk/);
  assert.match(el.innerHTML, /Always check the labels/);
  // A house recipe copied into the Recipe Box keeps what it contains, so cooking mode and the cookbook show it.
  const r = en.eng176, d = K.dish('eng176');
  await K.toRecipeBox(d, r);
  const [saved] = plain(await WIN.BW.store.all('recipes'));
  assert.match(saved.story, /Contains: .*eggs/);
  assert.match(saved.story, /Always check the labels of what you buy\./);
});
