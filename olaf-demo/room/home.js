/* The calm home screen the paid experts share (Ivy and Juno; Olaf's dashboard uses its parts): the room above
   says what's next, then the question box, today's one thing (and at most two more), the numbers from the free
   tools, the expert's own picture of where you stand, three picture tiles that each open their handful of
   skills, and the conversations as cards. The expert's notes sit behind one button.

   The paid build copies this file into apps/<name>/room/ with the room; each expert's app.js gives the content:
     BW.expertUI.page({ ... })  →  the HTML        BW.expertUI.bind(main, { ... })  →  the buttons
   Pictures come from the free tools' places (shared/places/<place>/<room>.jpg), in the morning, by day or in
   the evening like the rest. Nothing here talks to the AI. */
(function () {
  'use strict';
  const { esc } = BW;
  const h = new Date().getHours(), TOD = h >= 5 && h < 11 ? '-morning' : h >= 11 && h < 17 ? '' : '-evening';
  const pic = (place, room) => `${BW.root}shared/places/${place}/${room}${TOD}.jpg`;

  const css = document.createElement('style');
  css.textContent = `
    .xp-hero { display: block; padding: 20px 24px; margin: 16px 0 18px; background: var(--app-soft); }
    .xp-hero h2 { font-size: 1.35rem; margin-bottom: 4px; }
    .xp-hero p { color: var(--ink-2); margin-bottom: 4px; }
    .xp-today { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; margin-bottom: 8px; }
    .xp-today .side { display: grid; gap: 14px; align-content: start; }
    .xp-do { display: flex; gap: 14px; align-items: center; text-align: left; font: inherit; color: inherit; cursor: pointer; padding: 14px 16px;
      border: 2px solid var(--border); border-radius: var(--r-sm, 16px); background: var(--surface); box-shadow: var(--shadow-sm); }
    .xp-do:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 var(--shadow-c); }
    .xp-do .e { font-size: 1.5rem; } .xp-do small { display: block; color: var(--ink-2); }
    .xp-do.big { flex-direction: column; align-items: flex-start; justify-content: flex-end; min-height: 170px; padding: 22px; background: var(--app); color: var(--on-app); }
    .xp-do.big .e { font-size: 2.2rem; } .xp-do.big b { font-size: 1.25rem; } .xp-do.big small { color: inherit; opacity: .8; }
    .xp-do.big .go { margin-top: 8px; font-weight: 800; }
    .xp-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 18px 0 6px; }
    .xp-stat { padding: 14px 16px; } .xp-stat .k { color: var(--ink-2); font-weight: 700; font-size: .85rem; }
    .xp-stat .v { font-size: 1.9rem; font-weight: 900; line-height: 1.1; margin-top: 4px; } .xp-stat .s { color: var(--ink-3); font-size: .8rem; }
    .xp-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; }
    .xp-tile { position: relative; overflow: hidden; text-align: left; font: inherit; color: #FBF7EE; cursor: pointer; min-height: 190px; padding: 0;
      border: 2px solid var(--border); border-radius: 22px; background: #16141F center / cover no-repeat; box-shadow: var(--shadow); }
    .xp-tile::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(22,20,31,.92), rgba(22,20,31,.15) 62%, transparent); }
    .xp-tile span { position: absolute; left: 18px; right: 18px; bottom: 16px; z-index: 1; }
    .xp-tile b { display: block; font-size: 1.2rem; color: #FBF7EE; } .xp-tile small { display: block; color: rgba(251, 247, 238, .88); margin-top: 2px; }
    .xp-tile:hover { transform: translate(-2px, -2px); }
    .xp-list { display: grid; gap: 10px; }
    .xp-list .xp-do { box-shadow: none; }
    .xp-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
    .xp-card { text-align: left; font: inherit; color: inherit; cursor: pointer; padding: 14px 16px; border: 2px solid var(--border); border-radius: var(--r-sm, 16px); background: var(--surface); }
    .xp-card b { display: block; } .xp-card small { color: var(--ink-3); }
    .xp-card .st { display: inline-block; margin-bottom: 6px; padding: 1px 9px; border-radius: 99px; font-size: .75rem; font-weight: 800; background: var(--app-soft); }
    .xp-foot { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .xp-path { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; margin: 6px 0 4px; }
    .xp-step { position: relative; padding: 10px 10px 12px; border: 2px solid var(--border); border-radius: 16px; background: var(--surface); text-align: center; font-size: .82rem; }
    .xp-step i { display: block; height: 54px; margin: -10px -10px 8px; border-radius: 14px 14px 0 0; background: center / cover no-repeat; filter: saturate(.25) brightness(.7); }
    .xp-step.done i, .xp-step.here i { filter: none; }
    .xp-step.done { border-color: var(--app); } .xp-step.here { box-shadow: 0 0 0 3px var(--app); }
    .xp-step b { display: block; } .xp-step small { color: var(--ink-3); }
    .xp-ribbon { position: relative; height: 150px; margin: 10px 0 4px; border: 2px solid var(--border); border-radius: 18px; background: var(--surface); overflow: hidden; }
    .xp-ribbon .wk { position: absolute; top: 0; bottom: 0; border-left: 1px dashed var(--hair); font-size: .7rem; color: var(--ink-3); padding: 4px 6px; }
    .xp-ribbon .dot { position: absolute; top: 34px; transform: translateX(-50%); width: 120px; font-size: .74rem; font-weight: 700; text-align: center; line-height: 1.2; cursor: default; }
    .xp-ribbon .dot::before { content: attr(data-e); display: block; font-size: 1.3rem; }
    @media (max-width: 760px) { .xp-today { grid-template-columns: 1fr; } .xp-path { grid-auto-flow: row; grid-template-columns: repeat(3, minmax(0, 1fr)); } }`;
  document.head.append(css);

  const ui = BW.expertUI = { pic, TOD };

  // Today: the first thing big, at most two more beside it. now: [[emoji, title, sub, skill, instruction], ...]
  ui.today = (now) => {
    if (!now.length) return '';
    const [first, ...rest] = now.slice(0, 3);
    const btn = ([e, b, s], i, big) => `<button class="xp-do${big ? ' big' : ''}" data-now="${i}"><span class="e">${e}</span><span><b>${esc(b)}</b><small>${esc(s)}</small>${big ? '<span class="go">Start →</span>' : ''}</span></button>`;
    return `<div class="section-h"><h2>Today</h2></div><div class="xp-today rise">${btn(first, 0, true)}<div class="side">${rest.map((x, i) => btn(x, i + 1)).join('')}</div></div>`;
  };
  // The numbers from the free tools: [[label, value, sub], ...]
  ui.stats = (list) => `<div class="xp-stats rise">${list.map(([k, v, s]) => `<div class="card xp-stat"><div class="k">${esc(k)}</div><div class="v">${esc(String(v))}</div><div class="s">${esc(s || '')}</div></div>`).join('')}</div>`;
  // Three picture tiles: [{ title, sub, place, room, ids }]
  ui.tiles = (tiles) => `<div class="section-h"><h2>What we can do</h2></div><div class="xp-tiles rise">${tiles.map((t, i) => `<button class="xp-tile" data-tile="${i}" style="background-image:url('${pic(t.place, t.room)}')"><span><b>${esc(t.title)}</b><small>${esc(t.sub)}</small></span></button>`).join('')}</div>`;
  // Conversations as cards, the notes behind one button.
  ui.history = ({ sessions, files, title, who, folder }) => `
    <div class="section-h"><h2>Conversations</h2></div>
    ${sessions.length ? `<div class="xp-cards">${sessions.slice(0, 6).map((s) => `<button class="xp-card" data-s="${s.id}"><span class="st">${s.finished ? 'Done' : 'Open'}</span><b>${esc(s.title === s.skillId ? title(s.skillId) : s.title)}</b><small>${esc(title(s.skillId))} · ${BW.fmtDate((s.updatedAt || '').slice(0, 10))}</small></button>`).join('')}</div>`
      : `<p class="faint">Your conversations with ${who} show here, so you can pick one up again.</p>`}
    <div class="xp-foot">${files.length ? `<button class="btn" data-notes>🗂️ ${who}’s notes (${files.length})</button>` : ''}<button class="btn btn-ghost" data-ai-foot>⚙️ AI settings</button></div>
    <p class="faint" style="margin-top:8px">${files.length ? `Also in the ${who} folder inside your ${folder}.` : `${who} keeps notes in your ${folder} after your first conversation.`}</p>`;

  // The buttons. skills: { id: [emoji, title, sub] }; onSkill(id), onNow(i), onSession(id), onFile(path), onAi().
  ui.bind = (main, { tiles, skills, files, onSkill, onNow, onSession, onFile, onAi }) => {
    main.querySelectorAll('[data-now]').forEach((b) => (b.onclick = () => onNow(Number(b.dataset.now))));
    main.querySelectorAll('[data-tile]').forEach((b) => (b.onclick = () => {
      const t = tiles[Number(b.dataset.tile)];
      const box = BW.html(`<div class="xp-list">${t.ids.map((id) => `<button class="xp-do" data-pick="${id}"><span class="e">${skills[id][0]}</span><span><b>${esc(skills[id][1])}</b><small>${esc(skills[id][2])}</small></span></button>`).join('')}</div>`);
      const m = BW.modal({ title: esc(t.title), body: box, actions: [{ label: 'Close', kind: 'ghost' }] });
      box.querySelectorAll('[data-pick]').forEach((p) => (p.onclick = () => { m.close(); setTimeout(() => onSkill(p.dataset.pick), 0); }));
    }));
    main.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => onSession(b.dataset.s)));
    const notes = main.querySelector('[data-notes]');
    if (notes) notes.onclick = () => {
      const box = BW.html(`<div class="xp-list">${files.map((p) => `<button class="xp-do" data-f="${esc(p)}"><span class="e">📄</span><span><b>${esc(p)}</b></span></button>`).join('')}</div>`);
      const m = BW.modal({ title: '🗂️ Notes', body: box, actions: [{ label: 'Close', kind: 'ghost' }] });
      box.querySelectorAll('[data-f]').forEach((p) => (p.onclick = () => { m.close(); setTimeout(() => onFile(p.dataset.f), 0); }));
    };
    const ai = main.querySelector('[data-ai-foot]');
    if (ai) ai.onclick = onAi;
  };

  // A path of steps with room pictures: [{ title, sub, place, room, state: 'done'|'here'|'' }]
  ui.path = (steps, heading) => `<div class="section-h"><h2>${heading}</h2></div><div class="xp-path rise">${steps.map((s) => `<div class="xp-step ${s.state || ''}"><i style="background-image:url('${pic(s.place, s.room)}')"></i><b>${s.state === 'done' ? '✓ ' : ''}${esc(s.title)}</b><small>${esc(s.sub || '')}</small></div>`).join('')}</div>`;
  // The next weeks as one ribbon: items [{ date, e, label }], from today.
  ui.ribbon = (items, today, weeks = 8, heading = 'The next eight weeks') => {
    const span = weeks * 7, at = (d) => Math.max(0, Math.min(1, (new Date(d) - new Date(today)) / 864e5 / span));
    const wk = Array.from({ length: weeks }, (_, i) => `<span class="wk" style="left:${(i / weeks) * 100}%">${i ? BW.fmtDate(BW.addDays(today, i * 7), { day: 'numeric', month: 'short' }) : 'Now'}</span>`).join('');
    // Each label takes the first of three rows where it doesn't touch the one before it.
    const last = [-1, -1, -1];
    const dots = items.slice(0, 9).map((x) => {
      const pos = Math.max(7, Math.min(93, at(x.date) * 100));
      let row = last.findIndex((l) => pos - l >= 13);
      if (row < 0) row = last.indexOf(Math.min(...last));
      last[row] = pos;
      return `<span class="dot" data-e="${x.e}" style="left:${pos}%;top:${20 + row * 42}px" title="${esc(x.label)} · ${esc(BW.fmtDate(x.date))}">${esc(x.label)}</span>`;
    }).join('');
    return `<div class="section-h"><h2>${heading}</h2></div><div class="xp-ribbon rise">${wk}${dots || '<span class="dot" data-e="🌤️" style="left:50%">Nothing due: all calm</span>'}</div>`;
  };
})();
