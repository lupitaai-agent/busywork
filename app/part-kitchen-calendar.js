/* The food calendar: what each of the six kitchens cooks through the year, feast by feast and season by season,
   month by month from this one. Lines with no clear month (a moveable feast described in words) come last. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const K = BW.kitchen;
  const main = $('#main');
  let only = '';

  BW.boot({ part: 'calendar', onReady: render, onChange: render });

  function render() {
    const now = new Date(BW.today() + 'T12:00:00').getMonth();
    const all = K.calendar().filter((c) => !only || c.k === only);
    const months = Array.from({ length: 12 }, (_, i) => (now + i) % 12);
    const lineHtml = (c) => { const k = K.kitchen(c.k); return `<div class="line"><span>${k.flag} <b>${esc(c.feast || c.when)}</b>${c.feast ? ` <small class="muted">${esc(c.when)}</small>` : ''}${c.g ? ` <small class="muted">· ${esc(c.g)}</small>` : ''}<br><span class="muted">${esc(c.what)}</span></span></div>`; };
    const undated = all.filter((c) => !c.months.length);
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Food calendar')}</p><h1 class="big">${BW.t('What the six kitchens cook, through the year.')}</h1></div></div>
      <div class="tabs-row"><button class="btn" data-only="" aria-pressed="${!only}">${BW.t('All six')}</button>${K.kitchens.map((k) => `<button class="btn" data-only="${k.id}" aria-pressed="${only === k.id}">${k.flag} ${esc(BW.t(k.name.replace(/^The /, '')))}</button>`).join('')}</div>
      ${months.map((m) => { const ls = all.filter((c) => c.months.some((x) => x.m === m)).sort((a, b) => ((a.months.find((x) => x.m === m) || {}).d || 99) - ((b.months.find((x) => x.m === m) || {}).d || 99));
        return ls.length ? `<section class="card month"><h2>${BW.fmtDate(`2026-${String(m + 1).padStart(2, '0')}-01`, { month: 'long' })}${m === now ? ` · ${BW.t('now')}` : ''}</h2>${ls.map(lineHtml).join('')}</section>` : ''; }).join('')}
      ${undated.length ? `<section class="card month"><h2>${BW.t('Through the year')}</h2>${undated.map(lineHtml).join('')}</section>` : ''}
      <p class="faint">${BW.t('From the research behind Busy Kitchen. Moveable feasts such as Easter and Carnival fall in different weeks each year.')}</p></div>`;
    BW.$$('[data-only]', main).forEach((b) => { b.onclick = () => { only = b.dataset.only; render(); }; });
  }
})();
