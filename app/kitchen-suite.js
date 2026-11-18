/* Busy Kitchen opens on Tonight: what you have (your pantry, plus anything you type), and what it makes across the
   six kitchens and your own recipes: cook now, missing one, missing two. "Travel tonight" keeps it to one kitchen.
   Beside it: this week's food in the kitchens' calendars, what to use first, the passport and what your kitchen has. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const K = BW.kitchen;
  const main = $('#main');
  const KEY = 'busy:kitchen:tonight';
  const mem = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const keep = (x) => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(mem(), x))); } catch (e) { /* private window */ } };

  BW.boot({ part: 'today', onReady: render, onChange: render });

  async function render() {
    const s = BW.settings, today = BW.today();
    const [pantry, recipes, stamps] = await Promise.all(['pantry', 'recipes', 'cooked'].map((n) => BW.store.all(n).catch(() => [])));
    const m = mem();
    const typed = m.typed || [], off = m.off || [], travel = m.travel || '';
    const fromPantry = pantry.filter((p) => !p.gone).map((p) => p.name).filter((n) => n && !off.includes(n));
    const have = [...new Set(typed.concat(fromPantry))];
    const found = have.length ? K.match(have, { kitchen: travel, gear: K.gear(), recipes }) : [];
    const groups = [[0, 'Cook it now', 'You have everything (salt, oil and the like are taken as read).'], [1, 'Missing one thing', ''], [2, 'Missing two', '']]
      .map(([n, h, sub]) => ({ h, sub, list: found.filter((f) => f.missing.length === n).slice(0, 8) })).filter((g) => g.list.length);
    const useFirst = pantry.filter((p) => !p.gone && p.useBy && p.useBy <= BW.addDays(today, 3)).sort((a, b) => a.useBy.localeCompare(b.useBy));
    // The kitchen of the week: the travel choice, or each kitchen in turn, week by week.
    const week = Math.floor(Date.parse(today) / 6048e5);
    const kw = K.kitchen(travel && travel !== 'mine' ? travel : K.kitchens[week % K.kitchens.length].id);
    const lines = K.thisWeek(kw.id, today).slice(0, 4);
    const plan = (await BW.store.all('plan').catch(() => [])).find((p) => p.date === today);
    BW.partCount('today', useFirst.length);

    const row = (f, i) => {
      const it = f.item, k = K.kitchen(it.k || it.kitchen);
      return `<button type="button" class="cook-row link" data-hit="${i}" style="text-align:left;width:100%">
        <span aria-hidden="true">${k ? k.flag : '📖'}</span><span class="main"><b>${esc(it.name)}</b><small>${esc(f.kind === 'recipe' ? BW.t('Your recipe') : it.en || '')}${it.g ? ' · ' + esc(it.g) : ''}</small>
        ${f.missing.length ? `<span class="miss">${BW.t('Missing')}: ${esc(f.missing.join(', '))}</span>` : ''}${f.missing.map((m) => K.swapFor(m)).filter(Boolean).slice(0, 1).map((sw) => `<small class="swap">💡 ${BW.t('Can’t find it?')} ${esc(sw.use)}</small>`).join('')}</span></button>`;
    };
    let idx = 0; const flat = [];
    main.innerHTML = `<div class="today">
      <div>
        ${ui.hello(s.ownerName)}
        <h1 class="big">${BW.t(plan ? 'Tonight is planned.' : 'What shall we cook tonight?')}</h1>
        ${plan ? `<div class="card need" style="--c:var(--mint)"><span class="ic">🍽️</span><div class="nt"><b>${esc(plan.name)}</b><span>${BW.t('In your week plan for tonight')}</span></div><div class="na"><a class="btn btn-primary" href="apps/plan/index.html">${BW.t('Open the week')}</a></div></div>` : ''}
        <section class="card">
          ${ui.k(BW.t('What is in your fridge'))}
          <div class="have">${have.map((h) => `<span class="chip ${typed.includes(h) ? '' : 'pantry'}">${esc(h)}<button type="button" data-drop="${esc(h)}" aria-label="${BW.t('Take away')}">✕</button></span>`).join('')}
            <input class="in" data-add list="fridge-words" placeholder="${BW.t('Add what is in the fridge, then Enter')}" aria-label="${BW.t('Add an ingredient')}"><datalist id="fridge-words">${K.suggestions().map((w) => `<option value="${esc(w)}">`).join('')}</datalist></div>
          <p class="faint">${BW.t('Type in any of the six languages: Busy finds the dishes and recipes closest to what you have.')}</p>
          <p class="faint">${BW.t(fromPantry.length ? 'Dashed ones come from your pantry.' : 'Tip: keep your pantry in Busy and it fills this in for you.')}</p>
          ${ui.k(BW.t('Travel tonight')).replace('class="k"', 'class="k gap"')}
          <div class="travel"><button type="button" class="btn" data-travel="" aria-pressed="${!travel}">${BW.t('All six kitchens')}</button>${K.kitchens.map((k) => `<button type="button" class="btn" data-travel="${k.id}" aria-pressed="${travel === k.id}">${k.flag} ${esc(BW.t(k.name.replace(/^The /, '')))}</button>`).join('')}<button type="button" class="btn" data-travel="mine" aria-pressed="${travel === 'mine'}">📖 ${BW.t('My recipes')}</button></div>
        </section>
        ${!have.length ? `<div class="card all-clear"><div><b>${BW.t('Tell Busy what you have.')}</b><br><span class="muted">${BW.t('A few things from the fridge are enough: Busy looks through 1,886 dishes from six kitchens, and your own recipes.')}</span></div></div>` : ''}
        ${have.length && !groups.length ? `<div class="card all-clear"><div><b>${BW.t('Nothing matches yet.')}</b><br><span class="muted">${BW.t('Add a few more things, or travel to all six kitchens.')}</span></div></div>` : ''}
        ${groups.map((g) => `<section class="card cook-group"><h2>${BW.t(g.h)} <small>· ${g.list.length}</small></h2>${g.sub ? `<p class="faint">${BW.t(g.sub)}</p>` : ''}${g.list.map((f) => { flat.push(f); return row(f, idx++); }).join('')}</section>`).join('')}
      </div>
      <aside class="side-col">
        <a class="card" href="kitchen-calendar.html" style="text-decoration:none;color:inherit">${ui.k(`${kw.flag} ${BW.t('This week in')} ${esc(BW.t(kw.name.replace(/^The /, 'the ')))}`)}
          ${lines.length ? lines.map((c) => `<p class="s"><b>${esc(c.feast || c.when)}</b> · ${esc(c.what)}</p>`).join('') : `<p class="s">${esc(kw.line || '')}</p>`}</a>
        ${useFirst.length ? `<a class="card use-first" href="apps/pantry/index.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Use these first'))}${useFirst.slice(0, 5).map((p) => ui.line(`🧺 ${esc(p.name)}`, BW.fmtDate(p.useBy, { day: 'numeric', month: 'short' }))).join('')}</a>` : ''}
        ${K.passportCard(stamps)}
        ${K.gearCard()}
        <section class="card">${ui.k(BW.t('Conversions'))}<p class="s">${BW.t('Cups and grams, °F and °C, gas marks, fan ovens.')}</p><button class="btn" data-convert>⚖️ ${BW.t('Convert')}</button></section>
      </aside></div>`;

    const add = $('[data-add]', main);
    add.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      const v = add.value.trim().toLowerCase();
      if (!v) return;
      keep({ typed: [...new Set(typed.concat(v.split(/\s*,\s*/).filter(Boolean)))], off: off.filter((o) => o !== v) });
      render().then(() => { const a = $('[data-add]', main); if (a) a.focus(); });
    };
    BW.$$('[data-drop]', main).forEach((b) => { b.onclick = () => { const v = b.dataset.drop; keep(typed.includes(v) ? { typed: typed.filter((t) => t !== v) } : { off: off.concat(v) }); render(); }; });
    BW.$$('[data-travel]', main).forEach((b) => { b.onclick = () => { keep({ travel: b.dataset.travel }); render(); }; });
    BW.$$('[data-hit]', main).forEach((b) => { b.onclick = () => { const f = flat[Number(b.dataset.hit)]; if (f.kind === 'recipe') location.href = `apps/recipes/index.html#open/${f.item.id}`; else K.dishDrawer(f.item, render); }; });
    $('[data-convert]', main).onclick = K.convert;
    K.bindGear(main, render);
  }
})();
