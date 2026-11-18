/* Example data for Busy Kitchen: a made-up household in Rotterdam. Sanne and Marco cook for four: Lotte is 9,
   Tiago is 6 and eats no peanuts. Marco's family came from Puglia, Sanne's grandmother from Drenthe, so the Recipe
   Box holds Nonna Pina's orecchiette and Oma Joke's hachee next to a house recipe they copied and two of their own.
   The pantry has two things to use up within three days, the coming two weeks are planned across the six kitchens,
   the shopping list follows from the plan, and the passport has stamps from four kitchens. Made up, with first names
   only. Dates are relative to today. Used by the website demo only; not in any download. Every record carries
   example: true. */
(function () {
  'use strict';
  const BW = window.BW;
  const day = (n) => BW.addDays(BW.today(), n);
  const tr = (v) => (typeof v === 'string' && BW.t ? BW.t(v) : v);
  // Ingredients and steps are written as lists of lines: each line is translated, and they are kept one per line.
  const trLines = (list) => list.map(tr).join('\n');
  // A dish of the six kitchens, from the built-in data (kitchen.js, or the data itself before it has run).
  const dish = (id) => (BW.kitchen && BW.kitchen.dish ? BW.kitchen.dish(id) : ((window.BW_KITCHEN || {}).dishes || []).find((d) => d.id === id)) || { id, k: '', name: id };

  BW.kitchenExamples = {
    get settings() {
      return {
        suite: 'kitchen', ownerName: 'Sanne', household: tr('Marco, Lotte (9), Tiago (6)'), city: 'Rotterdam', country: 'Netherlands',
        email: 'sanne@example.com', currency: 'EUR',
        kitchenGear: { oven: true, airfryer: true, onepot: false },
        kitchenHousehold: { people: 4, allergies: tr('No peanuts for Tiago') },
      };
    },
    // The house dishes in the demo, by id (shared/kitchen-data.js); the test checks that each one exists.
    DISHES: ['eng14', 'spa186', 'dut2', 'por187', 'ger83', 'ita155', 'por24', 'dut37', 'por237', 'ger121', 'dut1', 'dut13', 'dut53', 'ita28', 'ita42', 'spa1', 'spa113', 'eng22', 'eng1'],
    async load() {
      const ex = (o) => Object.assign({ id: BW.uid(), example: true }, o);
      const txt = (o) => { for (const k of ['name', 'country', 'from', 'tags', 'story', 'qty', 'note', 'text']) if (o[k]) o[k] = tr(o[k]); for (const k of ['ingredients', 'steps']) if (o[k]) o[k] = trLines(o[k]); return o; };

      // ---------- The Recipe Box: two family recipes, one copied from a house recipe, two of their own ----------
      const orecchiette = ex(txt({ name: 'Nonna Pina’s orecchiette with turnip tops', kitchen: 'it', country: 'Bari, Puglia', from: 'Nonna Pina', family: 'yes', serves: 4, minutes: 35, gear: 'hob', tags: 'Sunday, family',
        ingredients: ['400 g orecchiette', '1 kg turnip tops (cime di rapa)', '4 anchovy fillets in oil', '2 cloves of garlic', '1 small dried chilli', '6 tbsp olive oil', '4 tbsp breadcrumbs'],
        steps: ['Wash the turnip tops and keep the tender leaves, florets and thin stalks.', 'Bring a large pan of salted water to the boil. Cook the turnip tops for 4 minutes, then add the orecchiette and cook them together until the pasta is al dente.', 'Meanwhile warm the olive oil with the garlic, the chilli and the anchovies in a wide pan, until the anchovies melt.', 'Toast the breadcrumbs in a dry pan until golden.', 'Drain the pasta and greens, keeping a cup of the water, and toss everything in the anchovy oil with a splash of that water.', 'Serve with the toasted breadcrumbs on top, the way Nonna did instead of cheese.'],
        story: 'Nonna Pina made orecchiette by hand every Sunday in Bari, pressing each one with her thumb. Marco learnt at eight, standing on a chair beside her. We buy the pasta now, but the sauce is still hers, written on a card in her slanting hand.' }));
      const hachee = ex(txt({ name: 'Oma Joke’s hachee', kitchen: 'nl', country: 'Drenthe, the Netherlands', from: 'Oma Joke', family: 'yes', serves: 4, minutes: 180, gear: 'onepot', tags: 'winter, Saturday',
        ingredients: ['750 g braising beef', '500 g onions', '40 g butter', '2 tbsp flour', '500 ml beef stock', '2 tbsp vinegar', '2 bay leaves', '4 whole cloves', '1 tbsp brown sugar'],
        steps: ['Cut the beef into large cubes and the onions into rings.', 'Brown the beef in the butter in a heavy pan, a few pieces at a time, and lift it out.', 'Soften the onions in the same pan for 10 minutes, sprinkle over the flour and stir for a minute.', 'Pour in the stock and the vinegar, add the bay leaves, cloves and sugar, and put the beef back.', 'Cover and simmer very gently for 2 hours 30 minutes, until the beef falls apart.', 'Serve with boiled potatoes and red cabbage.'],
        story: 'Oma Joke cooked hachee on the first cold Saturday of autumn, and by noon the whole house smelled of cloves. The card is in her handwriting, with a gravy stain in one corner. Sanne still makes it in Oma’s cast-iron pan.' }));
      // Copied from the house recipe of Tortilla de patatas, the way "Add to my Recipe Box" does it (kitchen.js, K.toRecipeBox).
      const t = dish('spa186');
      const tortilla = ex({ name: t.name, kitchen: t.k, country: [t.g, t.where].filter(Boolean).join(', '), serves: 4, minutes: 50, tags: t.type || '',
        ingredients: trLines(['800 g potatoes (peeled)', '1 onion (thinly sliced)', '1 tsp salt', '300 ml olive oil', '6 eggs']),
        steps: trLines(['Cut the potatoes in half lengthways and then into thin slices about 3 mm thick. Mix with the onion and half the salt.', 'Heat the olive oil in a 24 cm frying pan over a medium heat. Add the potatoes and onion and cook gently for 20 to 25 minutes, turning now and then, until soft but hardly coloured.', 'Drain them in a sieve over a bowl and keep the oil.', 'Beat the eggs with the rest of the salt, stir in the warm potatoes and onion and leave for 10 minutes.', 'Wipe the pan, heat 2 tablespoons of the kept oil over a medium-high heat and pour in the mixture. Shake the pan and cook for 3 to 4 minutes until the base is set and golden.', 'Put a large plate on top, turn the tortilla over onto it and slide it back into the pan. Cook for 2 to 3 minutes more. Serve hot, warm or cold.']),
        story: [t.story, tr('Leave out the onion if you are on that side of the debate. A juicy centre means lightly cooked egg: cook each side 2 minutes longer for the very young, the old and in pregnancy.')].filter(Boolean).join('\n\n'),
        source: tr('Busy Kitchen (not yet cooked by us)') });
      const wraps = ex(txt({ name: 'Air-fryer chicken wraps', kitchen: '', from: 'Sanne', serves: 4, minutes: 30, gear: 'airfryer', tags: 'quick, weekday',
        ingredients: ['600 g chicken thighs', '2 tsp smoked paprika', '1 tbsp olive oil', '8 tortilla wraps', '1 cucumber', '200 g Greek yoghurt', '1 lime'],
        steps: ['Cut the chicken into strips and toss with the paprika, the olive oil and a pinch of salt.', 'Cook in the air fryer at 200 °C for 12 to 14 minutes, shaking the basket halfway.', 'Warm the wraps in the air fryer for 1 minute.', 'Serve with sliced cucumber, the yoghurt and lime wedges, and let everyone roll their own.'],
        story: 'Our quick dinner since the air fryer came. Lotte rolls her own; Tiago eats the cucumber first.' }));
      const soup = ex(txt({ name: 'Marco’s red lentil soup', kitchen: '', from: 'Marco', serves: 6, minutes: 40, gear: 'onepot', tags: 'vegetarian, freezer',
        ingredients: ['300 g red lentils', '1 onion', '2 carrots', '1 tin chopped tomatoes', '1.5 l vegetable stock', '2 tsp ground cumin', '1 lemon'],
        steps: ['Chop the onion and carrots and soften them in a little oil for 8 minutes.', 'Stir in the cumin, then add the lentils, tomatoes and stock.', 'Simmer for 25 minutes, until the lentils have fallen apart.', 'Blend until smooth, squeeze in the lemon and season with salt.', 'Freeze what is left in portions.'],
        story: 'A big pot on Sunday evening, and two portions in the freezer for a busy week.' }));
      const recipes = [orecchiette, hachee, tortilla, wraps, soup];

      // ---------- The pantry: two things to use within three days, the rest can wait ----------
      const pantry = [
        ['Spinach', 'fridge', 1, '300 g bag', '', ''],
        ['Minced beef', 'fridge', 2, '500 g', '', 'For the shepherd’s pie'],
        ['Eggs', 'fridge', 12, '6', '', ''],
        ['Greek yoghurt', 'fridge', 6, '500 g', '', ''],
        ['Parmesan', 'fridge', 30, 'A piece of about 200 g', '', ''],
        ['Butter', 'fridge', 25, '250 g', '', ''],
        ['Potatoes', 'cupboard', 14, '2.5 kg', '', ''],
        ['Onions', 'cupboard', 20, '1 kg', '', ''],
        ['Risotto rice', 'cupboard', 240, 'Half a bag', '', ''],
        ['Tinned tomatoes', 'cupboard', 420, '3 tins', '', ''],
        ['Frozen peas', 'freezer', 150, '1 bag', '', ''],
        ['Marco’s red lentil soup', 'freezer', 75, '2 portions', 'yes', 'From last Sunday’s pot'],
      ].map(([name, where, n, qty, leftover, note]) => ex(txt({ name, where, useBy: day(n), qty, leftover, note })));

      // ---------- The coming two weeks: house dishes from all six kitchens, and two of their own recipes ----------
      const of = (id) => { const d = dish(id); return { dishId: d.id, name: d.name, k: d.k }; };
      const mine = (r) => ({ recipeId: r.id, name: r.name, k: r.kitchen });
      const plan = [
        [0, of('eng14')], [1, Object.assign(of('eng14'), { leftovers: true })], [2, of('spa186')], [3, mine(wraps)], [4, of('dut2')], [5, mine(orecchiette)],
        [6, of('por187')], [7, of('ger83')], [8, of('ita155')], [10, of('por24')], [11, of('dut37')], [12, of('por237')], [13, of('ger121')],
      ].map(([n, what]) => ex(Object.assign({ date: day(n) }, what)));

      // ---------- The shopping list: what the plan needs that the pantry does not have; two things already bought ----------
      const nameOf = (id) => dish(id).name;
      const shopping = [
        ['Carrots, 1 kg', nameOf('eng14')], ['Smoked sausage (rookworst)', nameOf('dut2')], ['Chicken thighs, 600 g', wraps.name], ['Tortilla wraps, 8', wraps.name], ['Cucumber', wraps.name],
        ['Orecchiette, 400 g', orecchiette.name], ['Turnip tops, 1 kg', orecchiette.name], ['Anchovy fillets in oil', orecchiette.name],
        ['Kale or spring greens, 250 g', nameOf('por187')], ['Chouriço', nameOf('por187')], ['Spätzle, 500 g', nameOf('ger83')], ['Emmental or mountain cheese, 300 g', nameOf('ger83')],
        ['Guanciale or pancetta, 150 g', nameOf('ita155')], ['Pecorino Romano, 80 g', nameOf('ita155')], ['White fish fillets, 600 g', nameOf('por24')], ['Coconut milk, 1 tin', nameOf('por24')],
        ['Fresh coriander', nameOf('por24')], ['Salt cod, 400 g', nameOf('por237')], ['Black olives', nameOf('por237')], ['Thin beef slices for rouladen, 4', nameOf('ger121')], ['Gherkins', nameOf('ger121')],
        ['Milk, 1 litre', nameOf('dut37'), true], ['Lemons', '', true],
      ].map(([text, forWhat, done]) => ex(Object.assign(txt({ text }), { for: forWhat, done: !!done })));

      // ---------- The passport: fifteen stamps from four kitchens (the carbonara twice), one with a note ----------
      const stamp = (id, n, more) => { const d = dish(id); return ex(Object.assign({ dishId: d.id, k: d.k, name: d.name, date: day(-n) }, more || {})); };
      const stampMine = (r, n) => ex({ recipeId: r.id, k: r.kitchen, name: r.name, date: day(-n) });
      const cooked = [
        stamp('dut1', 61), stamp('dut13', 40), stamp('dut37', 19), stamp('dut53', 33), stampMine(hachee, 26),
        stamp('ita155', 52), stamp('ita155', 9), stamp('ita28', 45), stamp('ita42', 23), stampMine(orecchiette, 12),
        stamp('spa186', 70), stamp('spa1', 88, { how: 'changed', note: tr('Half the garlic next time; the children found it too strong.') }), stamp('spa113', 30),
        stamp('eng22', 15), stamp('eng1', 5, { how: 'good' }),
      ];

      const put = [['recipes', recipes], ['pantry', pantry], ['plan', plan], ['shopping', shopping], ['cooked', cooked]];
      for (const [name, list] of put) await BW.store.putMany(name, list);
    },
  };
})();
