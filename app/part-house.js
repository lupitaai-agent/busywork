/* Two parts of Busy Home, each one screen. The tray: drop the post in, see what still wants a date. Dates: everything
   at home that has a day attached, month by month, for the year ahead. The page says which it is (data-part). */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const H = BW.house;
  const main = $('#main'), part = document.body.dataset.part;

  BW.boot({ part, onReady: render, onChange: render });

  const also = (ids) => `<p class="also">${BW.t('Also here:')} ${ids.map((id) => BW.apps.find((a) => a.id === id)).filter(Boolean).map((a) => `<a href="apps/${a.id}/index.html">${a.emoji} ${esc(BW.t(a.name))}</a>`).join(' · ')}</p>`;

  async function render() {
    const today = BW.today();
    const [papers, contracts, upkeep, inventory, moves] = await Promise.all(['papers', 'contracts', 'upkeep', 'inventory', 'moves'].map((n) => BW.store.all(n)));
    if (part === 'tray') {
      // What is filed but not finished: no date, or a name that is still the file's name.
      const open = papers.filter((p) => !p.replaced && !p.expires && !p.reviewAt && (p.kind === 'other' || !p.person)).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 8);
      const recent = papers.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 8);
      main.innerHTML = `<div class="part-page">
        <div class="part-head"><div><p class="hello">${BW.t('The tray')}</p><h1 class="big">${BW.t('Drop the post in. It is dealt with.')}</h1></div></div>
        <div class="tray-two">${H.trayHtml(true)}
          <div class="side-col">
            ${open.length ? `<section class="card">${ui.k(BW.t('Still wants a date or a name'))}${open.map((p) => ui.line(`${H.kind(p.kind)[1]} ${esc(p.title || 'A document')}`, BW.t('Finish'), `apps/papers/index.html#open/${p.id}`)).join('')}</section>` : ''}
            <section class="card">${ui.k(BW.t('Filed lately'))}${recent.length ? recent.map((p) => ui.line(`${H.kind(p.kind)[1]} ${esc(p.title || 'A document')}`, p.expires ? BW.fmtDate(p.expires, { month: 'short', year: 'numeric' }) : '', `apps/papers/index.html#open/${p.id}`)).join('') : `<p class="s">${BW.t('Nothing filed yet. Start with a passport: Busy tells you four months before it runs out.')}</p>`}</section>
          </div></div>
        ${also(['papers', 'inventory'])}</div>`;
      H.bindTray(main, render);
      return;
    }
    // Dates: the year ahead, month by month.
    const all = H.upcoming({ papers, contracts, upkeep, inventory, moves }, today, 365);
    const overdue = all.filter((x) => x.left < 0), ahead = all.filter((x) => x.left >= 0);
    const byMonth = {};
    ahead.forEach((x) => { (byMonth[x.date.slice(0, 7)] = byMonth[x.date.slice(0, 7)] || []).push(x); });
    const live = contracts.filter((c) => H.contractState(c, today) !== 'ended');
    const row = (x) => `<a class="line" href="apps/${x.app}/index.html#open/${x.id}"><span>${x.emoji} ${esc(BW.t(x.text))}</span><b>${BW.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b></a>`;
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('Dates')}</p><h1 class="big">${BW.t(ahead.length ? 'Everything at home that has a day.' : 'No dates yet. Add a contract or a passport.')}</h1></div>
        <div class="start-row"><a class="btn" href="apps/contracts/index.html#new">🔁 ${BW.t('A contract')}</a><a class="btn" href="apps/papers/index.html#new">🪪 ${BW.t('A document')}</a><a class="btn" href="apps/upkeep/index.html#new">🛠️ ${BW.t('An upkeep job')}</a></div></div>
      <div class="dates-two"><div>
        ${overdue.length ? `<section class="card month over"><h2>⚠️ ${BW.t('Overdue')}</h2>${overdue.map(row).join('')}</section>` : ''}
        ${Object.keys(byMonth).sort().map((m) => `<section class="card month"><h2>${BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' })}</h2>${byMonth[m].map(row).join('')}</section>`).join('')}
      </div><aside class="side-col">
        <section class="card">${ui.k(BW.t('What you pay for'))}<h2>${BW.money(H.totalMonthly(live, today))} ${BW.t('a month')}</h2><p class="s">${live.length} ${BW.t(live.length === 1 ? 'contract' : 'contracts')} · ${BW.money(H.totalMonthly(live, today) * 12)} ${BW.t('a year')}</p></section>
        <section class="card">${ui.k(BW.t('How Busy counts'))}<p class="s">${BW.t('A contract that renews by itself shows its last day to cancel. A passport shows four months before it runs out, because a new one takes weeks.')}</p></section>
      </aside></div>
      ${also(['contracts', 'upkeep', 'moving'])}</div>`;
  }
})();
