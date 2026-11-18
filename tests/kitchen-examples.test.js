// The demo household of Busy Kitchen (shared/kitchen-examples.js): fits the schema, points only at dishes and recipes
// that exist, and gives every screen something to show: two things to use up soon, two weeks planned across the
// kitchens with two of their own recipes, a shopping list that follows the plan, a Recipe Box with family recipes and
// a copied house recipe, and a passport with stamps from four kitchens.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { busywork, load, plain, APP } = require('./harness.js');

const KITCHEN = ['shared/kitchen-data.js', 'shared/kitchen-words.js', 'shared/kitchen-swaps.js', 'shared/kitchen.js'];

test('the demo household fits the schema and every part of Busy Kitchen has something to show', async () => {
  const { BW } = await busywork(['shared/schema.js', ...KITCHEN, 'shared/kitchen-examples.js']);
  const K = BW.kitchen, s = BW.kitchenExamples.settings, today = BW.today();
  Object.assign(BW.settings, s);
  assert.deepEqual([...BW.schema.check('settings', BW.settings)], []);
  await BW.kitchenExamples.load();
  const all = {}, problems = [];
  for (const n of await BW.store.collections()) {
    all[n] = await BW.store.all(n);
    for (const r of Array.isArray(all[n]) ? all[n] : [all[n]]) problems.push(...BW.schema.check(n, r));
  }
  assert.deepEqual(problems, []);
  const names = ['recipes', 'plan', 'shopping', 'pantry', 'cooked'];
  for (const n of names) assert.ok(all[n].length && all[n].every((r) => r.example === true), `${n}: every record is marked as an example`);

  // Every dish is one of the six kitchens' own, with its own name and kitchen; every recipe id is in the Recipe Box.
  for (const id of BW.kitchenExamples.DISHES) assert.ok(K.dish(id), `${id} is a dish of the six kitchens`);
  const rids = new Set(all.recipes.map((r) => r.id));
  for (const n of ['plan', 'cooked']) for (const r of all[n]) {
    if (r.dishId) { const d = K.dish(r.dishId); assert.ok(d, `${n}: ${r.dishId} exists`); assert.equal(r.name, d.name); assert.equal(r.k, d.k); }
    else assert.ok(rids.has(r.recipeId), `${n}: ${r.name} points at a recipe in the box`);
  }

  // The pantry: about twelve things, two to use within three days, nothing already off.
  assert.ok(all.pantry.length >= 10 && all.pantry.length <= 14);
  assert.equal(all.pantry.filter((p) => p.useBy <= BW.addDays(today, 3)).length, 2, 'two things go off within three days');
  assert.ok(all.pantry.every((p) => p.useBy > today && ['fridge', 'freezer', 'cupboard'].includes(p.where)));
  assert.ok(all.pantry.some((p) => p.leftover === 'yes'), 'a leftover in the freezer');

  // The plan: the coming two weeks, house dishes from at least five kitchens and two of their own recipes.
  const last = BW.addDays(today, 13);
  assert.ok(all.plan.every((p) => p.date >= today && p.date <= last), 'within the fourteen days the plan shows');
  assert.ok(all.plan.some((p) => p.date === today), 'tonight is planned');
  assert.equal(new Set(all.plan.filter((p) => p.recipeId).map((p) => p.recipeId)).size, 2, 'two of their own recipes');
  assert.ok(new Set(all.plan.filter((p) => p.dishId).map((p) => p.k)).size >= 5, 'house dishes from several kitchens');
  assert.ok(all.plan.some((p) => p.leftovers), 'a leftovers day');

  // The shopping list follows the plan: each thing is for a planned dinner, and none is already in the pantry.
  const planned = new Set(all.plan.map((p) => p.name));
  assert.ok(all.shopping.length >= 12);
  for (const x of all.shopping) assert.ok(!x.for || planned.has(x.for), `"${x.text}" is for a planned dinner`);
  const pantryWords = all.pantry.map((p) => K.words(K.canon(p.name)).join(' '));
  for (const x of all.shopping) assert.ok(!pantryWords.includes(K.words(K.canon(x.text.split(',')[0])).join(' ')), `"${x.text}" is not in the pantry already`);
  assert.ok(all.shopping.some((x) => x.done) && all.shopping.some((x) => !x.done), 'some bought, most still to buy');

  // The Recipe Box: five, two of them family recipes with a story and a country, one copied from a house recipe.
  assert.equal(all.recipes.length, 5);
  const family = all.recipes.filter((r) => r.family === 'yes');
  assert.equal(family.length, 2);
  for (const r of family) assert.ok(r.story && r.country && r.from && r.ingredients.split('\n').length >= 5 && r.steps.split('\n').length >= 4, `${r.name} is complete`);
  const copied = all.recipes.filter((r) => r.source === 'Busy Kitchen (not yet cooked by us)');
  assert.equal(copied.length, 1);
  const house = K.dishes.find((d) => d.name === copied[0].name && d.k === copied[0].kitchen);
  assert.ok(house, 'the copied recipe is a house dish');
  assert.ok(copied[0].story.startsWith(house.story), 'with the dish’s story, as "Add to my Recipe Box" does it');

  // The passport: about fifteen stamps from exactly four kitchens.
  assert.ok(all.cooked.length >= 13 && all.cooked.length <= 17);
  assert.ok(all.cooked.every((c) => c.date < today));
  const passport = K.passport(all.cooked).filter((p) => p.n > 0);
  assert.equal(passport.length, 4, 'four kitchens in the passport');
  assert.ok(passport.every((p) => p.n >= 2));

  // Settings: an oven and an air fryer, four at the table.
  BW.settings = Object.assign({}, BW.settings, s);
  assert.deepEqual(plain(K.gear()), { oven: true, airfryer: true, onepot: false });
  assert.equal(s.kitchenHousehold.people, 4);

  // The house style: no em dashes and no exclamation marks in anything the demo shows.
  const shown = JSON.stringify([s, ...names.map((n) => all[n])]);
  assert.ok(!/—/.test(shown) && !/!/.test(shown), 'no em dashes, no exclamation marks');
});

test('the website demo fills Busy Kitchen with the household, in the tab only', async () => {
  const DEMO = path.join(APP, '..', 'website', 'assets', 'demo.js');
  const win = load([DEMO, 'shared/core.js', ...KITCHEN], { before: (w) => { w.document.body.dataset.suite = 'kitchen'; } });
  win.BW.loadScript = async (src) => vm.runInContext(fs.readFileSync(path.join(APP, src.replace(/^(\.\.\/)*/, '')), 'utf8'), win);
  win.BW.runRecurring = async () => {};
  const { BW } = win;
  await BW.boot({});
  assert.equal(BW.store.kind, 'demo');
  assert.equal(BW.settings.suite, 'kitchen');
  assert.equal(BW.settings.kitchenHousehold.people, 4);
  assert.equal((await BW.store.all('recipes')).length, 5);
  assert.ok((await BW.store.all('plan')).length >= 10);
  assert.ok(win.sessionStorage.getItem('bw.demo.kitchen.seeded'));
  assert.equal(win.localStorage.length, 0, 'nothing in lasting browser storage');
});

test('the real app never loads the demo household', () => {
  const pages = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(html|js)$/.test(e.name)) pages.push(p); } };
  walk(APP);
  for (const p of pages) if (!p.endsWith('kitchen-examples.js')) assert.ok(!fs.readFileSync(p, 'utf8').includes('kitchen-examples'), `${path.relative(APP, p)} does not load the demo household`);
});
