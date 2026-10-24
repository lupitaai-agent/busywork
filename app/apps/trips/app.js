/* Trip Log: business kilometres and what they are worth at tax time. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let trips = [], clients = [], year = new Date().getFullYear();

  BW.boot({
    app: 'trips',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({ date: BW.today(), roundTrip: 1 }), open: (id) => { const t = trips.find((x) => x.id === id); if (t) edit(t); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Log a trip', () => edit({ date: BW.today(), roundTrip: 1 }));
  async function load() { [trips, clients] = await Promise.all([BW.store.all('trips'), BW.store.all('clients')]); }

  const rate = () => BW.num(BW.settings.kmRate == null ? 0.23 : BW.settings.kmRate);
  const kmOf = (t) => BW.num(t.km) * (t.roundTrip === 1 || t.roundTrip === '1' ? 2 : 1);
  const clientName = (id) => (clients.find((c) => c.id === id) || {}).name || '';

  function render() {
    const mine = trips.filter((t) => (t.date || '').startsWith(String(year))).sort((a, b) => b.date.localeCompare(a.date));
    const km = mine.reduce((a, t) => a + kmOf(t), 0);
    const months = {};
    for (const t of mine) (months[t.date.slice(0, 7)] = months[t.date.slice(0, 7)] || []).push(t);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🚗</span> Trip Log</h1><p class="lead">Every business kilometre counts. Literally: it lowers your tax.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <button class="chip chip-mint" data-rate style="cursor:pointer">🧮 ${BW.money(rate())} per km ✏️</button>
          ${mine.length ? '<button class="btn" data-export><span class="emo">⬇️</span> Export year</button>' : ''}
          <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Log a trip</button>
        </div>
      </div>
      <div class="year-nav"><button class="icon-btn" data-y="-1" aria-label="Previous year">◀</button><b>${year}</b><button class="icon-btn" data-y="1" aria-label="Next year">▶</button></div>
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--mint)"><div class="k">🛣️ Kilometres</div><div class="v">${Math.round(km).toLocaleString(BW.locale())} km</div><div class="s">${mine.length} trip${mine.length === 1 ? '' : 's'} in ${year}</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">💶 Worth at tax time</div><div class="v" data-count="${km * rate()}"></div><div class="s">At ${BW.money(rate())} per km</div></div>
        <div class="card stat" style="--tint:var(--sky)"><div class="k">🌍 Around the world</div><div class="v">${(km / 40075 * 100).toFixed(1)}%</div><div class="s">Keep driving 🚀</div></div>
      </div>
      ${favourites().length ? `<div class="favs"><b>⭐ Your usual trips</b>${favourites().map((f, i) => `<button class="chip" data-fav="${i}" title="Log this trip for today">${esc(f.from)} → ${esc(f.to)} <span class="faint">${Math.round(kmOf(f))} km</span></button>`).join('')}</div>` : ''}
      <div class="road"></div>
      ${mine.length ? Object.keys(months).map((m) => `
        <div class="month-h"><span>${BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' })}</span><small class="faint">${Math.round(months[m].reduce((a, t) => a + kmOf(t), 0))} km</small></div>
        <div class="list">${months[m].map(row).join('')}</div>`).join('') + '<div style="height:40px"></div>'
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🚗</div><h2>No trips in ${year} yet</h2><p>Drove to a client, the print shop or a networking event? Log it here. Your accountant will want this list.</p><button class="btn btn-primary btn-big" data-new>＋ Log my first trip</button></div>`}`;

    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ date: BW.today(), roundTrip: 1 }));
    $$('[data-y]', main).forEach((b) => b.onclick = () => { year += Number(b.dataset.y); render(); });
    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    $('[data-rate]', main).onclick = changeRate;
    $$('[data-fav]', main).forEach((b) => b.onclick = () => logAgain(favourites()[Number(b.dataset.fav)]));
    $$('.row[data-id]', main).forEach((r) => r.onclick = () => edit(trips.find((t) => t.id === r.dataset.id)));
    $$('[data-again]', main).forEach((b) => b.onclick = (e) => { e.stopPropagation(); logAgain(trips.find((x) => x.id === b.dataset.again)); });
    const ex = $('[data-export]', main);
    if (ex) ex.onclick = () => BW.exportCsv(`trips-${year}.csv`, ['Date', 'From', 'To', 'Km', 'Return trip', 'Total km', 'Purpose', 'Client', 'Amount'],
      mine.slice().reverse().map((t) => [t.date, t.from, t.to, BW.num(t.km), kmOf(t) > BW.num(t.km) ? 'yes' : 'no', kmOf(t), t.purpose || '', clientName(t.clientId), (kmOf(t) * rate()).toFixed(2)]));
  }

  // The routes you drive most, as one-tap buttons (MileIQ-style favourites).
  function favourites() {
    const count = {};
    trips.forEach((t) => { const k = `${t.from}|${t.to}|${t.km}|${t.roundTrip}`; count[k] = count[k] || { n: 0, t }; count[k].n++; });
    return Object.values(count).filter((c) => c.n >= 2).sort((a, b) => b.n - a.n).slice(0, 5).map((c) => c.t);
  }
  async function logAgain(t) {
    const copy = { date: BW.today(), from: t.from, to: t.to, km: t.km, roundTrip: t.roundTrip, purpose: t.purpose, clientId: t.clientId };
    try { await BW.store.put('trips', copy); } catch (err) { return BW.error(err); }
    BW.toast(`Logged ${Math.round(kmOf(copy))} km for today. Vroom!`, '🚗', { label: 'Undo', run: async () => { await BW.store.remove('trips', copy.id); await load(); render(); } });
    await load(); render();
  }

  function row(t) {
    return `<div class="row" data-id="${t.id}" tabindex="0">
      <span style="font-size:1.4rem">${kmOf(t) > BW.num(t.km) ? '🔁' : '➡️'}</span>
      <span class="main"><span class="route"><b>${esc(t.from || '?')}</b><span class="arrow">→</span><b>${esc(t.to || '?')}</b></span>
        <small>${BW.fmtDate(t.date)}${t.purpose ? ' · ' + esc(t.purpose) : ''}${t.clientId ? ' · ' + esc(clientName(t.clientId)) : ''}</small></span>
      <button class="btn again" data-again="${t.id}" title="Log the same trip for today">🔂 Again today</button>
      <span class="km">${Math.round(kmOf(t))} km</span></div>`;
  }

  function edit(t) {
    BW.recordDrawer({
      collection: 'trips', rec: t, title: 'Trip', newTitle: 'Log a trip',
      fields: [
        { k: 'from', label: 'From', ph: 'e.g. Home, Amsterdam' },
        { k: 'to', label: 'To', ph: 'e.g. Client office, Utrecht' },
        { k: 'km', label: 'Kilometres (one way)', type: 'number', ph: '42' },
        { k: 'date', label: 'Date', type: 'date' },
        { k: 'roundTrip', label: 'Did you drive back too?', type: 'chips', options: [[1, '🔁 Yes, there and back'], [0, '➡️ One way']] },
        { k: 'purpose', label: 'Why?', ph: 'e.g. Kick-off meeting', span: 2 },
        { k: 'clientId', label: 'Client', type: 'select', options: [['', 'No client']].concat(clients.map((c) => [c.id, c.name])), span: 2 },
      ],
      isComplete: (r) => BW.num(r.km) > 0 && !!r.date,
      onClose: async () => { await load(); render(); },
    });
  }

  function changeRate() {
    BW.modal({
      title: '🧮 Your rate per km',
      body: `<p style="margin-bottom:14px">The Dutch tax office has allowed €0.23 per business kilometre in recent years. Check the current amount for your country with your accountant.</p>
        <label class="field"><span>Amount per kilometre</span><input class="in" inputmode="decimal" data-v value="${rate()}"></label>`,
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const v = BW.num($('[data-v]').value);
        if (!(v >= 0)) { BW.toast('That needs to be a number', '🤔'); return false; }
        try { await BW.store.saveSettings(Object.assign({}, BW.settings, { kmRate: v })); } catch (e) { BW.error(e); return false; }
        render();
      } }],
    });
  }
})();
