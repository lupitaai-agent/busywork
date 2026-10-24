/* Subscriptions: every recurring bill, what it costs per month, and when it renews next. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  const CYCLES = [['week', 'Weekly'], ['month', 'Monthly'], ['quarter', 'Every 3 months'], ['year', 'Yearly']];
  const CATS = [['software', '💻 Software'], ['phone', '📱 Phone & internet'], ['insurance', '☂️ Insurance'], ['office', '🏢 Workspace'], ['finance', '🏦 Bank & finance'], ['other', '📦 Other']];
  let subs = [];

  BW.boot({
    app: 'subscriptions',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit(blank()), open: (id) => { const x = subs.find((y) => y.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  const blank = () => ({ cycle: 'month', category: 'software', nextDate: BW.addDays(BW.today(), 30), status: 'active', vatRate: BW.vatRates()[0] || 0 });
  BW.shortcut('n', 'Add a subscription', () => edit(blank()));
  async function load() { subs = await BW.store.all('subscriptions'); }

  const perMonth = (s) => { const a = BW.num(s.amount); return { week: a * 52 / 12, month: a, quarter: a / 3, year: a / 12 }[s.cycle || 'month'] || a; };
  // Renewal dates roll forward by themselves, so a yearly bill entered last spring shows next spring.
  function next(s) {
    let d = s.nextDate || BW.today();
    const step = { week: [0, 7], month: [1, 0], quarter: [3, 0], year: [12, 0] }[s.cycle || 'month'];
    for (let guard = 0; d < BW.today() && guard < 600; guard++) {
      const [y, m, day] = d.split('-').map(Number);
      const dt = new Date(y, m - 1 + step[0], day + step[1]);
      d = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
    return d;
  }
  const daysTo = (iso) => Math.round((new Date(iso) - new Date(BW.today())) / 864e5);

  function render() {
    const live = subs.filter((s) => s.status !== 'cancelled').sort((a, b) => next(a).localeCompare(next(b)));
    const off = subs.filter((s) => s.status === 'cancelled');
    const month = live.reduce((a, s) => a + perMonth(s), 0);
    const soon = live.filter((s) => daysTo(next(s)) <= 30);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🔁</span> Subscriptions</h1><p class="lead">All the little monthly bills, in one place. No more surprise renewals.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">${subs.length ? '<button class="btn" data-export><span class="emo">⬇️</span> Export</button>' : ''}<button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a subscription</button></div>
      </div>
      ${subs.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--grape)"><div class="k">📆 Per month</div><div class="v" data-count="${month}"></div><div class="s">${live.length} active</div></div>
        <div class="card stat" style="--tint:var(--pink)"><div class="k">🗓️ Per year</div><div class="v" data-count="${month * 12}"></div><div class="s">Before VAT you can claim back</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">⏰ Renewing within 30 days</div><div class="v">${soon.length}</div><div class="s">${soon.length ? BW.money(soon.reduce((a, s) => a + BW.num(s.amount), 0)) + ' coming up' : 'Nothing coming up'}</div></div>
      </div>
      <p class="coffee">☕ That's about <b>${Math.round(month / 3.5)}</b> cappuccinos a month. Still using all of them?</p>
      ${timeline(live)}
      <div class="sub-grid rise">${live.map(card).join('')}</div>
      ${off.length ? `<h3 style="margin:10px 0 14px">👋 Cancelled</h3><div class="sub-grid">${off.map(card).join('')}</div>` : ''}`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🔁</div><h2>No subscriptions yet</h2><p>Add your software, phone plan, insurance and anything else that keeps charging you. We'll show the real monthly total.</p><button class="btn btn-primary btn-big" data-new>＋ Add the first one</button></div>`}`;
    $$('[data-count]', main).forEach((el) => BW.countUp(el, Number(el.dataset.count), (v) => BW.money(v)));
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit(blank()));
    $$('[data-id]', main).forEach((b) => b.onclick = () => edit(subs.find((s) => s.id === b.dataset.id)));
    const ex = $('[data-export]', main);
    if (ex) ex.onclick = () => BW.exportCsv('subscriptions.csv', ['Name', 'Amount', 'Billed', 'Per month', 'Next renewal', 'Category', 'Status', 'Manage at'],
      subs.map((s) => [s.name, BW.num(s.amount).toFixed(2), (CYCLES.find((c) => c[0] === s.cycle) || CYCLES[1])[1], perMonth(s).toFixed(2), next(s), (CATS.find((c) => c[0] === s.category) || CATS[5])[1].replace(/^\S+\s/, ''), s.status || 'active', s.url || '']));
  }

  function card(s) {
    const d = next(s), n = daysTo(d), cyc = (CYCLES.find((c) => c[0] === s.cycle) || CYCLES[1])[1].toLowerCase();
    return `<button class="card sub ${s.status === 'cancelled' ? 'off' : ''}" data-id="${s.id}">
      <div class="top"><span class="avatar" style="--av:${BW.colorFor(s.name)}">${esc(BW.initials(s.name))}</span>
        <span><b>${esc(s.name)}</b><small>${(CATS.find((c) => c[0] === s.category) || CATS[5])[1]}</small></span></div>
      <div class="price">${BW.money(BW.num(s.amount))} <small class="faint">${cyc}</small></div>
      ${s.status === 'cancelled' ? '<span class="chip chip-grey">Cancelled</span>'
        : `<span class="chip ${n <= 7 ? 'chip-tomato soon' : n <= 30 ? 'chip-sun' : 'chip-grey'}">${n === 0 ? '🔔 Renews today' : n === 1 ? '🔔 Renews tomorrow' : `Renews in ${n} days`} · ${BW.fmtDate(d, { day: 'numeric', month: 'short' })}</span>`}
    </button>`;
  }

  // Twelve months ahead: what renews when, like Rocket Money's upcoming charges.
  function timeline(live) {
    const start = BW.today().slice(0, 7) + '-01';
    const months = Array.from({ length: 12 }, (_, i) => ({ key: BW.addPeriod(start, 'month', i).slice(0, 7), total: 0, names: [] }));
    live.forEach((x) => {
      let d = next(x);
      for (let n = 0; n < 60 && d.slice(0, 7) <= months[11].key; n++, d = BW.addPeriod(d, x.cycle || 'month')) {
        const m = months.find((mm) => mm.key === d.slice(0, 7)); if (m) { m.total += BW.num(x.amount); m.names.push(x.name); }
      }
    });
    const max = Math.max(1, ...months.map((m) => m.total));
    return `<section class="card tl"><h3>🗓️ The next 12 months</h3><div class="tl-bars">${months.map((m) => `
      <div class="tl-m" title="${esc(m.names.join(', '))}"><span class="tl-v">${m.total ? BW.money(m.total).replace(/[.,]00(?=\D*$)/, '') : ''}</span><span class="tl-b" style="height:${Math.max(m.total ? 6 : 0, m.total / max * 100)}%"></span><small>${BW.fmtDate(m.key + '-01', { month: 'short' })}</small></div>`).join('')}</div>
      <small class="faint">Hover a month to see what renews. Big yearly bills stand out, so they never catch you off guard.</small></section>`;
  }

  // One click turns this month's charge into an expense, so the receipt trail and VAT stay complete.
  async function logPayment(x) {
    const r = BW.num(x.vatRate);
    const e = { date: BW.today(), vendor: x.name, amount: BW.num(x.amount), vatRate: r, category: x.category === 'software' ? 'software' : x.category === 'phone' ? 'office' : 'other', paidBy: 'business', fromSub: x.id };
    try { await BW.store.put('expenses', e); } catch (err) { return BW.error(err); }
    BW.toast(`${esc(x.name)} logged in Receipts &amp; Expenses`, '📸', { label: 'Open', run: () => { location.href = '../expenses/index.html#open/' + e.id; } });
  }

  function edit(s) {
    BW.recordDrawer({
      collection: 'subscriptions', rec: s, title: 'Subscription', newTitle: 'New subscription',
      fields: [
        { k: 'name', label: 'What is it?', ph: 'e.g. Adobe Creative Cloud', span: 2 },
        { k: 'amount', label: 'Amount', type: 'money', ph: '0.00' },
        { k: 'nextDate', label: 'Next payment', type: 'date' },
        { k: 'cycle', label: 'How often?', type: 'chips', options: CYCLES },
        { k: 'category', label: 'Kind', type: 'chips', options: CATS },
        { k: 'status', label: 'Status', type: 'chips', options: [['active', '✅ Active'], ['cancelled', '👋 Cancelled']] },
        { k: 'vatRate', label: 'VAT included', type: 'chips', options: BW.vatRates().map((v) => [v, v + '%']) },
        { k: 'url', label: 'Where to manage or cancel it', ph: 'https://…', span: 2 },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2, ph: 'Login email, contract end date, who uses it…' },
      ],
      bottom: (r) => `<div class="row-flex" style="margin-top:14px">${r.id ? '<button type="button" class="btn btn-primary" data-log>📸 Log this payment as an expense</button>' : ''}${r.url ? `<a class="btn" href="${esc(/^https?:/.test(r.url) ? r.url : 'https://' + r.url)}" target="_blank" rel="noopener">🔗 Open the account page</a>` : ''}</div>`,
      bind: (box, r) => { const b = $('[data-log]', box); if (b) b.onclick = () => logPayment(r); },
      onClose: async () => { await load(); render(); },
    });
  }
})();
