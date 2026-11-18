/* Busy Kitchen: the six kitchens of the six languages, and the free tools around them (no AI). This file holds what
   every Kitchen screen shares: the kitchens and their 1,886 dishes (shared/kitchen-data.js, built from the research by
   kitchen/build_app_data.py), matching what you have against the dishes and your own recipes, the food calendar,
   what your kitchen can do, conversions, and the kitchen passport. */
(function () {
  'use strict';
  const BW = window.BW;
  const DATA = window.BW_KITCHEN || { kitchens: [], dishes: [] };
  const K = (BW.kitchen = {});

  K.kitchens = DATA.kitchens;
  // In the five other languages: the kitchens' names, lines, stories and picture captions (kitchen/content/kitchens-<lang>.json).
  const L = (DATA.i18n || {})[window.BusyLang || document.documentElement.lang || ''];
  if (L) for (const k of K.kitchens) {
    const t = (L.kitchens || {})[k.id];
    if (t) Object.assign(k, { name: t.name || k.name, line: t.line || k.line, story: t.story || k.story, say: t.say || k.say });
    for (const p of k.pictures) if ((L.captions || {})[p.id]) p.title = L.captions[p.id];
  }
  // The dish details and the kitchens' regions, pantry, customs and calendar in this language
  // (shared/kitchen/details-<lang>.js, loaded by kitchen-data.js). The English stays underneath for what the app
  // reads rather than shows: ingredients for matching, the kind for the kitchen-gear filter, the dates for the calendar.
  const DET = window.BW_KITCHEN_DETAILS;
  for (const d of DATA.dishes) { d._ing = d.ing; d._type = d.type; d._en = d.en; }
  for (const k of K.kitchens) for (const c of k.calendar) { c._when = c.when; c._feast = c.feast; }
  if (DET) {
    for (const d of DATA.dishes) {
      const o = (DET.dishes || {})[d.id];
      if (o) {
        // An empty description of the name is on purpose: the name needs none in this language.
        if ('en' in o) d.en = o.en;
        for (const f of ['where', 'type', 'when', 'ing', 'story', 'eaten', 'prot']) if (o[f] && (f !== 'prot' || d.prot)) d[f] = o[f];
      }
    }
    for (const k of K.kitchens) {
      const t = (DET.kitchens || {})[k.id];
      if (t) for (const f of ['regions', 'pantry', 'customs', 'calendar']) {
        if (t[f] && t[f].length === k[f].length) k[f] = k[f].map((x, i) => Object.assign({}, x, ...Object.entries(t[f][i]).filter(([, v]) => v).map(([c, v]) => ({ [c]: v }))));
      }
    }
  }
  for (const k of K.kitchens) k.calendar = k.calendar.filter((c) => !c.skip);  // lines the research left as "n/a"
  // A dash the research used for "no feast" is no feast (and never an em dash on screen).
  for (const k of K.kitchens) for (const c of k.calendar) for (const f of ['feast', 'what', 'when']) if (/^\s*[—–-]\s*$/.test(c[f] || '')) c[f] = '';
  K.dishes = DATA.dishes;
  K.kitchen = (id) => K.kitchens.find((k) => k.id === id) || null;
  K.dish = (id) => K.dishes.find((d) => d.id === id) || null;
  K.dishesOf = (id) => K.dishes.filter((d) => d.k === id);
  K.pic = (id) => `${BW.root}shared/kitchen/pics/${id}.jpg`;
  K.cover = (k) => (k.pictures[0] ? K.pic(k.pictures[0].id) : '');
  // Shown wherever the pictures are: they are made with AI, and say so (EU AI Act, article 50).
  K.AI_NOTE = 'Pictures made with AI to show each kitchen’s places and customs.';

  // ---------- Words: one ingredient in many spellings ----------
  // Assumed to be at home, and never a reason a dish "needs shopping".
  K.STAPLES = ['salt', 'pepper', 'black pepper', 'water', 'oil', 'olive oil', 'sunflower oil', 'vegetable oil', 'butter', 'flour', 'sugar', 'vinegar', 'stock', 'broth'];
  const singular = (w) => w.replace(/(ies)$/, 'y').replace(/(oes|ches|shes|sses|xes)$/, (m) => m.slice(0, -2)).replace(/([^s])s$/, '$1');
  const words = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter((w) => w.length > 1).map(singular);
  K.words = words;
  // A dish's key ingredients, as separate items ("Curly kale, potatoes, bacon" → three).
  // Words in an ingredient list that describe the cooking, not an ingredient ("Grated potatoes, onion, fried").
  const NOT_ING = /^(fried|boiled|baked|roasted|grilled|grated|chopped|sliced|smoked|steamed|stewed|served|optional|to taste|various|seasonal|spices|herbs|seasoning)$/i;
  K.parts = (ing) => String(ing || '').split(/[,;]| and | or |\//).map((x) => x.replace(/\([^)]*\)/g, '').trim()).filter((x) => x && x.length < 60 && !NOT_ING.test(x));
  const isStaple = (part) => { const w = words(part).join(' '); return K.STAPLES.some((s) => w === words(s).join(' ')); };
  // The kitchens' own names for everyday things, so "smoked sausage" finds the rookworst.
  const SYN = { rookworst: 'smoked sausage', rasher: 'bacon', speck: 'bacon', pancetta: 'bacon', lardon: 'bacon', spek: 'bacon', guanciale: 'bacon', banger: 'sausage', wurst: 'sausage', worst: 'sausage', salsiccia: 'sausage', linguica: 'sausage', kartoffel: 'potato', aardappel: 'potato', patata: 'potato', batata: 'potato', boerenkool: 'kale', grünkohl: 'kale', zwiebel: 'onion', ui: 'onion', cebolla: 'onion', cipolla: 'onion', cebola: 'onion', ei: 'egg', huevo: 'egg', uovo: 'egg', ovo: 'egg', mince: 'minced beef', hackfleisch: 'minced beef', gehakt: 'minced beef', aubergine: 'eggplant', courgette: 'zucchini', coriander: 'cilantro', prawn: 'shrimp', scallion: 'spring onion', collard: 'couve' };
  const syn = (ws) => ws.flatMap((w) => (SYN[w] ? words(SYN[w]) : [w]));

  // The fridge dictionary (shared/kitchen-words.js): every name in the six languages leads to one English name, so
  // what you type in your own language meets the dishes' ingredient lists.
  const ROWS = window.BW_KITCHEN_WORDS || [];
  const COL = { en: 0, nl: 1, de: 2, es: 3, it: 4, pt: 5, 'pt-br': 5 };
  const flat = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’'`]/g, '').replace(/\s+/g, ' ').trim();
  const LEX = new Map();
  for (const r of ROWS) { const en = r[0].split('|')[0]; r.forEach((cell) => cell.split('|').forEach((f) => { if (!LEX.has(flat(f))) LEX.set(flat(f), en); })); }
  /* "aardappelen" → "potato", "carne picada" → "minced beef"; a phrase it does not know is read word by word. */
  K.canon = (s) => { const n = flat(s); if (LEX.has(n)) return LEX.get(n); return n.split(' ').map((w) => LEX.get(w) || w).join(' '); };
  // Ingredients abroad (shared/kitchen-swaps.js): what to use when a kitchen's ingredient is hard to find.
  K.SWAPS = window.BW_KITCHEN_SWAPS || [];
  const col = () => COL[window.BusyLang || 'en'] || 0;
  K.swapsOf = (kid) => K.SWAPS.filter((x) => x.k === kid).map((x) => ({ name: x.name[col()] || x.name[0], use: x.use[col()] || x.use[0] }));
  K.swapFor = (part) => { const n = flat(part); const x = K.SWAPS.find((sw) => sw.match.split('|').some((m) => n.includes(flat(m)))); return x ? { name: x.name[col()] || x.name[0], use: x.use[col()] || x.use[0] } : null; };
  // The names the fridge suggests while you type: the first form in the language of the app.
  K.suggestions = () => { const c = COL[window.BusyLang || 'en'] || 0; return [...new Set(ROWS.map((r) => (r[c] || r[0]).split('|')[0]))].sort((a, b) => a.localeCompare(b)); };
  // A last word that says too little on its own ("tomato sauce" is not "soy sauce").
  const WEAK_HEAD = new Set(['sauce', 'oil', 'powder', 'paste', 'juice', 'water', 'flour', 'sugar', 'stock', 'cream', 'leaf', 'seed', 'meat', 'bread']);

  /* Does "have" (what you typed or keep in the pantry) cover this ingredient? A word match in either direction
     ("kale" covers "curly kale"), or the same main word at the end ("smoked sausage" covers "pork sausages"). */
  function covers(haveWords, part) {
    const pw = syn(words(part));
    if (!pw.length) return true;
    return haveWords.some((h) => {
      const hw = syn(h);
      if (!hw.length) return false;
      if (hw.every((w) => pw.includes(w)) || pw.every((w) => hw.includes(w))) return true;
      const head = hw[hw.length - 1];
      return head === pw[pw.length - 1] && !WEAK_HEAD.has(head);
    });
  }

  /* Everything that can be cooked with what you have: the six kitchens' dishes and your own recipes.
     have: ['kale', 'potatoes', …]  opts: { kitchen: 'it' | '', gear, recipes, max }
     → [{ kind: 'dish'|'recipe', item, need: [...], missing: [...], score }] best first. */
  K.match = (have, opts = {}) => {
    const hw = have.map((h) => words(K.canon(h))).filter((w) => w.length);
    const out = [];
    const consider = (kind, item, parts) => {
      const need = parts.filter((p) => !isStaple(p));
      // A dish of staples and one thing (butter cake: eggs) is no answer to "what can I make with this?".
      if (need.length < 2) return;
      const missing = need.filter((p) => !covers(hw, p));
      const got = need.length - missing.length;
      if (!got) return;
      out.push({ kind, item, need, missing, score: got / need.length + Math.min(got, 4) * 0.02 });
    };
    if (opts.kitchen !== 'mine') for (const d of K.dishes) if ((!opts.kitchen || d.k === opts.kitchen) && K.fits(d, opts.gear)) consider('dish', d, K.parts(d._ing || d.ing));
    for (const r of opts.recipes || []) if ((!opts.kitchen || opts.kitchen === 'mine' || r.kitchen === opts.kitchen) && K.fits(r, opts.gear)) consider('recipe', r, K.recipeParts(r));
    out.sort((a, b) => a.missing.length - b.missing.length || b.score - a.score);
    return out.slice(0, opts.max || 60);
  };
  // A recipe's ingredient lines without the amounts ("2 large red onions, chopped" → "red onions").
  K.recipeParts = (r) => String(r.ingredients || '').split(/\n/).map((l) => l.replace(/^[\s•*-]*[\d½¼¾⅓⅔.,/\s]*(g|kg|ml|l|dl|cl|tbsp|tsp|el|tl|cup|cups|oz|lb|pinch|clove|cloves|tin|tins|can|cans|bunch|handful|large|small|medium)?\b\.?\s*(of\s+)?/i, '').split(',')[0].trim()).filter(Boolean);

  // ---------- What the kitchen can do ----------
  // Saved in the settings as kitchenGear. The filter reads a dish's type and words: a guess, and the screen says so.
  K.GEAR = [['oven', '🔥', 'An oven'], ['airfryer', '🌀', 'An air fryer'], ['onepot', '🍲', 'One pot only']];
  const NEEDS_OVEN = /\b(bak|baked|bake|roast|oven|cake|bread|pie|tart|biscuit|cookie|pastr|torte|kuchen|gratin|pizza|lasagn|strudel|quiche|crumble|scone|focaccia|stollen|brood|taart|koek|pastel|bolo|empanada|flan)\w*/i;
  const ONE_POT = /\b(stew|soup|pot|risotto|stamppot|eintopf|guiso|cocido|curry|chili|chilli|casserole|porridge|polenta|feijoada|caldo|sopa|minestr|hotpot|goulash|gulasch|fabada|potaje|snert)\w*/i;
  K.fits = (item, gear) => {
    if (!gear) return true;
    const text = `${item._type || item.type || ''} ${item.name || ''} ${item._en || item.en || ''} ${item.eaten || ''} ${item.tags || ''}`;
    if (gear.oven === false && !gear.airfryer && NEEDS_OVEN.test(text)) return false;
    if (gear.onepot && !ONE_POT.test(text)) return false;
    return true;
  };
  K.gear = () => Object.assign({ oven: true, airfryer: false, onepot: false }, (BW.settings && BW.settings.kitchenGear) || {});

  // ---------- The food calendar ----------
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  /* Which months a calendar line is about, and the day if it names one: "5–6 Jan" → [{m:0, d:5}],
     "Carnival (Feb/Mar)" → [{m:1}, {m:2}], "Advent" → December, "Easter" → March and April. */
  const FEASTS = { advent: [11], christmas: [11], kerst: [11], natal: [11], natale: [11], navidad: [11], weihnacht: [11], sinterklaas: [10, 11], easter: [2, 3], pasen: [2, 3], ostern: [2, 3], pascua: [2, 3], pasqua: [2, 3], 'semana santa': [2, 3], carnival: [1, 2], carnaval: [1, 2], fasching: [1, 2], lent: [1, 2, 3], thanksgiving: [10], 'new year': [0, 11], halloween: [9], 'festa junina': [5, 6], 'são joão': [5] };
  K.whenMonths = (when, feast) => {
    const s = `${when || ''} ${feast || ''}`.toLowerCase();
    const found = [];
    const re = /(\d{1,2})?(?:[–-]\d{1,2})?\s*\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/g;
    let m;
    while ((m = re.exec(s))) found.push({ m: MONTHS.indexOf(m[2]), d: m[1] ? Number(m[1]) : 0 });
    if (!found.length) for (const [k, ms] of Object.entries(FEASTS)) if (s.includes(k)) ms.forEach((x) => found.push({ m: x, d: 0 }));
    return found;
  };
  // Every kitchen's calendar lines, each with its months: [{ k, when, feast, what, g, months }]
  K.calendar = () => K.kitchens.flatMap((k) => k.calendar.map((c) => Object.assign({ k: k.id, months: K.whenMonths(c._when || c.when, c._feast || c.feast) }, c)));
  /* This week's food, or this month's: lines with a day within ten days of today first, then the month's. */
  K.thisWeek = (kitchenId, iso) => {
    const t = new Date((iso || BW.today()) + 'T12:00:00');
    const month = t.getMonth(), day = t.getDate();
    const lines = K.calendar().filter((c) => !kitchenId || c.k === kitchenId);
    const near = lines.filter((c) => c.months.some((x) => x.m === month && x.d && Math.abs(x.d - day) <= 10));
    const inMonth = lines.filter((c) => !near.includes(c) && c.months.some((x) => x.m === month));
    return near.concat(inMonth);
  };

  // ---------- Conversions ----------
  // Grams in one US cup (240 ml) of each kind; one tablespoon is 1/16 cup.
  K.CUP = { flour: 125, sugar: 200, 'brown sugar': 220, 'icing sugar': 120, butter: 227, rice: 185, oats: 90, cocoa: 85, honey: 340, milk: 240, water: 240, oil: 218 };
  K.GAS = [[1, 140], [2, 150], [3, 170], [4, 180], [5, 190], [6, 200], [7, 220], [8, 230], [9, 240]];
  K.toC = (f) => Math.round(((f - 32) * 5) / 9);
  K.toF = (c) => Math.round((c * 9) / 5 + 32);
  K.gasOf = (c) => K.GAS.reduce((best, g) => (Math.abs(g[1] - c) < Math.abs(best[1] - c) ? g : best))[0];
  K.fan = (c) => c - 20; // a fan oven runs about 20 °C hotter than a conventional one

  // ---------- The kitchen passport ----------
  // One stamp per dish cooked, kept in the "cooked" collection: { dishId | recipeId, k, date }.
  K.stamps = async () => BW.store.all('cooked').catch(() => []);
  K.stamp = (item, kind) => BW.store.put('cooked', { [kind === 'recipe' ? 'recipeId' : 'dishId']: item.id, k: item.k || item.kitchen || '', name: item.name, date: BW.today() });
  K.passport = (stamps) => K.kitchens.map((k) => ({ k, n: new Set(stamps.filter((s) => s.k === k.id).map((s) => s.dishId || s.recipeId)).size, of: K.dishesOf(k.id).length }));

  // ---------- Words on screen ----------
  K.storyNote = (d) => (d.uv ? `<p class="faint">${BW.t('This story has not been checked against a second source yet.')}</p>` : '');
  K.badge = (k) => `<span class="k-flag" title="${BW.esc(BW.t(k.name))}">${k.flag}</span>`;

  // ---------- Shared drawers and dialogs ----------
  const { esc } = BW;
  /* One dish of the six kitchens: where it is from, what goes in, its story, how it is eaten. Buttons to stamp the
     passport and to put it in the week plan. */
  K.dishDrawer = (d, after) => {
    const k = K.kitchen(d.k);
    const row = (label, v) => (v ? `<dt>${BW.t(label)}</dt><dd>${esc(v)}</dd>` : '');
    const dr = BW.drawer({ title: `${k ? k.flag : ''} ${esc(d.name)}`, body: `
      ${d.en && d.en !== d.name ? `<p class="muted">${esc(d.en)}</p>` : ''}
      <div data-recipe></div>
      <h3>${BW.t('About this dish')}</h3>
      <dl class="kv">${row('From', [d.g, d.where].filter(Boolean).join(' · '))}${row('Kind', d.type)}${row('When', d.when)}${row('What goes in', d.ing)}${row('How it is eaten', d.eaten)}${row('Protected name', d.prot)}</dl>
      ${d.story ? `<h3>${BW.t('The story')}</h3><p>${esc(d.story)}</p>${K.storyNote(d)}` : ''}
      <div class="start-row" style="margin-top:18px"><button class="btn btn-primary" data-cooked>🍳 ${BW.t('I cooked this')}</button><button class="btn" data-plan>🗓️ ${BW.t('Plan it')}</button><button class="btn" data-box hidden>📖 ${BW.t('Add to my Recipe Box')}</button><button class="btn" data-how hidden>💬 ${BW.t('Tell us how it went')}</button>${k ? `<a class="btn btn-ghost" href="${BW.root}apps/kitchens/index.html#${k.id}">${k.flag} ${BW.t(k.name)}</a>` : ''}</div>` });
    BW.$('[data-cooked]', dr.body).onclick = async () => { try { await K.stamp(d, 'dish'); BW.toast(BW.t('Stamped in your passport'), '🛂'); if (after) after(); } catch (e) { BW.error(e); } };
    BW.$('[data-plan]', dr.body).onclick = () => K.planIt({ dishId: d.id, name: d.name, k: d.k }, after);
    K.recipeOf(d.id).then((r) => {
      if (!r) return;
      const box = BW.$('[data-recipe]', dr.body);
      K.showRecipe(box, r);
      if (r.k !== 'r') return;
      const add = BW.$('[data-box]', dr.body), how = BW.$('[data-how]', dr.body);
      add.hidden = false; how.hidden = false;
      add.onclick = () => K.toRecipeBox(d, r);
      how.onclick = () => K.howItWent(d, after);
    });
    return dr;
  };

  // ---------- The house recipes (kitchen/recipes, built into shared/kitchen/recipes-<lang>.js) ----------
  // Written by Busy, checked against the rules in kitchen/recipes/README.md, and not yet cooked by us: every recipe
  // says so, and asks how it went.
  const LANG_COL = () => COL[window.BusyLang || 'en'] || 0;
  let loading = null;
  K.recipes = () => loading || (loading = new Promise((done) => {
    if (window.BW_KITCHEN_RECIPES) return done(window.BW_KITCHEN_RECIPES);
    const lang = ['nl', 'de', 'es', 'it', 'pt-br'].includes(window.BusyLang) ? window.BusyLang : 'en';
    const add = (l, then) => { const s = document.createElement('script'); s.src = `${BW.root}shared/kitchen/recipes-${l}.js`; s.onload = () => done(window.BW_KITCHEN_RECIPES || {}); s.onerror = then; document.head.appendChild(s); };
    add(lang, () => (lang === 'en' ? done({}) : add('en', () => done({}))));
  }));
  K.recipeOf = (id) => K.recipes().then((all) => all[id] || null).catch(() => null);

  // Units and allergens in the six languages: [singular, plural] per language (en, nl, de, es, it, pt).
  const U = {
    tsp: [['tsp'], ['tl'], ['TL'], ['cdta.'], ['cucchiaino', 'cucchiaini'], ['colher (chá)', 'colheres (chá)']],
    tbsp: [['tbsp'], ['el'], ['EL'], ['cda.'], ['cucchiaio', 'cucchiai'], ['colher (sopa)', 'colheres (sopa)']],
    pinch: [['pinch', 'pinches'], ['snufje', 'snufjes'], ['Prise', 'Prisen'], ['pizca', 'pizcas'], ['pizzico', 'pizzichi'], ['pitada', 'pitadas']],
    clove: [['clove', 'cloves'], ['teen', 'tenen'], ['Zehe', 'Zehen'], ['diente', 'dientes'], ['spicchio', 'spicchi'], ['dente', 'dentes']],
    sprig: [['sprig', 'sprigs'], ['takje', 'takjes'], ['Zweig', 'Zweige'], ['ramita', 'ramitas'], ['rametto', 'rametti'], ['raminho', 'raminhos']],
    bunch: [['bunch', 'bunches'], ['bos', 'bossen'], ['Bund', 'Bund'], ['manojo', 'manojos'], ['mazzo', 'mazzi'], ['maço', 'maços']],
    slice: [['slice', 'slices'], ['plak', 'plakken'], ['Scheibe', 'Scheiben'], ['rebanada', 'rebanadas'], ['fetta', 'fette'], ['fatia', 'fatias']],
    sheet: [['sheet', 'sheets'], ['vel', 'vellen'], ['Blatt', 'Blätter'], ['lámina', 'láminas'], ['foglio', 'fogli'], ['folha', 'folhas']],
    can: [['tin', 'tins'], ['blik', 'blikken'], ['Dose', 'Dosen'], ['lata', 'latas'], ['scatola', 'scatole'], ['lata', 'latas']],
    handful: [['handful', 'handfuls'], ['handje', 'handjes'], ['Handvoll', 'Handvoll'], ['puñado', 'puñados'], ['manciata', 'manciate'], ['punhado', 'punhados']],
    leaf: [['leaf', 'leaves'], ['blad', 'blaadjes'], ['Blatt', 'Blätter'], ['hoja', 'hojas'], ['foglia', 'foglie'], ['folha', 'folhas']],
    stick: [['stick', 'sticks'], ['stokje', 'stokjes'], ['Stange', 'Stangen'], ['rama', 'ramas'], ['stecca', 'stecche'], ['pau', 'paus']],
    loaf: [['loaf', 'loaves'], ['brood', 'broden'], ['Laib', 'Laibe'], ['pan', 'panes'], ['pagnotta', 'pagnotte'], ['pão', 'pães']],
    piece: [['piece', 'pieces'], ['stuk', 'stuks'], ['Stück', 'Stück'], ['unidad', 'unidades'], ['pezzo', 'pezzi'], ['unidade', 'unidades']],
    cake: [['cake', 'cakes'], ['taart', 'taarten'], ['Kuchen', 'Kuchen'], ['tarta', 'tartas'], ['torta', 'torte'], ['bolo', 'bolos']],
    litre: [['litre', 'litres'], ['liter', 'liter'], ['Liter', 'Liter'], ['litro', 'litros'], ['litro', 'litri'], ['litro', 'litros']],
    jar: [['jar', 'jars'], ['pot', 'potten'], ['Glas', 'Gläser'], ['tarro', 'tarros'], ['vasetto', 'vasetti'], ['pote', 'potes']],
    tray: [['tray', 'trays'], ['bakplaat', 'bakplaten'], ['Blech', 'Bleche'], ['bandeja', 'bandejas'], ['teglia', 'teglie'], ['assadeira', 'assadeiras']],
    pie: [['pie', 'pies'], ['taart', 'taarten'], ['Pastete', 'Pasteten'], ['pastel', 'pasteles'], ['torta', 'torte'], ['torta', 'tortas']],
    portion: [['portion', 'portions'], ['portie', 'porties'], ['Portion', 'Portionen'], ['ración', 'raciones'], ['porzione', 'porzioni'], ['porção', 'porções']],
    glass: [['glass', 'glasses'], ['glas', 'glazen'], ['Glas', 'Gläser'], ['vaso', 'vasos'], ['bicchiere', 'bicchieri'], ['copo', 'copos']],
  };
  K.unit = (u, q) => { const f = (U[u] || [])[LANG_COL()] || (U[u] || [])[0]; return f ? (q > 1 && f[1] ? f[1] : f[0]) : u; };
  const ALLERGEN = {
    gluten: ['gluten', 'gluten', 'Gluten', 'gluten', 'glutine', 'glúten'], crustaceans: ['crustaceans', 'schaaldieren', 'Krebstiere', 'crustáceos', 'crostacei', 'crustáceos'],
    eggs: ['eggs', 'ei', 'Eier', 'huevo', 'uova', 'ovos'], fish: ['fish', 'vis', 'Fisch', 'pescado', 'pesce', 'peixe'],
    peanuts: ['peanuts', 'pinda’s', 'Erdnüsse', 'cacahuetes', 'arachidi', 'amendoim'], soy: ['soy', 'soja', 'Soja', 'soja', 'soia', 'soja'],
    milk: ['milk', 'melk', 'Milch', 'leche', 'latte', 'leite'], nuts: ['nuts', 'noten', 'Schalenfrüchte', 'frutos de cáscara', 'frutta a guscio', 'castanhas e nozes'],
    celery: ['celery', 'selderij', 'Sellerie', 'apio', 'sedano', 'aipo'], mustard: ['mustard', 'mosterd', 'Senf', 'mostaza', 'senape', 'mostarda'],
    sesame: ['sesame', 'sesamzaad', 'Sesam', 'sésamo', 'sesamo', 'gergelim'], sulphites: ['sulphites', 'sulfiet', 'Sulfite', 'sulfitos', 'solfiti', 'sulfitos'],
    lupin: ['lupin', 'lupine', 'Lupinen', 'altramuces', 'lupini', 'tremoço'], molluscs: ['molluscs', 'weekdieren', 'Weichtiere', 'moluscos', 'molluschi', 'moluscos'],
  };
  K.allergen = (a) => (ALLERGEN[a] || [a])[LANG_COL()] || a;
  /* What a dish contains, in the language, always with the labels line: as plain text (the Recipe Box copy, Sal) and on screen. */
  K.allergenText = (list) => `${list && list.length ? `${BW.t('Contains')}: ${list.map(K.allergen).join(', ')}. ` : ''}${BW.t('Always check the labels of what you buy.')}`;
  K.allergenHtml = (list) => `<p class="r-allergens">${list && list.length ? `<b>${BW.t('Contains')}:</b> ${esc(list.map(K.allergen).join(', '))}. ` : ''}<small class="muted">${BW.t('Always check the labels of what you buy.')}</small></p>`;
  const LEVEL = { easy: 'Easy', medium: 'Takes some care', project: 'A project' };

  // An amount at a new size, rounded the way a cook would write it: ½ and ¼ for spoons and pieces, round grams.
  K.amount = (q, u, f) => {
    if (q == null) return '';
    let v = q * f;
    if (['g', 'ml'].includes(u)) v = v >= 100 ? Math.round(v / 10) * 10 : v >= 20 ? Math.round(v / 5) * 5 : Math.round(v);
    else if (['kg', 'l'].includes(u)) v = Math.round(v * 100) / 100;
    else v = Math.round(v * 4) / 4 || 0.25;
    const whole = Math.floor(v), part = v - whole, frac = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[part];
    if (!['g', 'ml', 'kg', 'l', 'cm'].includes(u) && frac) return `${whole || ''}${frac}`;
    return v.toLocaleString(window.BusyLang || 'en');
  };

  /* A house recipe in a drawer or page: the "not yet cooked by us" line, times and oven, a size you can change,
     the ingredients (in groups), the method, the tip and what it contains. A note (a cheese, a ham, a café drink)
     is a short paragraph instead. */
  K.showRecipe = (el, r) => {
    if (r.k !== 'r') { el.innerHTML = r.n ? `<h3>${BW.t('How to enjoy it')}</h3><p>${esc(r.n)}</p>${K.allergenHtml(r.a)}` : ''; return; }
    const base = r.s || (r.y ? r.y[0] : 4);
    let n = base;
    const min = (m) => (m >= 120 && m % 60 === 0 ? `${m / 60} ${BW.t('hours')}` : m >= 90 ? `${Math.floor(m / 60)} ${BW.t('h')} ${m % 60} ${BW.t('min')}` : `${m} ${BW.t('min')}`);
    const meta = [r.t[0] ? `${BW.t('Prep')} ${min(r.t[0])}` : '', r.t[1] ? `${BW.t('Cooking')} ${min(r.t[1])}` : '', r.t[2] ? `${BW.t('Waiting time')} ${min(r.t[2])}` : '',
      r.o ? `${BW.t('Oven')} ${r.o[0]} °C (${BW.t('fan')} ${r.o[1]} °C, ${BW.t('gas mark')} ${r.o[2]}, ${K.toF(r.o[0])} °F)` : '', BW.t(LEVEL[r.l] || '')].filter(Boolean);
    const draw = () => {
      const f = n / base;
      let group = null;
      const lines = r.i.map(([q, u, name, note, g]) => {
        const head = g && g !== group ? `<li class="r-group">${esc(g)}</li>` : '';
        group = g;
        const amt = K.amount(q, u, f), unit = q == null || !u || u === 'piece' ? '' : ['g', 'kg', 'ml', 'l', 'cm'].includes(u) ? u : K.unit(u, q * f);
        return `${head}<li><span class="r-q">${esc([amt, unit].filter(Boolean).join(' '))}</span> <span>${esc(name)}${note ? `<small class="muted">, ${esc(note)}</small>` : ''}</span></li>`;
      }).join('');
      const size = r.s ? `${n} ${BW.t(n === 1 ? 'person' : 'people')}` : `${n} ${K.unit(r.y[1], n)}`;
      el.innerHTML = `<div class="r-card">
        <p class="r-untested"><span class="chip">🧪 ${BW.t('Not yet cooked by us')}</span> <small class="muted">${BW.t('Written and checked by Busy, not yet cooked in our kitchen. Tell us how it went.')}</small></p>
        <p class="r-meta muted">${meta.map(esc).join(' · ')}</p>
        <div class="r-size"><button class="btn btn-ghost" data-less aria-label="${BW.t('Fewer')}">−</button><b>${esc(size)}</b><button class="btn btn-ghost" data-more aria-label="${BW.t('More')}">+</button></div>
        <h3>${BW.t('Ingredients')}</h3><ul class="r-ing">${lines}</ul>
        <h3>${BW.t('Method')}</h3><ol class="r-steps">${r.st.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        ${r.tip ? `<p class="r-tip"><b>${BW.t('Tip')}:</b> ${esc(r.tip)}</p>` : ''}
        ${K.allergenHtml(r.a)}
      </div>`;
      BW.$('[data-less]', el).onclick = () => { const step = base >= 8 ? Math.round(base / 4) : 1; if (n - step >= 1) { n -= step; draw(); } };
      BW.$('[data-more]', el).onclick = () => { const step = base >= 8 ? Math.round(base / 4) : 1; n += step; draw(); };
    };
    draw();
  };

  /* The house recipe as your own copy in the Recipe Box, where you can change it, cook it step by step and print it. */
  K.toRecipeBox = async (d, r) => {
    const f = 1;
    const ing = r.i.map(([q, u, name, note]) => [K.amount(q, u, f), q == null || !u || u === 'piece' ? '' : ['g', 'kg', 'ml', 'l', 'cm'].includes(u) ? u : K.unit(u, q), name, note ? `(${note})` : ''].filter(Boolean).join(' ')).join('\n');
    try {
      const rec = await BW.store.put('recipes', { name: d.name, kitchen: d.k, country: [d.g, d.where].filter(Boolean).join(', '), serves: r.s || '', minutes: r.t[0] + r.t[1],
        ingredients: ing, steps: r.st.join('\n'), story: [d.story, r.tip, K.allergenText(r.a)].filter(Boolean).join('\n\n'), source: BW.t('Busy Kitchen (not yet cooked by us)'), tags: d.type || '' });
      BW.toast(BW.t('In your Recipe Box'), '📖');
      location.href = `${BW.root}apps/recipes/index.html#open/${encodeURIComponent(rec.id)}`;
    } catch (e) { BW.error(e); }
  };

  /* "Tell us how it went": kept with your cooked dishes (it stamps the passport too), and a link to the comments on
     Busy Kitchen's itch.io page (owner, 18 November 2026: "itch io, in comments"). */
  K.FEEDBACK_URL = 'https://busyai.itch.io/busy-kitchen#comments';
  K.howItWent = (d, after) => {
    BW.modal({ title: `💬 ${BW.t('How did it go?')}`, body: `<p><b>${esc(d.name)}</b></p>
      <div class="start-row" role="radiogroup">${[['good', '😋', 'It worked'], ['changed', '🤔', 'I had to change it'], ['bad', '😕', 'It did not work']].map(([v, e, l]) => `<label class="chip"><input type="radio" name="how" value="${v}"> ${e} ${BW.t(l)}</label>`).join('')}</div>
      <label class="field"><span>${BW.t('What would you change? Amounts, times, the oven, a step')}</span><textarea class="in" rows="4" data-note></textarea></label>
      <p class="faint">${BW.t('This stays on your computer. To help us improve the recipe, leave a comment on the Busy Kitchen page too.')} <a href="${K.FEEDBACK_URL}" target="_blank" rel="noopener">${BW.t('Leave a comment')} ↗</a></p>`,
      actions: [{ label: BW.t('Never mind'), kind: 'ghost' }, { label: BW.t('Save'), kind: 'primary', onClick: async () => {
        const how = (document.querySelector('input[name="how"]:checked') || {}).value || '';
        const note = BW.$('[data-note]', document.body).value.trim();
        try { await BW.store.put('cooked', { dishId: d.id, k: d.k, name: d.name, date: BW.today(), how, note }); BW.toast(BW.t('Saved with your cooked dishes'), '🛂'); if (after) after(); } catch (e) { BW.error(e); }
      } }] });
  };

  /* Put a dish or recipe on a day of the week plan. */
  K.planIt = (what, after) => {
    const days = Array.from({ length: 14 }, (_, i) => BW.addDays(BW.today(), i));
    BW.modal({ title: `🗓️ ${BW.t('Plan it')}`, body: `<p><b>${esc(what.name)}</b></p><label class="field"><span>${BW.t('Which day?')}</span>
      <select class="in" data-day>${days.map((d, i) => `<option value="${d}">${i === 0 ? BW.t('Tonight') : i === 1 ? BW.t('Tomorrow') : BW.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</option>`).join('')}</select></label>`,
      actions: [{ label: BW.t('Never mind'), kind: 'ghost' }, { label: BW.t('Plan it'), kind: 'primary', onClick: async (close) => {
        const day = BW.$('[data-day]', document.body).value;
        try { await BW.store.put('plan', Object.assign({ date: day }, what)); BW.toast(BW.t('In the week plan'), '🗓️'); if (after) after(); } catch (e) { BW.error(e); }
      } }] });
  };

  /* Cups and grams, Fahrenheit and Celsius, gas marks, fan and conventional ovens. */
  K.convert = () => {
    const kinds = Object.keys(K.CUP);
    const m = BW.modal({ title: `⚖️ ${BW.t('Conversions')}`, body: `
      <h3>${BW.t('Cups and grams')}</h3><div class="conv"><label>${BW.t('Cups')}<input class="in" type="number" step="0.25" min="0" value="1" data-cups></label>
      <label>${BW.t('Of')}<select class="in" data-kind>${kinds.map((k) => `<option value="${k}">${esc(BW.t(k))}</option>`).join('')}</select></label><p class="out" data-g></p></div>
      <h3>${BW.t('Oven')}</h3><div class="conv"><label>°C<input class="in" type="number" step="5" value="180" data-c></label><label>°F<input class="in" type="number" step="5" value="356" data-f></label><p class="out" data-o></p></div>
      <h3>${BW.t('Weight')}</h3><div class="conv"><label>oz<input class="in" type="number" step="0.5" value="4" data-oz></label><label>lb<input class="in" type="number" step="0.25" value="1" data-lb></label><p class="out" data-w></p></div>
      <p class="faint">${BW.t('A cup is 240 ml. A fan oven runs about 20 °C hotter, so it is set 20 °C lower.')}</p>`, actions: [{ label: BW.t('Done'), kind: 'primary' }] });
    const $ = (s) => BW.$(s, m.body), n = (s) => Number($(s).value) || 0;
    const draw = (from) => {
      $('[data-g]').textContent = `= ${Math.round(n('[data-cups]') * K.CUP[$('[data-kind]').value])} g`;
      if (from === 'f') $('[data-c]').value = K.toC(n('[data-f]')); else $('[data-f]').value = K.toF(n('[data-c]'));
      const c = n('[data-c]');
      $('[data-o]').textContent = `${BW.t('Gas mark')} ${K.gasOf(c)} · ${BW.t('Fan oven')} ${K.fan(c)} °C`;
      $('[data-w]').textContent = `${Math.round(n('[data-oz]') * 28.35)} g · ${Math.round(n('[data-lb]') * 453.6)} g`;
    };
    m.body.addEventListener('input', (e) => draw(e.target.matches('[data-f]') ? 'f' : 'c'));
    draw('c');
  };

  /* What is in the kitchen: the dishes and recipes follow it. */
  K.gearCard = () => {
    const g = K.gear();
    return `<section class="card">${BW.ui.k(BW.t('What is in your kitchen'))}${K.GEAR.map(([id, e, label]) => `<label class="check-line"><input type="checkbox" data-gear="${id}" ${g[id] ? 'checked' : ''}> ${e} ${BW.t(label)}</label>`).join('')}
      <p class="faint">${BW.t('Without an oven, dishes that are baked or roasted step aside. Busy guesses this from each dish’s kind.')}</p></section>`;
  };
  K.bindGear = (root, after) => BW.$$('[data-gear]', root).forEach((box) => { box.onchange = async () => {
    const g = K.gear(); g[box.dataset.gear] = box.checked;
    try { await BW.store.saveSettings(Object.assign({}, BW.settings, { kitchenGear: g })); if (after) after(); } catch (e) { BW.error(e); }
  }; });

  K.passportCard = (stamps) => `<a class="card" href="${BW.root}apps/kitchens/index.html#passport" style="text-decoration:none;color:inherit">${BW.ui.k(BW.t('Your kitchen passport'))}
    <div class="passport">${K.passport(stamps).map((p) => `<div class="stamp ${p.n ? 'on' : ''}"><span class="f">${p.k.flag}</span><small>${p.n}</small></div>`).join('')}</div>
    <p class="faint">${BW.t('A stamp for every dish you cook from each kitchen.')}</p></a>`;
})();
