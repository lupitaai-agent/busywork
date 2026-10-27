/* Interview Stories: your best stories in the STAR shape (situation, task, action, result), most of
   them grown from a win. See which common interview questions you can answer, and practise. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let stories = [], skills = [], wins = [], tab = 'stories';

  BW.boot({
    app: 'stories',
    onReady: async () => {
      await load(); render();
      BW.route({
        // #new, or #new/win:<id> from the Wins Log
        'new': (from) => { const w = from && from.startsWith('win:') ? wins.find((x) => x.id === from.slice(4)) : null; edit(w ? G.storyFromWin(w) : {}); },
        open: (id) => { const s = stories.find((x) => x.id === id); if (s) edit(s); },
        practice: () => { tab = 'questions'; render(); practise(); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !$('.modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Write a story', () => edit({}));
  // What a strong answer has, checked by the person after saying it out loud.
  const CHECK = ['The situation in a sentence or two', 'What I did, with “I”', 'A result', 'A number', 'Under two minutes', 'Linked to the job'];
  async function load() { [stories, skills, wins] = await Promise.all(['stories', 'skills', 'wins'].map((n) => BW.store.all(n))); }

  function render() {
    const cov = G.coverage(stories, skills), covered = cov.filter((c) => c.stories.length).length;
    const unused = wins.filter((w) => !stories.some((s) => s.winId === w.id)).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🎤</span> Interview Stories</h1><p class="lead">Five good stories answer most interview questions. Write them once, practise them often.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          ${stories.length ? '<button class="btn" data-practise>🎲 Practise a question</button>' : ''}
          <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Write a story</button>
        </div>
      </div>
      ${stories.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--mint)"><div class="k">🎤 Stories</div><div class="v">${stories.length}</div><div class="s">${stories.filter((s) => s.result).length} with a result</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">❓ Questions covered</div><div class="v">${covered} of ${cov.length}</div><div class="s">Common interview questions you have a story for</div></div>
        <div class="card stat" style="--tint:var(--sky)"><div class="k">🔁 Practised</div><div class="v">${stories.reduce((a, s) => a + BW.num(s.practised), 0)}×</div><div class="s">Out loud counts double</div></div>
      </div>
      <div class="filters" data-tab style="margin-bottom:18px"><button type="button" data-v="stories" aria-pressed="${tab === 'stories'}">🎤 My stories</button><button type="button" data-v="questions" aria-pressed="${tab === 'questions'}">❓ Questions</button></div>
      ${tab === 'stories' ? `<div class="win-list">${stories.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).map(card).join('')}</div>`
        : `<div class="list">${cov.map((c) => `<div class="row" data-q="${esc(c.question)}" tabindex="0"><span class="icon-big">${c.stories.length ? '✅' : '⬜'}</span>
            <span class="main"><b>${esc(c.question)}</b><small class="faint">${c.stories.length ? c.stories.slice(0, 3).map((s) => esc(s.title)).join(' · ') : 'No story yet'}</small></span></div>`).join('')}</div>`}`
      : `<div class="card empty rise"><div class="big">🎤</div><h2>Your first interview story</h2>
          <p>Interviewers ask “tell me about a time when…”. Answer with a story: the <b>situation</b>, your <b>task</b>, what you <b>did</b> and the <b>result</b>. Start from a win: most of the work is done already.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Write a story</button></div>`}
      ${unused.length ? `<div class="section-h"><h2>🏆 Wins that could be stories</h2></div>
        <div class="list">${unused.slice(0, 6).map((w) => `<div class="row"><span class="main"><b>${esc(w.title)}</b><small class="faint">${w.result ? esc(w.result) : BW.fmtDate(w.date)}</small></span><button class="btn" data-from-win="${w.id}">🎤 Make it a story</button></div>`).join('')}</div>` : ''}
      <div style="height:40px"></div>`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({}));
    const pr = $('[data-practise]', main); if (pr) pr.onclick = () => practise();
    const tb = $('[data-tab]', main); if (tb) tb.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { tab = b.dataset.v; render(); } };
    $$('[data-from-win]', main).forEach((b) => b.onclick = () => edit(G.storyFromWin(wins.find((w) => w.id === b.dataset.fromWin))));
    $$('.win-card[data-id]', main).forEach((c) => { c.onclick = () => edit(stories.find((s) => s.id === c.dataset.id)); c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); }; });
    $$('[data-q]', main).forEach((r) => { r.onclick = () => practise(r.dataset.q); r.onkeydown = (e) => { if (e.key === 'Enter') r.onclick(); }; });
  }

  function card(s) {
    const parts = ['situation', 'task', 'action', 'result'].filter((k) => String(s[k] || '').trim()).length;
    return `<div class="card win-card" data-id="${s.id}" tabindex="0">
      <b>${esc(s.title || 'A story')}</b>
      ${s.result ? `<span class="result">📈 ${esc(s.result)}</span>` : ''}
      <small class="faint">${parts === 4 ? '✅ Situation, task, action and result' : `✏️ ${4 - parts} part${4 - parts === 1 ? '' : 's'} to fill in`}${BW.num(s.practised) ? ` · practised ${BW.num(s.practised)}×` : ''}</small>
      <span class="meta">${G.skillChips(G.skillIds(s), skills)}</span>
    </div>`;
  }

  function edit(x) {
    BW.recordDrawer({
      collection: 'stories', rec: x, title: 'Story', newTitle: 'Write a story',
      fields: [
        { k: 'title', label: 'The story in one line', ph: 'e.g. The week the newsletter broke', span: 2, required: true },
        { k: 'situation', label: '1 · Situation: where, when, what was going on', type: 'textarea', span: 2 },
        { k: 'task', label: '2 · Task: what you had to do, or the problem', type: 'textarea', span: 2 },
        { k: 'action', label: '3 · Action: what you did (say “I”, not “we”)', type: 'textarea', span: 2 },
        { k: 'result', label: '4 · Result: what changed, with a number if you can', span: 2 },
        { k: 'tags', label: 'Tags', ph: 'e.g. conflict, deadline', span: 2 },
      ],
      bottom: (r) => G.skillPickerHtml(skills, G.skillIds(r)) + (r.winId ? `<p class="faint" style="margin-top:10px">🏆 From your win: <a href="../wins/index.html#open/${esc(r.winId)}">${esc((wins.find((w) => w.id === r.winId) || {}).title || 'open it')}</a></p>` : ''),
      bind: (box, r, save) => G.bindSkillPicker(box, r, save, skills),
      onClose: async () => { await load(); render(); },
    });
  }

  // Practice: a question, the stories that answer it, and a tick when you've said one out loud.
  function practise(question) {
    const pickQ = () => { const qs = G.QUESTIONS.map((q) => q[0]); return qs[Math.floor(Math.random() * qs.length)]; };
    let q = question || pickQ();
    const box = document.createElement('div');
    const draw = () => {
      const fit = G.storiesFor(q, stories, skills);
      box.innerHTML = `<p class="practice-q">“${esc(q)}”</p>
        <div class="timer-row"><button type="button" class="btn btn-primary" data-timer>🎙️ Start answering</button><span class="timer" data-time aria-live="polite">2:00</span>
          <small class="faint">Out loud, about two minutes: situation, task, action, result.</small></div>
        <div class="self-check" data-self hidden><b>How did that go?</b> Tick what you did:
          <div class="choice-chips multi">${CHECK.map((c, i) => `<button type="button" data-chk="${i}" aria-pressed="false">${c}</button>`).join('')}</div><small class="faint" data-chk-out></small></div>
        ${fit.length ? `<div class="list" style="margin-top:12px">${fit.map((s) => `<details class="card" style="padding:12px 14px"><summary><b>${esc(s.title)}</b></summary>
          ${['situation', 'task', 'action', 'result'].map((k) => (s[k] ? `<p style="margin-top:8px"><b>${k[0].toUpperCase() + k.slice(1)}:</b> ${esc(s[k])}</p>` : '')).join('')}
          <button type="button" class="btn" data-said="${s.id}" style="margin-top:10px">✅ I practised this one</button></details>`).join('')}</div>`
        : '<p style="margin-top:12px">No story for this one yet. Which win would answer it? <a href="#new">Write one</a>.</p>'}`;
      bindTimer();
      $$('[data-said]', box).forEach((b) => b.onclick = async () => {
        const s = stories.find((x) => x.id === b.dataset.said);
        s.practised = BW.num(s.practised) + 1; s.lastPractised = BW.today();
        try { await BW.store.put('stories', s); } catch (e) { return BW.error(e); }
        b.textContent = '🎉 Nice. Another one?'; b.disabled = true;
      });
    };
    // Two minutes, counting down, then over time in red. Stop it to check your answer.
    let tick = null;
    const stop = () => { clearInterval(tick); tick = null; };
    function bindTimer() {
      const btn = $('[data-timer]', box), out = $('[data-time]', box);
      btn.onclick = () => {
        if (tick) { stop(); btn.textContent = '🎙️ Again'; $('[data-self]', box).hidden = false; return; }
        const t0 = Date.now(); btn.textContent = '⏹ Done'; $('[data-self]', box).hidden = true;
        tick = setInterval(() => {
          const left = 120 - Math.round((Date.now() - t0) / 1000), a = Math.abs(left);
          out.textContent = `${left < 0 ? '+' : ''}${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
          out.classList.toggle('over', left < 0);
        }, 250);
      };
      $$('[data-chk]', box).forEach((b) => b.onclick = () => {
        b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
        const n = $$('[data-chk][aria-pressed="true"]', box).length;
        $('[data-chk-out]', box).textContent = n === CHECK.length ? '🎉 A complete answer.' : `Next time, add: ${CHECK.filter((_, i) => $(`[data-chk="${i}"]`, box).getAttribute('aria-pressed') !== 'true').join(', ').toLowerCase()}.`;
      });
    }
    draw();
    BW.modal({ title: '🎲 Practise', body: box, wide: true, actions: [{ label: 'Done', kind: 'ghost' }, { label: '🎲 Another question', kind: 'primary', onClick: () => { stop(); q = pickQ(); draw(); return false; } }], onClose: async () => { stop(); await load(); render(); } });
  }
})();
