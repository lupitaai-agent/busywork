/* Rent & Deposits: for each tenancy, the rent month by month (what was due, what came in, what is late) with one
   click to note a payment, a rent receipt as PDF, a new rent from a date, and where the deposit stands: the most it
   may be in this country, the date to protect it by, the date to return it by. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';
  let homes = [], tenancies = [], payments = [], showEnded = false;

  BW.boot({
    app: 'rent',
    onReady: async () => {
      await load(); render();
      BW.route({ open: async (id) => { await load(); const t = tenancies.find((x) => x.id === id); if (t) openTenancy(t); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  async function load() { [homes, tenancies, payments] = await Promise.all(['homes', 'tenancies', 'rentpayments'].map((n) => BW.store.all(n).catch(() => []))); }
  const homeOf = (t) => homes.find((h) => h.id === t.homeId) || {};
  const label = (t) => `${homeOf(t).name || homeOf(t).address || BW.t('A home')} · ${t.tenants || BW.t('A tenant')}`;
  const codeOf = (t) => R.countryOf(homeOf(t), BW.settings, lang());
  // Amounts in the money of the home's country (pounds for a home in England, whatever the landlord's own setting).
  const money = (v, t) => BW.money(v, R.currencyOf(codeOf(t), BW.settings));
  // "£300.00 a week", "€1,250.00 a month": the rent as the tenant pays it today.
  const rentWords = (t, day) => { const r = R.rentNow(t, day || BW.today()); return `${money(r.amount, t)} ${BW.t(r.per === 'week' ? 'a week' : 'a month')}`; };
  const monthName = (m) => BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' });

  function render() {
    const today = BW.today(), list = (showEnded ? tenancies : R.live(tenancies, today)).slice().sort((a, b) => label(a).localeCompare(label(b)));
    // What is late stays here until it is in, also after the tenant has left.
    const late = tenancies.map((t) => [t, R.rentStatus(t, payments, today)]).filter(([, s]) => s.open > 0);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">💶</span> ${BW.t('Rent & Deposits')}</h1><p class="lead">${BW.t('What came in, what is late, and where each deposit stands.')}</p></div>
      </div>
      ${late.length ? `<section class="card attention rise"><h2>⏰ ${BW.t('Not in yet')}</h2>${late.map(([t, s]) => `<a class="file-row" href="#open/${t.id}"><span>💶</span><span class="main"><b>${esc(label(t))}</b><small>${esc([R.lateText(s), t.endedAt && t.endedAt < today ? BW.t(`ended on ${BW.fmtDate(t.endedAt)}`) : ''].filter(Boolean).join(' · '))}</small></span><b>${money(s.open, t)}</b></a>`).join('')}</section>` : ''}
      ${list.length ? list.map((t) => {
        const s = R.rentStatus(t, payments, today), ds = R.depositState(codeOf(t), t, today);
        return `<a class="card" href="#open/${t.id}" style="display:block;text-decoration:none;color:inherit;margin-top:14px"><h2>${esc(label(t))}</h2>
          <p class="s">${rentWords(t, today)}${t.endedAt ? ` · ${BW.t(`ended on ${BW.fmtDate(t.endedAt)}`)}` : ''}</p>
          <p>${s.open ? `<span class="duty-state overdue">${BW.t(`${money(s.open, t)} still open`)}</span>` : `<span class="duty-state ok">${BW.t('Paid up')}</span>`}
          ${ds.amount ? `<span class="duty-state ${ds.over || (ds.protectLeft != null && ds.protectLeft < 0) ? 'overdue' : ds.protectBy || ds.returnBy ? 'soon' : 'ok'}">🛡️ ${BW.t('Deposit')} ${money(ds.amount, t)}</span>` : ''}</p></a>`;
      }).join('') : `<section class="card"><h2>${BW.t('No tenancies yet.')}</h2><p class="s">${BW.t('Add one to a home in Homes & Tenancies.')}</p><a class="btn btn-primary" href="../homes/index.html">🏠 ${BW.t('Homes & Tenancies')}</a></section>`}
      ${tenancies.length > R.live(tenancies, today).length ? `<p style="margin-top:14px"><button class="btn btn-ghost" data-ended>${BW.t(showEnded ? 'Hide ended tenancies' : 'Show ended tenancies')}</button></p>` : ''}`;
    const e = $('[data-ended]', main); if (e) e.onclick = () => { showEnded = !showEnded; render(); };
  }

  function openTenancy(t) {
    const box = document.createElement('div');
    BW.drawer({ title: esc(label(t)), body: box, onClose: async () => { await load(); render(); } });
    const draw = async () => {
      await load();
      t = tenancies.find((x) => x.id === t.id) || t;
      const today = BW.today(), code = codeOf(t), pack = R.pack(code), s = R.rentStatus(t, payments, today), ds = R.depositState(code, t, today);
      const from = !t.endedAt && R.rentReviewFrom(code, t), rents = (t.rents || []).slice().sort((a, b) => String(b.from).localeCompare(String(a.from)));
      const per = BW.t(t.rentPer === 'week' ? 'a week' : 'a month');
      box.innerHTML = `
        <h3>💶 ${BW.t('Rent, month by month')}</h3>
        <p class="s">${rentWords(t, today)}${s.credit > 0 ? ` · ${BW.t('Paid ahead')}: ${money(s.credit, t)}` : ''}</p>
        <div class="table-scroll"><table class="ledger"><thead><tr><th>${BW.t('Month')}</th><th class="n due">${BW.t('Due')}</th><th class="n">${BW.t('In')}</th><th class="n">${BW.t('Open')}</th><th></th></tr></thead><tbody>
          ${s.months.slice().reverse().slice(0, 24).map((m) => `<tr class="${m.late ? 'late' : ''}"><td>${BW.fmtDate(m.month + '-01', { month: 'short', year: 'numeric' })}</td><td class="n due">${money(m.amount, t)}</td><td class="n">${money(m.paid, t)}</td><td class="n">${m.open ? money(m.open, t) : '✓'}</td>
            <td class="acts">${m.open ? `<button class="btn" data-pay="${m.month}">${BW.t('Paid')}</button>` : `<button class="btn btn-ghost" data-receipt="${m.month}">📄 ${BW.t('Receipt')}</button>`}${m.received ? `<button class="btn btn-ghost" data-unpay="${m.month}" title="${BW.t('Remove')}" aria-label="${BW.t('Remove')}">✕</button>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        ${s.months.length ? '' : `<p class="s">${BW.t('Add the start date and the rent to the tenancy, and the months appear here.')}</p>`}
        <h3 style="margin-top:18px">🛡️ ${BW.t('The deposit')}</h3>
        ${ds.amount ? `<p>${money(ds.amount, t)}${ds.cap != null ? ` · ${BW.t('at most')} ${money(ds.cap, t)}` : ''}${t.depositHeld ? ` · ${esc(t.depositHeld)}` : ''}</p>
          ${ds.over ? `<p class="duty-state overdue">⚠️ ${BW.t('Above the most allowed here.')}</p>` : ''}
          ${ds.protectBy ? `<p><span class="duty-state wrap ${ds.protectLeft < 0 ? 'overdue' : 'soon'}">${esc(BW.t(pack.deposit.protectWhat))}: ${BW.t(`due by ${BW.fmtDate(ds.protectBy)}`)}</span></p>` : t.depositProtectedAt ? `<p class="s">✓ ${BW.t('Protected on')} ${BW.fmtDate(t.depositProtectedAt)}</p>` : ''}
          ${ds.returnBy ? `<p><span class="duty-state ${ds.returnLeft < 0 ? 'overdue' : 'soon'}">${BW.t('Return it by')} ${BW.fmtDate(ds.returnBy)}</span></p>` : ''}
          ${ds.returnWhat ? `<p class="s">${esc(BW.t(ds.returnWhat))}</p>` : ''}
          ${t.depositReturnedAt ? `<p class="s">✓ ${BW.t('Returned on')} ${BW.fmtDate(t.depositReturnedAt)}</p>` : ''}`
          : `<p class="s">${BW.t('No deposit noted.')}</p>`}
        ${pack ? `<p class="s"><a href="${esc(pack.deposit.source)}" target="_blank" rel="noopener">${BW.t('The official page on deposits')} ↗</a></p>` : ''}
        ${t.endedAt ? '' : `<h3 style="margin-top:18px">📈 ${BW.t('The rent review')}</h3>
          ${from ? `<p>${BW.t('A new rent can apply from')} <b>${BW.fmtDate(from)}</b>.</p><p class="s">${esc(BW.t(pack.rentReview.what))} <a href="${esc(pack.rentReview.source)}" target="_blank" rel="noopener">↗</a></p>` : ''}
          ${rents.length > 1 ? rents.map((x, i) => `<div class="duty-row"><span class="main">${BW.fmtDate(x.from)} · ${money(R.rentAt(t, x.from), t)} ${per}</span>${i === 0 ? `<button class="btn btn-ghost" data-unrent title="${BW.t('Remove')}" aria-label="${BW.t('Remove')}">✕</button>` : ''}</div>`).join('') : ''}
          <p style="margin-top:8px"><button class="btn" data-newrent>📈 ${BW.t('Record a new rent')}</button></p>`}
        <p style="margin-top:16px"><a class="btn" href="../homes/index.html#open/${t.homeId}">✏️ ${BW.t('Change the tenancy')}</a></p>`;
      $$('[data-pay]', box).forEach((b) => b.onclick = () => pay(t, b.dataset.pay, s.months.find((m) => m.month === b.dataset.pay), draw));
      $$('[data-receipt]', box).forEach((b) => b.onclick = () => receipt(t, s.months.find((m) => m.month === b.dataset.receipt)));
      // A payment noted by mistake: take the latest one of that month away again, with an Undo.
      $$('[data-unpay]', box).forEach((b) => b.onclick = () => {
        const last = payments.filter((p) => p.tenancyId === t.id && (p.month || String(p.date || '').slice(0, 7)) === b.dataset.unpay).sort((x, y) => String(x.createdAt || x.date).localeCompare(String(y.createdAt || y.date))).pop();
        if (last) BW.removeWithUndo('rentpayments', last, `${monthName(b.dataset.unpay)} · ${money(R.amount(last.amount), t)}`, draw);
      });
      const nr = $('[data-newrent]', box); if (nr) nr.onclick = () => newRent(t, from, draw);
      // A rent change recorded by mistake: the latest one goes, and the rent is what it was before. With an Undo.
      $$('[data-unrent]', box).forEach((b) => b.onclick = async () => {
        const was = Object.assign({}, t);
        try { await BW.store.put('tenancies', R.dropRent(t)); } catch (e) { return BW.error(e); }
        draw();
        BW.toast(BW.t('The rent is what it was before.'), '↩️', { label: BW.t('Undo'), run: async () => { try { await BW.store.put('tenancies', was); draw(); } catch (e) { BW.error(e); } } });
      });
    };
    draw();
  }

  function pay(t, month, m, redraw) {
    // A weekly rent is usually paid a week at a time, so that is what the box starts with.
    const week = R.rentNow(t, BW.today()), start = m ? (week.per === 'week' ? Math.min(m.open, week.amount) : m.open) : '';
    const box = BW.html(`<div class="grid-2">
      <label class="field"><span>${BW.t('Amount')}</span><input class="in" inputmode="decimal" data-a value="${start}"></label>
      <label class="field"><span>${BW.t('Received on')}</span><input class="in" type="date" data-d value="${BW.today()}"></label></div>`);
    BW.modal({ title: `💶 ${monthName(month)}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
      const amount = R.amount($('[data-a]', box).value); if (!(amount > 0)) return false;
      try { await BW.store.put('rentpayments', { tenancyId: t.id, month, date: $('[data-d]', box).value || BW.today(), amount }); } catch (e) { BW.error(e); return false; }
      BW.toast(BW.t('Noted.'), '💶'); redraw();
    } }] });
  }

  // A new rent from a date. Months before that date keep the rent they had; the tenancy's own "Rent" is for corrections.
  function newRent(t, from, redraw) {
    const today = BW.today(), per = BW.t(t.rentPer === 'week' ? 'a week' : 'a month');
    const box = BW.html(`<div class="grid-2">
      <label class="field"><span>${BW.t('Rent')}, ${per}</span><input class="in" inputmode="decimal" data-a></label>
      <label class="field"><span>${BW.t('Applies from')}</span><input class="in" type="date" data-d value="${from && from > today ? from : today}"></label>
      <p class="s span-2" style="margin:0">${BW.t('The months before this date keep the rent they had.')}</p></div>`);
    BW.modal({ title: `📈 ${BW.t('Record a new rent')}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
      const rent = R.amount($('[data-a]', box).value), date = $('[data-d]', box).value;
      if (!(rent > 0) || !date) return false;
      try { await BW.store.put('tenancies', R.changeRent(t, rent, date)); } catch (e) { BW.error(e); return false; }
      BW.toast(BW.t('Noted.'), '📈'); redraw();
    } }] });
  }

  async function receipt(t, m) {
    const s = BW.settings, h = homeOf(t);
    const L = [`# ${BW.t('Rent receipt')}`, '', `${BW.t('Received from')}: ${t.tenants || ''}`, `${BW.t('For')}: ${[h.address, h.postcode, h.city].filter(Boolean).join(', ') || h.name || ''}`,
      `${BW.t('Period')}: ${monthName(m.month)}`, `${BW.t('Amount')}: ${money(m.paid, t)}`, '', `${s.ownerName || ''}`, [s.address, s.postcode, s.city].filter(Boolean).join(', '), BW.fmtDate(BW.today())];
    try {
      // The home, the tenant and the month are in the name, so two receipts never share a file.
      const name = R.fileName(BW.t('Rent receipt'), h.name || h.address, t.tenants, m.month);
      const r = await BW.store.writeFile(`Rent/${name}.pdf`, R.pdf(name, L.join('\n'), { footer: BW.t('Made with Busy Rentals') }));
      BW.toast(r.saved ? `${BW.t('Saved to')} ${esc(r.where)}` : BW.t('The PDF is in your Downloads'), '📄');
    } catch (e) { BW.error(e); }
  }
})();
