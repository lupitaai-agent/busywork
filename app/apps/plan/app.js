/* Week Plan & Shopping: the coming fourteen days' dinners for the household, leftovers marked as such, and the
   shopping list that follows from the plan minus what is already in the pantry. The list reaches the phone through
   the synced folder (Shopping list.txt in the kitchen folder) or as a printout. Portions follow the household. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const K = BW.kitchen;
  const main = $('#main');

  BW.boot({ app: 'plan', onReady: render, onChange: render });

  const household = () => Object.assign({ people: 2, allergies: '' }, BW.settings.kitchenHousehold || {});

  async function render() {
    const [plan, shopping, pantry, recipes] = await Promise.all(['plan', 'shopping', 'pantry', 'recipes'].map((n) => BW.store.all(n).catch(() => [])));
    const today = BW.today();
    const days = Array.from({ length: 14 }, (_, i) => BW.addDays(today, i));
    const hh = household();
    const open = shopping.filter((x) => !x.done), done = shopping.filter((x) => x.done);
    BW.partCount('week', open.length);
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Week plan')}</p><h1 class="big">${BW.t(plan.some((p) => p.date >= today) ? 'The coming two weeks at the table.' : 'Plan a few dinners, and the shopping list follows.')}</h1></div>
        <div class="start-row"><a class="btn" href="../../kitchen.html">🍳 ${BW.t('Find something for tonight')}</a><a class="btn" href="../pantry/index.html">🧺 ${BW.t('Pantry')}</a></div></div>
      <div class="week-grid">${days.map((d, i) => { const meals = plan.filter((p) => p.date === d); return `<section class="card day-cell ${i === 0 ? 'is-today' : ''}"><b>${i === 0 ? BW.t('Tonight') : BW.fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</b>
        ${meals.map((p) => { const k = K.kitchen(p.k); return `<div class="meal">${k ? k.flag : '📖'} ${esc(p.name)}${p.leftovers ? ` <small class="muted">· ${BW.t('leftovers')}</small>` : ''} <button class="link" data-del="${esc(p.id)}" aria-label="${BW.t('Take it off the plan')}">✕</button></div>`; }).join('')}
        <div class="day-acts"><button class="link" data-add="${d}">＋ ${BW.t(meals.length ? 'Another' : 'Add a dinner')}</button>${meals.length ? `<button class="link" data-left="${d}">🍲 ${BW.t('Leftovers?')}</button>` : ''}</div></section>`; }).join('')}</div>
      <div class="today" style="margin-top:18px"><div>
        <section class="card"><h2>🛒 ${BW.t('Shopping list')} <small>· ${open.length}</small></h2>
          <div class="have"><input class="in" data-new placeholder="${BW.t('Add something, then Enter')}" aria-label="${BW.t('Add to the shopping list')}"></div>
          ${open.map((x) => `<div class="shop-row"><input type="checkbox" data-tick="${esc(x.id)}" aria-label="${BW.t('Bought')}"><span>${esc(x.text)}${x.for ? ` <small class="muted">· ${esc(x.for)}</small>` : ''}</span></div>`).join('') || `<p class="muted">${BW.t('Nothing on the list.')}</p>`}
          ${done.length ? `<details style="margin-top:10px"><summary>${done.length} ${BW.t('bought')}</summary>${done.map((x) => `<div class="shop-row done"><input type="checkbox" checked data-tick="${esc(x.id)}"><span>${esc(x.text)}</span></div>`).join('')}<button class="btn btn-ghost" data-clear>${BW.t('Clear what is bought')}</button></details>` : ''}
          <div class="start-row" style="margin-top:12px"><button class="btn btn-primary" data-fill>🗓️ ${BW.t('Fill from the week plan')}</button><button class="btn" data-phone>📱 ${BW.t('Send to my phone')}</button><button class="btn" data-print>🖨️ ${BW.t('Print (PDF)')}</button></div>
          <p class="faint">${BW.t('“Send to my phone” saves Shopping list.txt in your kitchen folder. In a synced folder (iCloud, OneDrive, Dropbox, Google Drive) it opens on your phone.')}</p></section>
      </div><aside class="side-col">
        <section class="card">${ui.k(BW.t('Your household'))}<label class="field"><span>${BW.t('How many eat')}</span><input class="in" type="number" min="1" max="20" value="${esc(hh.people)}" data-people></label>
          <label class="field"><span>${BW.t('Allergies and diets')}</span><input class="in" value="${esc(hh.allergies)}" data-allergies placeholder="${BW.t('e.g. no nuts, one vegetarian')}"></label>
          <p class="faint">${BW.t('Recipes show their portions for this many people. Always check the labels of what you buy.')}</p></section>
      </aside></div></div>`;

    BW.$$('[data-add]', main).forEach((b) => { b.onclick = () => pick(b.dataset.add, recipes); });
    BW.$$('[data-del]', main).forEach((b) => { b.onclick = async () => { try { await BW.store.remove('plan', b.dataset.del); } catch (e) { BW.error(e); } }; });
    BW.$$('[data-left]', main).forEach((b) => { b.onclick = async () => { const m = plan.filter((p) => p.date === b.dataset.left); try { await BW.store.putMany('plan', m.map((p) => Object.assign(p, { leftovers: !p.leftovers }))); } catch (e) { BW.error(e); } }; });
    BW.$$('[data-tick]', main).forEach((c) => { c.onchange = async () => { const x = shopping.find((s) => s.id === c.dataset.tick); try { await BW.store.put('shopping', Object.assign(x, { done: c.checked })); } catch (e) { BW.error(e); } }; });
    const nw = $('[data-new]', main);
    nw.onkeydown = async (e) => { if (e.key !== 'Enter' || !nw.value.trim()) return; try { await BW.store.put('shopping', { text: nw.value.trim() }); } catch (err) { BW.error(err); } };
    const clear = $('[data-clear]', main); if (clear) clear.onclick = async () => { try { await BW.store.removeWhere('shopping', (x) => x.done); } catch (e) { BW.error(e); } };
    $('[data-fill]', main).onclick = () => fill(plan.filter((p) => p.date >= today && !p.leftovers), pantry, recipes, shopping);
    $('[data-phone]', main).onclick = async () => { try { await BW.store.writeFile('Shopping list.txt', new Blob([listText(open)], { type: 'text/plain' })); BW.toast(BW.t('Shopping list.txt is in your kitchen folder'), '📱'); } catch (e) { BW.error(e); } };
    $('[data-print]', main).onclick = () => {
      const doc = new BW.pdf.Doc();
      let y = 64;
      doc.text(BW.t('Shopping list'), 56, y, { size: 22, bold: true }); y += 22;
      doc.text(BW.fmtDate(BW.today(), { weekday: 'long', day: 'numeric', month: 'long' }), 56, y, { size: 11 }); y += 28;
      for (const x of open) { if (y > doc.H - 56) { doc.addPage(); y = 64; } doc.rect(56, y - 10, 11, 11, { stroke: '#1E1B2E' }); doc.text(`${x.text}${x.for ? '  (' + x.for + ')' : ''}`, 76, y, { size: 13 }); y += 24; }
      BW.download(doc.blob(BW.t('Shopping list')), `${BW.fileSafe(BW.t('Shopping list'))}.pdf`);
    };
    const saveHh = BW.debounce(async () => { try { await BW.store.saveSettings(Object.assign({}, BW.settings, { kitchenHousehold: Object.assign({}, BW.settings.kitchenHousehold, { people: Number($('[data-people]', main).value) || 1, allergies: $('[data-allergies]', main).value }) })); } catch (e) { BW.error(e); } }, 600);
    $('[data-people]', main).oninput = saveHh; $('[data-allergies]', main).oninput = saveHh;
  }

  const listText = (open) => `${BW.t('Shopping list')} · ${BW.fmtDate(BW.today(), { weekday: 'long', day: 'numeric', month: 'long' })}\n\n${open.map((x) => `☐ ${x.text}`).join('\n')}\n`;

  // The ingredients of the planned dinners, minus the pantry, staples and what is on the list already.
  async function fill(meals, pantry, recipes, shopping) {
    const have = pantry.filter((p) => !p.gone).map((p) => K.words(K.canon(p.name)));
    const onList = new Set(shopping.map((x) => x.text.toLowerCase()));
    const add = [];
    for (const m of meals) {
      const r = m.recipeId && recipes.find((x) => x.id === m.recipeId);
      const parts = r ? String(r.ingredients || '').split('\n').map((x) => x.trim()).filter(Boolean) : m.dishId && K.dish(m.dishId) ? K.parts(K.dish(m.dishId).ing) : [];
      for (const p of parts) {
        const w = K.words(K.canon(r ? K.recipeParts({ ingredients: p })[0] || p : p));
        if (!w.length || K.STAPLES.some((s) => K.words(s).join(' ') === w.join(' '))) continue;
        if (have.some((h) => h.length && (h.every((x) => w.includes(x)) || w.every((x) => h.includes(x))))) continue;
        if (onList.has(p.toLowerCase())) continue;
        onList.add(p.toLowerCase());
        add.push({ text: p, for: m.name });
      }
    }
    if (!add.length) return BW.toast(BW.t(meals.length ? 'Everything for the plan is in the pantry or on the list.' : 'Plan a dinner first.'), '🛒');
    try { await BW.store.putMany('shopping', add); BW.toast(`${add.length} ${BW.t('things on the list')}`, '🛒'); } catch (e) { BW.error(e); }
  }

  // Choose what to cook on a day: your recipes first, then any dish of the six kitchens.
  function pick(day, recipes) {
    const m = BW.modal({ title: `🗓️ ${BW.fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })}`, wide: true, body: `<input class="in" data-q placeholder="${BW.t('Search your recipes and the six kitchens')}" style="width:100%"><div data-res style="margin-top:10px;max-height:50vh;overflow:auto"></div>` });
    const res = $('[data-res]', m.body);
    const draw = (q) => {
      const w = K.words(q);
      const ok = (s) => !w.length || w.every((x) => K.words(s).some((y) => y.startsWith(x)));
      const mine = recipes.filter((r) => ok(`${r.name} ${r.tags} ${r.ingredients}`)).slice(0, 20).map((r) => ({ recipeId: r.id, name: r.name, k: r.kitchen || '', label: `📖 ${r.name}` }));
      const dishes = w.length ? K.dishes.filter((d) => ok(`${d.name} ${d.en} ${d.ing}`)).slice(0, 40).map((d) => ({ dishId: d.id, name: d.name, k: d.k, label: `${K.kitchen(d.k).flag} ${d.name}${d.en && d.en !== d.name ? ' · ' + d.en : ''}` })) : [];
      const all = mine.concat(dishes);
      res.innerHTML = all.map((x, i) => `<button class="line link" data-i="${i}" style="width:100%;text-align:left"><span>${esc(x.label)}</span></button>`).join('') || `<p class="muted">${BW.t(w.length ? 'Nothing found.' : 'Type a dish or an ingredient.')}</p>`;
      BW.$$('[data-i]', res).forEach((b) => { b.onclick = async () => { const x = all[Number(b.dataset.i)]; delete x.label; try { await BW.store.put('plan', Object.assign({ date: day }, x)); m.close(); } catch (e) { BW.error(e); } }; });
    };
    $('[data-q]', m.body).oninput = (e) => draw(e.target.value);
    draw('');
  }
})();
