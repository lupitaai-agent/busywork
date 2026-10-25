/* The home screen: every tool, grouped, with what needs attention today. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');

  BW.boot({ onReady: render, onChange: render });

  const GROUPS = [
    ['💶 Get paid', ['invoices', 'time', 'clients']],
    ['🧮 Keep track', ['expenses', 'money', 'subscriptions', 'trips']],
    ['🗂️ Get organised', ['board', 'docs', 'stock', 'brand']],
    ['📣 Grow', ['marketing', 'olaf']],
  ];

  async function render() {
    const s = BW.settings;
    const [invoices, time, stock, subs, tasks, clients, expenses, docs] = await Promise.all(['invoices', 'time', 'stock', 'subscriptions', 'tasks', 'clients', 'expenses', 'documents'].map((n) => BW.store.all(n)));
    const h = new Date().getHours();
    const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = (s.ownerName || '').split(' ')[0];
    const today = BW.today();
    const out = invoices.filter((i) => i.kind === 'invoice' && i.status === 'sent' && BW.balanceOf(i) > 0);
    const late = out.filter((i) => i.dueDate < today);
    const sum = (a) => a.reduce((t, i) => t + BW.balanceOf(i), 0);
    const running = time.find((e) => e.start && !e.end);
    const low = stock.filter((i) => BW.num(i.qty) <= BW.num(i.min));
    const renewing = subs.filter((x) => x.status !== 'cancelled' && x.nextDate && x.nextDate >= today && x.nextDate <= BW.addDays(today, 7));
    const todo = tasks.filter((t) => t.status !== 'done');
    const dueSoon = todo.filter((t) => t.due && t.due <= BW.addDays(today, 2));
    const glance = [
      out.length && ['sun', '⏳', 'Waiting to come in', BW.money(sum(out)), `${out.length} open invoice${out.length === 1 ? '' : 's'}${late.length ? `, ${late.length} overdue` : ''}`, 'invoices'],
      running && ['mint', '⏱️', 'Timer running', 'Since ' + new Date(running.start).toLocaleTimeString(BW.locale(), { hour: '2-digit', minute: '2-digit' }), running.desc || 'Working on something great', 'time'],
      dueSoon.length && ['teal', '🗂️', 'Due in the next 2 days', String(dueSoon.length), dueSoon.slice(0, 2).map((t) => t.title).join(', '), 'board'],
      low.length && ['tomato', '🚨', 'Running low', String(low.length), low.slice(0, 3).map((i) => i.name).join(', '), 'stock'],
      renewing.length && ['grape', '🔁', 'Renewing this week', BW.money(renewing.reduce((a, x) => a + BW.num(x.amount), 0)), renewing.map((x) => x.name).join(', '), 'subscriptions'],
    ].filter(Boolean);
    const byId = Object.fromEntries(BW.apps.map((a) => [a.id, a]));
    // Getting started: ticks itself off as people use the tools (the Stripe / Notion onboarding pattern).
    const steps = [
      [!!s.iban, '🏦', 'Add your bank details', 'So invoices tell clients where to pay', () => BW.openSettings()],
      [clients.length > 0, '📇', 'Add your first client', 'Or import the list you already have', 'apps/clients/index.html#new'],
      [invoices.some((i) => i.status !== 'draft'), '🧾', 'Send your first invoice', 'It takes about a minute', 'apps/invoices/index.html#new/invoice'],
      [time.length > 0, '⏱️', 'Track some time', 'One button. Start, stop, done.', 'apps/time/index.html'],
      [expenses.length > 0, '📸', 'Snap a receipt', 'Drop a photo or PDF, we file it', 'apps/expenses/index.html#new'],
      [BW.store.kind === 'folder', '📁', 'Keep your work in a folder', 'Pick one inside Google Drive to sync it', null],
    ];
    const doneN = steps.filter((x) => x[0]).length;
    let hidden = false; try { hidden = localStorage.getItem('bw.hideStart') === '1'; } catch (e) { /* private window */ }
    const hasExamples = clients.some((x) => x.example) || invoices.some((x) => x.example);
    const recent = [].concat(
      invoices.map((x) => [x.updatedAt, x.kind === 'quote' ? '💬' : '🧾', `${x.number} · ${x.client ? x.client.name : 'No client'}`, `apps/invoices/index.html#edit/${x.id}`]),
      clients.map((x) => [x.updatedAt, '📇', x.name, `apps/clients/index.html#open/${x.id}`]),
      tasks.map((x) => [x.updatedAt, '🗂️', x.title, `apps/board/index.html#open/${x.id}`]),
      expenses.map((x) => [x.updatedAt, '📸', x.vendor || 'Expense', `apps/expenses/index.html#open/${x.id}`]),
      docs.map((x) => [x.updatedAt, '📝', x.title || 'Document', `apps/docs/index.html#edit/${x.id}`]),
    ).filter((x) => x[0]).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
    const soon = BW.apps.filter((a) => !a.ready);
    const tile = (a) => a.ready
      ? `<a class="tile" style="--c:var(--${a.color})" href="apps/${a.id}/index.html" ${a.addon ? `data-addon="${a.id}"` : ''}>${a.addon ? '<span class="chip chip-sun sticker" data-addon-chip>Paid add-on</span>' : ''}<span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p><span class="go">Open <span>→</span></span></a>`
      : `<div class="tile soon" style="--c:var(--${a.color})"><span class="chip chip-grape sticker">Soon</span><span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p></div>`;

    main.innerHTML = `
      <section class="home-hero">
        <div><h1>${hello}${name ? ', ' + esc(name) : ''} <span class="hand">👋</span></h1>
          <p class="lead">${glance.length ? 'Here’s what needs you today.' : BW.brand.tagline + ' What are we ticking off today?'}</p></div>
      </section>
      ${glance.length ? `<section class="stats glance rise">${glance.map(([c, e, k, v, sub, app]) => `
        <a class="card stat" style="--tint:var(--${c})" href="apps/${app}/index.html"><div class="k">${e} ${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(sub)}</div></a>`).join('')}</section>` : ''}
      ${!hidden && doneN < steps.length ? `<section class="card start rise">
        <div class="start-head"><div><h2>🚀 Getting started</h2><small>${doneN} of ${steps.length} done</small></div><div class="bar"><i style="width:${doneN / steps.length * 100}%"></i></div><button class="link" data-hide>Hide</button></div>
        <div class="start-steps">${steps.map(([ok, e, t, sub, go], i) => `<${typeof go === 'string' && !ok ? `a href="${go}"` : 'button type="button"'} class="step ${ok ? 'ok' : ''}" data-step="${i}"><span class="tick">${ok ? '✓' : e}</span><span><b>${t}</b><small>${sub}</small></span></${typeof go === 'string' && !ok ? 'a' : 'button'}>`).join('')}</div>
      </section>` : ''}
      <div class="home-row">
        <section class="card demo"><span class="emo">${hasExamples ? '🧹' : '👀'}</span><div><b>${hasExamples ? 'Example data is switched on' : 'Just looking around?'}</b><small>${hasExamples ? 'A pretend design studio fills every tool. Remove it before you start for real.' : 'Fill every tool with a pretend design studio. One click removes it again.'}</small></div>
          <button class="btn ${hasExamples ? '' : 'btn-primary'}" data-demo>${hasExamples ? 'Remove example data' : 'Show me with example data'}</button></section>
        ${recent.length ? `<section class="card recent"><b>🕒 Recently changed</b>${recent.map(([at, e, l, href]) => `<a href="${href}"><span>${e}</span><span class="t">${esc(l)}</span><small>${BW.fmtDate(at.slice(0, 10), { day: 'numeric', month: 'short' })}</small></a>`).join('')}</section>` : ''}
      </div>
      <p class="tip">💡 Press <kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd> anywhere to find a client, an invoice or a tool. Press <kbd>?</kbd> for every shortcut.</p>
      ${GROUPS.map(([title, ids]) => `<div class="section-h"><h2>${title}</h2></div><div class="tiles rise">${ids.map((id) => tile(byId[id])).join('')}</div>`).join('')}
      <div class="section-h"><h2>🛠️ On the workbench</h2><small class="faint">Coming to your folder soon</small></div>
      <div class="tiles rise">${soon.map(tile).join('')}</div>
      <div class="card home-foot"><span class="emo">🔒</span><div><b>Your business, your files.</b><br><small>Everything is saved in <b>${esc(BW.store.where)}</b>. No account, no server, nothing sent to us.</small></div></div>`;
    const hide = $('[data-hide]', main); if (hide) hide.onclick = () => { try { localStorage.setItem('bw.hideStart', '1'); } catch (e) { /* ignore */ } render(); };
    $$('button[data-step]', main).forEach((b) => b.onclick = () => { const go = steps[Number(b.dataset.step)][4]; if (typeof go === 'function') go(); else if (!steps[Number(b.dataset.step)][0]) BW.toast('Use the 📁 button at the top to pick a folder', '📁'); });
    // Olaf is only in the paid download: without it, the tile goes to the Olaf page.
    const ot = $('[data-addon="olaf"]', main);
    if (ot) BW.olafInstalled().then((ed) => {
      if (ed === 'full') { ot.querySelector('[data-addon-chip]').remove(); return; }
      if (ed === 'demo') { ot.querySelector('[data-addon-chip]').textContent = 'Demo'; return; }
      ot.href = BW.olafPage(); ot.target = '_blank'; ot.rel = 'noopener'; ot.querySelector('.go').innerHTML = 'See Olaf <span>→</span>';
    });
    $('[data-demo]', main).onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        if (!BW.examples) await BW.loadScript('shared/examples.js');
        if (hasExamples) { const n = await BW.examples.remove(); BW.toast(`Removed ${n} example records. Fresh start!`, '🧹'); }
        else { await BW.examples.load(); BW.confetti(); BW.toast('Meet the pretend clients. Have a look around!', '👀'); }
      } catch (err) { BW.error(err); }
      render();
    };
  }
})();
