/* Project Board: one board per project, four columns, drag cards along. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const main = $('#main');
  const COLS = [['todo', '📝 To do', 'var(--sky)'], ['doing', '🔨 Doing', 'var(--sun)'], ['waiting', '⏳ Waiting on someone', 'var(--pink)'], ['done', '🎉 Done', 'var(--mint)']];
  const COLORS = ['teal', 'sky', 'grape', 'pink', 'tomato', 'sun', 'mint'];
  let projects = [], tasks = [], clients = [], current = null; // null = every project
  let dragging = null, find = '';

  BW.boot({
    app: 'board',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => { const i = $('[data-add="todo"] input', main); if (i) i.focus(); }, open: (id) => { const t = tasks.find((x) => x.id === id); if (t) editTask(t); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap') && !dragging && !(document.activeElement && document.activeElement.matches('.add-card input'))) render(); },
  });

  BW.shortcut('n', 'New card', () => { const i = $('[data-add="todo"] input', main); if (i) i.focus(); });
  BW.shortcut('/', 'Filter cards', () => { const i = $('[data-find]', main); if (i) i.focus(); });

  async function load() {
    [projects, tasks, clients] = await Promise.all(['projects', 'tasks', 'clients'].map((n) => BW.store.all(n)));
    if (current && !projects.some((p) => p.id === current)) current = null;
  }

  const projectOf = (t) => projects.find((p) => p.id === t.projectId);
  const shown = () => tasks.filter((t) => (!current || t.projectId === current) && (!find || (t.title + ' ' + (t.notes || '')).toLowerCase().includes(find.toLowerCase())));

  function render() {
    const list = shown();
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🗂️</span> Project Board</h1><p class="lead">Drag your to-dos from “ugh” to “done”.</p></div>
        <div class="spacer"></div>
        <button class="btn btn-primary btn-big" data-newp><span class="emo">＋</span> New project</button>
      </div>
      <div class="projects">
        <button class="p" data-p="" aria-pressed="${!current}">🌈 Everything <span class="n">${tasks.filter((t) => t.status !== 'done').length}</span></button>
        ${projects.map((p) => `<button class="p" data-p="${p.id}" aria-pressed="${current === p.id}" style="--pc:var(--${p.color || 'teal'})">${esc(p.emoji || '📁')} ${esc(p.name)} <span class="n">${tasks.filter((t) => t.projectId === p.id && t.status !== 'done').length}</span></button>`).join('')}
        ${current ? '<button class="btn btn-ghost" data-editp>✏️ Edit project</button>' : ''}
        ${tasks.length ? `<label class="search" style="margin-left:auto;min-width:200px"><input class="in" type="search" data-find placeholder="Filter cards…" value="${esc(find)}" aria-label="Filter cards"></label>` : ''}
      </div>
      ${!projects.length && !tasks.length ? `<div class="card empty rise" style="margin-bottom:50px"><div class="big">🗂️</div><h2>A fresh, empty board</h2><p>Make a project for each job or client. Then add cards for every little thing that needs doing.</p><button class="btn btn-primary btn-big" data-newp>＋ Make my first project</button></div>` : `
      <div class="board">${COLS.map(([k, label, color]) => {
        const cards = list.filter((t) => (t.status || 'todo') === k).sort((a, b) => (a.order || 0) - (b.order || 0));
        return `<section class="col" data-col="${k}" style="--cc:${color}">
          <div class="col-h"><span>${label}</span><span class="row-flex" style="gap:6px">${k === 'done' && cards.length ? '<button class="link" data-clear style="font-size:.8rem">Clear</button>' : ''}<span class="count">${cards.length}</span></span></div>
          <div class="cards">${cards.map(card).join('')}</div>
          ${k !== 'done' ? `<form class="add-card" data-add="${k}"><input placeholder="＋ Add a card" aria-label="Add a card to ${label.replace(/^\S+\s/, '')}"></form>` : ''}
        </section>`;
      }).join('')}</div>`}`;

    $$('[data-p]', main).forEach((b) => b.onclick = () => { current = b.dataset.p || null; render(); });
    $$('[data-newp]', main).forEach((b) => b.onclick = () => editProject({ color: COLORS[projects.length % COLORS.length], emoji: '📁' }));
    const ep = $('[data-editp]', main); if (ep) ep.onclick = () => editProject(projects.find((p) => p.id === current));
    $$('[data-add]', main).forEach((f) => f.onsubmit = (e) => { e.preventDefault(); addCard(f.dataset.add, $('input', f)); });
    const fi = $('[data-find]', main);
    if (fi) fi.oninput = BW.debounce(() => { find = fi.value; render(); const n = $('[data-find]', main); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150);
    const cl = $('[data-clear]', main); if (cl) cl.onclick = clearDone;
    $$('.tcard', main).forEach((c) => {
      c.onclick = () => editTask(tasks.find((t) => t.id === c.dataset.id));
      c.onkeydown = (e) => { if (e.key === 'Enter') c.click(); };
      c.ondragstart = (e) => { dragging = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', dragging); };
      c.ondragend = () => { dragging = null; c.classList.remove('dragging'); $$('.drop-line', main).forEach((l) => l.remove()); $$('.col', main).forEach((x) => x.classList.remove('over')); };
    });
    $$('.col', main).forEach((col) => {
      col.ondragover = (e) => {
        if (!dragging) return;
        e.preventDefault();
        col.classList.add('over');
        $$('.drop-line', main).forEach((l) => l.remove());
        const before = beforeCard(col, e.clientY);
        const line = document.createElement('div'); line.className = 'drop-line';
        const box = $('.cards', col);
        if (before) box.insertBefore(line, before); else box.append(line);
      };
      col.ondragleave = (e) => { if (!col.contains(e.relatedTarget)) { col.classList.remove('over'); $$('.drop-line', col).forEach((l) => l.remove()); } };
      col.ondrop = (e) => { e.preventDefault(); if (dragging) move(dragging, col.dataset.col, beforeCard(col, e.clientY), e); };
    });
  }

  function card(t) {
    const p = projectOf(t), late = t.due && t.due < BW.today() && t.status !== 'done';
    return `<article class="tcard ${t.status === 'done' ? 'done' : ''}" draggable="true" data-id="${t.id}" tabindex="0">
      <b>${t.hot ? '🔥 ' : ''}${esc(t.title)}</b>
      <div class="meta">${!current && p ? `<span>${esc(p.emoji || '📁')} ${esc(p.name)}</span>` : ''}${(t.checklist || []).length ? `<span class="${t.checklist.every((c) => c.done) ? 'all' : ''}">☑ ${t.checklist.filter((c) => c.done).length}/${t.checklist.length}</span>` : ''}${t.due ? `<span class="${late ? 'late' : ''}">📅 ${BW.fmtDate(t.due, { day: 'numeric', month: 'short' })}</span>` : ''}${t.notes ? '<span>📝</span>' : ''}</div>
    </article>`;
  }

  const beforeCard = (col, y) => $$('.tcard:not(.dragging)', col).find((c) => { const r = c.getBoundingClientRect(); return y < r.top + r.height / 2; }) || null;

  async function move(id, status, before, e) {
    const t = tasks.find((x) => x.id === id);
    const siblings = shown().filter((x) => (x.status || 'todo') === status && x.id !== id).sort((a, b) => (a.order || 0) - (b.order || 0));
    const at = before ? siblings.findIndex((x) => x.id === before.dataset.id) : siblings.length;
    siblings.splice(at < 0 ? siblings.length : at, 0, t);
    siblings.forEach((x, i) => { x.order = i; });
    const wasDone = t.status === 'done';
    t.status = status;
    dragging = null;
    try { await BW.store.putMany('tasks', siblings); } catch (err) { return BW.error(err); }
    render();
    if (status === 'done' && !wasDone) { BW.confetti({ x: e.clientX, y: e.clientY }); BW.toast(['Boom. Done!', 'Look at you go!', 'One less thing!', 'Crushed it!'][Math.floor(Math.random() * 4)], '🎉'); }
  }

  async function addCard(status, input) {
    const title = input.value.trim(); if (!title) return;
    let projectId = current;
    if (!projectId) {
      if (!projects.length) { const p = { name: 'My first project', emoji: '📁', color: 'teal' }; await BW.store.put('projects', p); projects.push(p); }
      projectId = projects[0].id;
    }
    const order = Math.max(-1, ...tasks.filter((t) => t.status === status).map((t) => t.order || 0)) + 1;
    try { await BW.store.put('tasks', { title, status, projectId, order }); } catch (e) { return BW.error(e); }
    await load(); render();
    const again = $(`[data-add="${status}"] input`, main); if (again) again.focus();
  }

  // Done cards leave the board in one go; Undo puts them all back.
  async function clearDone() {
    const done = shown().filter((t) => t.status === 'done');
    for (const t of done) await BW.store.remove('tasks', t.id);
    await load(); render();
    BW.toast(`${done.length} done card${done.length === 1 ? '' : 's'} cleared`, '🧹', { label: 'Undo', run: async () => { await BW.store.putMany('tasks', done); await load(); render(); } });
  }

  function editTask(t) {
    const p = projects.find((x) => x.id === t.projectId) || {};
    BW.recordDrawer({
      collection: 'tasks', rec: t, title: 'Card',
      top: (r) => `<div class="row-flex" style="margin-bottom:14px"><a class="btn" href="../time/index.html#track/${encodeURIComponent((r.title || 'Task') + '|' + (p.clientId || ''))}">⏱️ Track time on this</a></div>`,
      bottom: (r) => `<div class="field" style="margin-top:16px"><span>☑ Checklist</span>
        <div class="checklist-edit" data-check>${(r.checklist || []).map((c) => `<label data-cid="${c.id}"><input type="checkbox" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span><button type="button" class="icon-btn" data-rmc aria-label="Remove">✕</button></label>`).join('')}</div>
        <form data-addc class="row-flex" style="margin-top:8px"><input class="in" placeholder="Add a step and press Enter" style="flex:1" aria-label="Add a checklist step"></form></div>`,
      bind: (box, r, save) => {
        const wrap = $('[data-check]', box);
        const redraw = () => { wrap.innerHTML = (r.checklist || []).map((c) => `<label data-cid="${c.id}"><input type="checkbox" ${c.done ? 'checked' : ''}><span>${esc(c.text)}</span><button type="button" class="icon-btn" data-rmc aria-label="Remove">✕</button></label>`).join(''); };
        $('[data-addc]', box).onsubmit = (e) => {
          e.preventDefault(); const i = $('input', e.target); if (!i.value.trim()) return;
          r.checklist = (r.checklist || []).concat({ id: BW.uid(), text: i.value.trim(), done: false }); i.value = ''; redraw(); save();
        };
        wrap.onclick = (e) => {
          const lab = e.target.closest('[data-cid]'); if (!lab) return;
          const item = r.checklist.find((c) => c.id === lab.dataset.cid);
          if (e.target.closest('[data-rmc]')) { e.preventDefault(); r.checklist = r.checklist.filter((c) => c !== item); redraw(); save(); return; }
          if (e.target.type === 'checkbox') {
            item.done = e.target.checked; save();
            if (r.checklist.every((c) => c.done)) BW.toast('Every step done! Drag it to Done?', '🎉');
          }
        };
      },
      fields: [
        { k: 'title', label: 'What needs doing?', span: 2 },
        { k: 'status', label: 'Where is it at?', type: 'chips', options: COLS.map(([k, l]) => [k, l]) },
        { k: 'projectId', label: 'Project', type: 'select', options: projects.map((p) => [p.id, `${p.emoji || '📁'} ${p.name}`]) },
        { k: 'due', label: 'Due date', type: 'date' },
        { k: 'hot', label: 'Urgent?', type: 'chips', options: [['', 'Not really'], ['1', '🔥 Yes!']] },
        { k: 'notes', label: 'Notes', type: 'textarea', span: 2, ph: 'Links, details, the thing you’ll otherwise forget…' },
      ],
      deleteLabel: 'Delete card',
      onClose: async () => { await load(); render(); },
    });
  }

  function editProject(p) {
    BW.recordDrawer({
      collection: 'projects', rec: p, title: 'Project', newTitle: 'New project',
      fields: [
        { k: 'name', label: 'Project name', ph: 'e.g. Website for De Gouden Korst', span: 2 },
        { k: 'emoji', label: 'An emoji for it', ph: '📁' },
        { k: 'clientId', label: 'Client', type: 'select', options: [['', 'No client']].concat(clients.map((c) => [c.id, c.name])) },
        { k: 'color', label: 'Colour', type: 'chips', html: true, options: COLORS.map((c) => [c, `<span class="swatch" style="display:inline-block;width:16px;height:16px;vertical-align:-3px;background:var(--${c})"></span>`]) },
      ],
      deleteLabel: 'Delete project',
      confirmDelete: 'This also deletes every card in this project.',
      onSaved: (r, isNew) => { if (isNew) current = r.id; },
      onClose: async (r) => {
        if (r.deleted) { const gone = tasks.filter((t) => t.projectId === r.id); for (const t of gone) await BW.store.remove('tasks', t.id); current = null; }
        await load(); render();
      },
    });
  }
})();
