/* Home Upkeep: the jobs a home needs now and then (the boiler service, smoke alarms, gutters), when
   each is due, and a log of when it was done, by whom and what it cost. */
(function () {
  'use strict';
  const { $, $$, esc } = BW;
  const H = BW.house;
  const main = $('#main');
  let jobs = [], area = '';

  BW.boot({
    app: 'upkeep',
    onReady: async () => {
      await load(); render();
      BW.route({ new: () => edit({ area: 'other', every: 12 }), starter: () => starter(), open: (id) => { const x = jobs.find((j) => j.id === id); if (x) edit(x); } });
    },
    onChange: async () => { await load(); if (!$('.drawer-wrap, .modal-wrap')) render(); },
  });
  BW.shortcut('n', 'Add an upkeep job', () => edit({ area: area || 'other', every: 12 }));
  async function load() { jobs = await BW.store.all('upkeep'); }
  const everyText = (n) => { n = BW.num(n) || 12; return n === 1 ? 'every month' : n === 12 ? 'every year' : n % 12 === 0 ? `every ${n / 12} years` : `every ${n} months`; };

  function render() {
    const today = BW.today(), year = today.slice(0, 4);
    const shown = jobs.filter((j) => !area || j.area === area).map((j) => [j, H.nextDue(j, today)]).sort((a, b) => a[1].localeCompare(b[1]));
    const overdue = jobs.filter((j) => H.jobState(j, today) === 'overdue').length, soon = jobs.filter((j) => H.jobState(j, today) === 'soon').length;
    const spent = jobs.reduce((s, j) => s + (j.log || []).filter((l) => String(l.date || '').startsWith(year)).reduce((a, l) => a + BW.num(l.cost), 0), 0);
    const counts = {}; jobs.forEach((j) => { counts[j.area || 'other'] = (counts[j.area || 'other'] || 0) + 1; });
    main.innerHTML = `
      <div class="page-head">
        <div><h1><span class="title-emo">🛠️</span> Home Upkeep</h1><p class="lead">What your home needs now and then, and when it was last done.</p></div>
        <div class="spacer"></div>
        <div class="row-flex"><button class="btn" data-starter><span class="emo">📋</span> Pick from a list</button><button class="btn btn-primary btn-big" data-new><span class="emo">＋</span> Add a job</button></div>
      </div>
      ${jobs.length ? `
      <div class="stats rise">
        <div class="card stat" style="--tint:var(--tomato)"><div class="k">⏰ Overdue</div><div class="v">${overdue}</div><div class="s">${overdue ? 'Worth a look this week' : 'All on schedule'}</div></div>
        <div class="card stat" style="--tint:var(--sun)"><div class="k">📅 Due in 30 days</div><div class="v">${soon}</div><div class="s">${soon ? 'Book the ones that need a pro' : 'A quiet month'}</div></div>
        <div class="card stat" style="--tint:var(--mint)"><div class="k">💶 Spent in ${year}</div><div class="v">${BW.money(spent)}</div><div class="s">From the costs you logged</div></div>
      </div>
      <div class="filters" data-area style="margin-bottom:18px"><button type="button" data-v="" aria-pressed="${!area}">All</button>${H.AREAS.filter((a) => counts[a[0]]).map((a) => `<button type="button" data-v="${a[0]}" aria-pressed="${area === a[0]}">${a[1]}<small>${counts[a[0]]}</small></button>`).join('')}</div>
      <div class="list rise">${shown.map(([j, due]) => row(j, due, today)).join('')}</div>
      <div style="height:40px"></div>`
      : `<div class="card empty rise"><div class="big">🛠️</div><h2>A home that looks after itself (almost)</h2>
          <p>The boiler service, the smoke alarms, the gutters, the car. Start from a ready-made list and tell Busy when you last did each one. It tells you when they’re due again.</p>
          <div class="row-flex" style="justify-content:center"><button class="btn btn-primary btn-big" data-starter>📋 Pick from a list</button><button class="btn" data-new>＋ Add my own</button></div></div>`}`;
    $$('[data-new]', main).forEach((b) => b.onclick = () => edit({ area: area || 'other', every: 12 }));
    $$('[data-starter]', main).forEach((b) => b.onclick = starter);
    const fa = $('[data-area]', main); if (fa) fa.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { area = b.dataset.v; render(); } };
    $$('.row[data-id]', main).forEach((r) => { r.onclick = (e) => { if (!e.target.closest('[data-done]')) edit(jobs.find((j) => j.id === r.dataset.id)); }; r.onkeydown = (e) => { if (e.key === 'Enter' && e.target === r) r.onclick(e); }; });
    $$('[data-done]', main).forEach((b) => b.onclick = () => done(jobs.find((j) => j.id === b.dataset.done)));
  }
  function row(j, due, today) {
    const left = H.days(today, due), st = H.jobState(j, today);
    const sub = [everyText(j.every), j.last ? `last done ${BW.fmtDate(j.last)}` : 'not done yet', j.who].filter(Boolean).join(' · ');
    return `<div class="row" data-id="${j.id}" tabindex="0"><span class="icon-big">${H.area(j.area).split(' ')[0]}</span>
      <span class="main"><b>${esc(j.task || 'A job')}</b><small>${esc(sub)}</small></span>
      <span class="due ${st === 'overdue' ? 'late' : st}">${st === 'overdue' ? 'Overdue' : left === 0 ? 'Due today' : 'Due ' + H.when(left)}</span>
      <button class="btn" data-done="${j.id}">✓ Done</button></div>`;
  }

  // Logs a job as done: when, a note, what it cost.
  function done(j) {
    const box = BW.html(`<div class="grid-2">
      <label class="field"><span>Done on</span><input class="in" type="date" data-d value="${BW.today()}"></label>
      <label class="field"><span>What it cost</span><input class="in" inputmode="decimal" data-c placeholder="0.00"></label>
      <label class="field span-2"><span>A note (optional)</span><input class="in" data-n placeholder="e.g. New filter fitted, all fine"></label></div>`);
    BW.modal({ title: `✓ ${esc(j.task || 'Job')}`, body: box, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Log it', kind: 'primary', onClick: async () => {
      const date = $('[data-d]', box).value || BW.today();
      try { await BW.store.put('upkeep', H.markDone(j, date, $('[data-n]', box).value.trim(), $('[data-c]', box).value.trim())); } catch (e) { BW.error(e); return false; }
      BW.toast(`Logged. Next time: ${BW.fmtDate(H.nextDue(H.markDone(j, date), BW.today()))}`, '🛠️');
      await load(); render();
    } }] });
  }

  function starter() {
    const have = new Set(jobs.map((j) => String(j.task).toLowerCase()));
    const list = H.STARTER.filter(([t]) => !have.has(t.toLowerCase()));
    if (!list.length) return BW.toast('You have every job from the list already.', '📋');
    const box = BW.html(`<div><p style="margin-bottom:12px">Tick what fits your home. You can say when you last did each one afterwards.</p>
      <div class="check-list">${list.map(([t, a, n, tip], i) => `<label class="check-item"><input type="checkbox" data-i="${i}" ${a === 'car' || /chimney/i.test(t) ? '' : 'checked'}><span class="main"><b>${esc(t)}</b>${tip ? `<br><small>${esc(tip)}</small>` : ''}</span><small>${everyText(n)}</small></label>`).join('')}</div></div>`);
    BW.modal({ title: '📋 Pick from a list', body: box, wide: true, actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Add these', kind: 'primary', onClick: async () => {
      const pick = $$('[data-i]', box).filter((c) => c.checked).map((c) => list[Number(c.dataset.i)]);
      if (!pick.length) return;
      try { await BW.store.putMany('upkeep', pick.map(([task, a, every, notes]) => ({ task, area: a, every, notes, log: [] }))); } catch (e) { BW.error(e); return false; }
      BW.toast(`${pick.length} job${pick.length === 1 ? '' : 's'} added. Open one to say when you last did it.`, '🛠️');
      await load(); render();
    } }] });
  }

  function edit(j) {
    BW.recordDrawer({
      collection: 'upkeep', rec: Object.assign({ log: [] }, j), title: 'Upkeep job', newTitle: 'Add a job',
      fields: [
        { k: 'task', label: 'The job', ph: 'e.g. Service the boiler', span: 2, required: true },
        { k: 'area', label: 'Where', type: 'chips', options: H.AREAS },
        { k: 'every', label: 'How often', type: 'chips', options: [[1, 'Monthly'], [3, 'Every 3 months'], [6, 'Twice a year'], [12, 'Yearly'], [24, 'Every 2 years'], [60, 'Every 5 years']] },
        { k: 'last', label: 'Last done on', type: 'date' },
        { k: 'next', label: 'Next time on (optional)', type: 'date', hint: 'Booked already? Set the date and it wins over “how often”.' },
        { k: 'who', label: 'Who does it?', ph: 'e.g. Me, the heating company, the garage' },
        { k: 'notes', label: 'Notes', type: 'textarea', ph: 'Phone number, what to ask for, model numbers', span: 2 },
      ],
      isComplete: (r) => !!r.task,
      bottom: (r) => (r.log || []).length ? `<h3 style="margin:18px 0 8px">📜 Done before</h3><div class="list">${r.log.map((l) => `<div class="file-row"><span>✓</span><span class="main">${BW.fmtDate(l.date)}${l.note ? ' · ' + esc(l.note) : ''}</span>${l.cost !== '' && l.cost != null ? `<b>${BW.money(BW.num(l.cost))}</b>` : ''}</div>`).join('')}</div>` : '',
      onClose: async () => { await load(); render(); },
    });
  }
})();
