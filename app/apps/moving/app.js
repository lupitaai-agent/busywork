/* Moving Planner: a checklist worked back from the moving day, and everyone to tell, including every
   contract in Contracts & Renewals (with a change-of-address letter one click away). */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let moves = [], contracts = [], openId = '';

  BW.boot({
    app: 'moving',
    onReady: async () => { await load(); render(); BW.route({ new: () => plan(), open: (id) => { openId = id; render(); } }); },
    onChange: async () => { await load(); if (!$('.modal-wrap')) render(); },
  });
  async function load() { [moves, contracts] = await Promise.all(['moves', 'contracts'].map((n) => BW.store.all(n))); }
  const current = () => moves.find((m) => m.id === openId) || moves.filter((m) => !m.finished).sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

  function render() {
    const m = current();
    if (!m) {
      main.innerHTML = `<div class="page-head"><div><h1><span class="title-emo">🚚</span> Moving Planner</h1><p class="lead">Everything to do before and after the move, and everyone to tell.</p></div></div>
        <div class="card empty rise"><div class="big">🚚</div><h2>Moving soon?</h2><p>Give Busy the date and it makes a checklist worked back from moving day: notice, movers, packing, meters, post. Plus everyone to tell, with your contracts already on the list.</p>
          <button class="btn btn-primary btn-big" data-new>🚚 Plan my move</button></div>
        ${past()}`;
      $('[data-new]', main).onclick = () => plan();
      bindPast();
      return;
    }
    const today = BW.today(), left = m.date ? H.days(today, m.date) : null;
    const tasks = (m.tasks || []).slice().sort((a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999')));
    const doneN = tasks.filter((t) => t.done).length + (m.tell || []).filter((t) => t.done).length, all = tasks.length + (m.tell || []).length;
    const phase = (t) => (!m.date || !t.due ? 'before' : t.due < m.date ? 'before' : t.due === m.date ? 'day' : 'after');
    const sec = (key, title) => { const l = tasks.filter((t) => phase(t) === key); return l.length ? `<div class="month-h"><span>${title}</span><small class="faint">${l.filter((t) => t.done).length} of ${l.length}</small></div><div class="check-list">${l.map((t) => item(t, today)).join('')}</div>` : ''; };
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🚚</span> Moving Planner</h1><p class="lead">${esc([m.from, m.to].filter(Boolean).join(' → ')) || 'Your move'}</p></div>
        <div class="spacer"></div>
        <div class="row-flex"><button class="btn" data-pdf><span class="emo">🖨️</span> Print the checklist</button><button class="btn" data-edit><span class="emo">✏️</span> Details</button><button class="btn btn-primary" data-finish><span class="emo">🏁</span> We’ve moved in</button></div>
      </div>
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--teal)"><div class="k">📅 Moving day</div><div class="countdown">${left == null ? '?' : left > 0 ? left : left === 0 ? 'Today!' : 'Done'}</div><div class="s">${m.date ? (left > 0 ? `days to go, ${BW.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}` : BW.fmtDate(m.date)) : 'Set the date in Details'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">✅ Done</div><div class="v">${doneN} of ${all}</div><div class="s"><span class="bar" style="display:block;height:8px;border-radius:9px;background:var(--hair);margin-top:6px"><i style="display:block;height:100%;border-radius:9px;background:var(--app);width:${all ? doneN / all * 100 : 0}%"></i></span></div></div>
      </div>
      <div class="two" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;align-items:start">
        <section>${sec('before', '📦 Before the move')}${sec('day', '🚚 On the day')}${sec('after', '🏡 After the move')}
          <form class="row-flex" data-add style="margin-top:12px"><input class="in" data-task placeholder="Add your own task" style="flex:1"><input class="in" type="date" data-due style="width:auto"><button class="btn">＋</button></form></section>
        <section><div class="month-h"><span>📣 Who to tell</span><small class="faint">${(m.tell || []).filter((t) => t.done).length} of ${(m.tell || []).length}</small></div>
          <div class="check-list">${(m.tell || []).map((t, i) => `<label class="check-item ${t.done ? 'done' : ''}"><input type="checkbox" data-tell="${i}" ${t.done ? 'checked' : ''}><span class="main">${esc(t.who)}</span>${t.contractId ? `<a class="btn" href="../letters/index.html#new/move/${t.contractId}" title="Write the change-of-address letter">✉️</a>` : ''}</label>`).join('')}</div>
          <form class="row-flex" data-add-tell style="margin-top:12px"><input class="in" data-who placeholder="Someone else to tell" style="flex:1"><button class="btn">＋</button></form>
          <p class="faint" style="margin-top:12px">✉️ writes a change-of-address letter with your details and the contract filled in. Change your address in Your household (⚙️) first.</p></section>
      </div>
      ${past()}<div style="height:40px"></div>`;
    const save = async () => { try { await BW.store.put('moves', m); } catch (e) { BW.error(e); } };
    $$('[data-task-id]', main).forEach((c) => c.onchange = async () => { const t = m.tasks.find((x) => x.id === c.dataset.taskId); t.done = c.checked; await save(); render(); });
    $$('[data-tell]', main).forEach((c) => c.onchange = async () => { m.tell[Number(c.dataset.tell)].done = c.checked; await save(); render(); });
    $('[data-add]', main).onsubmit = async (e) => { e.preventDefault(); const v = $('[data-task]', main).value.trim(); if (!v) return; m.tasks.push({ id: BW.uid(), task: v, due: $('[data-due]', main).value || '', done: false }); await save(); render(); };
    $('[data-add-tell]', main).onsubmit = async (e) => { e.preventDefault(); const v = $('[data-who]', main).value.trim(); if (!v) return; m.tell.push({ who: v, done: false }); await save(); render(); };
    $('[data-edit]', main).onclick = () => plan(m);
    $('[data-finish]', main).onclick = async () => { if (!(await BW.confirm('Mark this move as done? The checklist stays under Earlier moves.', { ok: 'We’ve moved in' }))) return; m.finished = true; await save(); openId = ''; BW.confetti && BW.confetti(); render(); };
    $('[data-pdf]', main).onclick = () => {
      const lines = [`# Moving ${m.date ? BW.fmtDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`, [m.from, m.to].filter(Boolean).join(' → '), '', '# To do', ''];
      tasks.forEach((t) => lines.push(`- ${t.done ? '✓ ' : '☐ '}${t.task}${t.due ? ` (${BW.fmtDate(t.due)})` : ''}`));
      lines.push('', '# Who to tell', ''); (m.tell || []).forEach((t) => lines.push(`- ${t.done ? '✓ ' : '☐ '}${t.who}`));
      H.savePdf('Home', `Moving checklist ${m.date || ''}`, H.pdf('Moving checklist', lines.join('\n'))).catch(BW.error);
    };
    bindPast();
  }
  function item(t, today) {
    const late = !t.done && t.due && t.due < today;
    return `<label class="check-item ${t.done ? 'done' : ''}"><input type="checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}><span class="main">${esc(t.task)}</span>${t.due ? `<small ${late ? 'style="color:var(--tomato);font-weight:800"' : ''}>${BW.fmtDate(t.due, { day: 'numeric', month: 'short' })}</small>` : ''}</label>`;
  }
  function past() {
    const done = moves.filter((m) => m.finished || m.id !== (current() || {}).id).filter((m) => m.finished);
    return done.length ? `<div class="month-h" style="margin-top:30px"><span>Earlier moves</span></div><div class="list">${done.map((m) => `<div class="row" data-past="${m.id}" tabindex="0"><span class="icon-big">🏁</span><span class="main"><b>${esc([m.from, m.to].filter(Boolean).join(' → ') || 'A move')}</b><small>${m.date ? BW.fmtDate(m.date) : ''}</small></span></div>`).join('')}</div>` : '';
  }
  function bindPast() { $$('[data-past]', main).forEach((r) => r.onclick = () => { openId = r.dataset.past; render(); }); }

  // A new move, or the details of this one.
  function plan(m) {
    const s = BW.settings, isNew = !m;
    const box = BW.html(`<div class="grid-2">
      <label class="field span-2"><span>Moving day</span><input class="in" type="date" data-date value="${esc(m ? m.date : '')}"></label>
      <label class="field"><span>From</span><input class="in" data-from placeholder="e.g. Oudegracht 1, Utrecht" value="${esc(m ? m.from : [s.address, s.city].filter(Boolean).join(', '))}"></label>
      <label class="field"><span>To</span><input class="in" data-to placeholder="e.g. Lindenlaan 8, Zeist" value="${esc(m ? m.to : '')}"></label></div>`);
    BW.modal({ title: isNew ? '🚚 Plan a move' : '✏️ The move', body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: isNew ? 'Make my checklist' : 'Save', kind: 'primary', onClick: async () => {
      const date = $('[data-date]', box).value;
      if (!date) { BW.toast('When is moving day?', '📅'); return false; }
      const rec = m || {};
      const moved = m && m.date !== date;
      Object.assign(rec, { date, from: $('[data-from]', box).value.trim(), to: $('[data-to]', box).value.trim() });
      if (isNew) {
        rec.tasks = H.moveTasks(rec);
        const live = contracts.filter((c) => !c.cancelledAt);
        rec.tell = H.WHO_TO_TELL.map((who) => ({ who, done: false })).concat(live.map((c) => ({ who: `${c.name || c.provider}${c.provider && c.provider !== c.name ? ' (' + c.provider + ')' : ''}`, contractId: c.id, done: false })));
      } else if (moved) {
        // A new date moves the standard tasks with it; your own keep their dates.
        const fresh = H.moveTasks(rec);
        rec.tasks.forEach((t) => { const f = fresh.find((x) => x.id === t.id); if (f) t.due = f.due; });
      }
      try { await BW.store.put('moves', rec); } catch (e) { BW.error(e); return false; }
      openId = rec.id; await load(); render();
      if (isNew) BW.toast('Your checklist is ready. Tick things off as you go.', '🚚');
    } }] });
  }
})();
