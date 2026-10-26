/* Busy brain games: the play screen and the games hub. Uses engine.js (window.BusyGames).
   Progress, streaks and solved levels stay in this browser (localStorage), as a convenience: no
   account, nothing sent anywhere. If the browser keeps nothing (a private window), the games
   still work; they just forget. */
(function () {
  'use strict';
  const G = window.BusyGames;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const NAMES = { stars: 'Stars', duo: 'Duo', trail: 'Trail', six: 'Six' };
  const KEY = 'busy.games.v1';

  // ---------- what this browser remembers ----------
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && v.v === 1) return v; } catch (e) { /* nothing kept */ }
    return { v: 1, levels: {}, daily: {}, progress: {} };
  }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private window: forget */ } }
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => ymd(new Date());
  const dayBefore = (day) => { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() - 1); return ymd(d); };
  // Days in a row with the daily puzzle solved (of one game, or any game), counting today or yesterday.
  function streak(s, game) {
    const has = (day) => s.daily[day] && (game ? s.daily[day][game] != null : Object.keys(s.daily[day]).length > 0);
    let day = today(), n = 0;
    if (!has(day)) day = dayBefore(day);
    while (has(day)) { n++; day = dayBefore(day); }
    return n;
  }
  const clock = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const solvedCount = (s, game) => Object.keys((s.levels[game] || {}).solved || {}).length;
  function nextLevel(s, game) {
    const solved = (s.levels[game] || {}).solved || {};
    let n = 1; while (solved[n] != null && n < G.LEVELS) n++;
    return n;
  }

  // ---------- the hub ----------
  if (document.body.dataset.hub != null) {
    const s = load(), day = today();
    document.querySelectorAll('[data-status]').forEach((el) => {
      const game = el.dataset.status, done = s.daily[day] && s.daily[day][game];
      const lv = solvedCount(s, game);
      el.innerHTML = (done != null ? `✅ Today's puzzle solved in ${clock(done)}` : '🗓️ Today\'s puzzle is waiting')
        + `<br>${lv ? `🏁 ${lv.toLocaleString('en-GB')} level${lv === 1 ? '' : 's'} solved, next is ${nextLevel(s, game)}` : `🏁 ${G.LEVELS.toLocaleString('en-GB')} levels to play`}`;
    });
    const all = streak(s, null), el = $('[data-streak]');
    if (el && all) el.textContent = `🔥 ${all}-day streak`;
    return;
  }

  const game = document.body.dataset.game;
  const play = $('#play');
  if (!game || !play) return;

  // ---------- shared pieces of a board ----------
  function gridKeys(board, n) {
    board.addEventListener('keydown', (e) => {
      const c = e.target.closest('.cell'); if (!c) return;
      const i = +c.dataset.i, r = Math.floor(i / n), k = i % n;
      const to = { ArrowUp: r > 0 ? i - n : -1, ArrowDown: r < n - 1 ? i + n : -1, ArrowLeft: k > 0 ? i - 1 : -1, ArrowRight: k < n - 1 ? i + 1 : -1 }[e.key];
      if (to == null) return;
      e.preventDefault();
      if (to >= 0) { board.children[to].focus(); }
    });
  }
  const cellAt = (board, e) => { const el = document.elementFromPoint(e.clientX, e.clientY); const c = el && el.closest && el.closest('.cell'); return c && board.contains(c) ? +c.dataset.i : -1; };
  const where = (n, i) => `row ${Math.floor(i / n) + 1}, column ${(i % n) + 1}`;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k); // a to b, both included

  // ---------- Stars ----------
  function Stars(p, board, ctx) {
    const n = p.size; let marks = new Array(n * n).fill(0); // 0 empty, 1 cross, 2 star
    board.style.setProperty('--n', n);
    board.classList.add('stars');
    board.innerHTML = Array.from({ length: n * n }, (_, i) => {
      const g = p.regions[i], r = Math.floor(i / n), k = i % n, side = [];
      if (r === 0 || p.regions[i - n] !== g) side.push('bt');
      if (k === n - 1 || p.regions[i + 1] !== g) side.push('br');
      if (r === n - 1 || p.regions[i + n] !== g) side.push('bb');
      if (k === 0 || p.regions[i - 1] !== g) side.push('bl');
      return `<button type="button" class="cell ${side.join(' ')}" data-i="${i}" style="--g:var(--g${g})"></button>`;
    }).join('');
    const cells = [...board.children];
    function draw() {
      const stars = marks.flatMap((m, i) => (m === 2 ? [i] : []));
      const bad = new Set(G.check.stars(p, stars).bad);
      cells.forEach((c, i) => {
        c.dataset.v = marks[i]; c.classList.toggle('bad', bad.has(i));
        c.textContent = marks[i] === 2 ? '★' : marks[i] === 1 ? '×' : '';
        c.setAttribute('aria-label', `${where(n, i)}, patch ${p.regions[i] + 1}${marks[i] === 2 ? ', star' : marks[i] === 1 ? ', crossed out' : ''}`);
      });
    }
    let paint = null, last = -1;
    const tap = (i) => { ctx.begin(); marks[i] = (marks[i] + 1) % 3; paint = marks[i] === 1 ? 1 : null; last = i; draw(); ctx.changed(); };
    board.onpointerdown = (e) => { const i = cellAt(board, e); if (i < 0 || ctx.done()) return; e.preventDefault(); tap(i); };
    board.onpointermove = (e) => {
      if (paint == null || !e.buttons) return;
      const i = cellAt(board, e); if (i < 0 || i === last) return;
      // A quick drag can jump cells: cross out everything between, along the row or column.
      const [r0, c0, r1, c1] = [Math.floor(last / n), last % n, Math.floor(i / n), i % n];
      const between = r0 === r1 ? range(Math.min(c0, c1), Math.max(c0, c1)).map((c) => r0 * n + c)
        : c0 === c1 ? range(Math.min(r0, r1), Math.max(r0, r1)).map((r) => r * n + c0) : [i];
      let any = false;
      for (const k of between) if (marks[k] === 0) { marks[k] = 1; any = true; }
      last = i;
      if (any) { draw(); ctx.changed(); }
    };
    board.onpointerup = board.onpointercancel = () => { paint = null; };
    board.onclick = (e) => { if (e.detail === 0 && e.target.closest('.cell') && !ctx.done()) tap(+e.target.closest('.cell').dataset.i); paint = null; };
    gridKeys(board, n);
    draw();
    const solution = new Set(p.solution.map((c, r) => r * n + c));
    return {
      get: () => marks.slice(), set: (m) => { marks = m.slice(); draw(); },
      clear: () => { marks.fill(0); draw(); },
      solved: () => G.check.stars(p, marks.flatMap((m, i) => (m === 2 ? [i] : []))).solved,
      showAnswer: () => { marks = marks.map((_, i) => (solution.has(i) ? 2 : 0)); draw(); },
      hint() { // take away a wrong star, else put the right star in the first row without one
        const wrong = marks.findIndex((m, i) => m === 2 && !solution.has(i));
        if (wrong >= 0) { marks[wrong] = 1; draw(); return; }
        for (let r = 0; r < n; r++) { const c = r * n + p.solution[r]; if (marks[c] !== 2) { marks[c] = 2; draw(); return; } }
      },
    };
  }

  // ---------- Duo ----------
  function Duo(p, board, ctx) {
    const n = p.size; let g = p.givens.slice();
    board.style.setProperty('--n', n);
    board.innerHTML = Array.from({ length: n * n }, (_, i) => `<button type="button" class="cell${p.givens[i] !== -1 ? ' given' : ''}" data-i="${i}"><span class="tok"></span></button>`).join('');
    const cells = [...board.children];
    const NAME = ['sun', 'grape'];
    function draw() {
      const bad = new Set(G.check.duo(p, g).bad);
      cells.forEach((c, i) => {
        c.dataset.v = g[i]; c.classList.toggle('bad', bad.has(i));
        c.setAttribute('aria-label', `${where(n, i)}, ${g[i] === -1 ? 'empty' : NAME[g[i]]}${p.givens[i] !== -1 ? ', given' : ''}`);
      });
    }
    const tap = (i) => { if (p.givens[i] !== -1 || ctx.done()) return; ctx.begin(); g[i] = g[i] === -1 ? 0 : g[i] === 0 ? 1 : -1; draw(); ctx.changed(); };
    board.onpointerdown = (e) => { const i = cellAt(board, e); if (i < 0) return; e.preventDefault(); tap(i); };
    board.onclick = (e) => { if (e.detail === 0 && e.target.closest('.cell')) tap(+e.target.closest('.cell').dataset.i); };
    gridKeys(board, n);
    draw();
    return {
      get: () => g.slice(), set: (s) => { g = s.slice(); draw(); },
      clear: () => { g = p.givens.slice(); draw(); },
      solved: () => G.check.duo(p, g).solved,
      showAnswer: () => { g = p.solution.slice(); draw(); },
      hint() { const i = g.findIndex((v, k) => v !== p.solution[k]); if (i >= 0) { g[i] = p.solution[i]; draw(); } },
    };
  }

  // ---------- Six ----------
  function Six(p, board, ctx) {
    let g = p.givens.slice(), sel = p.givens.indexOf(0);
    board.style.setProperty('--n', 6);
    board.classList.add('six');
    board.innerHTML = Array.from({ length: 36 }, (_, i) => {
      const r = Math.floor(i / 6), k = i % 6, side = [];
      if (r % 2 === 0) side.push('bt'); if (r === 5) side.push('bb');
      if (k % 3 === 0) side.push('bl'); if (k === 5) side.push('br');
      return `<button type="button" class="cell ${side.join(' ')}${p.givens[i] ? ' given' : ''}" data-i="${i}"></button>`;
    }).join('');
    const cells = [...board.children];
    const pad = $('[data-pad]', play);
    pad.hidden = false;
    pad.innerHTML = [1, 2, 3, 4, 5, 6].map((v) => `<button type="button" class="btn" data-v="${v}">${v}</button>`).join('') + '<button type="button" class="btn" data-v="0" aria-label="Erase">⌫</button>';
    function draw() {
      const bad = new Set(G.check.six(p, g).bad);
      cells.forEach((c, i) => {
        c.textContent = g[i] || ''; c.classList.toggle('bad', bad.has(i)); c.classList.toggle('sel', i === sel);
        c.setAttribute('aria-label', `${where(6, i)}, ${g[i] || 'empty'}${p.givens[i] ? ', given' : ''}`);
      });
    }
    const put = (v) => { if (sel < 0 || p.givens[sel] || ctx.done()) return; ctx.begin(); g[sel] = v; draw(); ctx.changed(); };
    board.onclick = (e) => { const c = e.target.closest('.cell'); if (!c) return; sel = +c.dataset.i; draw(); };
    pad.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { put(+b.dataset.v); if (sel >= 0) cells[sel].focus(); } };
    board.addEventListener('keydown', (e) => {
      const c = e.target.closest && e.target.closest('.cell');
      if (c) sel = +c.dataset.i; // the cell the key was pressed on, focused or not
      if (/^[1-6]$/.test(e.key)) { e.preventDefault(); put(+e.key); }
      else if (['Backspace', 'Delete', '0'].includes(e.key)) { e.preventDefault(); put(0); }
    });
    board.addEventListener('focusin', (e) => { const c = e.target.closest('.cell'); if (c) { sel = +c.dataset.i; draw(); } });
    gridKeys(board, 6);
    draw();
    return {
      get: () => g.slice(), set: (s) => { g = s.slice(); draw(); },
      clear: () => { g = p.givens.slice(); draw(); },
      solved: () => G.check.six(p, g).solved,
      showAnswer: () => { g = p.solution.slice(); sel = -1; draw(); },
      hint() {
        let i = sel >= 0 && !p.givens[sel] && g[sel] !== p.solution[sel] ? sel : g.findIndex((v, k) => v && v !== p.solution[k]);
        if (i < 0) i = g.indexOf(0);
        if (i >= 0) { g[i] = p.solution[i]; sel = i; draw(); }
      },
    };
  }

  // ---------- Trail ----------
  function Trail(p, board, ctx) {
    const n = p.size, N = n * n, walls = new Set(p.walls), K = Math.max(...p.labels);
    let path = [p.labels.indexOf(1)];
    board.style.setProperty('--n', n);
    board.classList.add('trail');
    board.tabIndex = 0;
    board.setAttribute('aria-label', `Trail board, ${n} by ${n}. Use the arrow keys to draw, Backspace to step back.`);
    const wall = (a, b) => walls.has(G.edge(a, b));
    board.innerHTML = Array.from({ length: N }, (_, i) => {
      const r = Math.floor(i / n), k = i % n, side = [];
      if (k < n - 1 && wall(i, i + 1)) side.push('wr');
      if (r < n - 1 && wall(i, i + n)) side.push('wb');
      return `<div class="cell ${side.join(' ')}" data-i="${i}">${p.labels[i] ? `<span class="num">${p.labels[i]}</span>` : ''}</div>`;
    }).join('') + `<svg class="line" viewBox="0 0 ${n} ${n}" aria-hidden="true"><polyline fill="none"/></svg>`;
    const cells = [...board.querySelectorAll('.cell')], line = $('polyline', board);
    const next = () => path.reduce((k, c) => (p.labels[c] ? k + 1 : k), 0) + 1;
    function draw() {
      const on = new Set(path);
      cells.forEach((c, i) => { c.classList.toggle('on', on.has(i)); c.classList.toggle('head', i === path[path.length - 1]); });
      line.setAttribute('points', path.map((c) => `${(c % n) + 0.5},${Math.floor(c / n) + 0.5}`).join(' '));
      board.setAttribute('aria-valuetext', `${path.length} of ${N} cells, next number ${Math.min(next(), K)}`);
    }
    function step(i) { // extend to i, or go back to it if it is already on the path
      const at = path.indexOf(i);
      if (at >= 0) { if (at < path.length - 1) { path = path.slice(0, at + 1); return true; } return false; }
      const head = path[path.length - 1];
      if (!G.neighbours(n, head).includes(i) || wall(head, i)) return false;
      if (p.labels[i] && p.labels[i] !== next()) return false;
      if (p.labels[head] === K) return false;
      path.push(i); return true;
    }
    let drawing = false;
    board.onpointerdown = (e) => {
      const i = cellAt(board, e); if (i < 0 || ctx.done()) return;
      e.preventDefault(); ctx.begin();
      if (step(i)) { draw(); ctx.changed(); }
      drawing = true;
      try { board.setPointerCapture(e.pointerId); } catch (err) { /* older browser */ }
    };
    board.onpointermove = (e) => {
      if (!drawing) return;
      const i = cellAt(board, e); if (i < 0 || i === path[path.length - 1]) return;
      // Moving back over the previous cell steps back; moving on extends.
      if (path.length > 1 && i === path[path.length - 2]) { path.pop(); draw(); ctx.changed(); return; }
      if (G.neighbours(n, path[path.length - 1]).includes(i) && step(i)) { draw(); ctx.changed(); }
    };
    board.onpointerup = board.onpointercancel = () => { drawing = false; };
    board.addEventListener('keydown', (e) => {
      if (ctx.done()) return;
      const head = path[path.length - 1], r = Math.floor(head / n), k = head % n;
      const to = { ArrowUp: r > 0 ? head - n : -1, ArrowDown: r < n - 1 ? head + n : -1, ArrowLeft: k > 0 ? head - 1 : -1, ArrowRight: k < n - 1 ? head + 1 : -1 }[e.key];
      if (to != null) {
        e.preventDefault(); if (to < 0) return;
        ctx.begin();
        if (path.length > 1 && to === path[path.length - 2]) path.pop(); else if (!step(to)) return;
        draw(); ctx.changed();
      } else if (e.key === 'Backspace' && path.length > 1) { e.preventDefault(); ctx.begin(); path.pop(); draw(); ctx.changed(); }
    });
    draw();
    return {
      get: () => path.slice(), set: (s) => { path = s.slice(); draw(); },
      clear: () => { path = [p.labels.indexOf(1)]; draw(); },
      solved: () => G.check.trail(p, path).solved,
      showAnswer: () => { path = p.solution.slice(); draw(); },
      hint() { let k = 0; while (k < path.length && path[k] === p.solution[k]) k++; path = p.solution.slice(0, k + 1); draw(); },
    };
  }

  const MAKERS = { stars: Stars, duo: Duo, trail: Trail, six: Six };

  // ---------- the play screen ----------
  play.innerHTML = `
    <div class="play-top">
      <div class="modes" role="tablist" aria-label="Mode">
        <button type="button" role="tab" data-mode="daily">🗓️ Today</button>
        <button type="button" role="tab" data-mode="level">🏁 Levels</button>
      </div>
      <div class="meta"><b data-title></b><span class="chip chip-grey" data-diff></span><span class="timer" data-timer aria-label="Time">0:00</span></div>
    </div>
    <div class="board-wrap"><div class="board" data-board role="group"></div><p class="making" data-making hidden>Making the puzzle…</p></div>
    <div class="pad" data-pad hidden></div>
    <div class="play-tools">
      <button type="button" class="btn" data-undo>↩️ Undo</button>
      <button type="button" class="btn" data-clear>🧽 Clear</button>
      <button type="button" class="btn" data-hint>💡 Hint</button>
      <span class="level-nav" data-levelnav><button type="button" class="btn" data-prev aria-label="Previous level">←</button><button type="button" class="btn" data-pick>🔢 Pick a level</button><button type="button" class="btn" data-next aria-label="Next level">→</button></span>
    </div>
    <div class="win card" data-win hidden role="status" aria-live="polite"></div>
    <div class="picker card" data-picker hidden></div>`;
  let board = $('[data-board]', play);
  const timerEl = $('[data-timer]', play), winEl = $('[data-win]', play);
  let state = load(), puzzle = null, ctrl = null, undo = [], secs = 0, hints = 0, finished = false, tick = null, current = null;

  const progressKey = () => (current.kind === 'daily' ? `${game}:daily` : `${game}:level`);
  const puzzleId = () => (current.kind === 'daily' ? current.day : current.level);
  function keep() {
    state = load();
    if (finished) delete state.progress[progressKey()];
    else state.progress[progressKey()] = { id: puzzleId(), board: ctrl.get(), secs, hints };
    save(state);
  }
  const ctx = {
    begin: () => { undo.push(ctrl.get()); if (undo.length > 200) undo.shift(); },
    changed: () => { if (ctrl.solved()) win(); else keep(); },
    done: () => finished,
  };
  function startClock() {
    clearInterval(tick);
    tick = setInterval(() => { if (!finished && !document.hidden) { secs++; timerEl.textContent = clock(secs); if (secs % 10 === 0) keep(); } }, 1000);
  }

  function open(target) {
    current = target;
    history.replaceState(null, '', current.kind === 'daily' ? location.pathname : `#level-${current.level}`);
    play.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === current.kind)));
    $('[data-levelnav]', play).hidden = current.kind !== 'level';
    winEl.hidden = true; $('[data-picker]', play).hidden = true;
    $('[data-pad]', play).hidden = true;
    const fresh = document.createElement('div'); // a new board each time, so no old listeners linger
    fresh.className = 'board'; fresh.dataset.board = ''; fresh.setAttribute('role', 'group'); fresh.setAttribute('aria-label', `${NAMES[game]} board`);
    board.replaceWith(fresh); board = fresh;
    $('[data-making]', play).hidden = false;
    setTimeout(() => {
      puzzle = current.kind === 'daily' ? G.daily(game, current.day) : G.level(game, current.level);
      $('[data-making]', play).hidden = true;
      $('[data-title]', play).textContent = current.kind === 'daily'
        ? `Today · #${G.dayNumber(current.day)}` : `Level ${current.level.toLocaleString('en-GB')}`;
      $('[data-diff]', play).textContent = `${puzzle.difficulty} · ${puzzle.size}×${puzzle.size}`;
      undo = []; finished = false; hints = 0; secs = 0;
      ctrl = MAKERS[game](puzzle, board, ctx);
      state = load();
      const done = current.kind === 'daily' ? (state.daily[current.day] || {})[game] : ((state.levels[game] || {}).solved || {})[current.level];
      const saved = state.progress[progressKey()];
      if (done != null) { finished = true; secs = done; ctrl.showAnswer(); showWin(true); }
      else if (saved && saved.id === puzzleId()) { ctrl.set(saved.board); secs = saved.secs || 0; hints = saved.hints || 0; }
      timerEl.textContent = clock(secs);
      if (current.kind === 'level') { state.levels[game] = state.levels[game] || { solved: {} }; state.levels[game].last = current.level; save(state); }
      startClock();
    }, 20);
  }

  function win() {
    finished = true;
    state = load();
    if (current.kind === 'daily') { state.daily[current.day] = state.daily[current.day] || {}; state.daily[current.day][game] = secs; }
    else { state.levels[game] = state.levels[game] || { solved: {} }; state.levels[game].solved[current.level] = secs; }
    delete state.progress[progressKey()];
    save(state);
    showWin(false);
  }
  function shareText() {
    const time = clock(secs) + (hints ? ` · ${hints} hint${hints === 1 ? '' : 's'}` : '');
    const s = streak(load(), game);
    return current.kind === 'daily'
      ? `Busy ${NAMES[game]} #${G.dayNumber(current.day)} · ${time}${s > 1 ? `\n🔥 ${s} days in a row` : ''}\n${location.origin}/games/${game}.html`
      : `Busy ${NAMES[game]} level ${current.level} (${puzzle.difficulty}) · ${time}\n${location.origin}/games/${game}.html#level-${current.level}`;
  }
  function showWin(again) {
    const s = streak(load(), game);
    const others = ['stars', 'duo', 'trail', 'six'].filter((g) => g !== game).map((g) => `<a class="btn" href="${g}.html">${NAMES[g]}</a>`).join('');
    winEl.innerHTML = `<div class="burst" aria-hidden="true">${again ? '✅' : '🎉'}</div>
      <h2>${again ? 'Already solved' : 'Solved!'}</h2>
      <p>${current.kind === 'daily' ? `Today's ${NAMES[game]}` : `Level ${current.level.toLocaleString('en-GB')} · ${esc(puzzle.difficulty)}`} in <b>${clock(secs)}</b>${hints ? ` with ${hints} hint${hints === 1 ? '' : 's'}` : ''}.</p>
      ${current.kind === 'daily' && s ? `<p class="streak">🔥 ${s}-day streak</p>` : ''}
      <div class="row-flex">
        ${current.kind === 'level' && current.level < G.LEVELS ? '<button type="button" class="btn btn-primary" data-go-next>Next level →</button>' : ''}
        ${current.kind === 'daily' ? '<button type="button" class="btn btn-primary" data-go-levels>🏁 Play levels</button>' : ''}
        ${again ? '' : '<button type="button" class="btn" data-share>📣 Share</button>'}
      </div>
      ${current.kind === 'daily' ? `<p class="faint">A new puzzle tomorrow. Meanwhile: ${others}</p>` : ''}`;
    winEl.hidden = false;
    const nx = $('[data-go-next]', winEl); if (nx) nx.onclick = () => open({ kind: 'level', level: current.level + 1 });
    const lv = $('[data-go-levels]', winEl); if (lv) lv.onclick = () => open({ kind: 'level', level: nextLevel(load(), game) });
    const sh = $('[data-share]', winEl);
    if (sh) sh.onclick = async () => {
      const text = shareText();
      try {
        if (navigator.share) await navigator.share({ text });
        else { await navigator.clipboard.writeText(text); sh.textContent = '✅ Copied'; }
      } catch (e) { /* closed the share sheet */ }
    };
    if (!again) (nx || lv || sh).focus();
  }

  function picker() {
    const box = $('[data-picker]', play), s = load(), solved = (s.levels[game] || {}).solved || {};
    let page = Math.floor((current.level - 1) / 100);
    const pages = Math.ceil(G.LEVELS / 100);
    function draw() {
      const from = page * 100 + 1, to = Math.min(G.LEVELS, from + 99);
      box.innerHTML = `<div class="picker-head"><b>Pick a level</b>
        <label>Levels <select data-page>${Array.from({ length: pages }, (_, k) => `<option value="${k}"${k === page ? ' selected' : ''}>${(k * 100 + 1).toLocaleString('en-GB')} to ${Math.min(G.LEVELS, k * 100 + 100).toLocaleString('en-GB')}</option>`).join('')}</select></label>
        <button type="button" class="btn btn-ghost" data-close aria-label="Close">✕</button></div>
        <div class="levels">${Array.from({ length: to - from + 1 }, (_, k) => {
          const L = from + k;
          return `<button type="button" class="lv${solved[L] != null ? ' done' : ''}${L === current.level ? ' now' : ''}" data-l="${L}" aria-label="Level ${L}${solved[L] != null ? ', solved' : ''}">${L}</button>`;
        }).join('')}</div>
        <p class="faint">${solvedCount(s, game).toLocaleString('en-GB')} of ${G.LEVELS.toLocaleString('en-GB')} solved · <button type="button" class="link" data-cont>Next unsolved: ${nextLevel(s, game)}</button></p>`;
      $('[data-page]', box).onchange = (e) => { page = +e.target.value; draw(); };
      $('[data-close]', box).onclick = () => { box.hidden = true; };
      $('[data-cont]', box).onclick = () => open({ kind: 'level', level: nextLevel(load(), game) });
      box.onclick = (e) => { const b = e.target.closest('[data-l]'); if (b) open({ kind: 'level', level: +b.dataset.l }); };
    }
    draw();
    box.hidden = false;
    $('[data-page]', box).focus();
  }

  play.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => {
    if (b.dataset.mode === 'daily') open({ kind: 'daily', day: today() });
    else { const s = load(); open({ kind: 'level', level: (s.levels[game] || {}).last || nextLevel(s, game) }); }
  });
  $('[data-undo]', play).onclick = () => { if (undo.length && !finished) { ctrl.set(undo.pop()); keep(); } };
  $('[data-clear]', play).onclick = () => { if (!finished) { ctx.begin(); ctrl.clear(); keep(); } };
  $('[data-hint]', play).onclick = () => { if (finished) return; ctx.begin(); hints++; ctrl.hint(); ctx.changed(); };
  $('[data-prev]', play).onclick = () => { if (current.level > 1) open({ kind: 'level', level: current.level - 1 }); };
  $('[data-next]', play).onclick = () => { if (current.level < G.LEVELS) open({ kind: 'level', level: current.level + 1 }); };
  $('[data-pick]', play).onclick = picker;
  addEventListener('beforeunload', () => { if (ctrl && !finished) keep(); });
  // A link to another level on this page only changes the #level- part of the address.
  addEventListener('hashchange', () => {
    const h = /^#level-(\d+)$/.exec(location.hash);
    if (h && !(current.kind === 'level' && current.level === +h[1])) { if (ctrl && !finished) keep(); open({ kind: 'level', level: Math.min(G.LEVELS, Math.max(1, +h[1])) }); }
  });

  const m = /^#level-(\d+)$/.exec(location.hash);
  open(m ? { kind: 'level', level: Math.min(G.LEVELS, Math.max(1, +m[1])) } : { kind: 'daily', day: today() });
})();
