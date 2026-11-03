/* The puzzle in its room: "🪑 In the room" on a game page shows the Puzzle Parlour room from the Busy Studio
   (assets/parlour/room-<game>-1920.jpg) with a real wooden board in its frame, drawn live with three.js
   through the same camera the room was rendered with (assets/parlour/rooms.json). The pieces are real
   too: brass stars, sun and grape tokens, number tiles, pegs and a cord.

   The game itself does not change. The page's own board (play.js) lies exactly over the wooden one,
   invisible, so every tap, drag and key goes to it as always; this file only watches the board and draws
   what it shows. Without WebGL, or when the person prefers the flat board, nothing here runs. */
import * as THREE from 'three';

const game = document.body.dataset.game;
const play = document.getElementById('play');
const KEY = 'busy.games.room';
const IMG_W = 1920, IMG_H = 1080; // the size the rooms were rendered at
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const t = (s) => (window.BusyI18n ? window.BusyI18n.t(s) : s);

function webgl() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
}
const remembered = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
const remember = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* private window */ } };

// A square (w × h) mapped onto four points on screen: the CSS matrix3d that puts the page's board on the wooden one.
function quadMatrix(w, h, [p0, p1, p2, p3]) {
  const solve = (A, b) => { // Gaussian elimination, 8 × 8
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let m = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[m][c])) m = r;
      [M[c], M[m]] = [M[m], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  };
  const src = [[0, 0], [w, 0], [w, h], [0, h]], dst = [p0, p1, p2, p3], A = [], b = [];
  src.forEach(([x, y], i) => {
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  });
  const [a, bb, c, d, e, f, g, hh] = solve(A, b);
  return `matrix3d(${[a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1].join(',')})`;
}

async function start() {
  if (!game || !play || !webgl()) return;
  const board = play.querySelector('[data-board]');
  if (!board) return;
  const rooms = await fetch(new URL('../parlour/rooms.json', import.meta.url)).then((r) => r.json()).catch(() => null);
  const room = rooms && rooms.rooms.find((r) => r.id === game);
  const frameDecal = room && (room.decals || []).find((d) => d.id === game);
  if (!frameDecal) return;

  // ---------- the switch ----------
  const top = play.querySelector('.play-top');
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'btn room-toggle';
  top.append(toggle);
  const wrap = play.querySelector('.board-wrap');
  const stage = document.createElement('div');
  stage.className = 'room-stage'; stage.hidden = true;
  stage.innerHTML = '<div class="room-bg" aria-hidden="true"></div><canvas class="room-gl" aria-hidden="true"></canvas>';
  wrap.before(stage);
  const bg = stage.querySelector('.room-bg'), canvas = stage.querySelector('.room-gl');
  bg.style.backgroundImage = `url(${new URL(`../parlour/room-${game}-1920.jpg`, import.meta.url)})`;

  // ---------- the scene, through the room's own camera ----------
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const cam = room.camera, aspect = cam.aspect || IMG_W / IMG_H;
  const vfov = 2 * Math.atan(Math.tan((cam.hfov * Math.PI) / 360) / aspect) * 180 / Math.PI;
  const camera = new THREE.PerspectiveCamera(vfov, aspect, 0.05, 200);
  camera.position.fromArray(cam.position); camera.lookAt(new THREE.Vector3().fromArray(cam.target)); camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight(0xc9d2ff, 0x2b2546, 1.1));
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
  const c = frameDecal.corners, wallZ = c[0][2];
  const cx = (c[0][0] + c[1][0]) / 2, cy = (c[0][1] + c[3][1]) / 2, frameW = c[1][0] - c[0][0];
  sun.position.set(cx - 1.4, cy + 2.4, wallZ + 3.2); sun.target.position.set(cx, cy, wallZ);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.bias = -0.0004;
  Object.assign(sun.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.5, far: 8 });
  scene.add(sun, sun.target);

  const S = frameW * 0.93;               // the wooden board inside the gold frame
  const holder = new THREE.Group(); holder.position.set(cx, cy, wallZ); scene.add(holder);
  const wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.7 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(S * 1.04, S * 1.04, 0.05), wood);
  slab.position.z = 0.025; slab.receiveShadow = true; holder.add(slab);
  const pieces = new THREE.Group(); holder.add(pieces);
  const TOP = 0.05;                      // the board's face, in front of the wall

  // ---------- what the board shows, as wood and brass ----------
  const n = () => +getComputedStyle(board).getPropertyValue('--n') || 6;
  const cellXY = (i, N) => { const cs = S / N; return [-S / 2 + cs * ((i % N) + 0.5), S / 2 - cs * (Math.floor(i / N) + 0.5)]; };
  const mats = new Map();
  const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o })); return mats.get(k); };
  const brass = mat(0xf2c14e, { metalness: 0.35, roughness: 0.32, emissive: 0x4a3000, emissiveIntensity: 0.35 });
  const ink = mat(0x24202f, { roughness: 0.6 });
  const tomato = mat(0xd9503f, { roughness: 0.5 });
  const geo = {};
  const starGeo = (r) => {
    if (geo.star) return geo.star;
    const s = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? r * 0.45 : r; s[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
    return (geo.star = new THREE.ExtrudeGeometry(s, { depth: r * 0.28, bevelEnabled: true, bevelThickness: r * 0.08, bevelSize: r * 0.06, bevelSegments: 2 }));
  };
  const digits = new Map();
  const digit = (d, fg, bgc) => {
    const k = d + fg + bgc; if (digits.has(k)) return digits.get(k);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d'); if (bgc) { g.fillStyle = bgc; g.fillRect(0, 0, 128, 128); }
    g.fillStyle = fg; g.font = '900 88px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(d), 64, 70);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: tex, transparent: !bgc, roughness: 0.6 });
    digits.set(k, m); return m;
  };
  const add = (mesh, x, y, z, shadow = true) => { mesh.position.set(x, y, z); mesh.castShadow = shadow; mesh.receiveShadow = true; pieces.add(mesh); return mesh; };
  const tile = (i, N, color, raise = 0.012) => {
    const cs = S / N, [x, y] = cellXY(i, N);
    return add(new THREE.Mesh(new THREE.BoxGeometry(cs * 0.95, cs * 0.95, raise), typeof color === 'object' ? color : mat(color)), x, y, TOP + raise / 2, false);
  };

  function draw() {
    pieces.children.forEach((m) => { if (m.geometry && m.geometry !== geo.star) m.geometry.dispose(); });
    pieces.clear();
    const N = n(), cs = S / N, cells = [...board.querySelectorAll('.cell')];
    cells.forEach((el, i) => {
      const v = el.dataset.v, bad = el.classList.contains('bad');
      const [x, y] = cellXY(i, N);
      if (game === 'stars') {
        tile(i, N, mat(getComputedStyle(el).getPropertyValue('--g').trim() || '#cdd1db', bad ? { emissive: 0x7a1a10, emissiveIntensity: 0.45 } : {}));
        // the patches' edges, as dark grooves, like the lines on the flat board
        const edge = (dx, dy, w, h) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.016), ink), x + dx, y + dy, TOP + 0.009, false);
        if (el.classList.contains('bt')) edge(0, cs / 2, cs, cs * 0.06);
        if (el.classList.contains('bb')) edge(0, -cs / 2, cs, cs * 0.06);
        if (el.classList.contains('bl')) edge(-cs / 2, 0, cs * 0.06, cs);
        if (el.classList.contains('br')) edge(cs / 2, 0, cs * 0.06, cs);
        if (v === '2') { const s = add(new THREE.Mesh(starGeo(cs * 0.34), bad ? tomato : brass), x, y, TOP + 0.014); s.userData.hop = true; }
        if (v === '1') { for (const r of [Math.PI / 4, -Math.PI / 4]) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(cs * 0.42, cs * 0.07, 0.008), ink), x, y, TOP + 0.017, false); b.rotation.z = r; } }
      } else if (game === 'duo') {
        tile(i, N, el.classList.contains('given') ? 0xc9b48a : 0xeadcc0);
        if (v === '0') { const s = add(new THREE.Mesh(new THREE.CylinderGeometry(cs * 0.3, cs * 0.3, cs * 0.12, 32), mat(0xf5b400, { emissive: 0x5a3a00, emissiveIntensity: 0.25 })), x, y, TOP + 0.012 + cs * 0.06); s.rotation.x = Math.PI / 2; s.userData.hop = true; }
        if (v === '1') { [[0, 0.1], [-0.11, -0.06], [0.11, -0.06], [0, -0.2]].forEach(([dx, dy], k) => { const g = add(new THREE.Mesh(new THREE.SphereGeometry(cs * 0.13, 20, 14), mat(0x7b3fa0, { roughness: 0.35 })), x + dx * cs, y + dy * cs, TOP + 0.012 + cs * 0.13); if (!k) g.userData.hop = true; }); }
        if (bad) tile(i, N, mat(0xd9503f, { transparent: true, opacity: 0.35 }), 0.014);
      } else if (game === 'six') {
        const given = el.classList.contains('given'), sel = el.classList.contains('sel');
        tile(i, N, sel ? 0xf3cf6a : given ? 0xd6c7a4 : 0xf1e8d4, given ? 0.02 : 0.012);
        const d = el.textContent.trim();
        if (d) { const f = add(new THREE.Mesh(new THREE.PlaneGeometry(cs * 0.8, cs * 0.8), digit(d, bad ? '#d9503f' : given ? '#24202f' : '#6a3a9a')), x, y, TOP + (given ? 0.021 : 0.013), false); if (!given) f.userData.hop = true; }
      } else if (game === 'trail') {
        tile(i, N, el.classList.contains('on') ? 0xf0c7b9 : 0xebe4d4);
        if (el.classList.contains('wr')) add(new THREE.Mesh(new THREE.BoxGeometry(cs * 0.08, cs, 0.03), ink), x + cs / 2, y, TOP + 0.015);
        if (el.classList.contains('wb')) add(new THREE.Mesh(new THREE.BoxGeometry(cs, cs * 0.08, 0.03), ink), x, y - cs / 2, TOP + 0.015);
        const num = el.querySelector('.num');
        if (num) {
          const peg = add(new THREE.Mesh(new THREE.CylinderGeometry(cs * 0.27, cs * 0.27, 0.04, 28), ink), x, y, TOP + 0.03); peg.rotation.x = Math.PI / 2;
          add(new THREE.Mesh(new THREE.CircleGeometry(cs * 0.24, 28), digit(num.textContent, '#ffffff', '#24202f')), x, y, TOP + 0.051, false);
        }
      }
    });
    if (game === 'trail') {
      const pts = (board.querySelector('polyline')?.getAttribute('points') || '').trim().split(/\s+/).filter(Boolean)
        .map((p) => p.split(',').map(Number)).map(([px, py]) => new THREE.Vector3(-S / 2 + (px / N) * S, S / 2 - (py / N) * S, TOP + 0.03));
      if (pts.length > 1) {
        const path = new THREE.CurvePath(); for (let k = 1; k < pts.length; k++) path.add(new THREE.LineCurve3(pts[k - 1], pts[k]));
        add(new THREE.Mesh(new THREE.TubeGeometry(path, pts.length * 8, cs * 0.09, 10, false), mat(0xc23b2e, { roughness: 0.75 })), 0, 0, 0);
        pts.forEach((p) => add(new THREE.Mesh(new THREE.SphereGeometry(cs * 0.09, 12, 10), mat(0xc23b2e, { roughness: 0.75 })), p.x, p.y, p.z));
      }
    }
    render();
  }

  // ---------- fitting the room to the space on the page ----------
  let crop = null;
  const project = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [(v.x + 1) / 2, (1 - v.y) / 2]; };
  function layout() {
    const W = stage.clientWidth; if (!W) return;
    const A = W < 620 ? 1 : 4 / 3, H = Math.round(W / A);
    stage.style.height = H + 'px';
    camera.clearViewOffset(); camera.updateProjectionMatrix();
    // the frame's place in the full picture, then a window around it in the stage's own shape
    const pts = c.map(([x, y, z]) => project(x, y, z)).map(([u, v]) => [u * IMG_W, v * IMG_H]);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const fw = Math.max(...xs) - Math.min(...xs), fh = Math.max(...ys) - Math.min(...ys);
    let ch = Math.max(fh * 1.3, (fw * 1.3) / A), cw = ch * A;
    if (cw > IMG_W) { cw = IMG_W; ch = cw / A; }
    if (ch > IMG_H) { ch = IMG_H; cw = ch * A; }
    const mx = (Math.max(...xs) + Math.min(...xs)) / 2, my = (Math.max(...ys) + Math.min(...ys)) / 2;
    const x0 = Math.min(Math.max(mx - cw / 2, 0), IMG_W - cw), y0 = Math.min(Math.max(my - ch / 2, 0), IMG_H - ch);
    crop = { x0, y0, cw, ch };
    camera.setViewOffset(IMG_W, IMG_H, x0, y0, cw, ch); camera.updateProjectionMatrix();
    const k = W / cw;
    Object.assign(bg.style, { backgroundSize: `${IMG_W * k}px ${IMG_H * k}px`, backgroundPosition: `${-x0 * k}px ${-y0 * k}px` });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
    // the page's board, invisible, exactly on the wooden one
    const B = 600, corners = [[-S / 2, S / 2], [S / 2, S / 2], [S / 2, -S / 2], [-S / 2, -S / 2]]
      .map(([x, y]) => project(cx + x, cy + y, wallZ + TOP + 0.012)).map(([u, v]) => [u * W, v * H]);
    Object.assign(board.style, { width: B + 'px', height: B + 'px', transform: quadMatrix(B, B, corners) });
    render();
  }

  // ---------- drawing, and a little celebration when it's solved ----------
  let frameReq = 0, party = 0;
  function render() { if (!frameReq) frameReq = requestAnimationFrame(tick); }
  function tick(now) {
    frameReq = 0;
    if (party) {
      const k = (now - party) / 1200;
      pieces.children.forEach((m, i) => { if (m.userData.hop) { m.userData.z0 ??= m.position.z; m.position.z = m.userData.z0 + Math.max(0, Math.sin(Math.min(k, 1) * Math.PI * 3 - i * 0.35)) * 0.06; } });
      sun.intensity = 2.2 + Math.sin(Math.min(k, 1) * Math.PI) * 1.2;
      if (k < 1) render(); else party = 0;
    }
    renderer.render(scene, camera);
  }
  const win = play.querySelector('[data-win]');
  if (win) new MutationObserver(() => { if (!win.hidden && !stage.hidden && !calm) { party = performance.now(); render(); } }).observe(win, { attributes: true, attributeFilter: ['hidden'] });

  // the board redraws itself on every move: draw after it
  let pending = 0;
  new MutationObserver(() => { if (!stage.hidden && !pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); })
    .observe(board, { attributes: true, childList: true, subtree: true, characterData: true });

  // ---------- switching ----------
  const label = (on) => { toggle.textContent = on ? t('▦ Flat board') : t('🪑 In the room'); toggle.setAttribute('aria-pressed', String(on)); };
  function set(on) {
    stage.hidden = !on; play.classList.toggle('in-room', on);
    if (on) { stage.append(board); requestAnimationFrame(() => { layout(); draw(); }); }
    else { wrap.prepend(board); board.style.transform = board.style.width = board.style.height = ''; }
    label(on); remember(on);
  }
  toggle.onclick = () => set(stage.hidden);
  new ResizeObserver(() => { if (!stage.hidden) layout(); }).observe(stage);
  set(remembered());
}

start();
