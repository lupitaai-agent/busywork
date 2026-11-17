/* Homes & Tenancies: each home that is let, who lives there, and every duty from the country's landlord year with
   its date: done, due, overdue, or never recorded; and whether the tenant got the copy they must get. Ends in
   "your rental on a page": one PDF with the home, the tenancy, the next dates and what is in order. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const R = BW.rentals;
  const main = $('#main');
  const lang = () => window.BusyLang || 'en';
  let homes = [], tenancies = [], checks = [];

  BW.boot({
    app: 'homes',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({}), open: async (id) => { await load(); const h = homes.find((x) => x.id === id); if (h) openHome(h); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a home', () => edit({}));
  async function load() { [homes, tenancies, checks] = await Promise.all(['homes', 'tenancies', 'checks'].map((n) => BW.store.all(n).catch(() => []))); }

  const STATE = { overdue: 'Overdue', soon: 'Soon', ok: 'In order', unknown: 'Not recorded', done: 'Done' };
  const codeOf = (h) => R.countryOf(h, BW.settings, lang());
  const nameOf = (h) => h.name || h.address || BW.t('A home');
  // Amounts in the money of the home's country, and the rent as the tenant pays it: "£300.00 a week".
  const money = (v, h) => BW.money(v, R.currencyOf(codeOf(h), BW.settings));
  const rentWords = (t, h) => { const r = R.rentNow(t, BW.today()); return `${money(r.amount, h)} ${BW.t(r.per === 'week' ? 'a week' : 'a month')}`; };

  function render() {
    const today = BW.today();
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🏠</span> ${BW.t('Homes & Tenancies')}</h1><p class="lead">${BW.t('Each home you let, who lives there, and every check and certificate with its date.')}</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> ${BW.t('Add a home')}</button>
      </div>
      ${homes.length ? homes.map((h) => {
        const t = R.current(h, tenancies, today), d = R.dutiesFor(h, codeOf(h), tenancies, checks, today);
        const bad = d.filter((x) => x.state === 'overdue' || x.state === 'unknown').length, owed = d.filter((x) => x.handOver && x.handOver.state === 'owed').length;
        return `<a class="card home-card" href="#open/${h.id}" style="display:block;text-decoration:none;color:inherit;margin-bottom:14px">
          <h2>🏠 ${esc(nameOf(h))}</h2>
          <p class="s">${esc([h.address, h.city].filter(Boolean).join(', '))}${(R.pack(codeOf(h)) || {}).flag ? ` · ${R.pack(codeOf(h)).flag}` : ''}</p>
          <p>${t ? `🔑 ${esc(t.tenants || BW.t('A tenant'))} · ${rentWords(t, h)}` : `<span class="s">${BW.t('Nobody lives there now')}</span>`}</p>
          <p>${bad ? `<span class="duty-state overdue">${bad} ${BW.t(bad === 1 ? 'thing to sort out' : 'things to sort out')}</span>` : `<span class="duty-state ok">${BW.t('In order')}</span>`} ${owed ? `<span class="duty-state soon">📨 ${owed} ${BW.t(owed === 1 ? 'copy owed to the tenant' : 'copies owed to the tenant')}</span>` : ''}</p>
        </a>`;
      }).join('') : `<section class="card"><h2>${BW.t('Start with the home you let.')}</h2><p class="s">${BW.t('Its address and country first. Then who lives there, and Busy shows every date your country’s rules ask for.')}</p></section>`}`;
    $('[data-new]', main).onclick = () => edit({});
  }

  // ---------- one home: its tenancy and its duties ----------
  function openHome(h) {
    const box = document.createElement('div');
    const d = BW.drawer({ title: esc(nameOf(h)), body: box, onClose: async () => { await load(); render(); } });
    const draw = async () => {
      await load();
      h = homes.find((x) => x.id === h.id) || h;
      const today = BW.today(), code = codeOf(h), pack = R.pack(code), t = R.current(h, tenancies, today);
      const duties = R.dutiesFor(h, code, tenancies, checks, today);
      const past = tenancies.filter((x) => x.homeId === h.id && x !== t).sort((a, b) => String(b.start).localeCompare(String(a.start)));
      // What was recorded for a duty, newest first, each with a way to take it away again (a wrong date, a double).
      const recorded = (duty) => checks.filter((c) => c.homeId === h.id && c.duty === duty.id && c.last).sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, 8);
      box.innerHTML = `
        <div class="row-flex" style="gap:8px;flex-wrap:wrap;margin-bottom:14px"><button class="btn" data-edit-home>✏️ ${BW.t('The home’s details')}</button><button class="btn btn-primary" data-page>📄 ${BW.t('Your rental on a page')}</button></div>
        <h3>🔑 ${BW.t('Who lives there')}</h3>
        ${t ? `<div class="card" style="margin:8px 0 16px"><b>${esc(t.tenants || BW.t('A tenant'))}</b><p class="s">${esc([BW.t(`Since ${BW.fmtDate(t.start)}`), rentWords(t, h), R.amount(t.deposit) ? BW.t(`Deposit ${money(R.amount(t.deposit), h)}`) : ''].filter(Boolean).join(' · '))}</p>
          <div class="row-flex" style="gap:8px;flex-wrap:wrap"><button class="btn" data-tenancy="${t.id}">✏️ ${BW.t('The tenancy')}</button><a class="btn" href="../rent/index.html#open/${t.id}">💶 ${BW.t('Rent and deposit')}</a><button class="btn" data-report="in" data-tid="${t.id}">📋 ${BW.t('Check-in report')}</button><button class="btn" data-report="out" data-tid="${t.id}">📋 ${BW.t('Check-out report')}</button></div></div>`
          : `<p class="s">${BW.t('Nobody lives there now.')}</p><button class="btn" data-new-tenancy>＋ ${BW.t('Add a tenancy')}</button>`}
        ${t ? `<button class="btn btn-ghost" data-new-tenancy style="margin-bottom:10px">＋ ${BW.t('A new tenancy (someone moves in)')}</button>` : ''}
        <h3 style="margin-top:14px">📋 ${pack ? BW.t(`What ${pack.flag} ${esc(pack.name)} asks of you`) : BW.t('Your country’s rules')}</h3>
        ${pack ? '' : `<p class="s">${BW.t('Busy knows the landlord’s year in England, the Netherlands and Germany. Set the home’s country in its details.')}</p>`}
        <div>${duties.map((x, i) => `<div class="duty-row"><span aria-hidden="true">${x.duty.emoji}</span><span class="main"><b>${esc(BW.t(x.duty.what))}</b>
            <small>${x.check && x.check.last ? `${BW.t('Last done')} ${BW.fmtDate(x.check.last)}` : BW.t('Not recorded yet')}${x.date && x.state !== 'done' ? ` · ${x.state === 'overdue' ? `${BW.t('was due')} ${BW.fmtDate(x.date)}` : BW.t(`next on ${BW.fmtDate(x.date)}`)}` : ''}${x.handOver ? ` · ${x.handOver.state === 'given' ? `📨 ${BW.t('copy given')} ${BW.fmtDate(x.handOver.date)}` : `📨 ${BW.t('copy to the tenant by')} ${BW.fmtDate(x.handOver.by)}`}` : ''}</small>
            <small><a href="${esc(x.duty.source)}" target="_blank" rel="noopener">${BW.t('The official page')} ↗</a>${x.duty.changing ? ` · ${BW.t('this rule is changing')}` : ''}</small></span>
            <span class="duty-state ${x.state}">${BW.t(STATE[x.state])}</span>
            <button class="btn" data-done="${i}">${BW.t('Record it')}</button>${x.handOver && x.handOver.state === 'owed' ? `<button class="btn" data-given="${i}">📨 ${BW.t('Copy given')}</button>` : ''}
            ${recorded(x.duty).length ? `<div class="duty-recs">${recorded(x.duty).map((c) => `<span class="duty-rec">${BW.fmtDate(c.last)}${c.by ? ` · ${esc(c.by)}` : ''}<button class="btn btn-ghost" data-uncheck="${c.id}" title="${BW.t('Remove')}" aria-label="${BW.t('Remove')}">✕</button></span>`).join('')}</div>` : ''}</div>`).join('')}</div>
        ${pack ? `<details style="margin-top:12px"><summary>${BW.t('Duties that only apply to some homes')}</summary>${pack.duties.filter((x) => x.optional).map((x) => `<label class="check-item"><input type="checkbox" data-opt="${x.id}" ${(h.duties || []).includes(x.id) ? 'checked' : ''}><span class="main"><b>${esc(BW.t(x.what))}</b><br><small>${esc(BW.t(x.note || ''))}</small></span></label>`).join('')}</details>` : ''}
        ${past.length ? `<h3 style="margin-top:18px">${BW.t('Earlier tenancies')}</h3>${past.map((x) => `<div class="card" style="margin:8px 0"><b>${esc(x.tenants || BW.t('A tenant'))}</b><p class="s">${BW.fmtDate(x.start)}${x.endedAt ? ` – ${BW.fmtDate(x.endedAt)}` : ''}</p>
          <div class="row-flex" style="gap:8px;flex-wrap:wrap"><button class="btn" data-tenancy="${x.id}">✏️ ${BW.t('The tenancy')}</button><a class="btn" href="../rent/index.html#open/${x.id}">💶 ${BW.t('Rent and deposit')}</a><button class="btn" data-report="in" data-tid="${x.id}">📋 ${BW.t('Check-in report')}</button><button class="btn" data-report="out" data-tid="${x.id}">📋 ${BW.t('Check-out report')}</button></div></div>`).join('')}` : ''}
        <p class="s" style="margin-top:18px">${BW.t('Busy keeps the dates and the records, with the official source for each. It never gives legal or tax advice.')}</p>`;
      $('[data-edit-home]', box).onclick = () => { d.close(); edit(h); };
      $('[data-page]', box).onclick = () => onPage(h);
      $$('[data-report]', box).forEach((b) => b.onclick = () => openReport(h, tenancies.find((x) => x.id === b.dataset.tid) || t, b.dataset.report, draw));
      $$('[data-new-tenancy]', box).forEach((b) => b.onclick = () => editTenancy({ homeId: h.id, payDay: 1, rentPer: 'month' }, draw));
      $$('[data-tenancy]', box).forEach((b) => b.onclick = () => editTenancy(tenancies.find((x) => x.id === b.dataset.tenancy), draw));
      $$('[data-done]', box).forEach((b) => b.onclick = () => record(h, t, duties[Number(b.dataset.done)], draw));
      // The copy is noted for the tenant who lives there now: a later tenant is owed one of their own.
      $$('[data-given]', box).forEach((b) => b.onclick = async () => { const x = duties[Number(b.dataset.given)]; try { await BW.store.put('checks', Object.assign({}, x.check, { handedOverAt: BW.today() }, t ? { handedOverTo: t.id } : {})); } catch (e) { return BW.error(e); } BW.toast(BW.t('Noted: the tenant has the copy.'), '📨'); draw(); });
      $$('[data-uncheck]', box).forEach((b) => b.onclick = () => {
        const c = checks.find((x) => x.id === b.dataset.uncheck), duty = c && pack && pack.duties.find((x) => x.id === c.duty);
        if (c) BW.removeWithUndo('checks', c, `${duty ? BW.t(duty.what) : ''} · ${BW.fmtDate(c.last)}`, draw);
      });
      $$('[data-opt]', box).forEach((c) => c.onchange = async () => { const on = new Set(h.duties || []); if (c.checked) on.add(c.dataset.opt); else on.delete(c.dataset.opt); try { await BW.store.put('homes', Object.assign({}, h, { duties: [...on] })); } catch (e) { return BW.error(e); } draw(); });
    };
    draw();
  }

  // Records a duty as done: the date (never one still to come), a booked next date for a check that comes back, who
  // did it, and whether the tenant who lives there now already has a copy.
  function record(h, t, x, redraw) {
    const today = BW.today();
    const box = BW.html(`<div class="grid-2">
      ${x.duty.note ? `<p class="s span-2" style="margin:0 0 6px">${esc(BW.t(x.duty.note))} <a href="${esc(x.duty.source)}" target="_blank" rel="noopener">${BW.t('The official page')} ↗</a></p>` : ''}
      <label class="field"><span>${BW.t('Done on')}</span><input class="in" type="date" data-d value="${today}" max="${today}"></label>
      ${x.duty.every ? `<label class="field"><span>${BW.t('Next time on (optional)')}</span><input class="in" type="date" data-n></label>` : ''}
      <label class="field span-2"><span>${BW.t('By whom (optional)')}</span><input class="in" data-b placeholder="${BW.t('e.g. the engineer’s name or company')}"></label>
      ${x.duty.handOver != null && t ? `<label class="check-item span-2"><input type="checkbox" data-g><span class="main">${BW.t('The tenant already has a copy')}</span></label>` : ''}</div>`);
    BW.modal({ title: `${x.duty.emoji} ${esc(BW.t(x.duty.what))}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
      const last = $('[data-d]', box).value || today, g = $('[data-g]', box), n = $('[data-n]', box);
      if (last > today) { BW.toast(BW.t('That day is still to come. Fill in the day it was done.'), '📅'); return false; }
      const rec = { homeId: h.id, duty: x.duty.id, last, next: n ? n.value : '', by: $('[data-b]', box).value.trim() };
      if (x.duty.per === 'tenancy' && t) rec.tenancyId = t.id;
      if (g && g.checked) { rec.handedOverAt = last; rec.handedOverTo = t.id; }
      try { await BW.store.put('checks', rec); } catch (e) { BW.error(e); return false; }
      BW.toast(BW.t('Recorded.'), '✅');
      redraw();
    } }] });
  }

  const COUNTRIES = [['england', 'England'], ['nl', 'Nederland'], ['de', 'Deutschland'], ['other', 'Another country']];
  function edit(h) {
    let fresh = '';
    BW.recordDrawer({
      collection: 'homes', rec: Object.assign({ country: R.countryOf({}, BW.settings, lang()) || 'other', duties: [] }, h), title: 'The home', newTitle: 'Add a home',
      fields: [
        { k: 'name', label: 'A short name', ph: 'e.g. Flat 2, the Utrecht flat', required: true },
        { k: 'country', label: 'Country', type: 'chips', options: COUNTRIES.map(([v, l]) => [v, BW.t(l)]), hint: 'Busy follows this country’s landlord year for the home.' },
        { k: 'address', label: 'Street and number', span: 2 },
        { k: 'postcode', label: 'Postcode' },
        { k: 'city', label: 'City' },
        { k: 'keys', label: 'Keys', ph: 'How many, who has a set' },
        { k: 'meters', label: 'Meters', ph: 'Where they are, the numbers' },
        { k: 'suppliers', label: 'Energy, water, internet', type: 'textarea', span: 2 },
        { k: 'insurance', label: 'Landlord insurance', ph: 'Insurer and policy number', span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      isComplete: (r) => !!String(r.name || r.address || '').trim(),
      onSaved: (r, isNew) => { if (isNew) fresh = r.id; },
      // A home with a tenancy stays: its rent, deposit and reports hang on it. Without one it goes with an Undo.
      canDelete: async (r) => {
        const n = (await BW.store.all('tenancies').catch(() => [])).filter((t) => t.homeId === r.id).length;
        if (!n) return true;
        BW.modal({ title: esc(nameOf(r)), body: `<p>${BW.t('This home still has a tenancy, so it stays. Delete its tenancies first, if you really want it gone.')}</p>`, actions: [{ label: 'Close', kind: 'primary' }] });
        return false;
      },
      // A home that was just added opens when its form closes: the next step is who lives there.
      onClose: async (r) => { await load(); render(); const made = fresh && !(r && r.deleted) && homes.find((x) => x.id === fresh); if (made) openHome(made); },
    });
  }

  function editTenancy(t, redraw) {
    const home = homes.find((h) => h.id === t.homeId) || {}, code = codeOf(home), pack = R.pack(code);
    BW.recordDrawer({
      collection: 'tenancies', rec: Object.assign({}, t), title: 'The tenancy', newTitle: 'Add a tenancy',
      top: (r) => { const ds = R.depositState(code, r, BW.today()); return ds.over ? `<div class="card attention" style="margin-bottom:12px">⚠️ ${BW.t('The deposit is above the most allowed here:')} ${money(ds.cap, home)}</div>` : ''; },
      fields: [
        { k: 'tenants', label: 'Who lives there', ph: 'e.g. Noor and Sam Visser', span: 2, required: true },
        { k: 'email', label: 'Email', type: 'email' },
        { k: 'phone', label: 'Phone' },
        { k: 'start', label: 'Start date', type: 'date' },
        { k: 'endedAt', label: 'Ended on', type: 'date', hint: 'Only when they have moved out.' },
        { k: 'rent', label: 'Rent', type: 'money', hint: [pack && pack.rentWhat ? BW.t(pack.rentWhat) : '', t.id ? BW.t('A new rent from a date? Record it in Rent & Deposits, so the months before keep the old rent.') : ''].filter(Boolean).join(' ') },
        { k: 'rentPer', label: 'Per', type: 'chips', options: [['month', BW.t('Month')], ['week', BW.t('Week')]] },
        { k: 'payDay', label: 'Paid on day of the month', type: 'number', ph: '1', hint: BW.t('A day from 1 to 31; in a shorter month, its last day. A weekly rent is due on the weekday of the start date.') },
        { k: 'lastRentChange', label: 'Rent last changed on', type: 'date' },
        { k: 'deposit', label: 'Deposit', type: 'money', hint: pack ? BW.t(pack.deposit.capWhat) : '' },
        { k: 'depositReceived', label: 'Deposit received on', type: 'date' },
        { k: 'depositHeld', label: 'Where the deposit is held', ph: pack && pack.deposit.protectDays ? BW.t('The scheme') : BW.t('e.g. a separate savings account'), span: 2 },
        { k: 'depositRef', label: 'Deposit reference' },
        { k: 'depositProtectedAt', label: pack && pack.deposit.protectDays ? 'Protected, and information given, on' : 'Put in its own account on', type: 'date' },
        { k: 'deductions', label: 'Deductions at the end', ph: 'What and why, if any', span: 2 },
        { k: 'depositReturnedAt', label: 'Deposit returned on', type: 'date' },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      // "Rent" here corrects the current figure, so the latest entry of the rent's history follows it (just before saving).
      isComplete: (r) => { R.syncRent(r); return !!String(r.tenants || '').trim(); },
      confirmDelete: 'This deletes the tenancy with everything recorded for it: rent payments, checks for this tenant, reports and letters. Its rent leaves the tax year. If the tenant has only moved out, fill in “Ended on” instead.',
      onClose: async (r) => {
        if (r && r.deleted) { try { for (const n of ['rentpayments', 'reports', 'rentletters', 'checks']) await BW.store.removeWhere(n, (x) => x.tenancyId === r.id); } catch (e) { BW.error(e); } }
        if (redraw) redraw();
      },
    });
  }

  // ---------- check-in and check-out ----------
  // Nothing is saved until something is filled in: looking at an empty check-out report of a tenant who still lives
  // there leaves no report behind.
  async function openReport(h, t, kind, redraw) {
    const all = await BW.store.all('reports').catch(() => []);
    let rep = all.find((r) => r.tenancyId === t.id && r.kind === kind);
    if (!rep) {
      const start = all.find((r) => r.tenancyId === t.id && r.kind === 'in');
      rep = { homeId: h.id, tenancyId: t.id, kind, date: kind === 'in' ? (t.start || BW.today()) : (t.endedAt || BW.today()),
        rooms: (start ? start.rooms.map((r) => r.room) : R.ROOMS.map((r) => BW.t(r))).map((room) => ({ room, condition: '', notes: '', photos: [] })) };
    }
    const box = document.createElement('div');
    BW.drawer({ title: `${BW.t(kind === 'in' ? 'Check-in report' : 'Check-out report')} · ${esc(nameOf(h))}`, body: box, onClose: () => redraw && redraw() });
    const save = async () => { try { rep = await BW.store.put('reports', rep); } catch (e) { BW.error(e); } };
    const cond = (v) => BW.t((R.CONDITIONS.find((x) => x[0] === v) || ['', '-'])[1]);
    const roomName = (r) => r.room || BW.t('Another room');
    // The check-out laid next to the check-in, room by room, by the rooms' names.
    const compare = async () => { const start = kind === 'out' ? (await BW.store.all('reports').catch(() => [])).find((r) => r.tenancyId === t.id && r.kind === 'in') : null; return start ? R.compareReports(start, rep) : []; };
    const draw = async (focus) => {
      const cmp = await compare();
      box.innerHTML = `<div class="grid-2">
          <label class="field"><span>${BW.t('Date')}</span><input class="in" type="date" data-f="date" value="${esc(rep.date || '')}"></label>
          <label class="field"><span>${BW.t('Keys handed over')}</span><input class="in" data-f="keys" value="${esc(rep.keys || '')}" placeholder="${BW.t('e.g. 2 front door, 1 bike shed')}"></label>
          <label class="field span-2"><span>${BW.t('Meter readings')}</span><input class="in" data-f="meters" value="${esc(rep.meters || '')}" placeholder="${BW.t('Electricity, gas, water')}"></label></div>
        <p class="s">${BW.t('Take dated photos of every room. They are the best evidence when the deposit is settled.')}</p>
        ${rep.rooms.map((r, i) => { const c = cmp.find((x) => x.end === r);
          return `<div class="card" style="margin:10px 0"><div class="row-flex" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><input class="in room-name" data-name="${i}" value="${esc(r.room || '')}" placeholder="${BW.t('Another room')}" aria-label="${BW.t('Name')}">
            <div class="choice-chips" data-cond="${i}">${R.CONDITIONS.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${r.condition === v}">${BW.t(l)}</button>`).join('')}</div></div>
            ${c && c.start ? `<p class="s">${BW.t('At the start')}: ${cond(c.start.condition)}${c.start.notes ? `, ${esc(c.start.notes)}` : ''}${c.worse ? ` · <span class="duty-state overdue">${BW.t('worse than at the start')}</span>` : ''}</p>` : ''}
            <textarea class="in" data-notes="${i}" placeholder="${BW.t('What you see: walls, floor, windows, appliances')}" style="margin-top:6px">${esc(r.notes || '')}</textarea>
            <p class="s" style="margin-top:6px">📷 ${BW.t(`Photos: ${(r.photos || []).length}`)} <label class="btn" style="margin-left:6px">${BW.t('Add photos')}<input type="file" accept="image/*" multiple hidden data-photos="${i}"></label></p></div>`; }).join('')}
        <p class="row-flex" style="gap:8px;flex-wrap:wrap"><button class="btn" data-room>＋ ${BW.t('A room')}</button><button class="btn btn-primary" data-rpdf>📄 ${BW.t('Make the PDF')}</button></p>`;
      $$('[data-f]', box).forEach((el) => el.onchange = async () => { rep[el.dataset.f] = el.value.trim(); await save(); });
      // A room's name can be changed: the one you add, or "Bedroom 1" into what the home really has.
      $$('[data-name]', box).forEach((el) => el.onchange = async () => { rep.rooms[Number(el.dataset.name)].room = el.value.trim(); await save(); draw(); });
      $$('[data-notes]', box).forEach((el) => el.onchange = async () => { rep.rooms[Number(el.dataset.notes)].notes = el.value.trim(); await save(); });
      $$('[data-cond]', box).forEach((g) => g.onclick = async (e) => { const b = e.target.closest('[data-v]'); if (!b) return; rep.rooms[Number(g.dataset.cond)].condition = b.dataset.v; await save(); draw(); });
      $$('[data-photos]', box).forEach((inp) => inp.onchange = async () => {
        const r = rep.rooms[Number(inp.dataset.photos)];
        if (BW.store.kind !== 'folder') BW.toast(BW.t('Photos are kept when Busy saves to a folder.'), '📁');
        for (const f of Array.from(inp.files || [])) {
          const path = `Homes/${R.fileName(nameOf(h))}/${rep.date || BW.today()} ${kind === 'in' ? 'check-in' : 'check-out'}/${R.fileName(roomName(r))} ${BW.uid().slice(-4)}${(f.name.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase()}`;
          try { const res = await BW.store.writeFile(path, f, { download: false }); if (res && res.saved) (r.photos = r.photos || []).push(path); } catch (e) { BW.error(e); }
        }
        await save(); draw();
      });
      // A room of your own: it starts without a name, with the cursor in it. It is saved once it has a name or anything else.
      $('[data-room]', box).onclick = () => { rep.rooms.push({ room: '', condition: '', notes: '', photos: [] }); draw(rep.rooms.length - 1); };
      $('[data-rpdf]', box).onclick = async () => {
        const now = await compare();
        const L = [`# ${BW.t(kind === 'in' ? 'Check-in report' : 'Check-out report')}: ${nameOf(h)}`, [h.address, h.city].filter(Boolean).join(', '), `${BW.t('Date')}: ${BW.fmtDate(rep.date)}`, `${BW.t('Tenants')}: ${t.tenants || ''}`, ''];
        if (rep.meters) L.push(`${BW.t('Meter readings')}: ${rep.meters}`);
        if (rep.keys) L.push(`${BW.t('Keys handed over')}: ${rep.keys}`);
        L.push('');
        rep.rooms.forEach((r) => { const c = now.find((x) => x.end === r); L.push(`# ${roomName(r)}`, '', `${BW.t('Condition')}: ${cond(r.condition)}${c && c.start ? ` (${BW.t('at the start')}: ${cond(c.start.condition)})` : ''}`); if (r.notes) L.push(r.notes); if ((r.photos || []).length) L.push(`${BW.t('Photos')}: ${r.photos.length}, ${BW.t('in the folder')} ${r.photos[0].split('/').slice(0, -1).join('/')}`); L.push(''); });
        L.push('', `${BW.t('Signed for the landlord')}: ______________________`, '', `${BW.t('Signed for the tenant')}: ______________________`);
        try { const name = R.fileName(nameOf(h), kind === 'in' ? 'check-in' : 'check-out', t.tenants, rep.date); const res = await BW.store.writeFile(`Homes/${name}.pdf`, R.pdf(name, L.join('\n'), { footer: BW.t('Made with Busy Rentals') })); BW.toast(res.saved ? `${BW.t('Saved to')} ${esc(res.where)}` : BW.t('The PDF is in your Downloads'), '📄'); } catch (e) { BW.error(e); }
      };
      const f = focus != null && $(`[data-name="${focus}"]`, box); if (f) f.focus();
    };
    draw();
  }

  // ---------- your rental on a page ----------
  async function onPage(h) {
    const today = BW.today(), code = codeOf(h), pack = R.pack(code), t = R.current(h, tenancies, today);
    const L = [`# ${nameOf(h)}`, [h.address, h.postcode, h.city].filter(Boolean).join(', '), pack ? `${BW.t('Rules followed:')} ${pack.name} (${BW.t('checked on')} ${BW.fmtDate(pack.checked)})` : '', ''];
    if (t) {
      L.push(`# ${BW.t('The tenancy')}`, '', `- ${t.tenants || ''}`, `- ${BW.t('Since')} ${BW.fmtDate(t.start)}`, `- ${BW.t('Rent')}: ${rentWords(t, h)}`);
      const ds = R.depositState(code, t, today);
      if (ds.amount) L.push(`- ${BW.t('Deposit')}: ${money(ds.amount, h)}${ds.cap != null ? ` (${BW.t('at most')} ${money(ds.cap, h)})` : ''}${t.depositHeld ? `, ${t.depositHeld}` : ''}`);
      const from = R.rentReviewFrom(code, t); if (from) L.push(`- ${BW.t('The rent can be reviewed from')} ${BW.fmtDate(from)}`);
      L.push('');
    }
    const duties = R.dutiesFor(h, code, tenancies, checks, today);
    if (duties.length) {
      L.push(`# ${BW.t('In order, and still to do')}`, '');
      duties.forEach((x) => L.push(`- ${x.state === 'ok' || x.state === 'done' ? '✓' : '○'} ${BW.t(x.duty.what)}: ${BW.t(STATE[x.state])}${x.date && x.state !== 'done' ? `, ${x.state === 'overdue' ? `${BW.t('was due')} ${BW.fmtDate(x.date)}` : BW.t(`next on ${BW.fmtDate(x.date)}`)}` : ''}${x.handOver && x.handOver.state === 'owed' ? `. ${BW.t('A copy to the tenant by')} ${BW.fmtDate(x.handOver.by)}` : ''}`));
      L.push('');
    }
    const next = R.upcoming({ homes: [h], tenancies, checks }, BW.settings, lang(), today, 366).filter((x) => x.left >= 0).slice(0, 10);
    if (next.length) { L.push(`# ${BW.t('The next dates')}`, ''); next.forEach((x) => L.push(`- ${BW.fmtDate(x.date)}: ${BW.t(x.text)}`)); L.push(''); }
    if (pack) { L.push(`# ${BW.t('Where the rules come from')}`, ''); pack.duties.forEach((x) => L.push(`- ${BW.t(x.what)}: ${x.source}`)); }
    try {
      const name = R.fileName(nameOf(h), BW.t('on a page'), today);
      const blob = R.pdf(name, L.join('\n'), { footer: BW.t('Made with Busy Rentals. Dates and records only: not legal or tax advice.') });
      const r = await BW.store.writeFile(`Homes/${name}.pdf`, blob);
      BW.toast(r.saved ? `${BW.t('Saved to')} ${esc(r.where)}` : BW.t('The PDF is in your Downloads'), '📄');
    } catch (e) { BW.error(e); }
  }
})();
