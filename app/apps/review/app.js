/* Weekly Review: ten minutes on Friday. The numbers come from your other tools; you add what went
   well, what was hard and what you'll do next week. Next week's review starts by ticking those off. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let reviews = [], data = {}, skills = [];
  const ENERGY = [['1', '😩'], ['2', '😕'], ['3', '😐'], ['4', '🙂'], ['5', '🤩']];

  BW.boot({
    app: 'review',
    onReady: async () => {
      await load(); render();
      BW.route({
        'new': () => open(G.weekStart(BW.today())),
        open: (week) => open(week),
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Review this week', () => open(G.weekStart(BW.today())));
  async function load() {
    const [rv, learning, wins, applications, library, sk] = await Promise.all(['reviews', 'learning', 'wins', 'applications', 'library', 'skills'].map((n) => BW.store.all(n)));
    reviews = rv.sort((a, b) => String(b.week).localeCompare(String(a.week)));
    data = { learning, wins, applications, library }; skills = sk;
  }
  const weekName = (w) => `Week of ${BW.fmtDate(w, { day: 'numeric', month: 'long' })}`;
  const numbers = (s) => [
    ['🎓', `${G.hours(s.minutes)} learning`], ['✅', `${s.finished} finished`], ['🏆', `${s.wins} win${s.wins === 1 ? '' : 's'}`],
    ['📨', `${s.applied} applied`], ['📖', `${s.read} read`],
  ];

  function render() {
    const today = BW.today(), week = G.weekStart(today), mine = reviews.find((r) => r.week === week);
    const streak = G.reviewStreak(reviews, today), s = G.weekSummary(data, week);
    const energies = reviews.slice(0, 8).map((r) => BW.num(r.energy)).filter(Boolean);
    const plan = planFor(week);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🪞</span> Weekly Review</h1><p class="lead">Ten minutes at the end of the week: what moved, what was hard, what’s next.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-week>${mine ? '✏️ Open this week’s review' : '🪞 Review this week'}</button>
      </div>
      <div class="card rise" style="padding:18px 20px;margin-bottom:22px">
        <div class="row-flex" style="justify-content:space-between"><b>${weekName(week)}${mine ? ' · ✅ reviewed' : ''}</b><small class="faint">${G.reviewDue(reviews, today) ? '⏰ Your review is due' : mine ? 'Done. See you next week.' : 'Best done on Friday'}</small></div>
        <div class="meta" style="margin-top:10px">${numbers(s).map(([e, l]) => `<span class="chip chip-grey">${e} ${l}</span>`).join('')}</div>
        ${plan.length ? `<p style="margin-top:14px"><b>Your plan for this week</b></p><ul class="plain-list">${plan.map((p) => `<li>${p.done ? '✅' : '⬜'} ${esc(p.text)}</li>`).join('')}</ul>` : ''}
      </div>
      ${reviews.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🔥 Weeks in a row</div><div class="v">${streak}</div><div class="s">${streak > 1 ? 'Keep it going' : 'A habit starts here'}</div></div>
        <div class="card stat" style="--tint:var(--grape)"><div class="k">🪞 Reviews</div><div class="v">${reviews.length}</div><div class="s">Since ${BW.fmtDate(reviews[reviews.length - 1].week)}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">⚡ Energy lately</div><div class="v">${energies.length ? ENERGY[Math.round(energies.reduce((a, b) => a + b, 0) / energies.length) - 1][1] : '–'}</div><div class="s">Average of your last ${energies.length} review${energies.length === 1 ? '' : 's'}</div></div>
      </div>
      <div class="section-h"><h2>🗓️ Past weeks</h2></div>
      <div class="win-list">${reviews.map(card).join('')}</div>
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🪞</div><h2>Your first weekly review</h2>
          <p>Once a week, look back before you look ahead. Busy fills in the numbers from your other tools. You add three lines: what went well, what was hard, and what you’ll do next week.</p>
          <button class="btn btn-primary btn-big" data-week>🪞 Review this week</button></div>`}`;
    $$('[data-week]', main).forEach((b) => b.onclick = () => open(week));
    $$('.win-card[data-id]', main).forEach((c) => { c.onclick = () => open(c.dataset.id); c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); }; });
  }

  function card(r) {
    const e = ENERGY[BW.num(r.energy) - 1];
    return `<div class="card win-card" data-id="${esc(r.week)}" tabindex="0">
      <small class="faint">${weekName(r.week)}${e ? ` · ${e[1]}` : ''}</small>
      ${r.went ? `<b>${esc(G.lines(r.went)[0] || '')}</b>` : '<b>A week</b>'}
      ${r.hard ? `<span class="snip">😤 ${esc(G.lines(r.hard)[0] || '')}</span>` : ''}
      ${r.next ? `<span class="snip">➡️ ${G.lines(r.next).slice(0, 3).map(esc).join(' · ')}</span>` : ''}
    </div>`;
  }

  // Last week's "next week, I will…" lines, with what you ticked off.
  function planFor(week) {
    const prev = reviews.find((r) => r.week === BW.addDays(week, -7));
    if (!prev) return [];
    const done = Array.isArray(prev.nextDone) ? prev.nextDone : [];
    return G.lines(prev.next).map((text, i) => ({ text, done: done.includes(i), i, prev }));
  }

  function open(week) {
    // The numbers are kept with the review, as they were that week.
    const s = G.weekSummary(data, week);
    const rec = Object.assign({ week }, reviews.find((r) => r.week === week), { minutes: s.minutes, finished: s.finished, wins: s.wins, applied: s.applied, read: s.read });
    BW.recordDrawer({
      collection: 'reviews', rec, title: weekName(week), newTitle: weekName(week),
      isComplete: (r) => ['went', 'hard', 'next', 'energy'].some((k) => String(r[k] || '').trim()),
      top: () => { const plan = planFor(week); return `<div class="meta" style="margin-bottom:14px">${numbers(s).map(([e, l]) => `<span class="chip chip-grey">${e} ${l}</span>`).join('')}</div>
        ${plan.length ? `<h3 class="section-title"><span>➡️</span>Last week you planned</h3>
          <div class="list" data-plan style="margin-bottom:16px">${plan.map((p) => `<label class="row" style="cursor:pointer"><input type="checkbox" data-i="${p.i}" ${p.done ? 'checked' : ''}><span class="main">${esc(p.text)}</span></label>`).join('')}</div>` : ''}`; },
      fields: [
        { k: 'went', label: '🌞 What went well?', type: 'textarea', ph: 'Small things count: a good conversation, a chapter finished, a bug fixed', span: 2 },
        { k: 'hard', label: '😤 What was hard, or got in the way?', type: 'textarea', ph: 'And what would make it easier next time?', span: 2 },
        { k: 'energy', label: 'How’s your energy?', type: 'chips', options: ENERGY },
        { k: 'focusSkillId', label: 'Skill to focus on next week', type: 'select', options: [['', 'None in particular']].concat(skills.map((k) => [k.id, k.name])) },
        { k: 'next', label: '➡️ Next week, I will…', type: 'textarea', ph: 'One per line, two or three is plenty\ne.g. Finish chapter 4\nAsk Anna for a referral', span: 2, hint: 'They show on your Growth home, and you tick them off in next week’s review.' },
      ],
      bottom: () => `<p class="faint" style="margin-top:14px">Something worth keeping? <a href="../wins/index.html#new">🏆 Log it as a win</a> while you remember the numbers.</p>`,
      bind: (box) => {
        const p = $('[data-plan]', box);
        if (p) p.onchange = async (e) => {
          const i = Number(e.target.dataset.i), prev = planFor(week)[0].prev, done = new Set(Array.isArray(prev.nextDone) ? prev.nextDone : []);
          if (e.target.checked) done.add(i); else done.delete(i);
          prev.nextDone = [...done].sort((a, b) => a - b);
          try { await BW.store.put('reviews', prev); } catch (err) { BW.error(err); }
        };
      },
      onSaved: (r, isNew) => { if (isNew) BW.toast('Reviewed. Nice habit.', '🪞'); },
      onClose: async () => { await load(); render(); },
    });
  }
})();
