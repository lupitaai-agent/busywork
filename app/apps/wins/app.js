/* Wins Log: achievements as they happen, with the result and the proof, linked to the skills they show.
   At review time or for the next CV, the brag document is one click away. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let wins = [], skills = [], learning = [], year = new Date().getFullYear(), skillFilter = '';

  BW.boot({
    app: 'wins',
    onReady: async () => {
      await load(); render();
      BW.route({
        // #new, or #new/learning:<id> after finishing something in the Learning Planner
        'new': (from) => {
          const l = from && from.startsWith('learning:') ? learning.find((x) => x.id === from.slice(9)) : null;
          edit(l ? { date: BW.today(), title: `Finished: ${l.title}`, what: l.provider ? `Completed ${l.title} (${l.provider}).` : '', skillIds: G.skillIds(l).slice(), proof: l.url || '' } : { date: BW.today() });
        },
        open: (id) => { const x = wins.find((w) => w.id === id); if (x) edit(x); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Log a win', () => edit({ date: BW.today() }));
  async function load() { [wins, skills, learning] = await Promise.all(['wins', 'skills', 'learning'].map((n) => BW.store.all(n))); }

  function render() {
    const mine = wins.filter((w) => String(w.date || '').startsWith(String(year)) && (!skillFilter || G.skillIds(w).includes(skillFilter)))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const months = {};
    for (const w of mine) (months[String(w.date).slice(0, 7)] = months[String(w.date).slice(0, 7)] || []).push(w);
    const shownSkills = new Set(wins.filter((w) => String(w.date || '').startsWith(String(year))).flatMap(G.skillIds));
    const thisMonth = wins.filter((w) => String(w.date || '').startsWith(BW.today().slice(0, 7))).length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🏆</span> Wins Log</h1><p class="lead">Write it down while you still remember the numbers. Future you, at review time, will thank you.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          ${wins.length ? `<button class="btn" data-brag title="Every win of ${year} as one document"><span class="emo">⬇️</span> Brag document</button>` : ''}
          <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Log a win</button>
        </div>
      </div>
      ${wins.length ? `
      <div class="year-nav row-flex" style="margin-bottom:16px"><button class="icon-btn" data-y="-1" aria-label="Previous year">◀</button><b>${year}</b><button class="icon-btn" data-y="1" aria-label="Next year">▶</button></div>
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🏆 Wins in ${year}</div><div class="v">${wins.filter((w) => String(w.date || '').startsWith(String(year))).length}</div><div class="s">${thisMonth} this month</div></div>
        <div class="card stat" style="--tint:var(--pink)"><div class="k">🧠 Skills shown</div><div class="v">${shownSkills.size}</div><div class="s">Different skills your wins prove</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">📏 With numbers</div><div class="v">${wins.filter((w) => /\d/.test(w.result || '')).length}</div><div class="s">Results with a number are the strongest</div></div>
      </div>
      ${shownSkills.size ? `<div class="filters" data-skill style="margin-bottom:18px"><button type="button" data-v="" aria-pressed="${!skillFilter}">All skills</button>${[...shownSkills].map((id) => skills.find((s) => s.id === id)).filter(Boolean).map((s) => `<button type="button" data-v="${s.id}" aria-pressed="${skillFilter === s.id}">🧠 ${esc(s.name)}</button>`).join('')}</div>` : ''}
      ${mine.length ? Object.keys(months).map((m) => `<div class="month-h"><span>${BW.fmtDate(m + '-01', { month: 'long', year: 'numeric' })}</span><small class="faint">${months[m].length} win${months[m].length === 1 ? '' : 's'}</small></div>
        <div class="win-list">${months[m].map(card).join('')}</div>`).join('') : `<div class="card empty"><div class="big">🗓️</div><h2>No wins in ${year}${skillFilter ? ' for this skill' : ''}</h2><p>Pick another year or skill.</p></div>`}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🏆</div><h2>Your first win goes here</h2>
          <p>Fixed something, shipped something, got a thank-you, learned something hard? Write it down with the result. It’s the raw material for your CV, your next review and your interview stories.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Log my first win</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ date: BW.today() }));
    $$('[data-y]', main).forEach((b) => b.onclick = () => { year += Number(b.dataset.y); render(); });
    const f = $('[data-skill]', main); if (f) f.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { skillFilter = b.dataset.v; render(); } };
    $$('.win-card[data-id]', main).forEach((c) => { c.onclick = () => edit(wins.find((w) => w.id === c.dataset.id)); c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); }; });
    const brag = $('[data-brag]', main);
    if (brag) brag.onclick = () => {
      const md = G.bragDoc(wins, skills, year, BW.settings.ownerName);
      BW.download(new Blob([md], { type: 'text/markdown' }), `wins-${year}.md`);
      BW.toast('Your brag document is downloading. Bring it to your next review.', '⬇️');
    };
  }

  function card(w) {
    return `<div class="card win-card" data-id="${w.id}" tabindex="0">
      <small class="faint">${BW.fmtDate(w.date)}</small>
      <b>${esc(w.title || 'A win')}</b>
      ${w.result ? `<span class="result">📈 ${esc(w.result)}</span>` : ''}
      ${w.what ? `<span class="snip">${esc(String(w.what).slice(0, 180))}</span>` : ''}
      <span class="meta">${G.skillChips(G.skillIds(w), skills)}${G.tags(w.tags).map((t) => `<span class="chip chip-grey mini"># ${esc(t)}</span>`).join('')}</span>
    </div>`;
  }

  function edit(x) {
    BW.recordDrawer({
      collection: 'wins', rec: x, title: 'Win', newTitle: 'Log a win',
      fields: [
        { k: 'title', label: 'The win, in one line', ph: 'e.g. Cut the weekly report from 3 hours to 20 minutes', span: 2, required: true },
        { k: 'date', label: 'When', type: 'date' },
        { k: 'tags', label: 'Tags', ph: 'e.g. reporting, team (optional)' },
        { k: 'what', label: 'What happened, and what you did', type: 'textarea', ph: 'The situation, your part in it, how you did it', span: 2 },
        { k: 'result', label: 'The result', ph: 'With a number if you have one: hours saved, sales, ratings, people helped', span: 2 },
        { k: 'proof', label: 'Proof', ph: 'A link, an email to find, a document in your library', span: 2 },
      ],
      bottom: (r) => G.skillPickerHtml(skills, G.skillIds(r)) + (r.id ? `<p style="margin-top:14px"><a class="btn" href="../stories/index.html#new/win:${r.id}">🎤 Make it an interview story</a></p>` : ''),
      bind: (box, r, save) => G.bindSkillPicker(box, r, save, skills),
      onSaved: (r, isNew) => { if (isNew) BW.toast('Nice one. Logged!', '🏆'); },
      onClose: async () => { await load(); render(); },
    });
  }
})();
