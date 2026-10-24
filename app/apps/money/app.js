/* Money Dashboard: reads invoices, expenses and subscriptions. Writes nothing but your tax reserve %. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  let invoices = [], expenses = [], subs = [], period = 'year', asTable = false;
  let vq = Math.floor(new Date().getMonth() / 3) + 1, vy = new Date().getFullYear(); // VAT overview quarter
  const year = () => (period === 'last' ? new Date().getFullYear() - 1 : new Date().getFullYear());

  BW.boot({
    app: 'money',
    onReady: async () => { await load(); render(); addEventListener('resize', BW.debounce(drawChart, 150)); },
    onChange: async () => { await load(); render(); },
  });

  async function load() {
    [invoices, expenses, subs] = await Promise.all(['invoices', 'expenses', 'subscriptions'].map((n) => BW.store.all(n)));
  }

  // ---------- numbers ----------
  const net = (i) => BW.invoiceTotals(i).subtotal;
  // Money received, without VAT: each payment counts on the day it arrived (cash basis).
  const received = (r) => {
    let sum = 0; const hits = [];
    for (const i of invoices) {
      if (i.kind === 'quote') continue;
      const t = BW.invoiceTotals(i), share = t.total ? t.subtotal / t.total : 0;
      BW.paymentsOf(i).forEach((p) => { if (within(p.date, r)) { sum += BW.num(p.amount) * share; if (!hits.includes(i)) hits.push(i); } });
    }
    return { sum, invoices: hits };
  };
  const vatIn = (i) => BW.invoiceTotals(i).vatTotal;
  const expVat = (e) => { const r = BW.num(e.vatRate), a = BW.num(e.amount); return Math.round(a * r / (100 + r) * 100) / 100; };
  const expNet = (e) => BW.num(e.amount) - expVat(e);
  const range = () => {
    const t = BW.today(), y = t.slice(0, 4), m = Number(t.slice(5, 7));
    if (period === 'month') return [t.slice(0, 7) + '-01', t.slice(0, 7) + '-31'];
    if (period === 'quarter') { const q0 = Math.floor((m - 1) / 3) * 3 + 1; return [`${y}-${String(q0).padStart(2, '0')}-01`, `${y}-${String(q0 + 2).padStart(2, '0')}-31`]; }
    return [`${year()}-01-01`, `${year()}-12-31`];
  };
  const within = (d, [a, b]) => d && d >= a && d <= b;
  const perMonth = (sub) => {
    const a = BW.num(sub.amount);
    return { week: a * 52 / 12, month: a, quarter: a / 3, year: a / 12 }[sub.cycle || 'month'] || a;
  };

  function figures() {
    const r = range();
    const got = received(r), paid = got.invoices;
    const issued = invoices.filter((i) => (i.kind === 'invoice' || i.kind === 'credit') && i.status !== 'draft' && within(i.issueDate, r));
    const spent = expenses.filter((e) => within(e.date, r));
    const earned = got.sum;
    const costs = spent.reduce((a, e) => a + expNet(e), 0);
    const profit = earned - costs;
    const vatDue = Math.max(0, issued.reduce((a, i) => a + vatIn(i), 0) - spent.reduce((a, e) => a + expVat(e), 0));
    const pct = BW.num(BW.settings.taxReserve == null ? 30 : BW.settings.taxReserve);
    const taxPot = Math.max(0, profit * pct / 100);
    const open = invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent' && BW.balanceOf(i) > 0);
    const late = open.filter((i) => i.dueDate < BW.today());
    return { paid, earned, costs, profit, vatDue, pct, taxPot, open, late, spent };
  }

  function months() {
    const y = String(year());
    return Array.from({ length: 12 }, (_, n) => {
      const key = `${y}-${String(n + 1).padStart(2, '0')}`;
      return {
        key, label: BW.fmtDate(key + '-01', { month: 'short' }),
        in: received([key + '-01', key + '-31']).sum,
        out: expenses.filter((e) => (e.date || '').startsWith(key)).reduce((a, e) => a + expNet(e), 0),
      };
    });
  }

  // ---------- page ----------
  function render() {
    const f = figures();
    const fixed = subs.filter((s) => !s.cancelled).reduce((a, s) => a + perMonth(s), 0);
    const byClient = {};
    const r = range();
    for (const i of f.paid) {
      const t = BW.invoiceTotals(i), share = t.total ? t.subtotal / t.total : 0;
      const got = BW.paymentsOf(i).filter((p) => within(p.date, r)).reduce((a, p) => a + BW.num(p.amount), 0) * share;
      const k = i.client ? i.client.name : 'Unknown';
      byClient[k] = (byClient[k] || 0) + got;
    }
    const top = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const empty = !invoices.length && !expenses.length;
    const P = [['month', 'This month'], ['quarter', 'This quarter'], ['year', 'This year'], ['last', 'Last year']];

    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">📈</span> Money Dashboard</h1><p class="lead">How's business? Here's the honest answer, without opening a spreadsheet.</p></div>
      </div>
      <div class="filters"><div class="tabs" role="tablist">${P.map(([k, l]) => `<button role="tab" data-p="${k}" aria-selected="${period === k}">${l}</button>`).join('')}</div>
        <small class="faint">Amounts without VAT, unless it says otherwise.</small></div>
      ${empty ? `<div class="card empty rise" style="margin-bottom:50px"><div class="big">📈</div><h2>Nothing to count yet</h2>
          <p>Once you send invoices and log a few expenses, this page tells you what you earned, what you spent and what to keep aside for the taxman.</p>
          <div class="row-flex" style="justify-content:center"><a class="btn btn-primary btn-big" href="../invoices/index.html#new/invoice">🧾 Make an invoice</a><a class="btn btn-big" href="../expenses/index.html">📸 Add an expense</a></div></div>` : `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--mint)"><div class="k">💚 Earned</div><div class="v" data-count="${f.earned}"></div><div class="s">${f.paid.length} paid invoice${f.paid.length === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">💸 Spent</div><div class="v" data-count="${f.costs}"></div><div class="s">${f.spent.length} expense${f.spent.length === 1 ? '' : 's'}</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">${f.profit >= 0 ? '🏆' : '🌧️'} Profit</div><div class="v" data-count="${f.profit}"></div><div class="s">${f.profit >= 0 ? 'Yours to keep (after tax)' : 'Spending more than earning'}</div></div>
        <div class="card stat pig"><div class="k">🐷 Keep aside</div><div class="v" data-count="${f.vatDue + f.taxPot}"></div>
          <div class="break"><span>VAT to pay <b>${BW.money(f.vatDue)}</b></span><span>Income tax pot (<button class="link" data-pct>${f.pct}%</button>) <b>${BW.money(f.taxPot)}</b></span></div></div>
      </div>
      <section class="card chart-card">
        <div class="chart-head"><h2>Month by month, ${year()}</h2>
          <div class="legend"><span><i style="background:var(--series-in)"></i>Earned</span><span><i style="background:var(--series-out)"></i>Spent</span></div>
          <button class="btn btn-ghost" data-table>${asTable ? '📊 Show chart' : '🔢 Show as table'}</button></div>
        <div class="chart" data-chart></div>
      </section>
      ${forecastHtml()}
      <div class="lower rise">
        ${ageingHtml()}
        ${vatHtml()}
      </div>
      <div class="lower rise">
        <section class="card"><h3>⏳ Still to come in</h3>
          ${f.open.length ? `<p style="font-size:1.8rem;font-weight:900">${BW.money(f.open.reduce((a, i) => a + BW.balanceOf(i), 0))}</p>
            <small>${f.open.length} invoice${f.open.length === 1 ? '' : 's'} out there, with VAT. ${f.late.length ? `<b>${f.late.length} overdue</b>: <a href="../invoices/index.html">time for a nudge</a>.` : 'None overdue 🌈'}</small>
            <p style="margin-top:14px"><small>🔁 Fixed costs: <b>${BW.money(fixed)}</b> a month in <a href="../subscriptions/index.html">subscriptions</a>.</small></p>`
          : `<p class="muted">Nobody owes you anything right now. 🎉</p><p style="margin-top:14px"><small>🔁 Fixed costs: <b>${BW.money(fixed)}</b> a month in <a href="../subscriptions/index.html">subscriptions</a>.</small></p>`}
        </section>
        <section class="card"><h3>⭐ Best clients</h3>
          ${top.length ? top.map(([n, v]) => `<div class="client-bar" title="${esc(n)}: ${BW.money(v)}"><span>${esc(n)}</span><b>${BW.money(v)}</b><div class="track"><div class="fill" style="width:${Math.max(2, v / top[0][1] * 100)}%"></div></div></div>`).join('')
            : '<p class="muted">Paid invoices in this period show up here.</p>'}
        </section>
      </div>`}`;

    $$('[data-p]', main).forEach((b) => b.onclick = () => { period = b.dataset.p; render(); });
    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    const t = $('[data-table]', main); if (t) t.onclick = () => { asTable = !asTable; render(); };
    const pc = $('[data-pct]', main); if (pc) pc.onclick = changePct;
    $$('[data-vq]', main).forEach((b) => b.onclick = () => {
      vq += Number(b.dataset.vq);
      if (vq < 1) { vq = 4; vy--; } if (vq > 4) { vq = 1; vy++; }
      render();
    });
    drawChart();
  }

  // ---------- VAT return overview (Dutch box numbers, which match the Belastingdienst form) ----------
  function vatHtml() {
    const from = `${vy}-${String((vq - 1) * 3 + 1).padStart(2, '0')}-01`, to = `${vy}-${String(vq * 3).padStart(2, '0')}-31`;
    const box = { '1a': [0, 0], '1b': [0, 0], '1c': [0, 0], '1e': [0, 0], '3b': [0, 0] };
    invoices.filter((i) => (i.kind === 'invoice' || i.kind === 'credit') && i.status !== 'draft' && within(i.issueDate, [from, to])).forEach((i) => {
      const t = BW.invoiceTotals(i);
      if (i.reverseCharge) { box['3b'][0] += t.subtotal; return; }
      let taxed = 0;
      t.vat.forEach((v) => { const k = v.rate === 21 ? '1a' : v.rate === 9 ? '1b' : '1c'; box[k][0] += v.base; box[k][1] += v.amount; taxed += v.base; });
      box['1e'][0] += t.subtotal - taxed;
    });
    const input = expenses.filter((e) => within(e.date, [from, to])).reduce((a, e) => a + expVat(e), 0);
    const owed = box['1a'][1] + box['1b'][1] + box['1c'][1];
    const rows = [['1a', 'Sales at 21%'], ['1b', 'Sales at 9%'], ['1c', 'Sales at other rates'], ['1e', 'Sales at 0% or not taxed here'], ['3b', 'Sales to EU businesses (reverse charge)']]
      .filter(([k]) => box[k][0] || ['1a', '1b'].includes(k));
    return `<section class="card"><div class="row-flex" style="margin-bottom:12px"><h3 style="flex:1">🧾 VAT return, Q${vq} ${vy}</h3>
        <button class="icon-btn" data-vq="-1" aria-label="Previous quarter">◀</button><button class="icon-btn" data-vq="1" aria-label="Next quarter">▶</button></div>
      <table class="data-table vat"><tr><th>Box</th><th>What</th><th>Amount</th><th>VAT</th></tr>
        ${rows.map(([k, l]) => `<tr><td><b>${k}</b></td><td>${l}</td><td>${BW.money(box[k][0])}</td><td>${['1e', '3b'].includes(k) ? '' : BW.money(box[k][1])}</td></tr>`).join('')}
        <tr><td><b>5b</b></td><td>VAT you paid on costs</td><td></td><td>- ${BW.money(input)}</td></tr>
        <tr class="sum"><td></td><td><b>${owed - input >= 0 ? 'To pay' : 'To get back'}</b></td><td></td><td><b>${BW.money(Math.abs(owed - input))}</b></td></tr></table>
      <small class="faint" style="display:block;margin-top:10px">Based on invoices sent and expenses logged in this quarter. Check it with your accountant before you file.</small></section>`;
  }

  // ---------- who owes you, and for how long ----------
  function ageingHtml() {
    const today = BW.today();
    const buckets = [['Not due yet', 'var(--mint)', 0], ['1–30 days late', 'var(--sun)', 0], ['31–60 days late', 'var(--tomato)', 0], ['Over 60 days', 'var(--grape)', 0]];
    const open = invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent' && BW.balanceOf(i) > 0);
    open.forEach((i) => {
      const late = Math.round((Date.parse(today) - Date.parse(i.dueDate || today)) / 864e5);
      buckets[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3][2] += BW.balanceOf(i);
    });
    const worst = open.filter((i) => i.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
    return `<section class="card"><h3>⏰ Unpaid invoices by age</h3>
      <div class="ageing">${buckets.map(([l, c, v]) => `<div style="--c:${c}"><small>${l}</small><b>${BW.money(v)}</b></div>`).join('')}</div>
      ${worst.length ? `<div class="list" style="margin-top:14px">${worst.map((i) => `<a class="row" href="../invoices/index.html#edit/${i.id}" style="text-decoration:none"><span class="main"><b>${esc(i.client ? i.client.name : '')}</b><small>${esc(i.number)} · ${Math.round((Date.parse(today) - Date.parse(i.dueDate)) / 864e5)} days late</small></span><span class="amt">${BW.money(BW.balanceOf(i))}</span></a>`).join('')}</div>` : '<p class="muted" style="margin-top:12px">Nobody is late. 🌈</p>'}
    </section>`;
  }

  // ---------- the next 90 days: open invoices and repeating invoices in, subscriptions out ----------
  function forecastHtml() {
    const today = BW.today(), slots = [[0, 30], [31, 60], [61, 90]].map(([a, b]) => ({ from: a ? BW.addDays(today, a) : '0000', to: BW.addDays(today, b), in: 0, out: 0 }));
    const slotFor = (d) => slots.find((x) => d <= x.to && d >= x.from) || (d < today ? slots[0] : null);
    invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent').forEach((i) => { const s = slotFor(i.dueDate || today); if (s) s.in += BW.balanceOf(i); });
    invoices.filter((i) => i.repeat && i.repeat.on).forEach((i) => {
      for (let d = i.repeat.next, n = 0; d <= slots[2].to && n < 20; d = BW.addPeriod(d, i.repeat.every), n++) { const s = slotFor(BW.addDays(d, 14)); if (s) s.in += BW.invoiceTotals(i).total; }
    });
    subs.filter((x) => x.status !== 'cancelled' && x.nextDate).forEach((x) => {
      let d = x.nextDate, n = 0;
      while (d < today && n++ < 600) d = BW.addPeriod(d, x.cycle || 'month');
      for (n = 0; d <= slots[2].to && n < 20; d = BW.addPeriod(d, x.cycle || 'month'), n++) { const s = slotFor(d); if (s) s.out += BW.num(x.amount); }
    });
    if (!slots.some((x) => x.in || x.out)) return '';
    return `<section class="card chart-card"><div class="chart-head"><h2>🔮 The next 90 days</h2><small class="faint">Open and repeating invoices coming in, subscriptions going out</small></div>
      <div class="forecast">${slots.map((x, i) => `<div><small>${['Next 30 days', 'Day 31–60', 'Day 61–90'][i]}</small>
        <span class="in">＋ ${BW.money(x.in)}</span><span class="out">− ${BW.money(x.out)}</span><b class="${x.in - x.out < 0 ? 'neg' : ''}">${BW.money(x.in - x.out)}</b></div>`).join('')}</div></section>`;
  }

  // Grouped bars: earned vs spent per month. One axis, rounded data-ends, hover tooltip, table fallback.
  function drawChart() {
    const box = $('[data-chart]', main); if (!box) return;
    const data = months();
    if (asTable) {
      box.innerHTML = `<table class="data-table"><tr><th>Month</th><th>Earned</th><th>Spent</th><th>Difference</th></tr>
        ${data.map((m) => `<tr><td>${m.label}</td><td>${BW.money(m.in)}</td><td>${BW.money(m.out)}</td><td>${BW.money(m.in - m.out)}</td></tr>`).join('')}</table>`;
      return;
    }
    const W = Math.max(320, box.clientWidth), H = 260, L = 64, R = 8, T = 10, B = 28;
    const pw = W - L - R, ph = H - T - B;
    const raw = Math.max(1, ...data.map((m) => Math.max(m.in, m.out)));
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const max = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((v) => v >= raw);
    const y = (v) => T + ph - (v / max) * ph;
    const gw = pw / 12, bw = Math.min(20, (gw - 12) / 2);
    const bar = (x, v, cls, color, i) => {
      if (v <= 0) return '';
      const top = y(v), h = T + ph - top, r = Math.min(4, h, bw / 2);
      return `<path class="bar ${cls}" style="fill:${color};animation-delay:${i * 30}ms" d="M${x},${T + ph} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${T + ph} Z"/>`;
    };
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
    const short = (v) => (v >= 1000 ? BW.money(v / 1000).replace(/[.,]00(?=\D*$)/, '') + 'k' : BW.money(v).replace(/[.,]00(?=\D*$)/, ''));
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Earned and spent per month in ${year()}">
      <g class="grid">${ticks.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
      <g class="axis">${ticks.map((v) => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`).join('')}
        ${data.map((m, i) => `<text x="${L + gw * i + gw / 2}" y="${H - 8}" text-anchor="middle">${m.label}</text>`).join('')}</g>
      ${data.map((m, i) => `<rect class="hit" data-i="${i}" x="${L + gw * i}" y="${T}" width="${gw}" height="${ph}" rx="8"/>`).join('')}
      <g style="pointer-events:none">${data.map((m, i) => { const x0 = L + gw * i + (gw - 2 * bw - 2) / 2; return bar(x0, m.in, 'in', 'var(--series-in)', i) + bar(x0 + bw + 2, m.out, 'out', 'var(--series-out)', i); }).join('')}</g>
    </svg><div class="tip" hidden></div>`;
    const tip = $('.tip', box), card = box.closest('.chart-card');
    $$('.hit', box).forEach((h) => {
      h.onmouseenter = () => {
        const m = data[Number(h.dataset.i)];
        tip.innerHTML = `<b>${BW.fmtDate(m.key + '-01', { month: 'long', year: 'numeric' })}</b>
          <span><span><i style="background:var(--series-in)"></i>Earned</span><b>${BW.money(m.in)}</b></span>
          <span><span><i style="background:var(--series-out)"></i>Spent</span><b>${BW.money(m.out)}</b></span>
          <span style="margin-top:4px;color:var(--ink-2)">Difference <b>${BW.money(m.in - m.out)}</b></span>`;
        tip.hidden = false;
        const hr = h.getBoundingClientRect(), cr = card.getBoundingClientRect();
        const left = Math.min(cr.width - tip.offsetWidth - 10, Math.max(10, hr.left - cr.left + hr.width / 2 - tip.offsetWidth / 2));
        tip.style.left = left + 'px'; tip.style.top = (hr.top - cr.top + 4) + 'px';
      };
      h.onmouseleave = () => { tip.hidden = true; };
    });
  }

  function changePct() {
    BW.modal({
      title: '🐷 Your income tax pot',
      body: `<p style="margin-bottom:14px">What share of your profit should we keep aside for income tax? Ask your accountant. Many freelancers keep 30–40% aside.</p>
        <label class="field"><span>Percentage of profit</span><input class="in" inputmode="decimal" data-v value="${BW.num(BW.settings.taxReserve == null ? 30 : BW.settings.taxReserve)}"></label>`,
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const v = BW.num($('[data-v]').value);
        if (v < 0 || v > 100) { BW.toast('Pick a number between 0 and 100', '🤔'); return false; }
        try { await BW.store.saveSettings(Object.assign({}, BW.settings, { taxReserve: v })); } catch (e) { BW.error(e); return false; }
        render();
      } }],
    });
  }
})();
