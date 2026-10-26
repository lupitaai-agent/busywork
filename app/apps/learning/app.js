/* Learning Planner: what you're learning (courses, books, videos, projects), the hours you put in
   each week, and what it builds. Finishing something is the moment to log a win and level up a skill. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const G = BW.growth;
  const main = $('#main');
  let items = [], skills = [], showDone = false;

  BW.boot({
    app: 'learning',
    onReady: async () => {
      await load(); render();
      BW.route({
        'new': (skillId) => edit({ status: 'planned', kind: 'course', start: BW.today(), skillIds: skillId ? [skillId] : [] }),
        open: (id) => { const x = items.find((i) => i.id === id); if (x) edit(x); },
        log: (id) => { const x = items.find((i) => i.id === id); if (x) logTime(x); },
      });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !$('.modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Plan something to learn', () => edit({ status: 'planned', kind: 'course', start: BW.today() }));
  async function load() { [items, skills] = await Promise.all([BW.store.all('learning'), BW.store.all('skills')]); }

  const KIND = Object.fromEntries(G.LEARN_KINDS);
  const emoOf = (x) => (KIND[x.kind] || KIND.other).split(' ')[0];

  function render() {
    const today = BW.today(), s = BW.settings;
    const week = G.weekMinutes(items, today), target = BW.num(s.learnHoursWeek) * 60;
    const streak = G.learningStreak(items, today);
    const doing = items.filter((x) => x.status === 'doing'), planned = items.filter((x) => x.status === 'planned' || !x.status);
    const done = items.filter((x) => x.status === 'done').sort((a, b) => String(b.doneAt || '').localeCompare(String(a.doneAt || '')));
    const year = today.slice(0, 4);
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🎓</span> Learning Planner</h1><p class="lead">A little every week beats a lot once. Plan it, log it, use it.</p></div>
        <div class="spacer"></div>
        <div class="row-flex">
          <button class="chip chip-grape" data-target style="cursor:pointer">🎯 ${target ? G.hours(target) + ' a week' : 'Set a weekly goal'} ✏️</button>
          <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Plan something to learn</button>
        </div>
      </div>
      ${items.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--grape)"><div class="k">⏱️ This week</div><div class="v">${G.hours(week)}</div>
          <div class="s">${target ? (week >= target ? '🎉 Weekly goal reached' : `${G.hours(target - week)} to your goal`) : 'Set a weekly goal to see progress'}</div>
          ${target ? `<div class="progress-bar" style="margin-top:8px"><i style="width:${Math.min(100, week / target * 100)}%"></i></div>` : ''}</div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">🔥 Streak</div><div class="v">${streak} week${streak === 1 ? '' : 's'}</div><div class="s">${streak ? 'Weeks in a row with learning logged' : 'Log some time to start one'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">✅ Finished in ${year}</div><div class="v">${done.filter((x) => String(x.doneAt || '').startsWith(year)).length}</div><div class="s">${G.hours(items.reduce((a, x) => a + G.itemMinutes(x), 0))} learned in total</div></div>
      </div>
      ${section('📖 Doing now', doing, 'Nothing on the go. Start one of your plans below.')}
      ${section('🗓️ Planned', planned, 'Nothing planned yet.')}
      ${done.length ? `<div class="section-h" style="margin-top:10px"><button class="link" data-toggle-done>${showDone ? '▾' : '▸'} ✅ Finished (${done.length})</button></div>${showDone ? `<div class="learn-grid">${done.map(card).join('')}</div>` : ''}` : ''}
      <div style="height:40px"></div>`
      : `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🎓</div><h2>What do you want to learn?</h2>
          <p>A course, a book, a video series or a project of your own. Plan it here, log the time you put in, and when you finish, it becomes proof for your Skills Map and a line for your CV.</p>
          <button class="btn btn-primary btn-big" data-new>＋ Plan my first one</button></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ status: 'planned', kind: 'course', start: BW.today() }));
    $('[data-target]', main).onclick = setTarget;
    const tg = $('[data-toggle-done]', main); if (tg) tg.onclick = () => { showDone = !showDone; render(); };
    $$('.learn-card[data-id]', main).forEach((c) => {
      c.onclick = () => edit(items.find((x) => x.id === c.dataset.id));
      c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); };
    });
    $$('[data-log]', main).forEach((b) => b.onclick = (e) => { e.stopPropagation(); logTime(items.find((x) => x.id === b.dataset.log)); });
    $$('[data-start]', main).forEach((b) => b.onclick = async (e) => { e.stopPropagation(); const x = items.find((i) => i.id === b.dataset.start); x.status = 'doing'; x.start = x.start || BW.today(); await save(x); });
    $$('[data-finish]', main).forEach((b) => b.onclick = (e) => { e.stopPropagation(); finish(items.find((x) => x.id === b.dataset.finish)); });
  }
  const section = (title, list, empty) => `<div class="section-h"><h2>${title}</h2></div>
    ${list.length ? `<div class="learn-grid">${list.map(card).join('')}</div>` : `<p class="faint" style="margin:-6px 0 22px">${empty}</p>`}`;

  function card(x) {
    const min = G.itemMinutes(x), plan = BW.num(x.hoursPlanned) * 60;
    const late = x.status !== 'done' && x.due && x.due < BW.today();
    return `<div class="card learn-card" data-id="${x.id}" tabindex="0">
      <div class="row-flex" style="justify-content:space-between;align-items:flex-start"><b>${emoOf(x)} ${esc(x.title)}</b>
        <span class="status-pill ${x.status === 'done' ? 'done' : x.status === 'doing' ? 'doing' : 'todo'}">${x.status === 'done' ? 'Done' : x.status === 'doing' ? 'Doing' : 'Planned'}</span></div>
      ${x.provider ? `<small class="faint">${esc(x.provider)}</small>` : ''}
      ${plan ? `<div class="progress-bar"><i style="width:${Math.min(100, min / plan * 100)}%"></i></div><small class="faint">${G.hours(min)} of ${G.hours(plan)}</small>` : min ? `<small class="faint">${G.hours(min)} so far</small>` : ''}
      ${x.due && x.status !== 'done' ? `<small class="${late ? '' : 'faint'}">${late ? '⏰ Was due' : '📅 Due'} ${BW.fmtDate(x.due)}</small>` : ''}
      ${x.status === 'done' && x.doneAt ? `<small class="faint">✅ Finished ${BW.fmtDate(x.doneAt)}</small>` : ''}
      <span class="meta">${G.skillChips(G.skillIds(x), skills)}</span>
      ${x.status === 'done' ? '' : `<div class="row-flex">${x.status === 'doing' ? `<button class="btn" data-log="${x.id}">⏱️ Log time</button><button class="btn" data-finish="${x.id}">✅ Finished</button>` : `<button class="btn" data-start="${x.id}">▶️ Start</button>`}</div>`}
    </div>`;
  }

  async function save(x) { try { await BW.store.put('learning', x); } catch (e) { return BW.error(e); } await load(); render(); }

  function logTime(x) {
    if (!x) return;
    let minutes = 30, date = BW.today();
    const box = BW.html(`<div><p>How long did you spend on <b>${esc(x.title)}</b>?</p>
      <div class="minutes">${[15, 30, 45, 60, 90, 120].map((m) => `<button type="button" class="btn" data-m="${m}" aria-pressed="${m === minutes}">${m < 60 ? m + ' min' : m / 60 + ' h'}</button>`).join('')}</div>
      <div class="grid-2"><label class="field"><span>Or minutes</span><input class="in" inputmode="numeric" data-min value="${minutes}"></label>
      <label class="field"><span>When</span><input class="in" type="date" data-date value="${date}"></label></div></div>`);
    box.onclick = (e) => { const b = e.target.closest('[data-m]'); if (b) { minutes = Number(b.dataset.m); BW.$('[data-min]', box).value = minutes; BW.$$('[data-m]', box).forEach((y) => y.setAttribute('aria-pressed', String(y === b))); } };
    BW.modal({ title: '⏱️ Log learning time', body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Log it', kind: 'primary', onClick: async () => {
      const m = BW.num(BW.$('[data-min]', box).value), d = BW.$('[data-date]', box).value || BW.today();
      if (!(m > 0)) { BW.toast('How many minutes?', '⏱️'); return false; }
      x.sessions = (Array.isArray(x.sessions) ? x.sessions : []).concat([{ date: d, minutes: m }]);
      if (!x.status || x.status === 'planned') x.status = 'doing';
      await save(x);
      const target = BW.num(BW.settings.learnHoursWeek) * 60, week = G.weekMinutes(items, BW.today());
      if (target && week >= target && week - m < target) { BW.confetti(); BW.toast('Weekly learning goal reached!', '🎉'); }
      else BW.toast(`Logged ${G.hours(m)}`, '⏱️');
    } }] });
  }

  async function finish(x) {
    if (!x) return;
    x.status = 'done'; x.doneAt = BW.today();
    await save(x);
    BW.confetti();
    BW.toast(`Finished ${esc(x.title)}! Write down what it proves while it’s fresh.`, '🎓', { label: 'Log a win', run: () => { location.href = `../wins/index.html#new/learning:${x.id}`; } });
  }

  function edit(x) {
    BW.recordDrawer({
      collection: 'learning', rec: x, title: 'Learning', newTitle: 'Plan something to learn',
      fields: [
        { k: 'title', label: 'What', ph: 'e.g. Google Data Analytics course, or “Build a portfolio site”', span: 2, required: true },
        { k: 'kind', label: 'Kind', type: 'chips', options: G.LEARN_KINDS },
        { k: 'provider', label: 'From', ph: 'e.g. Coursera, a book by…, my own project' },
        { k: 'url', label: 'Link', type: 'url', ph: 'https://…' },
        { k: 'start', label: 'Start', type: 'date' },
        { k: 'due', label: 'Finish by', type: 'date' },
        { k: 'hoursPlanned', label: 'Hours it should take', type: 'number', ph: 'e.g. 20' },
        { k: 'status', label: 'Status', type: 'chips', options: G.LEARN_STATUS },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'Why this, what you want to get out of it, what you learned', span: 2 },
      ],
      bottom: (r) => G.skillPickerHtml(skills, G.skillIds(r)) + (Array.isArray(r.sessions) && r.sessions.length ? `<h3 class="section-title" style="margin-top:22px"><span>⏱️</span>Time logged: ${G.hours(G.itemMinutes(r))}</h3>
        <div class="list">${r.sessions.slice().reverse().slice(0, 12).map((s) => `<div class="row"><span class="main">${BW.fmtDate(s.date)}</span><b>${G.hours(BW.num(s.minutes))}</b></div>`).join('')}</div>` : ''),
      bind: (box, r, save) => {
        G.bindSkillPicker(box, r, save, skills);
        $('[data-name="status"]', box).addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.v === 'done' && !r.doneAt) { r.doneAt = BW.today(); save(); } });
      },
      onClose: async () => { await load(); render(); },
    });
  }

  function setTarget() {
    BW.modal({
      title: '🎯 Your weekly learning goal',
      body: `<p style="margin-bottom:14px">How many hours a week can you give learning? Small and steady wins.</p>
        <label class="field"><span>Hours a week</span><input class="in" inputmode="decimal" data-v value="${BW.num(BW.settings.learnHoursWeek) || ''}" placeholder="e.g. 2"></label>`,
      actions: [{ label: 'Never mind', kind: 'ghost' }, { label: 'Save', kind: 'primary', onClick: async () => {
        const v = BW.num($('[data-v]').value);
        if (!(v >= 0)) { BW.toast('That needs to be a number', '🤔'); return false; }
        try { await BW.store.saveSettings(Object.assign({}, BW.settings, { learnHoursWeek: v })); } catch (e) { BW.error(e); return false; }
        render();
      } }],
    });
  }
})();
