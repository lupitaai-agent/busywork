/* Shared Costs: who paid what in the household, split between any number of people, and the fewest payments that
   make everyone even. Split equally, by an income share set once per person (a weight, never the income itself),
   or by a split of your own for one cost. Pets pay nothing. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  // Tool pages do not load the frame's helpers, so these two small ones live here.
  const ui = { k: (label) => `<p class="k">${label}</p>`, line: (left, right) => `<div class="line"><span>${left}</span><b>${right || ''}</b></div>` };
  const H = BW.house;
  const main = $('#main');
  let costs = [], settlements = [], members = [], month = BW.today().slice(0, 7);

  BW.boot({
    app: 'costs',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({}), open: (id) => { const x = costs.find((c) => c.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a cost', () => edit({}));
  async function load() { [costs, settlements, members] = await Promise.all(['costs', 'settlements', 'members'].map((n) => BW.store.all(n).catch(() => []))); }

  const name = (id) => H.whoName(members, id) || BW.t('Someone');
  const cents = (v) => BW.money(v / 100);

  function render() {
    const people = H.people(members);
    if (people.length < 2) {
      main.innerHTML = `<div class="page-head"><div><h1><span class="title-emo">🧮</span> ${BW.t('Shared Costs')}</h1><p class="lead">${BW.t('Who paid what, and who owes whom. For couples, families and housemates.')}</p></div></div>
        <section class="card pad"><h2>${BW.t('First, who shares the costs?')}</h2><p class="s">${BW.t('Add the people of the household on the Household page. Then every cost can be split between them.')}</p><a class="btn btn-primary" href="../../home-people.html">👪 ${BW.t('The household')}</a></section>`;
      return;
    }
    const net = H.balance(costs, settlements, members), pays = H.settleUp(net);
    const shown = H.costsOfMonth(costs, month).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const months = [...new Set(costs.map((c) => String(c.date || '').slice(0, 7)).filter(Boolean).concat([BW.today().slice(0, 7)]))].sort().reverse();
    const total = shown.reduce((s, c) => s + BW.num(c.amount), 0);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🧮</span> ${BW.t('Shared Costs')}</h1><p class="lead">${BW.t('Who paid what, and who owes whom. Split equally, by income share, or your own way.')}</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> ${BW.t('Add a cost')}</button>
      </div>
      <div class="stats rise">
        ${people.map((m) => `<div class="card stat" style="--tint:var(--${esc(m.colour || 'sun')})"><div class="k">${esc(m.name)}</div><div class="v">${net[m.id] > 0 ? '+' : ''}${cents(net[m.id] || 0)}</div><div class="s">${net[m.id] > 0 ? BW.t('is owed') : net[m.id] < 0 ? BW.t('has to pay') : BW.t('is even')}</div></div>`).join('')}
      </div>
      <section class="card ${pays.length ? 'attention' : 'pad'} rise">
        <h2>${pays.length ? `🤝 ${BW.t('To make everyone even')}` : `✅ ${BW.t('Everyone is even')}`}</h2>
        ${pays.map((p, i) => `<div class="file-row"><span>💸</span><span class="main"><b>${esc(name(p.from))}</b> → <b>${esc(name(p.to))}</b></span><b>${BW.money(p.amount)}</b><button type="button" class="btn" data-paid="${i}">${BW.t('Paid')}</button></div>`).join('')}
        ${pays.length ? `<p class="s">${BW.t('The fewest payments that settle it. Tap “Paid” once the money has gone.')}</p>` : ''}
      </section>
      <div class="filters" data-month style="margin:18px 0 10px">${months.slice(0, 12).map((m) => `<button type="button" data-v="${m}" aria-pressed="${m === month}">${BW.fmtDate(m + '-01', { month: 'short', year: 'numeric' })}</button>`).join('')}</div>
      <section class="card pad">
        ${ui.k(`${BW.t('This month')}: ${BW.money(total)}`)}
        ${shown.length ? shown.map((c) => `<a class="file-row" href="#open/${c.id}"><span>🧾</span><span class="main"><b>${esc(c.what || BW.t('A cost'))}</b><small>${esc([BW.fmtDate(c.date), `${BW.t('paid by')} ${name(c.paidBy)}`, BW.t((H.SPLITS.find((s) => s[0] === (c.split || 'equal')) || H.SPLITS[0])[1])].join(' · '))}</small></span><b>${BW.money(BW.num(c.amount))}</b></a>`).join('')
          : `<p class="s">${BW.t('Nothing this month yet. Add the groceries, the energy bill, the holiday.')}</p>`}
      </section>
      ${settlements.length ? `<section class="card pad" style="margin-top:16px">${ui.k(BW.t('Settled'))}${settlements.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6).map((s) => ui.line(`${esc(name(s.from))} → ${esc(name(s.to))} · ${BW.fmtDate(s.date)}`, `${BW.money(BW.num(s.amount))} <button type="button" class="btn btn-ghost unsettle" data-unsettle="${s.id}" title="${BW.t('Remove')}" aria-label="${BW.t('Remove')}">✕</button>`)).join('')}</section>` : ''}
      <p class="s" style="margin-top:16px">${BW.t('Splitting by income uses a share you set once per person on the Household page, such as 60 and 40. Busy never asks what anyone earns.')}</p>`;
    $('[data-new]', main).onclick = () => edit({});
    $('[data-month]', main).onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { month = b.dataset.v; render(); } };
    $$('[data-paid]', main).forEach((b) => b.onclick = async () => {
      const p = pays[Number(b.dataset.paid)];
      b.disabled = true;   // a double tap must not settle it twice
      let rec;
      try { rec = await BW.store.put('settlements', { date: BW.today(), from: p.from, to: p.to, amount: p.amount }); } catch (e) { return BW.error(e); }
      // A tap by mistake can be taken back at once, and later with the ✕ in "Settled".
      BW.toast(`${esc(name(p.from))} → ${esc(name(p.to))}: ${BW.money(p.amount)}`, '🤝', { label: BW.t('Undo'), run: async () => { try { await BW.store.remove('settlements', rec.id); } catch (e) { return BW.error(e); } await load(); render(); } });
      await load(); render();
    });
    $$('[data-unsettle]', main).forEach((b) => b.onclick = () => {
      const s = settlements.find((x) => x.id === b.dataset.unsettle);
      if (s) BW.removeWithUndo('settlements', s, `${esc(name(s.from))} → ${esc(name(s.to))}: ${BW.money(BW.num(s.amount))}`, async () => { await load(); render(); });
    });
  }

  function edit(c) {
    const people = H.people(members), me = H.myself();
    const rec = Object.assign({ date: BW.today(), split: 'equal', paidBy: H.member(members, me) ? me : (people[0] || {}).id, among: people.map((m) => m.id) }, c);
    BW.recordDrawer({
      collection: 'costs', rec, title: 'A shared cost', newTitle: 'Add a cost',
      fields: [
        { k: 'what', label: 'What was it?', ph: 'e.g. Groceries, the energy bill, the holiday cottage', span: 2, required: true },
        { k: 'amount', label: 'Amount', type: 'money' },
        { k: 'date', label: 'Paid on', type: 'date' },
        { k: 'paidBy', label: 'Who paid?', type: 'chips', options: people.map((m) => [m.id, m.name]) },
        { k: 'split', label: 'How to split it', type: 'chips', options: H.SPLITS.map(([v, l]) => [v, BW.t(l)]) },
        { k: 'note', label: 'Note', ph: 'Optional', span: 2 },
      ],
      isComplete: (r) => !!String(r.what || '').trim() && BW.num(r.amount) > 0 && !!r.paidBy,
      // Who shares this one, and (for "our own split") in what parts. Kept on the record as `among` and `shares`.
      bottom: (r) => `<h3 style="margin:18px 0 8px">${BW.t('Shared between')}</h3><div class="check-list" data-among>${people.map((m) => `<label class="check-item"><input type="checkbox" value="${m.id}" ${!(r.among || []).length || r.among.includes(m.id) ? 'checked' : ''}><span class="main"><b>${esc(m.name)}</b></span><input class="in share-in" inputmode="decimal" data-share="${m.id}" value="${esc((r.shares || {})[m.id] ?? '')}" placeholder="${BW.t('Part')}" aria-label="${BW.t('Part for')} ${esc(m.name)}"></label>`).join('')}</div>
        <p class="s">${BW.t('Parts only count for “our own split”: 1 and 2 means one third and two thirds.')}</p>`,
      bind: (box, r, save) => {
        const wrap = $('[data-among]', box);
        const read = () => {
          const ticked = $$('input[type=checkbox]', wrap).filter((x) => x.checked).map((x) => x.value);
          r.among = ticked;   // always the ids: "everyone" must not grow when the household does
          r.shares = {}; $$('[data-share]', wrap).forEach((x) => { if (x.value.trim()) r.shares[x.dataset.share] = BW.num(x.value); });
          save();
        };
        wrap.addEventListener('change', read); wrap.addEventListener('input', read);
      },
      onClose: async () => { await load(); render(); },
    });
  }
})();
