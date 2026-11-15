/* Busy Home opens on This week: at most three things at home that need doing, each with one button, so ten
   minutes are enough and the evening is free. Beside them: the tray (drop a letter, a contract or a receipt in)
   and what is coming up. The tools are in the parts of the rail, never in a grid here. */
(function () {
  'use strict';
  const { $, $$, esc, ui } = BW;
  const H = BW.house;
  const main = $('#main');

  BW.boot({ part: 'today', onReady: render, onChange: render });

  const HEAD = ['Nothing needs you this week. The evening is yours.', 'One thing this week. Then the evening is yours.', 'Two things this week. Then the evening is yours.', 'Ten minutes, three things. Then the evening is yours.'];

  async function render() {
    const s = BW.settings, today = BW.today();
    const [papers, contracts, upkeep, inventory, moves] = await Promise.all(['papers', 'contracts', 'upkeep', 'inventory', 'moves'].map((n) => BW.store.all(n)));
    const long = (d) => BW.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' });
    const needs = [], acts = [];
    const add = (w, n, act) => { needs.push(Object.assign({ w }, n)); acts.push(act || {}); needs[needs.length - 1].act = acts.length - 1; };

    // A contract that renews by itself: keep it, or cancel while it still can be.
    H.decisions(contracts, today, 30).filter((d) => d.contract.keptFor !== d.by).forEach((d) => {
      const c = d.contract, name = c.name || c.provider || 'A contract';
      add(100 - d.left, { c: 'tomato', e: d.kind === 'term' ? '🔁' : '✂️', t: d.kind === 'term' ? `${name}: the fixed term ends. Stay or switch?` : `${name} renews by itself. Keep it?`,
        s: `${BW.money(H.monthly(c))} ${BW.t('a month')} · ${BW.t(d.kind === 'term' ? 'the term ends on' : 'the last day to cancel is')} ${long(d.by)}`,
        b: 'Cancel it', href: `apps/letters/index.html#new/cancel/${c.id}`, more: ['Keep', null] },
      { more: async () => { await BW.store.put('contracts', Object.assign({}, c, { keptFor: d.by })); BW.toast(`${esc(name)}: kept. Busy asks again before the next renewal.`, '👍'); } });
    });
    upkeep.forEach((j) => {
      const due = H.nextDue(j, today), left = H.days(today, due);
      if (left > 7) return;
      add(left < 0 ? 85 : 60 - left, { c: 'sun', e: '🛠️', t: j.task || 'Upkeep', s: `${H.area(j.area).replace(/^\S+\s/, '')} · ${left < 0 ? BW.t('was due') : BW.t('due')} ${H.when(left)}`, b: 'Done', more: ['Open', `apps/upkeep/index.html#open/${j.id}`] },
        { main: async () => { await BW.store.put('upkeep', H.markDone(j, today)); BW.toast(`${esc(j.task || 'Upkeep')}: done.`, '✅'); } });
    });
    H.expiring(papers, today).filter((e) => e.left <= 60).forEach((e) => add(e.left < 0 ? 95 : 70 - e.left / 2, { c: 'sky', e: H.kind(e.paper.kind)[1],
      t: e.left < 0 ? `${e.paper.title || 'A document'} has run out` : `${e.paper.title || 'A document'} runs out ${H.when(e.left)}`,
      s: e.paper.kind === 'id' ? 'A new one takes a few weeks: book the appointment now' : 'Renew it, or mark it as replaced', b: 'Open it', href: `apps/papers/index.html#open/${e.paper.id}` }));
    H.warrantyEnding(inventory, today, 30).forEach((x) => add(40, { c: 'grape', e: '🧾', t: `The warranty on ${x.name || 'something you own'} ends ${H.when(H.days(today, x.warrantyUntil))}`, s: 'If something is wrong with it, say so now', b: 'Open it', href: `apps/inventory/index.html#open/${x.id}` }));
    const move = moves.filter((m) => !m.finished && m.date && m.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    if (move) add(45, { c: 'teal', e: '🚚', t: `${H.days(today, move.date)} days to moving day`, s: 'The list of what to do, and who to tell', b: 'Open the plan', href: 'apps/moving/index.html' });
    // A household that has only just started.
    if (!(papers.length + contracts.length + upkeep.length + inventory.length)) {
      add(30, { c: 'sky', e: '🪪', t: 'Add a passport or an ID card', s: 'Busy tells you four months before it runs out', b: 'Add it', href: 'apps/papers/index.html#new/id' });
      add(29, { c: 'tomato', e: '🔁', t: 'Add a contract', s: 'Insurance, energy, the gym: see the last day to cancel', b: 'Add it', href: 'apps/contracts/index.html#new' });
      add(28, { c: 'sun', e: '🛠️', t: 'Pick your upkeep jobs', s: 'From a ready-made list: the boiler, the smoke alarms, the gutters', b: 'Pick them', href: 'apps/upkeep/index.html#starter' });
    }
    needs.sort((a, b) => b.w - a.w);
    const cards = await ui.yes();
    const top = needs.slice(0, Math.max(0, 3 - Math.min(cards.n, 3)));
    BW.partCount('today', top.length + cards.n);
    const shown = new Set(top.map((n) => n.t));
    const coming = H.upcoming({ papers, contracts, upkeep, inventory, moves }, today, 90).filter((x) => x.left >= 0 && !top.some((n) => n.t.includes(x.text.replace(/^(Last day to cancel|Fixed term ends:?) /, '').replace(/ (expires|expired)$/, '')))).slice(0, 5);
    const live = contracts.filter((c) => H.contractState(c, today) !== 'ended');

    const START = [['🪪', 'A document', 'apps/papers/index.html#new'], ['🔁', 'A contract', 'apps/contracts/index.html#new'], ['✉️', 'A letter', 'apps/letters/index.html'], ['🛋️', 'Something you own', 'apps/inventory/index.html#new']];
    main.innerHTML = `<div class="today">
      <div>
        ${ui.hello(s.ownerName)}
        <h1 class="big">${BW.t(HEAD[Math.min(top.length + cards.n, 3)])}</h1>
        ${cards.html}
        ${top.map((n, i) => ui.need(n, i)).join('')}
        ${!top.length && !cards.n ? `<div class="card all-clear">${ui.guide('happy')}<div><b>${BW.t('All quiet at home.')}</b><br><span class="muted">${BW.t('Busy keeps watching the dates. Go and do something nice.')}</span></div></div>` : ''}
        ${ui.k(BW.t('Add something')).replace('class="k"', 'class="k gap"')}
        <div class="start-row">${START.map(([e, l, h]) => `<a class="btn" href="${h}">${e} ${BW.t(l)}</a>`).join('')}</div>
      </div>
      <aside class="side-col">
        ${H.trayHtml()}
        ${coming.length ? `<a class="card" href="home-dates.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('Coming up'))}${coming.map((x) => ui.line(`${x.emoji} ${esc(BW.t(x.text))}`, BW.fmtDate(x.date, { day: 'numeric', month: 'short' }))).join('')}</a>` : ''}
        ${live.length ? `<a class="card" href="apps/contracts/index.html" style="text-decoration:none;color:inherit">${ui.k(BW.t('What you pay for'))}${ui.line(`${live.length} ${BW.t(live.length === 1 ? 'contract' : 'contracts')}`, `${BW.money(H.totalMonthly(live, today))} ${BW.t('a month')}`)}</a>` : ''}
      </aside></div>`;
    ui.bindYes(main, render);
    H.bindTray(main, render);
    $$('[data-need]', main).forEach((b) => b.onclick = async () => { const a = acts[top[Number(b.dataset.need)].act]; if (a.main) { await a.main(); render(); } });
    $$('[data-more]', main).forEach((b) => b.onclick = async () => { const a = acts[top[Number(b.dataset.more)].act]; if (a.more) { await a.more(); render(); } });
    void shown;
  }
})();
