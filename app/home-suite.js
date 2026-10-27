/* The Busy Home home screen: what's coming up (last days to cancel, documents expiring, upkeep due,
   warranties ending, the move), getting started, and every household tool. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');

  BW.boot({ onReady: render, onChange: render });

  const GROUPS = [
    ['🗂️ Keep it', ['papers', 'inventory']],
    ['🔁 Stay on top', ['contracts', 'upkeep']],
    ['✉️ Sort it', ['letters', 'moving']],
    ['📕 Just in case', ['binder']],
  ];

  async function render() {
    const s = BW.settings;
    const [papers, contracts, upkeep, inventory, moves, binder] = await Promise.all(['papers', 'contracts', 'upkeep', 'inventory', 'moves', 'binder'].map((n) => BW.store.all(n)));
    const today = BW.today();
    const h = new Date().getHours();
    const hello = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    const name = (s.ownerName || '').split(' ')[0];
    const coming = H.upcoming({ papers, contracts, upkeep, inventory, moves }, today, 60);
    const decide = H.decisions(contracts, today, 60), expiring = H.expiring(papers, today);
    const due = upkeep.filter((j) => H.jobState(j, today) !== 'ok');
    const live = contracts.filter((c) => H.contractState(c, today) !== 'ended');
    const move = moves.filter((m) => !m.finished && m.date && m.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
    const glance = [
      move && ['teal', '🚚', 'Moving day', String(H.days(today, move.date)), `days to go${move.to ? ', to ' + move.to : ''}`, 'moving'],
      ['tomato', '✂️', 'Decide soon', String(decide.length), decide[0] ? `${decide[0].contract.name || decide[0].contract.provider}: cancel ${decide[0].left === 0 ? 'today' : 'by ' + BW.fmtDate(decide[0].by, { day: 'numeric', month: 'short' })}` : 'No last days to cancel in the next two months', 'contracts'],
      ['sky', '🗂️', 'Expiring', String(expiring.length), expiring[0] ? `${expiring[0].paper.title}: ${H.when(expiring[0].left)}` : 'Every document is up to date', 'papers'],
      ['sun', '🛠️', 'Upkeep due', String(due.length), due[0] ? due.map((j) => j.task).slice(0, 2).join(', ') : upkeep.length ? 'All on schedule' : 'Pick jobs from a ready-made list', 'upkeep'],
      ['grape', '💶', 'Contracts a month', BW.money(H.totalMonthly(live, today)), `${live.length} contract${live.length === 1 ? '' : 's'}`, 'contracts'],
    ].filter(Boolean);
    const byId = Object.fromEntries(BW.apps.map((a) => [a.id, a]));
    const steps = [
      [papers.some((p) => p.kind === 'id'), '🪪', 'Add a passport or ID card', 'Busy warns you four months before it expires', 'apps/papers/index.html#new/id'],
      [contracts.length > 0, '🔁', 'Add a contract', 'Insurance, energy, the gym: see the last day to cancel', 'apps/contracts/index.html#new'],
      [upkeep.length > 0, '🛠️', 'Pick your upkeep jobs', 'From a ready-made list', 'apps/upkeep/index.html#starter'],
      [inventory.length > 0, '🛋️', 'Add something you own', 'With a photo and the receipt', 'apps/inventory/index.html#new'],
      [binder.length > 0, '📕', 'Start your Just in Case binder', 'Begin with the people to call', 'apps/binder/index.html#new/people'],
      [BW.store.kind === 'folder', '📁', 'Keep it in a folder', 'Scans and photos are saved as files there', null],
    ];
    const doneN = steps.filter((x) => x[0]).length;
    let hidden = false;
    try { hidden = localStorage.getItem('bw.hideStart:house') === '1'; } catch (e) { /* private window */ }
    const tile = (a) => a.ready
      ? `<a class="tile" style="--c:var(--${a.color})" href="apps/${a.id}/index.html"><span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p><span class="go">Open <span>→</span></span></a>`
      : `<div class="tile soon" style="--c:var(--${a.color})"><span class="chip chip-grape sticker">Soon</span><span class="icon">${a.emoji}</span><b>${a.name}</b><p>${a.tagline}</p></div>`;

    main.innerHTML = `
      <section class="home-hero">
        <div><h1>${hello}${name ? ', ' + esc(name) : ''} <span class="hand">🏡</span></h1>
          <p class="lead">${coming.length ? `${coming.length} thing${coming.length === 1 ? '' : 's'} coming up at home. Here’s what and when.` : 'Your household paperwork, under control.'}</p></div>
      </section>
      <section class="stats glance rise">${glance.map(([c, e, k, v, sub, app]) => `
        <a class="card stat" style="--tint:var(--${c})" href="apps/${app}/index.html"><div class="k">${e} ${k}</div><div class="v ${/^[\d€$£.,\s-]/.test(v) ? '' : 'word'}">${esc(v)}</div><div class="s">${esc(sub)}</div></a>`).join('')}</section>
      ${coming.length ? `<section class="card attention rise" style="margin-top:6px"><h2>📅 Coming up</h2>${coming.slice(0, 8).map((x) => `
        <a href="apps/${x.app}/index.html#open/${x.id}"><span class="e">${x.emoji}</span><span class="main"><b>${esc(x.text)}</b><small>${BW.fmtDate(x.date, { weekday: 'short', day: 'numeric', month: 'long' })}, ${H.when(x.left)}</small></span></a>`).join('')}</section>` : ''}
      ${!hidden && doneN < steps.length ? `<section class="card start rise">
        <div class="start-head"><div><h2>🚀 Getting started</h2><small>${doneN} of ${steps.length} done</small></div><div class="bar"><i style="width:${doneN / steps.length * 100}%"></i></div><button class="link" data-hide>Hide</button></div>
        <div class="start-steps">${steps.map(([ok, e, t, sub, go], i) => `<${go && !ok ? `a href="${go}"` : 'button type="button"'} class="step ${ok ? 'ok' : ''}" data-step="${i}"><span class="tick">${ok ? '✓' : e}</span><span><b>${t}</b><small>${sub}</small></span></${go && !ok ? 'a' : 'button'}>`).join('')}</div>
      </section>` : ''}
      ${GROUPS.map(([title, ids]) => `<div class="section-h"><h2>${title}</h2></div><div class="tiles rise">${ids.map((id) => tile(byId[id])).join('')}</div>`).join('')}
      <div class="section-h"><h2>🏡 ${byId.juno.ready ? 'Your expert' : 'Coming to Busy Home'}</h2><small class="faint">${byId.juno.ready ? 'On your own Claude key' : 'Free tools stay free; the AI comes with Juno'}</small></div>
      <div class="tiles rise">${tile(byId.juno)}
        <a class="tile" style="--c:var(--sky)" href="${BW.siteUrl}/games/index.html" target="_blank" rel="noopener"><span class="icon">🧩</span><b>Today’s brain break</b><p>Four free logic puzzles on busy.com.ai, a new one every day.</p><span class="go">Play <span>→</span></span></a></div>
      <p class="tip">💡 Press <kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd> anywhere to find a document, a contract or something you own.</p>
      <div class="card home-foot"><span class="emo">🔒</span><div><b>Your home, your files.</b><br><small>Everything is saved in <b>${esc(BW.store.where)}</b>. Passports, policies and plans never leave it. No account, no server, nothing sent to us.</small></div></div>`;
    const hide = $('[data-hide]', main);
    if (hide) hide.onclick = () => { try { localStorage.setItem('bw.hideStart:house', '1'); } catch (e) { /* ignore */ } render(); };
    $$('button[data-step]', main).forEach((b) => b.onclick = () => { if (!steps[Number(b.dataset.step)][0]) BW.toast('Use the 📁 button at the top to pick a folder', '📁'); });
  }
})();
