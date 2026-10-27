/* Contracts & Renewals: everything the household pays for on a contract, what it costs a month, and
   the date that matters most: the last day to cancel before it renews by itself. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let contracts = [], papers = [], kind = '', showEnded = false;

  BW.boot({
    app: 'contracts',
    onReady: async () => {
      await load(); render();
      BW.route({ new: (k) => edit(blank(k)), open: (id) => { const x = contracts.find((c) => c.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a contract', () => edit(blank()));
  async function load() { [contracts, papers] = await Promise.all(['contracts', 'papers'].map((n) => BW.store.all(n))); }
  const blank = (k) => ({ kind: k || 'insurance', per: 'month', renews: 'yes', renewMonths: 12, notice: 1, noticeUnit: 'month' });
  const long = (d) => BW.fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' });

  // The one line that says what to do, for a card and for the drawer.
  function verdict(c, today) {
    const st = H.contractState(c, today), end = H.nextEnd(c, today), by = H.cancelBy(c, today);
    if (st === 'ended') return ['off', 'Ended', `Ended on ${long(c.end)}.`];
    if (st === 'cancelled') return ['off', end ? `Ends ${BW.fmtDate(end)}` : 'Cancelled', end ? `Cancelled. It ends on ${long(end)}.` : 'Cancelled.'];
    if (st === 'rolling') return ['ok', 'Cancel any time', `You can cancel any time with ${H.noticeText(c)} notice. Cancel today and it ends on ${long(H.endsIfCancelledToday(c, today))}.`];
    if (!by) return ['off', 'No end date', 'Add the date the current term ends to see the last day to cancel.'];
    const left = H.days(today, by);
    if (st === 'missed') return ['late', `Renews ${BW.fmtDate(end)}`, `The last day to cancel was ${long(by)}, so it renews on ${long(end)}.`];
    return [st === 'decide' ? 'soon' : 'ok', `Cancel by ${BW.fmtDate(by, { day: 'numeric', month: 'short' })}`,
      `${c.renews === 'no' ? 'It ends' : 'It renews'} on ${long(end)}. ${c.renews === 'no' ? '' : `To stop it, cancel by ${long(by)} (${H.when(left)}): that’s ${H.noticeText(c)} before.`}`];
  }

  function render() {
    const today = BW.today();
    const live = contracts.filter((c) => H.contractState(c, today) !== 'ended');
    const shown = (showEnded ? contracts : live).filter((c) => !kind || c.kind === kind)
      .sort((a, b) => (H.cancelBy(a, today) || '9999').localeCompare(H.cancelBy(b, today) || '9999') || String(a.name).localeCompare(String(b.name)));
    const decide = H.decisions(contracts, today, 60), perMonth = H.totalMonthly(live, today);
    const counts = {}; live.forEach((c) => { counts[c.kind || 'other'] = (counts[c.kind || 'other'] || 0) + 1; });
    const ended = contracts.length - live.length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🔁</span> Contracts &amp; Renewals</h1><p class="lead">What you pay for, and the last day to cancel before it renews by itself.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a contract</button>
      </div>
      ${contracts.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">💶 Per month</div><div class="v">${BW.money(perMonth)}</div><div class="s">${BW.money(perMonth * 12)} a year, ${live.length} contract${live.length === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">✂️ Decide soon</div><div class="v">${decide.length}</div><div class="s">${decide.length ? 'Last day to cancel within two months' : 'Nothing to decide in the next two months'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">🔓 Cancel any time</div><div class="v">${live.filter((c) => H.contractState(c, today) === 'rolling').length}</div><div class="s">No end date, just the notice</div></div>
      </div>
      ${decide.length ? `<section class="card attention rise"><h2>✂️ Keep it, switch or cancel?</h2>${decide.map((d) => `
        <a href="#open/${d.contract.id}"><span class="e">${H.contractKind(d.contract.kind).split(' ')[0]}</span><span class="main"><b>${esc(d.contract.name || d.contract.provider || 'A contract')}</b><small>Last day to cancel: ${long(d.by)} (${H.when(d.left)}). Otherwise it renews on ${BW.fmtDate(d.end)}.</small></span></a>`).join('')}</section>` : ''}
      <div class="filters" data-kind style="margin-bottom:18px"><button type="button" data-v="" aria-pressed="${!kind}">All</button>${H.CONTRACT_KINDS.filter((k) => counts[k[0]]).map((k) => `<button type="button" data-v="${k[0]}" aria-pressed="${kind === k[0]}">${k[1]}<small>${counts[k[0]]}</small></button>`).join('')}
        ${ended ? `<button type="button" data-ended aria-pressed="${showEnded}">Show ended<small>${ended}</small></button>` : ''}</div>
      <div class="card-grid rise">${shown.map((c) => card(c, today)).join('')}</div>
      <div style="height:40px"></div>`
      : `<div class="card empty rise"><div class="big">🔁</div><h2>Never miss the last day to cancel again</h2>
          <p>Insurance, energy, phone, internet, the gym. Add what it costs, when the term ends and the notice period, and Busy works out the last day you can cancel, before it renews by itself.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Add my first contract</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit(blank(kind)));
    const fk = $('[data-kind]', main);
    if (fk) fk.onclick = (e) => { if (e.target.closest('[data-ended]')) { showEnded = !showEnded; return render(); } const b = e.target.closest('[data-v]'); if (b) { kind = b.dataset.v; render(); } };
    $$('.h-card[data-id]', main).forEach((el) => el.onclick = () => edit(contracts.find((c) => c.id === el.dataset.id)));
  }
  function card(c, today) {
    const [cls, pill] = verdict(c, today), m = H.monthly(c);
    return `<button class="card h-card ${cls === 'off' && H.contractState(c, today) === 'ended' ? 'ended' : ''}" data-id="${c.id}">
      <span class="top"><span><small>${H.contractKind(c.kind)}</small><b style="display:block">${esc(c.name || c.provider || 'A contract')}</b></span><span class="due ${cls}">${pill}</span></span>
      <small>${esc([c.provider && c.provider !== c.name ? c.provider : '', m ? `${BW.money(m)} a month` : ''].filter(Boolean).join(' · ')) || '&nbsp;'}</small></button>`;
  }

  function edit(c) {
    const today = BW.today();
    BW.recordDrawer({
      collection: 'contracts', rec: c, title: 'Contract', newTitle: 'Add a contract',
      fields: [
        { k: 'name', label: 'What is it?', ph: 'e.g. Home insurance, Energy, Gym', required: true },
        { k: 'provider', label: 'With whom?', ph: 'e.g. the insurer or the gym' },
        { k: 'kind', label: 'Kind', type: 'chips', options: H.CONTRACT_KINDS },
        { k: 'cost', label: 'It costs', type: 'money', ph: '0.00' },
        { k: 'per', label: 'Per', type: 'chips', options: H.PER },
        { k: 'end', label: 'The current term ends on', type: 'date', hint: 'On the policy or the last renewal letter. Not sure? The start date plus the term.' },
        { k: 'renews', label: 'After that it…', type: 'chips', options: [['yes', '🔁 Renews by itself'], ['rolling', '🔓 Becomes cancel any time'], ['no', '🛑 Just ends']] },
        { k: 'renewMonths', label: 'It renews for', type: 'chips', options: [[1, '1 month'], [3, '3 months'], [12, '1 year'], [24, '2 years'], [36, '3 years']] },
        { k: 'notice', label: 'Notice period', type: 'number', ph: 'e.g. 1', hint: 'How long before the end you must cancel. Often one month.' },
        { k: 'noticeUnit', label: 'In', type: 'chips', options: [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']] },
        { k: 'reference', label: 'Policy or customer number', ph: 'For letters and phone calls' },
        { k: 'start', label: 'Started on', type: 'date' },
        { k: 'address', label: 'Where cancellation letters go', type: 'textarea', ph: 'The postal address or the email address in the terms', span: 2 },
        { k: 'website', label: 'Website or login page', ph: 'e.g. example.com/my-account' },
        { k: 'phone', label: 'Phone', ph: 'Customer service' },
        { k: 'paperId', label: 'The policy or contract in Paper Trail', type: 'select', options: [['', 'Not linked']].concat(papers.map((p) => [p.id, p.title || 'A document'])), span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'What’s included, the excess, what you agreed on the phone', span: 2 },
      ],
      isComplete: (r) => !!(r.name || r.provider),
      bottom: (r) => `<div class="card" style="padding:14px 16px;margin-top:14px;background:var(--app-soft)" data-verdict>${verdictHtml(r, today)}</div>`,
      bind: (box, r, save) => {
        const redraw = () => setTimeout(() => { BW.readFields($('[data-form]', box), r); $('[data-verdict]', box).innerHTML = verdictHtml(r, today); bindVerdict(); });
        box.addEventListener('input', redraw); box.addEventListener('click', (e) => { if (e.target.closest('.choice-chips')) redraw(); });
        const bindVerdict = () => {
          const cancel = $('[data-cancel]', box), undo = $('[data-undo]', box);
          if (cancel) cancel.onclick = () => { r.cancelledAt = today; save(); redraw(); BW.toast('Marked as cancelled. Keep the confirmation in Paper Trail.', '✂️'); };
          if (undo) undo.onclick = () => { r.cancelledAt = ''; save(); redraw(); };
        };
        bindVerdict();
      },
      onClose: async () => { await load(); render(); },
    });
  }
  function verdictHtml(r, today) {
    const [, , text] = verdict(r, today);
    const letter = r.id ? `<a class="btn" href="../letters/index.html#new/cancel/${r.id}">✂️ Write the cancellation letter</a>` : '';
    return `<b>${esc(text)}</b><div class="row-flex" style="margin-top:10px">${r.cancelledAt ? `<button type="button" class="btn btn-ghost" data-undo>Undo: not cancelled</button>` : `${letter}${r.id ? '<button type="button" class="btn" data-cancel>Mark as cancelled</button>' : ''}`}</div>`;
  }
})();
