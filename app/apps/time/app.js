/* Time Tracker: one big button, and unbilled hours turn into an invoice in one click. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  const baseTitle = document.title;
  let entries = [], clients = [], tick = null, view = 'list', weekStart = null;
  let draft = { clientId: '', desc: '' }; // what the next timer will be about

  BW.boot({
    app: 'time',
    onReady: async () => {
      await load(); render();
      BW.route({
        start: () => { if (!running()) toggle(); },
        track: (text) => { const [desc, clientId] = text.split('|'); draft = { desc, clientId: clientId || '' }; if (running()) { BW.toast('A timer is already running. Stop it first.', '⏱️'); render(); } else toggle(); },
        new: () => edit({ date: BW.today(), dur: '1:00', clientId: draft.clientId, billable: true }),
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !$('.modal-wrap')) render(); },
  });
  BW.shortcut('s', 'Start or stop the timer', () => toggle());
  BW.shortcut('n', 'Add time by hand', () => edit({ date: BW.today(), dur: '1:00', clientId: draft.clientId, billable: true }));
  BW.shortcut('w', 'Switch list / week view', () => { view = view === 'list' ? 'week' : 'list'; render(); });

  async function load() {
    [entries, clients] = await Promise.all([BW.store.all('time'), BW.store.all('clients')]);
    clients.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---------- durations and money ----------
  // "1:30", "1.5", "1,5", "90m" and "2h" all mean what you would expect.
  const parseDur = (s) => {
    s = String(s || '').trim().toLowerCase();
    if (!s) return 0;
    if (s.includes(':')) { const [h, m] = s.split(':'); return (Number(h) || 0) * 60 + (Number(m) || 0); }
    if (s.endsWith('m')) return Math.round(BW.num(s));
    return Math.round(BW.num(s) * 60);
  };
  const hm = (min) => `${Math.floor(min / 60)}:${String(Math.round(min % 60)).padStart(2, '0')}`;
  const pretty = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${m ? ' ' + m + 'm' : ''}` : `${m}m`; };
  const running = () => entries.find((e) => e.start && !e.end);
  const minutesOf = (e) => (e.start && !e.end ? (Date.now() - Date.parse(e.start)) / 60000 : parseDur(e.dur));
  const roundTo = () => BW.num(BW.settings.timeRound || 0);
  // Billing rounds each entry up to the chosen step, the way Harvest and Toggl do.
  const billedMinutes = (e) => { const m = minutesOf(e), r = roundTo(); return r ? Math.ceil(m / r) * r : m; };
  const client = (id) => clients.find((c) => c.id === id);
  const clientName = (id) => (client(id) || {}).name || '';
  const baseRate = () => BW.num(BW.settings.hourlyRate || 75);
  const rateOf = (e) => (e.rate !== '' && e.rate != null ? BW.num(e.rate) : BW.num((client(e.clientId) || {}).rate) || baseRate());
  const billable = (e) => e.billable !== false && e.billable !== 0 && e.billable !== '0';
  const valueOf = (e) => (billable(e) ? Math.round(billedMinutes(e) / 60 * rateOf(e) * 100) / 100 : 0);
  const clock = (sec) => { sec = Math.floor(sec); return `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`; };

  // ---------- page ----------
  function render() {
    clearInterval(tick);
    document.title = baseTitle;
    const run = running();
    const thisWeek = BW.addDays(BW.today(), -((new Date().getDay() + 6) % 7));
    if (!weekStart) weekStart = thisWeek;
    const week = entries.filter((e) => e.date >= thisWeek);
    const unbilled = entries.filter((e) => !e.invoiceId && !(e.start && !e.end) && billable(e));
    const groups = {};
    for (const e of unbilled) (groups[e.clientId || ''] = groups[e.clientId || ''] || []).push(e);

    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">⏱️</span> Time Tracker</h1><p class="lead">Tap start, do the work, bill the hours. Press <kbd>S</kbd> to start or stop.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <button class="chip chip-mint rate-chip" data-rate title="Change your hourly rate and rounding">💶 ${BW.money(baseRate())} an hour${roundTo() ? ` · ⏲️ ${roundTo()} min` : ''} ✏️</button>
          <button class="btn" data-manual><span class="emo">✍️</span> Add time by hand</button>
        </div>
      </div>

      <section class="card timer ${run ? 'on' : ''}">
        <button class="go" data-go aria-label="${run ? 'Stop the timer' : 'Start the timer'}"><span><span class="ico">${run ? '■' : '▶'}</span>${run ? 'Stop' : 'Start'}</span></button>
        <div>
          <div class="clock" data-clock>${run ? clock(minutesOf(run) * 60) : '0:00:00'}</div>
          <div class="mood">${run ? `Working on ${esc(run.desc || 'something great')}${run.clientId ? ' for ' + esc(clientName(run.clientId)) : ''}…` : 'Ready when you are. What are we working on?'}</div>
          <div class="fields">
            <input class="in" data-desc placeholder="What are you working on?" value="${esc(run ? run.desc : draft.desc)}" aria-label="What are you working on">
            <select class="in" data-client aria-label="Client"><option value="">No client</option>${clients.map((c) => `<option value="${c.id}" ${(run ? run.clientId : draft.clientId) === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
          </div>
        </div>
      </section>

      <div class="stats rise">
        <div class="card stat" style="--tint:var(--mint)"><div class="k">📅 This week</div><div class="v">${pretty(week.reduce((a, e) => a + minutesOf(e), 0))}</div><div class="s">${pretty(week.filter(billable).reduce((a, e) => a + minutesOf(e), 0))} billable</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">💰 Ready to bill</div><div class="v" data-count="${unbilled.filter((e) => e.clientId).reduce((a, e) => a + valueOf(e), 0)}"></div><div class="s">${pretty(unbilled.reduce((a, e) => a + minutesOf(e), 0))} not invoiced yet</div></div>
      </div>

      ${Object.keys(groups).length ? `<h2 style="margin-bottom:12px">🧾 Turn hours into money</h2>
        <div class="bill-list rise">${Object.entries(groups).map(([cid, list]) => {
          const mins = list.reduce((a, e) => a + billedMinutes(e), 0), val = list.reduce((a, e) => a + valueOf(e), 0);
          return `<div class="card bill"><b>${cid ? esc(clientName(cid) || 'A deleted client') : '🤷 No client yet'}</b>
            <small>${list.length} session${list.length === 1 ? '' : 's'} · ${pretty(mins)} · ${BW.money(val)}${roundTo() ? ' (rounded)' : ''}</small>
            ${cid && clientName(cid) ? `<button class="btn btn-primary" data-bill="${cid}">🧾 Make the invoice</button>` : '<small class="faint">Give these a client to bill them.</small>'}</div>`;
        }).join('')}</div>` : ''}

      ${entries.length ? `<div class="row-flex" style="margin-bottom:6px"><div class="tabs" role="tablist"><button role="tab" data-view="list" aria-selected="${view === 'list'}">📋 List</button><button role="tab" data-view="week" aria-selected="${view === 'week'}">🗓️ Week</button></div></div>
        ${view === 'week' ? weekView() : listView()}<div style="height:50px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">⏱️</div><h2>No hours logged yet</h2><p>Hit the big green button when you start working. Hit it again when you stop. That's the whole trick.</p></div>`}`;

    const descIn = $('[data-desc]', main), clientIn = $('[data-client]', main);
    const keep = BW.debounce(async () => {
      const r = running();
      if (r) { r.desc = descIn.value; r.clientId = clientIn.value; try { await BW.store.put('time', r); } catch (e) { BW.error(e); } }
    }, 500);
    descIn.oninput = () => { draft.desc = descIn.value; keep(); };
    clientIn.onchange = () => { draft.clientId = clientIn.value; keep(); };
    descIn.onkeydown = (e) => { if (e.key === 'Enter' && !running()) toggle(); };
    $('[data-go]', main).onclick = toggle;
    $('[data-manual]', main).onclick = () => edit({ date: BW.today(), dur: '1:00', clientId: draft.clientId, billable: true });
    $('[data-rate]', main).onclick = changeRate;
    $$('[data-view]', main).forEach((b) => b.onclick = () => { view = b.dataset.view; render(); });
    $$('[data-wk]', main).forEach((b) => b.onclick = () => { weekStart = b.dataset.wk === '0' ? thisWeek : BW.addDays(weekStart, Number(b.dataset.wk) * 7); render(); });
    $$('[data-bill]', main).forEach((b) => b.onclick = () => bill(b.dataset.bill, groups[b.dataset.bill]));
    $$('.row[data-id]', main).forEach((r) => r.onclick = () => edit(entries.find((e) => e.id === r.dataset.id)));
    $$('[data-again]', main).forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      if (running()) return BW.toast('Stop the running timer first', '⏱️');
      const src = entries.find((x) => x.id === b.dataset.again);
      draft = { desc: src.desc, clientId: src.clientId }; toggle();
    });
    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    if (run) {
      const update = () => {
        const t = clock(minutesOf(run) * 60);
        const c = $('[data-clock]', main); if (c) c.textContent = t;
        document.title = `⏱ ${t} · ${run.desc || 'Timer'}`;
      };
      update(); tick = setInterval(update, 1000);
    }
  }

  function listView() {
    const byDay = {};
    for (const e of entries.slice().sort((a, b) => (b.date + (b.start || '')).localeCompare(a.date + (a.start || '')))) (byDay[e.date] = byDay[e.date] || []).push(e);
    return Object.keys(byDay).slice(0, 30).map((d) => `
      <div class="day-h"><span>${d === BW.today() ? 'Today' : BW.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</span><small class="faint">${pretty(byDay[d].reduce((a, e) => a + minutesOf(e), 0))}</small></div>
      <div class="list">${byDay[d].map(row).join('')}</div>`).join('');
  }

  // A timesheet: one row per client, one column per day, like Harvest's week view.
  function weekView() {
    const days = Array.from({ length: 7 }, (_, i) => BW.addDays(weekStart, i));
    const inWeek = entries.filter((e) => e.date >= days[0] && e.date <= days[6]);
    const rows = {};
    for (const e of inWeek) { const k = e.clientId || ''; rows[k] = rows[k] || {}; rows[k][e.date] = (rows[k][e.date] || 0) + minutesOf(e); }
    const cell = (m) => (m ? hm(m) : '<span class="faint">–</span>');
    const dayTotal = (d) => inWeek.filter((e) => e.date === d).reduce((a, e) => a + minutesOf(e), 0);
    return `<div class="row-flex" style="margin:14px 0 10px"><button class="icon-btn" data-wk="-1" aria-label="Previous week">◀</button>
        <b>${BW.fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${BW.fmtDate(days[6], { day: 'numeric', month: 'short', year: 'numeric' })}</b>
        <button class="icon-btn" data-wk="1" aria-label="Next week">▶</button><button class="btn btn-ghost" data-wk="0">This week</button></div>
      <div class="card sheet-wrap"><table class="sheet">
        <tr><th>Client</th>${days.map((d) => `<th class="${d === BW.today() ? 'today' : ''}">${BW.fmtDate(d, { weekday: 'short' })}<br><small>${BW.fmtDate(d, { day: 'numeric' })}</small></th>`).join('')}<th>Total</th></tr>
        ${Object.keys(rows).length ? Object.entries(rows).map(([cid, byDate]) => `<tr><td>${esc(clientName(cid) || 'No client')}</td>${days.map((d) => `<td>${cell(byDate[d])}</td>`).join('')}<td><b>${hm(Object.values(byDate).reduce((a, b) => a + b, 0))}</b></td></tr>`).join('')
          : `<tr><td colspan="9" class="faint" style="text-align:center;padding:20px">Nothing logged this week.</td></tr>`}
        <tr class="tot"><td>Total</td>${days.map((d) => `<td>${cell(dayTotal(d))}</td>`).join('')}<td>${hm(inWeek.reduce((a, e) => a + minutesOf(e), 0))}</td></tr>
      </table></div>`;
  }

  function row(e) {
    const on = e.start && !e.end;
    return `<div class="row ${on ? 'running' : ''}" data-id="${e.id}" tabindex="0">
      <span class="avatar" style="--av:${BW.colorFor(clientName(e.clientId) || 'x')};width:38px;height:38px;border-radius:12px;font-size:.8rem">${esc(BW.initials(clientName(e.clientId) || '–'))}</span>
      <span class="main"><b>${esc(e.desc || 'Untitled work')}</b><small>${esc(clientName(e.clientId) || 'No client')}${e.start ? ' · ' + new Date(e.start).toLocaleTimeString(BW.locale(), { hour: '2-digit', minute: '2-digit' }) : ''}</small></span>
      ${e.invoiceId ? '<span class="chip chip-mint">✅ Billed</span>' : on ? '<span class="chip chip-tomato">● Running</span>' : !billable(e) ? '<span class="chip chip-grey">Not billable</span>' : ''}
      ${on ? '' : `<button class="icon-btn" data-again="${e.id}" title="Continue: start a new timer for this" aria-label="Continue this">▶</button>`}
      <span class="dur">${on ? '…' : hm(minutesOf(e))}</span></div>`;
  }

  async function toggle() {
    const run = running();
    try {
      if (run) {
        run.end = new Date().toISOString();
        run.dur = hm(Math.max(1, minutesOf(Object.assign({}, run, { end: null }))));
        await BW.store.put('time', run);
        BW.toast(`${pretty(parseDur(run.dur))} logged. Nice focus!`, '🎉');
      } else {
        const d = $('[data-desc]', main), c = $('[data-client]', main);
        const e = { date: BW.today(), start: new Date().toISOString(), end: null, desc: d ? d.value || draft.desc : draft.desc, clientId: c ? c.value || draft.clientId : draft.clientId, rate: '', billable: true };
        await BW.store.put('time', e);
        BW.toast('Timer running. You got this!', '🚀');
      }
    } catch (err) { return BW.error(err); }
    await load(); render();
  }

  function edit(e) {
    BW.recordDrawer({
      collection: 'time', rec: e, title: 'Time entry', newTitle: 'Add time by hand',
      fields: [
        { k: 'desc', label: 'What did you do?', ph: 'e.g. Homepage design', span: 2 },
        { k: 'clientId', label: 'For which client?', type: 'select', options: [['', 'No client']].concat(clients.map((c) => [c.id, c.name])), span: 2 },
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'dur', label: 'How long?', ph: '1:30', hint: 'Like 1:30, 1.5 or 90m' },
        { k: 'billable', label: 'Can you bill it?', type: 'chips', options: [[1, '💶 Billable'], [0, '🙅 Not billable']] },
        { k: 'rate', label: 'Hourly rate', type: 'money', ph: String(baseRate()), hint: 'Empty uses the client’s rate, or your normal one' },
      ],
      isComplete: (r) => parseDur(r.dur) > 0 && !!r.date,
      onClose: async () => { await load(); render(); },
    });
  }

  function changeRate() {
    const box = document.createElement('div');
    box.innerHTML = `<label class="field"><span>What do you charge per hour (before VAT)?</span><input class="in" inputmode="decimal" data-v value="${baseRate()}"></label>
      <div class="field" style="margin-top:16px"><span>Round billed time up to</span><div class="choice-chips" data-name="timeRound">${[[0, 'Exact'], [6, '6 minutes'], [15, '15 minutes']].map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${roundTo() === v}">${l}</button>`).join('')}</div>
      <em>Rounding only changes what goes on the invoice, never what you logged.</em></div>
      <p class="muted" style="margin-top:14px">💡 Different rate for one client? Set it on the client in the Client Book.</p>`;
    BW.bindChips(box);
    BW.modal({
      title: '💶 Your rate', body: box,
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const v = BW.num($('[data-v]', box).value);
        if (!(v > 0)) { BW.toast('That needs to be a number above zero', '🤔'); return false; }
        const r = BW.readFields(box, {}).timeRound;
        try { await BW.store.saveSettings(Object.assign({}, BW.settings, { hourlyRate: v, timeRound: BW.num(r) })); } catch (e) { BW.error(e); return false; }
        BW.toast(`Rate set to ${BW.money(v)}. Treat yourself!`, '💪'); render();
      } }],
    });
  }

  // Unbilled hours for one client become a draft invoice, one line per session.
  async function bill(clientId, list) {
    const c = client(clientId);
    try {
      const invoices = await BW.store.all('invoices');
      const today = BW.today(), vat = BW.vatRates()[0] != null ? BW.vatRates()[0] : 21;
      const days = BW.num(c.paymentDays) || BW.settings.paymentDays || 14;
      const inv = {
        kind: 'invoice', number: BW.nextNumber(invoices, 'invoice', today.slice(0, 4)), status: 'draft', issueDate: today,
        dueDate: BW.addDays(today, days), currency: BW.settings.currency, clientId, lang: c.lang || '',
        client: Object.fromEntries(['name', 'contact', 'email', 'address', 'postcode', 'city', 'country', 'vat'].map((k) => [k, c[k] || ''])),
        items: list.sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({
          id: BW.uid(), desc: `${BW.fmtDate(e.date, { day: 'numeric', month: 'short' })} – ${e.desc || 'Work'}`,
          qty: Math.round(billedMinutes(e) / 60 * 100) / 100, price: rateOf(e), vat,
        })),
        notes: '', reverseCharge: false,
      };
      await BW.store.put('invoices', inv);
      list.forEach((e) => { e.invoiceId = inv.id; });
      await BW.store.putMany('time', list);
      BW.confetti();
      BW.toast(`Invoice ${esc(inv.number)} is ready. Opening it…`, '🧾');
      setTimeout(() => { location.href = `../invoices/index.html#edit/${inv.id}`; }, 1100);
    } catch (e) { BW.error(e); }
  }
})();
