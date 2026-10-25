/* Project Planner: every project on one page, and per project its brief, milestones, a timeline you
   can drag, who does what, risks and decisions, and a weekly update written from the plan. The sums
   live in shared/projects.js (BW.pm); the tasks are the same cards as on the Project Board. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const P = BW.pm;
  const main = $('#main');
  const TABS = [['overview', '🏠 Overview'], ['timeline', '📅 Timeline'], ['tasks', '✅ Tasks'], ['people', '👥 People'], ['log', '⚠️ Risks & decisions'], ['updates', '📣 Updates']];
  const COLORS = ['sky', 'grape', 'pink', 'tomato', 'sun', 'mint', 'teal'];
  let d = null, current = null, tab = 'overview', olaf = null;

  BW.boot({
    app: 'projects',
    onReady: async () => {
      olaf = await BW.entitlements.edition('olaf');
      await load(); render();
      BW.route({ new: () => newProject(), p: (id) => { if (d.projects.some((p) => p.id === id)) { current = id; tab = 'overview'; render(); } } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !$('.modal-wrap') && !dragging) render(); },
  });
  BW.shortcut('n', 'New project', () => newProject());

  async function load() {
    d = await P.load();
    if (current && !d.projects.some((p) => p.id === current)) current = null;
  }

  const person = (id) => d.people.find((x) => x.id === id);
  const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const face = (p) => `<span class="face" style="--fc:var(--${p.color || 'sky'})" title="${esc(p.name)}">${esc(initials(p.name))}</span>`;
  const healthPill = (h) => `<span class="health ${h}">${P.HEALTH[h].emoji} ${P.HEALTH[h].label}</span>`;
  const when = (iso, done) => (iso ? `<span class="when ${!done && iso < BW.today() ? 'late' : ''}">${BW.fmtDate(iso, { day: 'numeric', month: 'short' })}</span>` : '<span class="when">no date</span>');
  const active = () => d.projects.filter((p) => (p.status || 'active') === 'active');

  function render() {
    if (current) return renderProject();
    renderHome();
  }

  // ---------- all projects ----------
  function renderHome() {
    const on = BW.today(), week = BW.addDays(on, 7);
    const list = active().map((p) => { const x = P.of(d, p.id); return { p, x, h: P.health(x, d), pr: P.progress(x) }; });
    const open = d.tasks.filter((t) => t.status !== 'done' && list.some((r) => r.p.id === t.projectId));
    const late = open.filter((t) => P.endOf(t) && P.endOf(t) < on);
    const soon = open.filter((t) => P.endOf(t) >= on && P.endOf(t) <= week).sort((a, b) => P.endOf(a).localeCompare(P.endOf(b)));
    const busy = P.workload(d, P.monday(on), 2).filter((r) => r.over.some(Boolean));
    const rest = d.projects.filter((p) => (p.status || 'active') !== 'active');
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🗓️</span> Project Planner</h1><p class="lead">Every project on one page: what is due, who is on it, and what is slipping.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> New project</button>
      </div>
      ${!d.projects.length ? emptyHome() : `
      <div class="stats rise">
        <div class="card stat"><div class="k">📁 Active projects</div><div class="v">${list.length}</div><div class="s">${list.filter((r) => r.h.level !== 'green').length} need attention</div></div>
        <div class="card stat"><div class="k">⏰ Late tasks</div><div class="v">${late.length}</div><div class="s">past their due date</div></div>
        <div class="card stat"><div class="k">📅 Due this week</div><div class="v">${soon.length}</div><div class="s">in the next 7 days</div></div>
        <div class="card stat"><div class="k">🔥 Too much on</div><div class="v">${busy.length}</div><div class="s">${busy.length ? esc(busy.map((r) => r.person.name).join(', ')) : 'nobody over their hours'}</div></div>
      </div>
      <div class="pgrid">${list.sort((a, b) => ['red', 'amber', 'green'].indexOf(a.h.level) - ['red', 'amber', 'green'].indexOf(b.h.level)).map(projectCard).join('')}</div>
      ${soon.length || late.length ? `<h2 style="margin-bottom:12px">This week across projects</h2><div style="margin-bottom:30px">${late.concat(soon).slice(0, 12).map((t) => taskRow(t, true)).join('')}</div>` : ''}
      ${rest.length ? `<details style="margin-bottom:24px"><summary style="font-weight:800;cursor:pointer">Finished and paused (${rest.length})</summary><div class="pgrid" style="margin-top:12px">${rest.map((p) => { const x = P.of(d, p.id); return projectCard({ p, x, h: P.health(x, d), pr: P.progress(x) }); }).join('')}</div></details>` : ''}
      ${olafCard(null)}`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => newProject());
    $$('[data-open]', main).forEach((b) => b.onclick = () => { current = b.dataset.open; tab = 'overview'; render(); scrollTo(0, 0); });
    $$('[data-tpl-start]', main).forEach((b) => b.onclick = () => newProject(b.dataset.tplStart));
    bindTaskRows();
  }

  function emptyHome() {
    return `<div class="card empty rise" style="margin-bottom:24px"><div class="big">🗓️</div><h2>Plan your first project</h2>
      <p>Pick a starting point. You get milestones, tasks and dates you can change, and the tasks show up on your Project Board too.</p></div>
      <div class="tpls" style="margin-bottom:30px">${P.TEMPLATES.map((t) => `<button class="tpl" data-tpl-start="${t.id}"><b>${t.emoji} ${esc(t.name)}</b><small>${esc(t.about)}</small></button>`).join('')}</div>`;
  }

  function projectCard({ p, x, h, pr }) {
    const next = x.milestones.find((m) => !m.done);
    const team = [...new Set(x.tasks.map((t) => t.assigneeId).filter(Boolean))].map(person).filter(Boolean);
    return `<button class="card pcard" data-open="${p.id}">
      <div class="row-flex" style="justify-content:space-between"><h3>${esc(p.emoji || '📁')} ${esc(p.name)}</h3>${(p.status || 'active') === 'active' ? healthPill(h.level) : `<span class="chip chip-grey">${p.status === 'done' ? 'Finished' : 'Paused'}</span>`}</div>
      ${x.client ? `<div class="sub">For ${esc(x.client.name)}</div>` : ''}
      <div class="meter" aria-label="${pr.pct}% done"><i style="width:${pr.pct}%"></i></div>
      <div class="facts"><span><b>${pr.done}/${pr.total}</b> tasks done</span>${next ? `<span>Next: <b>${esc(next.title)}</b> ${next.due ? BW.fmtDate(next.due, { day: 'numeric', month: 'short' }) : ''}</span>` : ''}${p.due ? `<span>Deadline <b>${BW.fmtDate(p.due, { day: 'numeric', month: 'short' })}</b></span>` : ''}</div>
      ${team.length ? `<div class="faces">${team.map(face).join('')}</div>` : ''}
    </button>`;
  }

  // ---------- one project ----------
  function renderProject() {
    const x = P.of(d, current);
    const h = P.health(x, d);
    main.innerHTML = `
      <button class="back" data-home>← All projects</button>
      <div class="page-head" style="padding-top:0">
        <div><h1><span class="title-emo">${esc(x.p.emoji || '📁')}</span> ${esc(x.p.name)}</h1>
          <p class="lead">${x.client ? `For ${esc(x.client.name)} · ` : ''}${x.p.start ? BW.fmtDate(x.p.start) : 'No start date'} to ${x.p.due ? BW.fmtDate(x.p.due) : 'no deadline yet'} ${(x.p.status || 'active') === 'active' ? healthPill(h.level) : ''}</p></div>
        <div class="spacer"></div>
        <div class="row-flex"><button class="btn" data-brief>✏️ Brief</button><button class="btn" data-export>⬇️ Export</button><a class="btn" href="../board/index.html#project/${x.p.id}">🗂️ Board</a></div>
      </div>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>
      <div data-view></div>`;
    $('[data-home]', main).onclick = () => { current = null; render(); };
    $$('[data-tab]', main).forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    $('[data-brief]', main).onclick = () => editBrief(x.p);
    $('[data-export]', main).onclick = () => exportMenu(x);
    const v = $('[data-view]', main);
    ({ overview, timeline, tasks: taskList, people, log, updates }[tab] || overview)(v, x, h);
    bindTaskRows();
  }

  function overview(v, x, h) {
    const on = BW.today();
    const soon = x.tasks.filter((t) => t.status !== 'done' && P.endOf(t) && P.endOf(t) <= BW.addDays(on, 7)).sort((a, b) => P.endOf(a).localeCompare(P.endOf(b)));
    const pr = P.progress(x);
    v.innerHTML = `<div class="cols">
      <div style="display:flex;flex-direction:column;gap:18px">
        <section class="card panel"><h2>📌 Brief<span class="spacer"></span><button class="btn btn-ghost" data-brief2>Edit</button></h2>
          ${x.p.goal || x.p.doneMeans ? `<dl class="brief">${x.p.goal ? `<dt>Goal</dt><dd>${esc(x.p.goal)}</dd>` : ''}${x.p.doneMeans ? `<dt>Done means</dt><dd>${esc(x.p.doneMeans)}</dd>` : ''}${x.p.budgetHours ? `<dt>Time budget</dt><dd>${esc(x.p.budgetHours)} hours (planned: ${Math.round(pr.hours)})</dd>` : ''}${x.owner ? `<dt>Owner</dt><dd>${esc(x.owner.name)}</dd>` : ''}</dl>`
            : '<p class="faint">Two lines make every decision easier: what this project is for, and how you will know it is done.</p>'}
        </section>
        <section class="card panel"><h2>◆ Milestones<span class="spacer"></span><small class="faint">${pr.milestonesDone}/${pr.milestones} reached</small></h2>
          <div class="mlist">${x.milestones.map((m) => `<label class="mrow ${m.done ? 'done' : ''}"><input type="checkbox" data-ms="${m.id}" ${m.done ? 'checked' : ''}><span class="t">${esc(m.title)}</span>${when(m.due, m.done)}<button type="button" class="icon-btn" data-ms-edit="${m.id}" aria-label="Edit ${esc(m.title)}">✏️</button></label>`).join('') || '<p class="faint">Milestones are the promises: dates that matter to you or your client.</p>'}</div>
          <form class="inline-add" data-ms-add><input class="in" name="title" placeholder="New milestone" aria-label="New milestone"><input class="in" type="date" name="due" aria-label="Milestone date" style="flex:none;width:auto"><button class="btn">Add</button></form>
        </section>
        <section class="card panel"><h2>📅 Due in the next 7 days</h2>${soon.length ? soon.map((t) => taskRow(t)).join('') : '<p class="faint">Nothing due this week.</p>'}</section>
      </div>
      <div style="display:flex;flex-direction:column;gap:18px">
        <section class="card panel"><h2>${P.HEALTH[h.level].emoji} ${P.HEALTH[h.level].label}${h.set ? ' <small class="faint">(set by hand)</small>' : ''}</h2>
          ${h.reasons.length ? `<ul class="reasons">${h.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p class="faint">Nothing late, nothing clashing, nobody overloaded.</p>'}
          <div class="meter"><i style="width:${pr.pct}%"></i></div><small class="faint">${pr.done} of ${pr.total} tasks done (${pr.pct}%)</small>
          <button class="btn btn-primary" data-write>📣 Write this week’s update</button>
        </section>
        ${olafCard(x)}
      </div></div>`;
    $('[data-brief2]', v).onclick = () => editBrief(x.p);
    $('[data-write]', v).onclick = () => writeUpdate(x);
    $$('[data-ms]', v).forEach((c) => c.onchange = async () => { const m = d.milestones.find((y) => y.id === c.dataset.ms); m.done = c.checked; await save('milestones', m); if (m.done) { BW.confetti(); BW.toast('Milestone reached!', '◆'); } });
    $$('[data-ms-edit]', v).forEach((b) => b.onclick = (e) => { e.preventDefault(); editMilestone(d.milestones.find((m) => m.id === b.dataset.msEdit)); });
    $('[data-ms-add]', v).onsubmit = async (e) => {
      e.preventDefault(); const f = e.target, title = f.title.value.trim(); if (!title) return;
      await save('milestones', { projectId: x.p.id, title, due: f.due.value, done: false, order: x.milestones.length });
    };
  }

  // ---------- timeline ----------
  let dragging = null;
  function timeline(v, x) {
    const dated = x.tasks.filter((t) => P.startOf(t));
    const dates = dated.flatMap((t) => [P.startOf(t), P.endOf(t)]).concat(x.milestones.map((m) => m.due).filter(Boolean), [x.p.start, x.p.due, BW.today()].filter(Boolean)).sort();
    if (!dated.length && !x.milestones.some((m) => m.due)) {
      v.innerHTML = `<div class="card empty"><div class="big">📅</div><h2>Nothing on the timeline yet</h2><p>Give tasks a start and due date (or a due date only) and they appear here as bars you can drag.</p></div>`;
      return;
    }
    const from = P.monday(BW.addDays(dates[0], -2)), to = BW.addDays(dates[dates.length - 1], 10);
    const span = P.days(from, to) + 1;
    // Fit the whole plan on screen when the days stay wide enough to grab; long plans scroll sideways.
    const dayW = Math.max(8, Math.min(28, Math.floor((Math.max(320, v.clientWidth) - 194) / span)));
    const width = span * dayW;
    const xOf = (iso) => P.days(from, iso) * dayW;
    const clash = new Set(P.conflicts(x.tasks).map((c) => c.task.id));
    const weeks = []; for (let w = from; w <= to; w = BW.addDays(w, 7)) weeks.push(w);
    const bar = (t) => {
      const s = P.startOf(t), e = P.endOf(t);
      if (!s) return '';
      const late = t.status !== 'done' && e < BW.today();
      const who = person(t.assigneeId);
      return `<div class="g-bar ${t.status || 'todo'} ${late ? 'late' : ''} ${clash.has(t.id) ? 'clash' : ''}" data-bar="${t.id}" style="left:${xOf(s)}px;width:${Math.max(dayW, (P.days(s, e) + 1) * dayW) - 2}px" title="${esc(t.title)}: ${BW.fmtDate(s)} to ${BW.fmtDate(e)}${who ? ', ' + esc(who.name) : ''}">${who && dayW * (P.days(s, e) + 1) > 40 ? esc(initials(who.name)) : ''}<span class="grip" data-grip></span></div>`;
    };
    const groups = x.milestones.map((m) => ({ m, tasks: x.tasks.filter((t) => t.milestoneId === m.id) })).concat([{ m: null, tasks: x.tasks.filter((t) => !x.milestones.some((m) => m.id === t.milestoneId)) }]).filter((g) => g.m || g.tasks.length);
    v.innerHTML = `<div class="gantt-wrap"><div class="gantt" style="width:${width + 190}px">
      <div class="g-row head"><div class="g-label">Task</div><div class="g-track" style="width:${width}px">${weeks.map((w) => `<span class="g-week" style="left:${xOf(w)}px">${BW.fmtDate(w, { day: 'numeric', month: 'short' })}</span>`).join('')}</div></div>
      ${groups.map((g) => `
        <div class="g-row ms"><div class="g-label">${g.m ? '◆ ' + esc(g.m.title) : 'Other tasks'}</div><div class="g-track" style="width:${width}px">${g.m && g.m.due ? `<span class="g-diamond ${g.m.done ? 'done' : ''}" style="left:${xOf(g.m.due) + dayW / 2 - 8}px" title="${esc(g.m.title)}, ${BW.fmtDate(g.m.due)}"></span>` : ''}</div></div>
        ${g.tasks.map((t) => `<div class="g-row"><div class="g-label" title="${esc(t.title)}">${esc(t.title)}</div><div class="g-track" style="width:${width}px">${bar(t)}</div></div>`).join('')}`).join('')}
      <div class="g-today" style="left:${190 + xOf(BW.today()) + dayW / 2}px" title="Today"></div>
      ${x.p.due ? `<div class="g-deadline" style="left:${190 + xOf(x.p.due) + dayW}px" title="Deadline ${BW.fmtDate(x.p.due)}"></div>` : ''}
    </div></div>
    <div class="legend"><span><i style="background:var(--sky)"></i>To do</span><span><i style="background:var(--sun)"></i>Doing</span><span><i style="background:var(--pink)"></i>Waiting</span><span><i style="background:var(--mint)"></i>Done</span><span><i style="background:var(--tomato)"></i>Late</span><span><i style="outline:3px solid var(--tomato)"></i>Starts before what it waits for</span><span>Drag a bar to move it, its right edge to make it longer. What waits for it moves along.</span></div>`;
    $$('[data-bar]', v).forEach((el) => {
      el.onpointerdown = (e) => {
        const t = x.tasks.find((y) => y.id === el.dataset.bar);
        const mode = e.target.closest('[data-grip]') ? 'resize' : 'move';
        const x0 = e.clientX, left0 = parseFloat(el.style.left), w0 = parseFloat(el.style.width);
        dragging = { t, mode, dx: 0 };
        el.setPointerCapture(e.pointerId); el.classList.add('dragging');
        el.onpointermove = (ev) => {
          dragging.dx = ev.clientX - x0;
          if (mode === 'move') el.style.left = left0 + dragging.dx + 'px'; else el.style.width = Math.max(dayW - 2, w0 + dragging.dx) + 'px';
        };
        el.onpointerup = async () => {
          el.onpointermove = el.onpointerup = null; el.classList.remove('dragging');
          const shift = Math.round(dragging.dx / dayW), was = dragging; dragging = null;
          if (Math.abs(was.dx) < 4) return editTask(t);
          if (!shift) return render();
          const s = P.startOf(t), e2 = P.endOf(t);
          const ns = was.mode === 'move' ? BW.addDays(s, shift) : s;
          const ne = BW.addDays(e2, shift) < ns ? ns : BW.addDays(e2, shift);
          await moveTask(x, t, ns, ne);
        };
      };
    });
  }

  // Saves a new date for a task, pushes what waits for it, and offers Undo.
  async function moveTask(x, t, start, due) {
    const changed = P.move(x.tasks, t.id, start, due);
    const before = changed.map((c) => x.tasks.find((y) => y.id === c.id)).map((y) => Object.assign({}, y));
    try { await BW.store.putMany('tasks', changed); } catch (e) { return BW.error(e); }
    await load(); render();
    const pushed = changed.length - 1;
    BW.toast(`${esc(t.title)} now ${BW.fmtDate(start, { day: 'numeric', month: 'short' })} to ${BW.fmtDate(due, { day: 'numeric', month: 'short' })}${pushed ? `; ${pushed} task${pushed === 1 ? '' : 's'} waiting for it moved too` : ''}`, '📅',
      { label: 'Undo', run: async () => { await BW.store.putMany('tasks', before); await load(); render(); } });
  }

  // ---------- tasks ----------
  function taskList(v, x) {
    const groups = x.milestones.map((m) => ({ m, tasks: x.tasks.filter((t) => t.milestoneId === m.id) })).concat([{ m: null, tasks: x.tasks.filter((t) => !x.milestones.some((m) => m.id === t.milestoneId)) }]);
    v.innerHTML = groups.map((g) => `<section class="group"><h3>${g.m ? `◆ ${esc(g.m.title)} ${when(g.m.due, g.m.done)}` : (x.milestones.length ? 'Not linked to a milestone' : 'Tasks')}</h3>
      ${g.tasks.map((t) => taskRow(t)).join('')}
      <form class="inline-add" data-add="${g.m ? g.m.id : ''}"><input class="in" name="title" placeholder="＋ Add a task" aria-label="Add a task${g.m ? ' to ' + esc(g.m.title) : ''}"><input class="in" type="date" name="due" aria-label="Due date" style="flex:none;width:auto"><button class="btn">Add</button></form></section>`).join('');
    $$('[data-add]', v).forEach((f) => f.onsubmit = async (e) => {
      e.preventDefault(); const title = f.title.value.trim(); if (!title) return;
      await save('tasks', { projectId: x.p.id, title, status: 'todo', milestoneId: f.dataset.add, due: f.due.value, order: x.tasks.length });
      const again = $(`[data-add="${f.dataset.add}"] input`, main); if (again) again.focus();
    });
  }

  function taskRow(t, withProject) {
    const who = person(t.assigneeId), p = d.projects.find((y) => y.id === t.projectId);
    const st = t.status || 'todo';
    return `<div class="trow ${st}" data-task="${t.id}" tabindex="0">
      <button class="st ${st}" data-st="${t.id}" title="Change status">${P.STATUS[st]}</button>
      <span class="t">${t.link ? `<span title="From the marketing ${t.link.startsWith('content:') ? 'content calendar' : 'plan'}">📣 </span>` : ''}${esc(t.title)}${withProject && p ? `<small>${esc(p.emoji || '📁')} ${esc(p.name)}</small>` : t.hours ? `<small>${esc(t.hours)} h</small>` : ''}</span>
      ${who ? `<span class="faces">${face(who)}</span>` : '<span></span>'}
      ${when(P.endOf(t), st === 'done')}
    </div>`;
  }
  function bindTaskRows() {
    $$('[data-st]', main).forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const t = d.tasks.find((y) => y.id === b.dataset.st), order = Object.keys(P.STATUS);
      t.status = order[(order.indexOf(t.status || 'todo') + 1) % order.length];
      t.doneAt = t.status === 'done' ? BW.today() : '';
      await save('tasks', t);
      if (t.status === 'done') BW.toast('Done!', '🎉');
    });
    $$('[data-task]', main).forEach((r) => { r.onclick = () => editTask(d.tasks.find((t) => t.id === r.dataset.task)); r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); }; });
  }

  function editTask(t) {
    const x = P.of(d, t.projectId);
    const before = { start: t.start, due: t.due, status: t.status };
    BW.recordDrawer({
      collection: 'tasks', rec: t, title: t.link ? '📣 Marketing task' : 'Task',
      top: () => (t.link ? `<p class="faint" style="margin-bottom:12px">From the marketing ${t.link.startsWith('content:') ? 'content calendar' : 'plan'} (Marketing Studio and Olaf). The title, the ${t.link.startsWith('content:') ? 'day' : 'month'} and whether it is done stay the same in both places; who does it and the hours are only here. Deleting it here leaves the marketing item as it is.</p>` : ''),
      fields: [
        { k: 'title', label: 'What needs doing?', span: 2 },
        { k: 'status', label: 'Where is it at?', type: 'chips', options: Object.entries(P.STATUS) },
        { k: 'assigneeId', label: 'Who does it?', type: 'select', options: [['', 'Nobody yet']].concat(d.people.map((p) => [p.id, p.name])) },
        { k: 'milestoneId', label: 'Leads to milestone', type: 'select', options: [['', 'None']].concat(x.milestones.map((m) => [m.id, m.title])) },
        { k: 'start', label: 'Start', type: 'date' },
        { k: 'due', label: 'Due', type: 'date' },
        { k: 'hours', label: 'Hours of work (estimate)', type: 'number', ph: String(P.DEFAULT_HOURS) },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ],
      bottom: (r) => {
        const others = x.tasks.filter((y) => y.id !== r.id);
        return others.length ? `<div class="field" style="margin-top:14px"><span>Waits for (it can only start when these are done)</span><div class="deps" data-deps>${others.map((y) => `<label><input type="checkbox" value="${y.id}" ${(r.after || []).includes(y.id) ? 'checked' : ''}>${esc(y.title)}</label>`).join('')}</div></div>` : '';
      },
      bind: (box, r, saveNow) => {
        const deps = $('[data-deps]', box);
        if (deps) deps.onchange = () => { r.after = $$('input:checked', deps).map((c) => c.value); saveNow(); };
      },
      deleteLabel: 'Delete task',
      onClose: async (r) => {
        if (!r.deleted && r.id) {
          const fresh = await BW.store.get('tasks', r.id);
          if (fresh && fresh.status === 'done' && before.status !== 'done' && !fresh.doneAt) { fresh.doneAt = BW.today(); await BW.store.put('tasks', fresh); }
          if (fresh && (fresh.start !== before.start || fresh.due !== before.due)) {
            await load();
            const x2 = P.of(d, fresh.projectId);
            const push = P.move(x2.tasks, fresh.id, P.startOf(fresh), P.endOf(fresh)).filter((y) => y.id !== fresh.id);
            if (push.length && await BW.confirm(`${push.length} task${push.length === 1 ? ' waits' : 's wait'} for “${esc(fresh.title)}” and would now start too early. Move ${push.length === 1 ? 'it' : 'them'} to start after it?`, { ok: 'Move them', title: 'Move what waits for it?' })) await BW.store.putMany('tasks', push);
          }
        }
        await load(); render();
      },
    });
  }

  // ---------- people ----------
  function people(v, x) {
    const w = P.workload(d, P.monday(BW.today()), 6);
    v.innerHTML = `<div class="cols"><section class="card panel"><h2>👥 The team<span class="spacer"></span><button class="btn" data-person>＋ Add someone</button></h2>
        ${d.people.length ? `<div class="list">${d.people.map((p) => `<div class="row" data-edit-person="${p.id}" tabindex="0"><span class="faces">${face(p)}</span><span class="main"><b>${esc(p.name)}</b><small>${esc(p.role || '')}${p.role ? ' · ' : ''}${esc(p.hours || P.DEFAULT_WEEK)} hours a week for projects</small></span><span class="faint">${x.tasks.filter((t) => t.assigneeId === p.id && t.status !== 'done').length} open here</span></div>`).join('')}</div>`
          : '<p class="faint">Add the people who do the work: yourself, colleagues, freelancers. No accounts needed; give each task a name and see who has too much on.</p>'}
      </section>
      <section class="card panel"><h2>⚖️ Workload, next 6 weeks</h2>
        ${d.people.length ? `<div class="load-wrap"><table class="load"><thead><tr><th></th>${w[0].weeks.map((s) => `<th>${BW.fmtDate(s, { day: 'numeric', month: 'short' })}</th>`).join('')}</tr></thead>
          <tbody>${w.map((r) => `<tr><td class="name">${esc(r.person.name)}</td>${r.hours.map((h) => `<td class="${h > r.cap ? 'over' : h > r.cap * 0.8 ? 'full' : h ? 'ok' : ''}" title="${h} of ${r.cap} hours">${h ? Math.round(h) : ''}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
          <small class="faint">Hours of open work, across all projects. A task without an estimate counts as ${P.DEFAULT_HOURS} hours. Red: more than the hours that person has.</small>` : '<p class="faint">Workload appears once there are people with tasks.</p>'}
      </section></div>`;
    $('[data-person]', v).onclick = () => editPerson({ color: COLORS[d.people.length % COLORS.length] });
    $$('[data-edit-person]', v).forEach((r) => { r.onclick = () => editPerson(person(r.dataset.editPerson)); r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); }; });
  }
  function editPerson(p) {
    BW.recordDrawer({ collection: 'people', rec: p, title: 'Person', newTitle: 'Add someone',
      fields: [{ k: 'name', label: 'Name', span: 2 }, { k: 'role', label: 'Role', ph: 'e.g. Designer, freelance' }, { k: 'hours', label: 'Hours a week for projects', type: 'number', ph: String(P.DEFAULT_WEEK) },
        { k: 'email', label: 'Email', type: 'email' }, { k: 'color', label: 'Colour', type: 'chips', html: true, options: COLORS.map((c) => [c, `<span class="swatch" style="display:inline-block;width:16px;height:16px;vertical-align:-3px;background:var(--${c})"></span>`]) }],
      deleteLabel: 'Remove', confirmDelete: 'Their tasks stay, without a name on them.',
      onClose: async () => { await load(); render(); } });
  }

  // ---------- risks and decisions ----------
  function log(v, x) {
    const risks = x.log.filter((r) => r.kind === 'risk').sort((a, b) => (a.state === 'closed') - (b.state === 'closed') || P.LEVELS.indexOf(P.riskLevel(b.likelihood, b.impact)) - P.LEVELS.indexOf(P.riskLevel(a.likelihood, a.impact)));
    const decisions = x.log.filter((r) => r.kind === 'decision');
    v.innerHTML = `<div class="cols">
      <section class="card panel"><h2>⚠️ Risks<span class="spacer"></span><button class="btn" data-risk>＋ Add a risk</button></h2>
        ${risks.length ? `<div class="list">${risks.map((r) => `<div class="row" data-entry="${r.id}" tabindex="0" style="${r.state === 'closed' ? 'opacity:.55' : ''}"><span class="lvl ${P.riskLevel(r.likelihood, r.impact)}">${P.riskLevel(r.likelihood, r.impact)}</span><span class="main"><b>${esc(r.title)}</b><small>${r.next ? 'Next step: ' + esc(r.next) : 'No next step yet'}${r.owner ? ' · ' + esc(r.owner) : ''}${r.state === 'closed' ? ' · closed' : ''}</small></span></div>`).join('')}</div>`
          : '<p class="faint">What could go wrong? Name it early, give it an owner and a next step. Tip: imagine the project failed, and ask why.</p>'}
      </section>
      <section class="card panel"><h2>🧭 Decisions<span class="spacer"></span><button class="btn" data-decision>＋ Note a decision</button></h2>
        ${decisions.length ? `<div class="list">${decisions.map((r) => `<div class="row" data-entry="${r.id}" tabindex="0"><span class="faint" style="white-space:nowrap">${BW.fmtDate(r.date, { day: 'numeric', month: 'short' })}</span><span class="main"><b>${esc(r.title)}</b>${r.text ? `<small>${esc(r.text)}</small>` : ''}</span></div>`).join('')}</div>`
          : '<p class="faint">Write down what was decided and why, so nobody has to remember (or argue) later.</p>'}
      </section></div>`;
    $('[data-risk]', v).onclick = () => editEntry({ kind: 'risk', projectId: x.p.id, date: BW.today(), likelihood: '2', impact: '2', state: 'open' });
    $('[data-decision]', v).onclick = () => editEntry({ kind: 'decision', projectId: x.p.id, date: BW.today() });
    $$('[data-entry]', v).forEach((r) => { r.onclick = () => editEntry(d.log.find((y) => y.id === r.dataset.entry)); r.onkeydown = (e) => { if (e.key === 'Enter') r.click(); }; });
  }
  function editEntry(r) {
    const scale = [['1', 'Low'], ['2', 'Medium'], ['3', 'High']];
    const fields = r.kind === 'risk'
      ? [{ k: 'title', label: 'What could go wrong?', span: 2, ph: 'e.g. The printer delivers late, so install day slips' }, { k: 'likelihood', label: 'How likely?', type: 'chips', options: scale }, { k: 'impact', label: 'How bad if it happens?', type: 'chips', options: scale },
        { k: 'next', label: 'Next step to prevent or soften it', span: 2 }, { k: 'owner', label: 'Who keeps an eye on it?' }, { k: 'state', label: 'State', type: 'chips', options: [['open', 'Open'], ['closed', 'Closed']] }]
      : [{ k: 'title', label: 'What was decided?', span: 2 }, { k: 'text', label: 'Why (and who decided)', type: 'textarea', span: 2 }, { k: 'date', label: 'Date', type: 'date' }];
    BW.recordDrawer({ collection: 'projectlog', rec: r, title: r.kind === 'risk' ? 'Risk' : 'Decision', fields, deleteLabel: 'Delete', onClose: async () => { await load(); render(); } });
  }

  // ---------- updates ----------
  function updates(v, x) {
    const list = x.log.filter((r) => r.kind === 'update');
    v.innerHTML = `<div class="row-flex" style="margin-bottom:16px"><button class="btn btn-primary" data-write>📣 Write this week’s update</button><span class="faint">Drafted from the plan: what got done, what is next, what is late or stuck.</span></div>
      <div class="list">${list.map((u) => `<article class="card update"><div class="row-flex"><b>${BW.fmtDate(u.date)}</b>${P.HEALTH[u.health] ? healthPill(u.health) : ''}<span class="spacer"></span><button class="btn btn-ghost" data-copy="${u.id}">📋 Copy</button></div><pre>${esc(u.text)}</pre></article>`).join('') || '<p class="faint">No updates yet. A short weekly update keeps your team and client calm, and takes a minute when it is drafted for you.</p>'}</div>`;
    $('[data-write]', v).onclick = () => writeUpdate(x);
    $$('[data-copy]', v).forEach((b) => b.onclick = async () => BW.toast(await BW.copy(d.log.find((u) => u.id === b.dataset.copy).text) ? 'Copied' : 'Could not copy', '📋'));
  }
  function writeUpdate(x) {
    const u = P.weekly(x, d);
    const box = BW.html(`<div><label class="field"><span>How is it going?</span><select class="in" data-h>${Object.entries(P.HEALTH).map(([k, h]) => `<option value="${k}" ${k === u.health ? 'selected' : ''}>${h.emoji} ${h.label}</option>`).join('')}</select></label>
      <label class="field" style="margin-top:12px"><span>The update (edit anything)</span><textarea class="in" rows="14" data-text>${esc(P.updateText(x, u, d.people))}</textarea></label></div>`);
    const mail = x.client && x.client.email;
    BW.modal({ title: '📣 This week’s update', body: box, wide: true, actions: [
      { label: '📋 Copy', kind: 'ghost', onClick: async () => { BW.toast(await BW.copy($('[data-text]', box).value) ? 'Copied' : 'Could not copy', '📋'); return false; } },
      ...(mail ? [{ label: '✉️ Email the client', kind: 'ghost', onClick: () => { BW.openUrl(`mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent(x.p.name + ': update')}&body=${encodeURIComponent($('[data-text]', box).value)}`); return false; } }] : []),
      { label: 'Save to updates', kind: 'primary', onClick: async () => { await save('projectlog', { kind: 'update', projectId: x.p.id, date: BW.today(), health: $('[data-h]', box).value, text: $('[data-text]', box).value }); BW.toast('Update saved', '📣'); } },
    ] });
    $('[data-h]', box).onchange = (e) => { const t = $('[data-text]', box); t.value = t.value.replace(/^(.*?): .*$/m, `$1: ${P.HEALTH[e.target.value].label.toLowerCase()}`); };
  }

  // ---------- new project, brief, milestones, export ----------
  function newProject(tplId) {
    let pick = tplId || 'client';
    const box = BW.html(`<div><div class="tpls" data-tpls>${P.TEMPLATES.map((t) => `<button type="button" class="tpl" data-t="${t.id}" aria-pressed="${t.id === pick}"><b>${t.emoji} ${esc(t.name)}</b><small>${esc(t.about)}</small></button>`).join('')}</div>
      <form data-form class="grid-2" style="margin-top:16px"><label class="field span-2"><span>Project name</span><input class="in" name="name" placeholder="e.g. Signage for Café Morgenrood" required></label>
      <label class="field"><span>Starts</span><input class="in" type="date" name="start" value="${BW.today()}"></label>
      <label class="field"><span>Client (optional)</span><select class="in" name="clientId"><option value="">No client</option>${d.clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label></form></div>`);
    $$('[data-t]', box).forEach((b) => b.onclick = () => { pick = b.dataset.t; $$('[data-t]', box).forEach((y) => y.setAttribute('aria-pressed', y === b)); });
    BW.modal({ title: '🗓️ New project', body: box, wide: true, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Create the plan', kind: 'primary', onClick: async () => {
      const f = $('[data-form]', box), name = f.name.value.trim();
      if (!name) { f.name.classList.add('shake'); f.name.focus(); return false; }
      const tpl = P.TEMPLATES.find((t) => t.id === pick);
      const plan = P.fromTemplate(tpl, f.start.value || BW.today(), { name, clientId: f.clientId.value, color: COLORS[d.projects.length % COLORS.length] });
      try {
        await BW.store.put('projects', plan.project);
        if (plan.milestones.length) await BW.store.putMany('milestones', plan.milestones);
        if (plan.tasks.length) await BW.store.putMany('tasks', plan.tasks);
      } catch (e) { BW.error(e); return false; }
      await load(); current = plan.project.id; tab = tpl.tasks.length ? 'timeline' : 'overview'; render();
      BW.toast(tpl.tasks.length ? 'Your plan is ready. Drag anything to fit your dates.' : 'Project made. Add milestones and tasks.', '🗓️');
    } }] });
  }

  function editBrief(p) {
    BW.recordDrawer({ collection: 'projects', rec: p, title: 'Brief',
      fields: [
        { k: 'name', label: 'Project name', span: 2 }, { k: 'emoji', label: 'Emoji', ph: '📁' },
        { k: 'clientId', label: 'Client', type: 'select', options: [['', 'No client']].concat(d.clients.map((c) => [c.id, c.name])) },
        { k: 'goal', label: 'Goal: what is this project for?', type: 'textarea', span: 2 },
        { k: 'doneMeans', label: 'Done means…', type: 'textarea', span: 2, ph: 'e.g. Signs installed, Sam has signed off, invoice sent' },
        { k: 'start', label: 'Start', type: 'date' }, { k: 'due', label: 'Deadline', type: 'date' },
        { k: 'budgetHours', label: 'Time budget (hours)', type: 'number', hint: 'What it is worth to you, not what it will take. Cut scope to fit.' },
        { k: 'ownerId', label: 'Owner', type: 'select', options: [['', 'Nobody yet']].concat(d.people.map((x) => [x.id, x.name])) },
        { k: 'status', label: 'Status', type: 'chips', options: [['active', 'Active'], ['paused', 'Paused'], ['done', 'Finished']] },
        { k: 'health', label: 'Health', type: 'chips', options: [['', 'Work it out'], ['green', '🟢 On track'], ['amber', '🟠 At risk'], ['red', '🔴 Off track']] },
      ],
      deleteLabel: 'Delete project', confirmDelete: 'This deletes the project with its milestones, tasks, risks, decisions and updates.',
      onClose: async (r) => {
        if (r.deleted) {
          for (const n of ['tasks', 'milestones', 'projectlog']) await BW.store.removeWhere(n, (y) => y.projectId === r.id);
          current = null;
        }
        await load(); render();
      } });
  }

  function editMilestone(m) {
    BW.recordDrawer({ collection: 'milestones', rec: m, title: 'Milestone', fields: [{ k: 'title', label: 'Milestone', span: 2 }, { k: 'due', label: 'Date', type: 'date' }, { k: 'done', label: 'Reached?', type: 'chips', options: [['false', 'Not yet'], ['true', '◆ Yes']] }],
      deleteLabel: 'Delete milestone', confirmDelete: 'Its tasks stay, no longer linked to it.',
      onClose: async () => {
        // The chips give text; milestones store a yes/no.
        const fresh = await BW.store.get('milestones', m.id);
        if (fresh && typeof fresh.done !== 'boolean') { fresh.done = fresh.done === 'true'; await BW.store.put('milestones', fresh); }
        await load(); render();
      } });
  }

  function exportMenu(x) {
    BW.modal({ title: '⬇️ Export', body: '<p>Take the plan elsewhere: milestones and due dates into your calendar, or every task into a spreadsheet.</p>', actions: [
      { label: '📅 Calendar (.ics)', kind: 'ghost', onClick: () => { BW.download(new Blob([P.ics(x)], { type: 'text/calendar' }), BW.fileSafe(x.p.name) + '.ics'); BW.toast('Open the file to add it to your calendar', '📅'); } },
      { label: '📄 Spreadsheet (.csv)', kind: 'primary', onClick: () => BW.exportCsv(BW.fileSafe(x.p.name) + '.csv', ['Task', 'Status', 'Milestone', 'Who', 'Start', 'Due', 'Hours', 'Waits for'],
        x.tasks.map((t) => [t.title, P.STATUS[t.status || 'todo'], (x.milestones.find((m) => m.id === t.milestoneId) || {}).title || '', (person(t.assigneeId) || {}).name || '', P.startOf(t), P.endOf(t), t.hours || '', (t.after || []).map((id) => (x.tasks.find((y) => y.id === id) || {}).title).filter(Boolean).join('; ')])) },
    ] });
  }

  // ---------- Olaf ----------
  function olafCard(x) {
    const full = olaf === 'full' || olaf === 'locked';
    const href = full || olaf === 'demo' ? `../olaf/index.html${x && full ? '#projects/' + x.p.id : ''}` : BW.olafPage();
    return `<a class="card olaf-card" href="${href}" ${full || olaf === 'demo' ? '' : 'target="_blank" rel="noopener"'} style="text-decoration:none;color:inherit"><span class="e">🧭</span>
      <div><b>${full ? (x ? 'Ask Olaf to run this project with you' : 'Olaf runs your projects with you') : 'Let Olaf run your projects with you'}</b><br>
      <small>${full ? 'A weekly check-in that reads the plan, spots what slips, drafts the update and re-plans with you.' : 'Olaf, the AI expert in the paid edition: a kick-off that writes the plan, a weekly check-in, a recovery plan when it slips, updates for your client.'}</small></div>
      <span class="btn ${full ? 'btn-primary' : ''}">${full ? 'Open Olaf →' : olaf === 'demo' ? 'See the demo →' : 'Meet Olaf →'}</span></a>`;
  }

  async function save(collection, rec) {
    try { await BW.store.put(collection, rec); } catch (e) { return BW.error(e); }
    await load(); render();
  }
})();
