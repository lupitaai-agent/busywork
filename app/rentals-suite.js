/* Busy Rentals opens on This month: at most three things for the homes you let, each with one button, then what is
   coming and the rent of the month. The tools are in the parts of the rail. */
(function () {
  'use strict';
  const { $, esc, ui } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';

  BW.boot({ part: 'today', onReady: render, onChange: render });

  const HEAD = ['Nothing needs you this month. Every home is in order.', 'One thing this month. Then every home is in order.', 'Two things this month. Then every home is in order.', 'Three things this month. Then every home is in order.'];

  async function render() {
    const s = BW.settings, today = BW.today();
    const [homes, tenancies, checks, payments] = await Promise.all(['homes', 'tenancies', 'checks', 'rentpayments'].map((n) => BW.store.all(n).catch(() => [])));
    const needs = [];
    const add = (w, n) => needs.push(Object.assign({ w }, n));
    const nameOf = (id) => { const h = homes.find((x) => x.id === id); return h ? h.name || h.address || BW.t('A home') : BW.t('A home'); };
    // Amounts in the money of the home's country (pounds for a home in England, whatever the landlord's own setting).
    const curOf = (t) => R.currencyOf(R.countryOf(homes.find((h) => h.id === t.homeId) || {}, s, lang()), s);

    // Rent that is late, per tenancy.
    for (const t of R.live(tenancies, today)) {
      const st = R.rentStatus(t, payments, today);
      if (st.open > 0) add(90 + st.monthsLate, { c: 'tomato', e: '💶', t: `${nameOf(t.homeId)}: ${BW.money(st.open, curOf(t))} ${BW.t('rent not in yet')}`, s: `${R.lateText(st)} · ${t.tenants || ''}`, b: 'Open the rent', href: `apps/rent/index.html#open/${t.id}` });
    }
    // Duties, copies owed, deposits and reviews in the next 30 days (or overdue).
    for (const x of R.upcoming({ homes, tenancies, checks }, s, lang(), today, 30)) {
      if (x.kind === 'year') continue;
      const w = x.left < 0 ? 85 : 70 - x.left;
      const href = x.kind === 'deposit' || x.kind === 'review' ? `apps/rent/index.html#open/${x.tenancyId}` : `apps/homes/index.html#open/${x.homeId}`;
      add(w, { c: x.kind === 'handover' ? 'grape' : x.kind === 'deposit' ? 'mint' : 'sky', e: x.emoji, t: BW.t(x.text), s: `${x.left < 0 ? BW.t('was due') : BW.t('Due')} ${BW.fmtDate(x.date, { weekday: 'long', day: 'numeric', month: 'long' })}`, b: 'Open it', href });
    }
    // Duties never recorded have no date, so they never come up above; without this, a home with an unknown
    // certificate would be called "in order".
    for (const h of homes) {
      const n = R.dutiesFor(h, R.countryOf(h, s, lang()), tenancies, checks, today).filter((x) => x.state === 'unknown').length;
      if (n) add(60, { c: 'sun', e: '❔', t: `${nameOf(h.id)}: ${n} ${BW.t(n === 1 ? 'date not recorded yet' : 'dates not recorded yet')}`, s: BW.t('Add when it was last done, and Busy keeps the next date.'), b: 'Open it', href: `apps/homes/index.html#open/${h.id}` });
    }
    // A landlord who has only just started.
    if (!homes.length) add(30, { c: 'sky', e: '🏠', t: 'Add the home you let', s: 'A few questions, then your rental on a page: the next dates and what is in order', b: 'Add it', href: 'apps/homes/index.html#new' });
    else if (!tenancies.length) add(30, { c: 'sky', e: '🔑', t: 'Add who lives there', s: 'The rent, the deposit and the start date', b: 'Add a tenancy', href: `apps/homes/index.html#open/${homes[0].id}` });
    needs.sort((a, b) => b.w - a.w);
    const top = needs.slice(0, 3);
    BW.partCount('today', top.length);

    const coming = R.upcoming({ homes, tenancies, checks }, s, lang(), today, 120).filter((x) => x.left >= 0 && !top.some((n) => n.t === BW.t(x.text))).slice(0, 6);
    const month = today.slice(0, 7);
    const live = R.live(tenancies, today);
    // This month's rent: what falls due and what came in, per currency (one line each for a landlord in one country).
    const rentNow = {};
    for (const t of live) {
      const k = curOf(t) || '', x = (rentNow[k] = rentNow[k] || { due: 0, got: 0 });
      x.due += (R.rentDue(t, month).find((m) => m.month === month) || { amount: 0 }).amount;
      x.got += payments.filter((p) => p.tenancyId === t.id && (p.month || String(p.date || '').slice(0, 7)) === month).reduce((sum, p) => sum + R.amount(p.amount), 0);
    }
    const code = R.countryOf({}, s, lang()), pack = R.pack(code);

    main.innerHTML = `<div class="today">
      <div>
        ${ui.hello(s.ownerName)}
        <h1 class="big">${BW.t(HEAD[Math.min(top.length, 3)])}</h1>
        ${top.map((n, i) => ui.need(n, i)).join('')}
        ${!top.length ? `<div class="card all-clear"><div><b>${BW.t('All in order.')}</b><br><span class="muted">${BW.t('Busy keeps watching the dates. Enjoy the month.')}</span></div></div>` : ''}
        ${ui.k(BW.t('Add something')).replace('class="k"', 'class="k gap"')}
        <div class="start-row"><a class="btn" href="apps/homes/index.html#new">🏠 ${BW.t('A home')}</a><a class="btn" href="apps/rent/index.html">💶 ${BW.t('Rent received')}</a><a class="btn" href="apps/rentcosts/index.html#new">🧾 ${BW.t('A cost')}</a></div>
      </div>
      <aside class="side-col">
        ${live.length ? `<a class="card" href="apps/rent/index.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Rent this month'))}${Object.entries(rentNow).map(([k, x]) => ui.line(BW.t('Due'), BW.money(x.due, k || undefined)) + ui.line(BW.t('In'), BW.money(x.got, k || undefined))).join('')}</a>` : ''}
        ${coming.length ? `<a class="card" href="rentals-dates.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Coming up'))}${coming.map((x) => ui.line(`${x.emoji} ${esc(BW.t(x.text))}`, BW.fmtDate(x.date, { day: 'numeric', month: 'short' }))).join('')}</a>` : ''}
        <section class="card">${ui.k(BW.t('Your country’s rules'))}${pack ? `<p class="s">${pack.flag} ${esc(pack.name)} · ${BW.t('checked on')} ${BW.fmtDate(pack.checked)}</p><p class="s">${BW.t('Busy keeps the dates and the records, with the official source for each. It never gives legal or tax advice.')}</p>` : `<p class="s">${BW.t('Busy knows the landlord’s year in England, the Netherlands and Germany. In other countries it keeps your homes, rent, deposits, costs and letters, without country dates.')}</p>`}</section>
      </aside></div>`;
  }
})();
