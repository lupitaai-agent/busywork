/* The landlord's year: every date across the homes you let, month by month, and the country's rules behind them,
   each with its official source and the day Busy last checked it. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';

  BW.boot({ part: 'dates', onReady: render, onChange: render });

  async function render() {
    const s = BW.settings, today = BW.today();
    const [homes, tenancies, checks] = await Promise.all(['homes', 'tenancies', 'checks'].map((n) => BW.store.all(n).catch(() => [])));
    const all = R.upcoming({ homes, tenancies, checks }, s, lang(), today, 366);
    const over = all.filter((x) => x.left < 0), ahead = all.filter((x) => x.left >= 0);
    const byMonth = {};
    ahead.forEach((x) => { (byMonth[x.date.slice(0, 7)] = byMonth[x.date.slice(0, 7)] || []).push(x); });
    const href = (x) => (x.kind === 'year' ? x.source : x.kind === 'deposit' || x.kind === 'review' ? `apps/rent/index.html#open/${x.tenancyId}` : `apps/homes/index.html#open/${x.homeId}`);
    const row = (x) => `<a class="line" href="${esc(href(x))}"${x.kind === 'year' ? ' target="_blank" rel="noopener"' : ''}><span>${x.emoji} ${esc(BW.t(x.text))}</span><b>${BW.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'short' })}</b></a>`;
    const codes = [...new Set((homes.length ? homes : [{}]).map((h) => R.countryOf(h, s, lang())).filter(Boolean))];
    main.innerHTML = `<div class="part-page">
      <div class="part-head"><div><p class="hello">${BW.t('The landlord’s year')}</p><h1 class="big">${BW.t(ahead.length ? 'Every date for the homes you let.' : 'No dates yet. Add the home you let.')}</h1></div>
        <div class="start-row"><a class="btn" href="apps/homes/index.html#new">🏠 ${BW.t('A home')}</a></div></div>
      <div class="dates-two"><div>
        ${over.length ? `<section class="card month over"><h2>⚠️ ${BW.t('Overdue')}</h2>${over.map(row).join('')}</section>` : ''}
        ${Object.keys(byMonth).sort().map((m) => `<section class="card month"><h2>${BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' })}</h2>${byMonth[m].map(row).join('')}</section>`).join('')}
      </div><aside class="side-col">
        ${codes.map((c) => { const p = R.pack(c); return `<section class="card">${ui.k(`${p.flag} ${esc(p.name)}`)}<p class="s">${BW.t('Checked on')} ${BW.fmtDate(p.checked)}</p>
          ${p.duties.map((d) => `<p class="s">${d.emoji} <a href="${esc(d.source)}" target="_blank" rel="noopener">${esc(BW.t(d.what))}</a>${d.changing ? ` <span class="duty-state soon">${BW.t('Changing')}</span>` : ''}</p>`).join('')}
          <p class="s">🛡️ ${esc(BW.t(p.deposit.capWhat || ''))} ${esc(BW.t(p.deposit.returnWhat || ''))}</p><p class="s">📈 ${esc(BW.t(p.rentReview.what))}</p>
          ${(p.know || []).length ? `${ui.k(BW.t('Good to know')).replace('class="k"', 'class="k gap"')}${p.know.map((k) => `<p class="s">💡 <a href="${esc(k.source)}" target="_blank" rel="noopener">${esc(BW.t(k.what))}</a>${k.changing ? ` <span class="duty-state soon">${BW.t('Changing')}</span>` : ''}</p>`).join('')}` : ''}</section>`; }).join('')
          || `<section class="card">${ui.k(BW.t('Your country’s rules'))}<p class="s">${BW.t('Busy knows the landlord’s year in England, the Netherlands and Germany. In other countries it keeps your homes, rent, deposits, costs and letters, without country dates.')}</p></section>`}
        <section class="card">${ui.k(BW.t('What Busy does'))}<p class="s">${BW.t('Busy keeps the dates and the records, with the official source for each. It never gives legal or tax advice, and it never sends anything to anyone.')}</p></section>
      </aside></div></div>`;
  }
})();
