/* Skills Map: what you can do, how well (1 to 5), where you want to be, and the proof: what you saved,
   learned and achieved that names the skill. The biggest gaps come first, with a way to close them. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let skills = [], library = [], learning = [], wins = [];

  BW.boot({
    app: 'skills',
    onReady: async () => {
      await load(); render();
      BW.route({
        'new': () => edit({ level: 2, target: 3 }),
        open: (id) => { const x = skills.find((s) => s.id === id); if (x) edit(x); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap')) render(); },
  });
  BW.shortcut('n', 'Add a skill', () => edit({ level: 2, target: 3 }));
  async function load() { [skills, library, learning, wins] = await Promise.all(['skills', 'library', 'learning', 'wins'].map((n) => BW.store.all(n))); }

  const STARTERS = ['Communication', 'Writing', 'Presenting', 'Project management', 'Excel', 'Data analysis', 'SQL', 'Customer service', 'Leadership', 'Negotiation', 'Design', 'Marketing', 'Sales', 'Using AI tools'];
  const levelName = (n) => G.LEVELS[BW.num(n) - 1] || 'Not set';
  const proof = (s) => G.evidence(s.id, { library, learning, wins });

  function render() {
    const gaps = G.gaps(skills).slice(0, 5);
    const cats = {};
    skills.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).forEach((s) => { (cats[s.category || 'Skills'] = cats[s.category || 'Skills'] || []).push(s); });
    const strong = skills.filter((s) => BW.num(s.level) >= 4).length;
    const unproven = skills.filter((s) => !G.evidenceCount(proof(s))).length;
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🧠</span> Skills Map</h1><p class="lead">What you can do, how well, and the proof. Set where you want to be; we’ll show the gaps.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a skill</button>
      </div>
      ${skills.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--pink)"><div class="k">🧠 Skills</div><div class="v">${skills.length}</div><div class="s">${strong} at Strong or Expert</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🎯 Growing</div><div class="v">${G.gaps(skills).length}</div><div class="s">Skills below where you want them</div></div>
        <div class="card stat" style="--tint:var(--sky)"><div class="k">📎 Need proof</div><div class="v">${unproven}</div><div class="s">${unproven ? 'Link a win, a course or something you saved' : 'Every skill has proof'}</div></div>
      </div>
      ${gaps.length ? `<div class="section-h"><h2>🎯 Biggest gaps</h2><small class="faint">Where a little learning goes furthest</small></div>
        <div class="gaps">${gaps.map((s) => `<div class="card gap-row"><b>🧠 ${esc(s.name)}</b><span class="lvl">${levelName(s.level)} → ${levelName(s.target)}</span><span class="spacer"></span>
          <a class="btn" href="../learning/index.html#new/${encodeURIComponent(s.id)}">🎓 Plan learning</a><a class="btn" href="../library/index.html#new/link">🔗 Save a resource</a></div>`).join('')}</div>` : ''}
      ${Object.entries(cats).map(([cat, list]) => `<div class="section-h"><h2>${esc(cat)}</h2></div><div class="skill-grid rise">${list.map(card).join('')}</div>`).join('')}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🧠</div><h2>Map what you can do</h2>
          <p>Add the skills you use and the ones you want. Rate each one from 1 (aware) to 5 (expert), and set where you’d like to be. Tap a few to start:</p>
          <div class="filters" data-starters style="justify-content:center;margin:14px 0 18px">${STARTERS.map((n) => `<button type="button" data-v="${esc(n)}">＋ ${esc(n)}</button>`).join('')}</div>
          <button class="btn btn-primary btn-big" data-new>＋ Add my own</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ level: 2, target: 3 }));
    const st = $('[data-starters]', main);
    if (st) st.onclick = async (e) => {
      const b = e.target.closest('[data-v]'); if (!b) return;
      try { await BW.store.put('skills', { name: b.dataset.v, level: 2, target: 3, category: '' }); } catch (err) { return BW.error(err); }
      b.disabled = true; b.textContent = '✓ ' + b.dataset.v;
      await load();
      if (skills.length >= 3) render();
    };
    $$('.skill-card[data-id]', main).forEach((c) => {
      c.onclick = (e) => { if (!e.target.closest('.dots5')) edit(skills.find((s) => s.id === c.dataset.id)); };
      c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(e); };
    });
    $$('.dots5 [data-lv]', main).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const s = skills.find((x) => x.id === b.closest('[data-id]').dataset.id), lv = Number(b.dataset.lv);
      const up = lv > BW.num(s.level);
      s.level = lv;
      try { await BW.store.put('skills', s); } catch (err) { return BW.error(err); }
      if (up && BW.num(s.target) && lv >= BW.num(s.target)) { BW.confetti(); BW.toast(`${esc(s.name)}: target reached!`, '🎉'); }
      await load(); render();
    });
  }

  function card(s) {
    const ev = proof(s), n = G.evidenceCount(ev);
    const dots = [1, 2, 3, 4, 5].map((i) => `<button type="button" data-lv="${i}" class="${i <= BW.num(s.level) ? 'on' : ''} ${i === BW.num(s.target) ? 'goal' : ''}" aria-label="Set ${esc(s.name)} to ${G.LEVELS[i - 1]}" title="${G.LEVELS[i - 1]}"></button>`).join('');
    return `<div class="card skill-card" data-id="${s.id}" tabindex="0">
      <b>${esc(s.name)}</b>
      <div class="dots5">${dots}</div>
      <span class="lvl">${levelName(s.level)}${BW.num(s.target) > BW.num(s.level) ? ` · aiming for ${levelName(s.target)}` : BW.num(s.target) ? ' · on target ✓' : ''}</span>
      <small class="faint">${n ? `📎 ${[ev.wins.length && `${ev.wins.length} win${ev.wins.length === 1 ? '' : 's'}`, ev.learning.length && `${ev.learning.length} learned`, ev.library.length && `${ev.library.length} saved`].filter(Boolean).join(' · ')}` : 'No proof linked yet'}</small>
    </div>`;
  }

  function edit(x) {
    const levels = G.LEVELS.map((l, i) => [i + 1, `${i + 1} · ${l}`]);
    BW.recordDrawer({
      collection: 'skills', rec: x, title: 'Skill', newTitle: 'Add a skill',
      fields: [
        { k: 'name', label: 'Skill', ph: 'e.g. Data analysis', span: 2, required: true },
        { k: 'category', label: 'Group', ph: 'e.g. Tools, People, Craft (optional)', span: 2 },
        { k: 'level', label: 'Where you are now', type: 'chips', options: levels },
        { k: 'target', label: 'Where you want to be', type: 'chips', options: levels },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'What “good” looks like, who to learn from…', span: 2 },
      ],
      bottom: (r) => {
        if (!r.id) return '';
        const ev = proof(r);
        const list = (title, emo, arr, app, label) => (arr.length ? `<h3 class="section-title" style="margin-top:18px"><span>${emo}</span>${title}</h3>
          <div class="list">${arr.map((y) => `<a class="row" href="../${app}/index.html#open/${y.id}"><span class="main">${esc(label(y))}</span></a>`).join('')}</div>` : '');
        return `<div style="margin-top:10px">${list('Wins that prove it', '🏆', ev.wins, 'wins', (y) => y.title) + list('What you learned', '🎓', ev.learning, 'learning', (y) => y.title)
          + list('What you saved', '📚', ev.library, 'library', (y) => y.title || y.url || y.fileName)}
          ${G.evidenceCount(ev) ? '' : '<p class="faint">No proof linked yet. Link this skill from a win, something you learned or something you saved.</p>'}
          <div class="row-flex" style="margin-top:14px"><a class="btn" href="../learning/index.html#new/${encodeURIComponent(r.id)}">🎓 Plan learning for this</a><a class="btn" href="../wins/index.html#new">🏆 Log a win</a></div></div>`;
      },
      onClose: async () => { await load(); render(); },
    });
  }
})();
