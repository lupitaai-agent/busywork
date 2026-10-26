/* Busy brain games: the puzzle makers and solvers. Plain JavaScript with no dependencies; the
   website's game pages load it, and the tests run it under Node.

   Every puzzle is made from a seed: level 37 of Stars is the same puzzle on every computer, and so
   is today's daily puzzle, without a server. Each maker keeps trying until its solver proves there
   is exactly one answer, so a puzzle can always be solved by reasoning, never only by guessing.

   The four games are classic puzzle types, under our own names:
     stars  Star Battle with one star: one per row, column and colour patch, never touching
     duo    Takuzu (Binairo): two fruits, half each per line, never three in a row, no repeated lines
     trail  a path puzzle: one line through every cell, passing the numbers in order
     six    Sudoku on a 6 × 6 grid with 2 × 3 boxes */
(function (root) {
  'use strict';

  const LEVELS = 10000;

  // ---------- seeded randomness ----------
  function hash(text) { // FNV-1a
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) { // mulberry32: small, fast, and the same on every engine
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, n) => Math.floor(r() * n);
  function shuffle(r, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = pick(r, i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  function neighbours(n, cell) {
    const r = Math.floor(cell / n), c = cell % n, out = [];
    if (r > 0) out.push(cell - n);
    if (c < n - 1) out.push(cell + 1);
    if (r < n - 1) out.push(cell + n);
    if (c > 0) out.push(cell - 1);
    return out;
  }

  // ---------- Stars (Star Battle, one star) ----------
  function starRows(r, n) {
    const cols = new Array(n), used = new Array(n).fill(false);
    (function place(row) {
      if (row === n) return true;
      for (const c of shuffle(r, range(n))) {
        if (used[c] || (row > 0 && Math.abs(cols[row - 1] - c) <= 1)) continue;
        used[c] = true; cols[row] = c;
        if (place(row + 1)) return true;
        used[c] = false;
      }
      return false;
    })(0);
    return cols;
  }
  // Patches grown at random from the solution's stars, so each patch holds exactly one of them.
  function growPatches(r, n, cols) {
    const reg = new Array(n * n).fill(-1), front = [];
    const ids = shuffle(r, range(n));
    cols.forEach((c, row) => { const cell = row * n + c; reg[cell] = ids[row]; neighbours(n, cell).forEach((x) => front.push([x, ids[row]])); });
    while (front.length) {
      const i = pick(r, front.length), [cell, id] = front[i];
      front[i] = front[front.length - 1]; front.pop();
      if (reg[cell] !== -1) continue;
      reg[cell] = id;
      neighbours(n, cell).forEach((x) => { if (reg[x] === -1) front.push([x, id]); });
    }
    return reg;
  }
  function solveStars(n, reg, limit) {
    let count = 0, first = null;
    const cols = new Array(n), found = [];
    (function go(row, colMask, regMask, prev) {
      if (count >= limit) return;
      if (row === n) { count++; found.push(cols.slice()); if (!first) first = cols.slice(); return; }
      for (let c = 0; c < n; c++) {
        if ((colMask >> c) & 1) continue;
        if (prev >= 0 && Math.abs(prev - c) <= 1) continue;
        const g = reg[row * n + c];
        if ((regMask >> g) & 1) continue;
        cols[row] = c;
        go(row + 1, colMask | (1 << c), regMask | (1 << g), c);
      }
    })(0, 0, 0, -1);
    return { count, first, found };
  }
  // A patch that lets another answer through gets the other answer's star cell taken away by a
  // neighbouring patch: this converges much faster than starting again.
  function makeStars(r, n) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const cols = starRows(r, n), reg = growPatches(r, n, cols);
      const star = new Set(cols.map((c, row) => row * n + c));
      for (let fix = 0; fix < 12 * n; fix++) {
        const s = solveStars(n, reg, 2);
        if (s.count === 1) return { size: n, regions: reg, solution: cols };
        const other = s.found.find((f) => f.some((c, row) => c !== cols[row]));
        const alt = shuffle(r, other.map((c, row) => row * n + c).filter((cell) => !star.has(cell)));
        let moved = false;
        for (const cell of alt) {
          const options = neighbours(n, cell).map((x) => reg[x]).filter((g) => g !== reg[cell]);
          if (!options.length || !stillJoined(n, reg, cell)) continue;
          reg[cell] = options[pick(r, options.length)];
          moved = true;
          break;
        }
        if (!moved) break;
      }
    }
    throw new Error('stars: no unique puzzle found (' + n + ')');
  }
  // Would the cell's patch stay in one piece without it?
  function stillJoined(n, reg, cell) {
    const g = reg[cell], rest = [];
    for (let i = 0; i < n * n; i++) if (reg[i] === g && i !== cell) rest.push(i);
    if (!rest.length) return false;
    const seen = new Set([rest[0]]), todo = [rest[0]];
    while (todo.length) neighbours(n, todo.pop()).forEach((x) => { if (x !== cell && reg[x] === g && !seen.has(x)) { seen.add(x); todo.push(x); } });
    return seen.size === rest.length;
  }
  function checkStars(p, stars) { // stars: array of cells with a star
    const n = p.size, bad = new Set();
    for (let i = 0; i < stars.length; i++) for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i], b = stars[j];
      const ra = Math.floor(a / n), ca = a % n, rb = Math.floor(b / n), cb = b % n;
      if (ra === rb || ca === cb || p.regions[a] === p.regions[b] || (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1)) { bad.add(a); bad.add(b); }
    }
    return { bad: [...bad], solved: stars.length === n && bad.size === 0 };
  }

  // ---------- Duo (Takuzu) ----------
  // Cells: -1 empty, 0 lemon, 1 berry.
  function lineOk(line, n) {
    let c0 = 0, c1 = 0;
    for (let i = 0; i < n; i++) {
      const v = line[i];
      if (v === 0) c0++; else if (v === 1) c1++;
      if (v !== -1 && i >= 2 && line[i - 1] === v && line[i - 2] === v) return false;
    }
    return c0 <= n / 2 && c1 <= n / 2;
  }
  const rowOf = (g, n, r) => g.slice(r * n, r * n + n);
  const colOf = (g, n, c) => range(n).map((r) => g[r * n + c]);
  function linesDistinct(g, n) {
    const seen = new Set();
    for (let r = 0; r < n; r++) { const l = rowOf(g, n, r); if (l.includes(-1)) continue; const k = 'r' + l.join(''); if (seen.has(k)) return false; seen.add(k); }
    for (let c = 0; c < n; c++) { const l = colOf(g, n, c); if (l.includes(-1)) continue; const k = 'c' + l.join(''); if (seen.has(k)) return false; seen.add(k); }
    return true;
  }
  function duoValid(g, n) {
    for (let i = 0; i < n; i++) if (!lineOk(rowOf(g, n, i), n) || !lineOk(colOf(g, n, i), n)) return false;
    return linesDistinct(g, n);
  }
  // The rules a person uses: two alike force the third, a full half forces the rest.
  function duoPropagate(g, n) {
    let changed = true;
    const lines = [];
    for (let i = 0; i < n; i++) { lines.push(range(n).map((k) => i * n + k)); lines.push(range(n).map((k) => k * n + i)); }
    while (changed) {
      changed = false;
      for (const idx of lines) {
        for (let k = 0; k + 2 < n; k++) {
          const a = g[idx[k]], b = g[idx[k + 1]], c = g[idx[k + 2]];
          if (a !== -1 && a === b && c === -1) { g[idx[k + 2]] = 1 - a; changed = true; }
          else if (b !== -1 && b === c && a === -1) { g[idx[k]] = 1 - b; changed = true; }
          else if (a !== -1 && a === c && b === -1) { g[idx[k + 1]] = 1 - a; changed = true; }
        }
        let c0 = 0, c1 = 0;
        for (const i of idx) { if (g[i] === 0) c0++; else if (g[i] === 1) c1++; }
        if (c0 > n / 2 || c1 > n / 2) return false;
        if ((c0 === n / 2 || c1 === n / 2) && c0 + c1 < n) {
          const v = c0 === n / 2 ? 1 : 0;
          for (const i of idx) if (g[i] === -1) g[i] = v;
          changed = true;
        }
      }
    }
    return duoValid(g, n);
  }
  function solveDuo(givens, n, limit) {
    let count = 0, first = null;
    (function go(g) {
      if (count >= limit) return;
      if (!duoPropagate(g, n)) return;
      const empty = g.indexOf(-1);
      if (empty === -1) { count++; if (!first) first = g.slice(); return; }
      for (const v of [0, 1]) { const h = g.slice(); h[empty] = v; go(h); }
    })(givens.slice());
    return { count, first };
  }
  function fullDuo(r, n) {
    const g = new Array(n * n).fill(-1);
    (function fill(i) {
      if (i === n * n) return linesDistinct(g, n);
      const row = Math.floor(i / n), col = i % n;
      for (const v of r() < 0.5 ? [0, 1] : [1, 0]) {
        g[i] = v;
        if (lineOk(rowOf(g, n, row), n) && lineOk(colOf(g, n, col), n) && (col < n - 1 || linesDistinct(g, n)) && fill(i + 1)) return true;
      }
      g[i] = -1;
      return false;
    })(0);
    return g;
  }
  function makeDuo(r, n, keep) {
    const solution = fullDuo(r, n), givens = solution.slice();
    const cells = shuffle(r, range(n * n)), stopAt = Math.ceil(n * n * keep);
    let left = n * n;
    for (const cell of cells) {
      if (left <= stopAt) break;
      const v = givens[cell]; givens[cell] = -1;
      if (solveDuo(givens, n, 2).count !== 1) givens[cell] = v; else left--;
    }
    return { size: n, givens, solution };
  }
  function checkDuo(p, g) {
    const n = p.size, bad = new Set();
    for (let i = 0; i < n; i++) {
      for (const [cells, line] of [[range(n).map((k) => i * n + k), rowOf(g, n, i)], [range(n).map((k) => k * n + i), colOf(g, n, i)]]) {
        for (let k = 2; k < n; k++) if (line[k] !== -1 && line[k] === line[k - 1] && line[k] === line[k - 2]) [k, k - 1, k - 2].forEach((j) => bad.add(cells[j]));
        for (const v of [0, 1]) if (line.filter((x) => x === v).length > n / 2) cells.forEach((c, j) => { if (line[j] === v) bad.add(c); });
      }
    }
    const full = !g.includes(-1);
    if (full && !linesDistinct(g, n)) {
      const seen = new Map();
      for (let i = 0; i < n; i++) {
        for (const [key, cells] of [['r' + rowOf(g, n, i).join(''), range(n).map((k) => i * n + k)], ['c' + colOf(g, n, i).join(''), range(n).map((k) => k * n + i)]]) {
          if (seen.has(key)) { cells.forEach((c) => bad.add(c)); seen.get(key).forEach((c) => bad.add(c)); } else seen.set(key, cells);
        }
      }
    }
    return { bad: [...bad], solved: full && bad.size === 0 };
  }

  // ---------- Trail (path through every cell) ----------
  const edge = (a, b) => (a < b ? a + ':' + b : b + ':' + a);
  // A random path through every cell: start from a snake, then "backbite" many times.
  function randomPath(r, n) {
    let path = [];
    for (let row = 0; row < n; row++) for (let k = 0; k < n; k++) path.push(row * n + (row % 2 ? n - 1 - k : k));
    const N = n * n, moves = 12 * N;
    for (let m = 0; m < moves; m++) {
      if (r() < 0.5) path.reverse();
      const end = path[0], nb = neighbours(n, end), x = nb[pick(r, nb.length)];
      const i = path.indexOf(x);
      if (i <= 1) continue;
      path = path.slice(0, i).reverse().concat(path.slice(i));
    }
    return r() < 0.5 ? path : path.reverse();
  }
  // budget: give up (count -1) after this many steps, so a puzzle maker never stalls on a board.
  function solveTrail(n, labels, walls, limit, budget) {
    const N = n * n, visited = new Uint8Array(N), seen = new Uint32Array(N), stack = new Int32Array(N), path = [];
    let K = 0, start = -1, endCell = -1, stamp = 0;
    labels.forEach((v, i) => { if (v > K) { K = v; endCell = i; } if (v === 1) start = i; });
    // Each cell's neighbours through open edges, worked out once.
    const NB = range(N).map((c) => neighbours(n, c).filter((x) => !walls.has(edge(c, x))));
    let count = 0, first = null, steps = 0;
    const found = [];
    // Is the rest impossible? A cell (other than the end) needs two ways in and out, and the cells
    // still to visit must hang together.
    function dead(head) {
      let forced = 0, left = 0, seed = -1;
      for (let c = 0; c < N; c++) {
        if (visited[c]) continue;
        left++; if (seed < 0) seed = c;
        let deg = 0, toHead = false;
        for (const x of NB[c]) { if (!visited[x]) deg++; else if (x === head) { deg++; toHead = true; } }
        if (deg === 0) return true;
        if (c === endCell) continue;
        if (deg === 1) { if (!toHead) return true; if (++forced > 1) return true; }
      }
      if (!left) return false;
      stamp++;
      let top = 0, reached = 1;
      stack[top++] = seed; seen[seed] = stamp;
      while (top) { const c = stack[--top]; for (const x of NB[c]) if (!visited[x] && seen[x] !== stamp) { seen[x] = stamp; reached++; stack[top++] = x; } }
      return reached !== left;
    }
    (function go(cell, next) {
      if (count >= limit || count < 0) return;
      if (budget && ++steps > budget) { count = -1; return; }
      visited[cell] = 1; path.push(cell);
      if (path.length === N) { if (cell === endCell) { count++; found.push(path.slice()); if (!first) first = path.slice(); } }
      else if (cell !== endCell && !dead(cell)) {
        for (const x of NB[cell]) {
          if (visited[x]) continue;
          if (labels[x] && labels[x] !== next) continue;
          go(x, labels[x] ? next + 1 : next);
          if (count >= limit || count < 0) break;
        }
      }
      visited[cell] = 0; path.pop();
    })(start, 2);
    return { count, first, found };
  }
  function makeTrail(r, n, every, wallCount) {
    const N = n * n;
    for (let attempt = 0; attempt < 50; attempt++) {
      const path = randomPath(r, n), at = new Map(path.map((c, i) => [c, i]));
      const marked = new Set([0, N - 1]);
      if (every) for (let i = every; i < N - 1; i += every) marked.add(Math.min(N - 2, i + pick(r, 2)));
      const walls = new Set();
      if (wallCount) {
        const used = new Set(path.slice(1).map((c, i) => edge(path[i], c)));
        const free = [];
        for (let c = 0; c < N; c++) for (const x of neighbours(n, c)) if (x > c && !used.has(edge(c, x))) free.push(edge(c, x));
        shuffle(r, free).slice(0, wallCount).forEach((w) => walls.add(w));
      }
      for (let fix = 0; fix < N; fix++) {
        const labels = new Array(N).fill(0);
        [...marked].sort((a, b) => a - b).forEach((i, k) => { labels[path[i]] = k + 1; });
        const s = solveTrail(n, labels, walls, 2, 20000);
        if (s.count === 1) return { size: n, labels, walls: [...walls], solution: path };
        if (s.count === 0) break;
        if (s.count < 0) { // too open to check quickly: pin one more step of the path and look again
          const free = range(N).filter((i) => !marked.has(i));
          marked.add(free[pick(r, free.length)]);
          continue;
        }
        const other = s.found.find((f) => f.some((c, i) => c !== path[i]));
        let j = 0; while (other[j] === path[j]) j++;
        if (marked.has(j)) { const k = at.get(other[j]); if (marked.has(k)) break; marked.add(k); } else marked.add(j);
      }
    }
    throw new Error('trail: no unique puzzle found');
  }
  function checkTrail(p, path) {
    const n = p.size, N = n * n, walls = new Set(p.walls);
    let next = 1;
    for (let i = 0; i < path.length; i++) {
      const c = path[i];
      if (i && (!neighbours(n, path[i - 1]).includes(c) || walls.has(edge(path[i - 1], c)))) return { solved: false, bad: [c] };
      if (p.labels[c]) { if (p.labels[c] !== next) return { solved: false, bad: [c] }; next++; }
    }
    const K = Math.max(...p.labels);
    return { solved: path.length === N && new Set(path).size === N && next === K + 1 && p.labels[path[N - 1]] === K, bad: [] };
  }

  // ---------- Six (6 × 6 Sudoku) ----------
  const BOX = (i) => Math.floor(Math.floor(i / 6) / 2) * 2 + Math.floor((i % 6) / 3);
  function sixPeers(i) {
    const r = Math.floor(i / 6), c = i % 6, b = BOX(i), out = [];
    for (let j = 0; j < 36; j++) if (j !== i && (Math.floor(j / 6) === r || j % 6 === c || BOX(j) === b)) out.push(j);
    return out;
  }
  const PEERS = range(36).map(sixPeers);
  function solveSix(givens, limit, r) {
    const g = givens.slice();
    let count = 0, first = null;
    (function go() {
      if (count >= limit) return;
      let best = -1, bestOpts = null;
      for (let i = 0; i < 36; i++) {
        if (g[i]) continue;
        const opts = [];
        for (let v = 1; v <= 6; v++) if (!PEERS[i].some((j) => g[j] === v)) opts.push(v);
        if (!opts.length) return;
        if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; if (opts.length === 1) break; }
      }
      if (best === -1) { count++; if (!first) first = g.slice(); return; }
      for (const v of r ? shuffle(r, bestOpts) : bestOpts) { g[best] = v; go(); if (count >= limit) break; }
      g[best] = 0;
    })();
    return { count, first };
  }
  function makeSix(r, minGivens) {
    const solution = solveSix(new Array(36).fill(0), 1, r).first, givens = solution.slice();
    let left = 36;
    for (const cell of shuffle(r, range(36))) {
      if (left <= minGivens) break;
      const v = givens[cell]; givens[cell] = 0;
      if (solveSix(givens, 2).count !== 1) givens[cell] = v; else left--;
    }
    return { size: 6, givens, solution };
  }
  function checkSix(p, g) {
    const bad = new Set();
    for (let i = 0; i < 36; i++) if (g[i] && PEERS[i].some((j) => g[j] === g[i])) bad.add(i);
    return { bad: [...bad], solved: !g.includes(0) && bad.size === 0 };
  }

  // ---------- levels: from gentle to expert ----------
  // Each game ramps up over its first levels, then mixes sizes and difficulty so no two in a row
  // feel the same. The plan for a level comes from its own seed, so it never changes.
  const LABEL = ['Easy', 'Medium', 'Hard', 'Expert'];
  const PLANS = {
    stars(level, r) {
      const n = level <= 8 ? 5 : level <= 30 ? 6 : level <= 80 ? 7 : level <= 160 ? 8 : [7, 8, 8, 9, 9, 9, 10, 10][pick(r, 8)];
      return { n, diff: n <= 6 ? 0 : n <= 8 ? 1 : n === 9 ? 2 : 3 };
    },
    duo(level, r) {
      if (level <= 5) return { n: 4, keep: 0.5, diff: 0 };
      if (level <= 30) return { n: 6, keep: 0.45, diff: 0 };
      if (level <= 80) return { n: 6, keep: 0, diff: 1 };
      if (level <= 160) return [{ n: 6, keep: 0, diff: 1 }, { n: 8, keep: 0.4, diff: 1 }][pick(r, 2)];
      return [{ n: 6, keep: 0, diff: 1 }, { n: 8, keep: 0.35, diff: 2 }, { n: 8, keep: 0, diff: 2 }, { n: 10, keep: 0.35, diff: 3 }][pick(r, 4)];
    },
    trail(level, r) {
      if (level <= 6) return { n: 4, every: 3, walls: 0, diff: 0 };
      if (level <= 30) return { n: 5, every: 4, walls: 0, diff: 0 };
      if (level <= 80) return { n: 6, every: 5, walls: 0, diff: 1 };
      if (level <= 160) return [{ n: 6, every: 0, walls: 2, diff: 1 }, { n: 7, every: 6, walls: 0, diff: 1 }][pick(r, 2)];
      return [{ n: 6, every: 0, walls: 3, diff: 2 }, { n: 7, every: 0, walls: 3, diff: 2 }, { n: 7, every: 8, walls: 2, diff: 2 }, { n: 8, every: 0, walls: 4, diff: 3 }][pick(r, 4)];
    },
    six(level, r) {
      if (level <= 20) return { min: 22, diff: 0 };
      if (level <= 80) return { min: 17, diff: 1 };
      if (level <= 160) return [{ min: 15, diff: 1 }, { min: 13, diff: 2 }][pick(r, 2)];
      return [{ min: 14, diff: 1 }, { min: 12, diff: 2 }, { min: 0, diff: 3 }][pick(r, 3)];
    },
  };
  // Daily puzzles: gentle on Monday, hardest at the weekend.
  const DAILY = {
    stars: [{ n: 7, diff: 1 }, { n: 7, diff: 1 }, { n: 8, diff: 1 }, { n: 8, diff: 1 }, { n: 8, diff: 1 }, { n: 9, diff: 2 }, { n: 9, diff: 2 }],
    duo: [{ n: 6, keep: 0.4, diff: 0 }, { n: 6, keep: 0, diff: 1 }, { n: 6, keep: 0, diff: 1 }, { n: 8, keep: 0.4, diff: 1 }, { n: 8, keep: 0.35, diff: 2 }, { n: 8, keep: 0, diff: 2 }, { n: 8, keep: 0, diff: 2 }],
    trail: [{ n: 6, every: 5, walls: 0, diff: 1 }, { n: 6, every: 6, walls: 1, diff: 1 }, { n: 6, every: 0, walls: 2, diff: 1 }, { n: 7, every: 7, walls: 1, diff: 1 }, { n: 7, every: 0, walls: 3, diff: 2 }, { n: 7, every: 0, walls: 3, diff: 2 }, { n: 7, every: 0, walls: 2, diff: 2 }],
    six: [{ min: 18, diff: 0 }, { min: 16, diff: 1 }, { min: 15, diff: 1 }, { min: 14, diff: 1 }, { min: 13, diff: 2 }, { min: 12, diff: 2 }, { min: 0, diff: 3 }],
  };

  function build(game, plan, r) {
    if (game === 'stars') return makeStars(r, plan.n);
    if (game === 'duo') return makeDuo(r, plan.n, plan.keep);
    if (game === 'trail') return makeTrail(r, plan.n, plan.every, plan.walls);
    if (game === 'six') return makeSix(r, plan.min);
    throw new Error('unknown game ' + game);
  }
  function level(game, n) {
    if (!(n >= 1 && n <= LEVELS)) throw new Error('levels run from 1 to ' + LEVELS);
    const r = rng(hash(game + ':level:' + n)), plan = PLANS[game](n, r);
    return Object.assign({ game, kind: 'level', level: n, difficulty: LABEL[plan.diff] }, build(game, plan, r));
  }
  function daily(game, day) { // day: 'YYYY-MM-DD'
    const weekday = (new Date(day + 'T12:00:00Z').getUTCDay() + 6) % 7, plan = DAILY[game][weekday];
    const r = rng(hash(game + ':daily:' + day));
    return Object.assign({ game, kind: 'daily', day, difficulty: LABEL[plan.diff] }, build(game, plan, r));
  }
  // The number shown on a daily puzzle: days since the games started.
  function dayNumber(day) { return Math.round((Date.parse(day + 'T12:00:00Z') - Date.parse('2026-10-26T12:00:00Z')) / 864e5) + 1; }

  const api = {
    LEVELS, level, daily, dayNumber, hash, rng,
    check: { stars: checkStars, duo: checkDuo, trail: checkTrail, six: checkSix },
    solve: {
      stars: (p) => solveStars(p.size, p.regions, 2).count,
      duo: (p) => solveDuo(p.givens, p.size, 2).count,
      trail: (p) => solveTrail(p.size, p.labels, new Set(p.walls), 2).count,
      six: (p) => solveSix(p.givens, 2).count,
    },
    neighbours, edge,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.BusyGames = api;
})(typeof window !== 'undefined' ? window : globalThis);
