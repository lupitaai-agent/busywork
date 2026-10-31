/* Tuck's house: the Busy Home page as a place. Every room is a still rendered in the Busy Studio (Unreal
   Engine) with its own camera; the live Tuck (three.js, the same camera) walks through it, like the
   pre-rendered screens of a late-1990s adventure game. One room per tool: you do the thing, Tuck reacts,
   and "Try it for real" opens the tool in the demo.

   The rooms' words and what happens in them live in the page (the <article data-room> list, written by
   build.py); the cameras and spots come from assets/house/rooms.json (made by the Busy Studio).
   Without WebGL the rooms, words and buttons all still work, just without Tuck. */
const house = document.querySelector('[data-house]');
if (house) start(house).catch((e) => console.info('House stays simple:', e && e.message));

async function start(house) {
  const view = house.querySelector('[data-house-view]');
  const plates = [...view.querySelectorAll('[data-house-plate]')];
  const spots = view.querySelector('[data-house-spots]');
  const bubble = view.querySelector('[data-tuck-bubble]');
  const card = house.querySelector('[data-house-card]');
  const title = house.querySelector('[data-house-title]');
  const count = house.querySelector('[data-house-count]');
  const dots = house.querySelector('[data-house-dots]');
  const prev = house.querySelector('[data-house-prev]');
  const next = house.querySelector('[data-house-next]');
  const steps = [...document.querySelectorAll('[data-room]')].map((a) => ({
    id: a.dataset.room, plate: a.dataset.plate || a.dataset.room, html: a.querySelector('[data-card]').innerHTML, el: a,
    say: a.dataset.say, move: a.dataset.move, acts: [...a.querySelectorAll('[data-act]')].map((t) => ({ id: t.dataset.act, move: t.dataset.move, say: t.dataset.say, then: t.dataset.then, html: t.innerHTML })),
  }));
  const data = await (await fetch(house.dataset.houseRooms)).json();
  const roomData = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
  const wide = () => innerWidth * Math.min(devicePixelRatio || 1, 2) > 1400;
  const src = (id) => `${house.dataset.housePlates}room-${id}-${wide() ? 1920 : 1280}.jpg`;
  const ready = {};
  const preload = (id) => ready[id] || (ready[id] = new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = src(id); }));

  let at = Math.max(0, steps.findIndex((s) => '#' + s.id === location.hash));
  let tuck = null, busy = false, focusX = 0.5, frame = null;

  // ---------- framing: the 16:9 room covers the view; on narrow screens it pans to what matters ----------
  function layout() {
    const W = view.clientWidth, H = view.clientHeight;
    let fw = Math.max(W, H * 16 / 9), fh = fw * 9 / 16;
    if (fh < H) { fh = H; fw = H * 16 / 9; }
    const ox = Math.min(0, Math.max(W - fw, W / 2 - focusX * fw)), oy = (H - fh) / 2;
    frame = { W, H, fw, fh, ox, oy };
    plates.forEach((p) => Object.assign(p.style, { width: fw + 'px', height: fh + 'px', left: ox + 'px', top: oy + 'px' }));
    if (tuck) tuck.frame(frame);
    place();
  }
  // Where a point of the room is on screen: the room's own camera (as in Unreal), worked out by hand, so
  // the spots are right before Tuck arrives and without WebGL too.
  function onScreen(p, r = roomData[steps[at].plate]) {
    const C = r.camera.position, T = r.camera.target;
    const f = norm(sub(T, C)), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f);
    const d = sub(p, C), zc = dot(d, f);
    if (zc <= 0) return null;
    const tx = Math.tan(r.camera.hfov * Math.PI / 360), ty = tx / r.camera.aspect;
    const nx = dot(d, rt) / zc / tx, ny = dot(d, up) / zc / ty;
    return { x: (nx + 1) / 2 * frame.fw + frame.ox, y: (1 - ny) / 2 * frame.fh + frame.oy };
  }
  function place() {
    const s = steps[at], r = roomData[s.plate];
    spots.querySelectorAll('[data-spot]').forEach((b) => {
      const h = r.hotspots.find((x) => x.id === b.dataset.spot);
      const pt = h && onScreen(h.at, r);
      if (pt) { b.style.left = pt.x + 'px'; b.style.top = pt.y + 'px'; }
    });
    if (tuck) {
      const head = tuck.head();
      const bw = bubble.offsetWidth || 280;
      const x = Math.min(Math.max(head.x - bw / 2, 12), frame.W - bw - 12);
      Object.assign(bubble.style, { left: x + 'px', top: 'auto', bottom: (frame.H - head.y + 18) + 'px' });
      bubble.style.setProperty('--tail', (head.x - x) + 'px');
    }
  }

  // ---------- talking ----------
  function say(text) {
    if (!text) return;
    bubble.textContent = text;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    bubble.hidden = false;
    requestAnimationFrame(place);
  }

  // ---------- rooms ----------
  function show(i, { walk } = {}) {
    at = (i + steps.length) % steps.length;
    const s = steps[at], r = roomData[s.plate];
    const front = plates[0];
    front.src = src(s.plate);
    front.alt = `${r.name}, rendered in the Busy Studio`;
    title.textContent = s.el.dataset.title;
    count.textContent = `${at + 1} / ${steps.length}`;
    card.innerHTML = s.html;
    card.scrollTop = 0;
    dots.querySelectorAll('button').forEach((d, k) => d.setAttribute('aria-current', k === at ? 'step' : 'false'));
    prev.disabled = at === 0;
    next.textContent = at === steps.length - 1 ? 'Start again ↺' : 'Next room →';
    history.replaceState(null, '', '#' + s.id);
    // The clickable spots of this room.
    spots.innerHTML = '';
    const room = s.el;
    r.hotspots.forEach((h) => {
      const act = room.querySelector(`[data-act="${h.id}"]`);
      if (!act) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'house-spot'; b.dataset.spot = h.id; b.setAttribute('aria-label', h.label);
      b.innerHTML = '<span></span>';
      b.addEventListener('click', () => doAct(h.id));
      spots.append(b);
    });
    if (tuck) tuck.room(r, walk);
    layout();
    focusX = framing(r);
    layout();
    say(s.say);
    if (s.move && tuck) tuck.play(s.move);
    bindCard();
    if (steps[at + 1]) preload(steps[at + 1].plate);
  }

  // Where to look on a narrow screen: between Tuck and the first thing to tap (as a share of the room's width).
  function framing(r) {
    const xs = [r.walk.stand, ...r.hotspots.slice(0, 1).map((h) => h.at)].map((p) => onScreen(p, r)).filter(Boolean).map((pt) => (pt.x - frame.ox) / frame.fw);
    return xs.length ? Math.min(0.85, Math.max(0.15, xs.reduce((a, b) => a + b, 0) / xs.length)) : 0.5;
  }

  function bindCard() {
    card.querySelectorAll('[data-house-do]').forEach((b) => b.addEventListener('click', () => doAct(b.dataset.houseDo)));
    card.querySelectorAll('[data-house-next]').forEach((b) => b.addEventListener('click', () => go(1)));
  }

  // Doing the room's thing: Tuck moves and talks, the result appears in the card.
  async function doAct(id) {
    const s = steps[at];
    const a = s.acts.find((x) => x.id === id);
    if (!a) return;
    const r = roomData[s.plate];
    const h = r.hotspots.find((x) => x.id === id);
    if (h) { const pt = onScreen(h.at, r); if (pt) focusX = Math.min(0.85, Math.max(0.15, (pt.x - frame.ox) / frame.fw)); layout(); }
    spots.querySelector(`[data-spot="${id}"]`)?.classList.add('done');
    if (a.move && tuck) tuck.play(a.move);
    say(a.say);
    if (a.html.trim()) {
      const out = card.querySelector('[data-result]');
      if (out) { out.innerHTML = a.html; out.hidden = false; out.classList.remove('rise'); void out.offsetWidth; out.classList.add('rise'); }
      out?.querySelectorAll('[data-house-do]').forEach((b) => b.addEventListener('click', () => doAct(b.dataset.houseDo)));
      type(out);
      tick(out);
    }
    if (id === 'stamp' || id === 'safe') confetti(view);
    if (id === 'alarm') beep();
    if (a.then === 'next') setTimeout(() => go(1), 1600);
  }

  async function go(dir) {
    if (busy) return;
    const to = at + dir;
    if (to < 0) return;
    busy = true;
    const target = to >= steps.length ? 0 : to;
    const box = view.getBoundingClientRect();
    if (box.top < -box.height / 3 || box.bottom > innerHeight + box.height / 3) view.scrollIntoView({ block: 'start', behavior: 'smooth' });
    await preload(steps[target].plate);
    if (tuck) await Promise.race([tuck.leave(dir), wait(2500)]);
    house.classList.add('cut');
    await wait(180);
    show(target, { walk: dir });
    house.classList.remove('cut');
    if (tuck) await Promise.race([tuck.enter(dir), wait(2500)]);
    busy = false;
    if (tuck && steps[at].move) tuck.play(steps[at].move);
  }

  // ---------- controls ----------
  steps.forEach((s, k) => {
    const d = document.createElement('button');
    d.type = 'button'; d.title = s.el.dataset.title; d.setAttribute('aria-label', `Go to: ${s.el.dataset.title}`);
    d.addEventListener('click', () => { if (k !== at && !busy) { busy = true; preload(steps[k].plate).then(() => { show(k); busy = false; }); } });
    dots.append(d);
  });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select')) return;
    const r = house.getBoundingClientRect();
    if (r.bottom < 80 || r.top > innerHeight - 80) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  let sx = null;
  view.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  view.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 60) go(e.clientX < sx ? 1 : -1); sx = null; });
  new ResizeObserver(layout).observe(view);

  show(at);
  // The live Tuck, once the page itself is there.
  const load = () => tuckIn(view, house.dataset.tuckModel, () => frame).then((t) => {
    tuck = t; tuck.room(roomData[steps[at].plate]); layout(); place(); view.classList.add('live');
    tuck.onFrame(place);
    if (steps[at].move) tuck.play(steps[at].move);
  }, (e) => console.info('Tuck stays away:', e && e.message));
  if (document.readyState === 'complete') idle(load); else addEventListener('load', () => idle(load), { once: true });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function idle(fn) { (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(fn); }

// Typing out a letter, ticking off a list: small touches in the result card.
function type(root) {
  root?.querySelectorAll('[data-type]').forEach((el) => {
    const text = el.textContent; el.textContent = ''; let k = 0;
    const t = setInterval(() => { el.textContent = text.slice(0, ++k); if (k >= text.length) clearInterval(t); }, 18);
  });
}
function tick(root) {
  root?.querySelectorAll('[data-tick]').forEach((li, k) => setTimeout(() => li.classList.add('ticked'), 500 + k * 450));
}
function beep() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.28].forEach((t) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 3100; g.gain.setValueAtTime(0.0001, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t + 0.18);
      o.connect(g).connect(ac.destination); o.start(ac.currentTime + t); o.stop(ac.currentTime + t + 0.2); });
  } catch (e) { /* no sound */ }
}
function confetti(near) {
  const cv = document.createElement('canvas'); cv.className = 'tuck-confetti';
  const dpr = Math.min(devicePixelRatio || 1, 2); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.append(cv);
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const r = near.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height * 0.4;
  const colors = ['#FF8A5B', '#FFC93C', '#2FD18C', '#4DA3FF', '#9B6BFF', '#FF7AC6'];
  const bits = Array.from({ length: 120 }, () => ({ x: ox, y: oy, vx: (Math.random() - 0.5) * 15, vy: Math.random() * -13 - 4, s: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)] }));
  let n = 0;
  (function f() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits.forEach((b) => { b.vy += 0.35; b.x += b.vx; b.y += b.vy; b.a += b.va; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
    if (++n < 130) requestAnimationFrame(f); else cv.remove();
  })();
}

// ---------- the live Tuck ----------
async function tuckIn(view, model, getFrame) {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
  const THREE = await import('three');
  const { GLTFLoader } = await import('../vendor/three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(model);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = 'house-tuck';
  canvas.setAttribute('aria-hidden', 'true');
  view.querySelector('[data-house-spots]').before(canvas);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe6d5, 0x3b2a20, 1.25));
  const key = new THREE.DirectionalLight(0xffd7a8, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2, bottom: -0.5, near: 0.5, far: 12 });
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fe0ff, 2.2);
  scene.add(rim, rim.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Tuck, one metre tall, feet on the floor.
  const holder = new THREE.Group();
  const model3 = gltf.scene;
  model3.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  holder.add(model3);
  scene.add(holder);
  model3.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model3);
  model3.scale.setScalar(1 / (box.max.y - box.min.y));
  model3.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model3);
  const c = box.getCenter(new THREE.Vector3());
  model3.position.set(-c.x, -box.min.y, -c.z);

  // Movements. "Walk" is the steady part of Start Walking, looped.
  const mixer = new THREE.AnimationMixer(model3);
  const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
  if (clips.StartWalking) clips.Walk = THREE.AnimationUtils.subclip(clips.StartWalking, 'Walk', 34, 87, 30);
  const actions = Object.fromEntries(Object.entries(clips).map(([n, a]) => [n, mixer.clipAction(a)]));
  const loops = new Set(['Idle', 'Walk', 'Typing', 'JoggingWithBox']);
  let current = actions.Idle;
  current.play();
  mixer.addEventListener('finished', () => fade(actions.Idle));
  function fade(nextA, loop) {
    if (!nextA) return;
    if (nextA === current) { if (!loop) nextA.reset().play(); return; }
    nextA.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    current.fadeOut(0.25);
    current = nextA;
  }
  function play(name) {
    const a = actions[name];
    if (!a) return;
    const loop = loops.has(name) && name !== 'Typing' && name !== 'JoggingWithBox';
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    a.clampWhenFinished = !loop;
    if (name === 'Typing' || name === 'JoggingWithBox') { a.setLoop(THREE.LoopRepeat, 2); a.clampWhenFinished = true; }
    fade(a, loop);
  }

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);
  let room = null;
  const v = new THREE.Vector3();
  const head = model3.getObjectByName('Head');
  function setRoom(r, walk) {
    room = r;
    const p = r.camera.position, t = r.camera.target;
    camera.position.set(p[0], p[1], p[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(t[0], t[1], t[2]);
    camera.fov = 2 * Math.atan(Math.tan((r.camera.hfov * Math.PI / 180) / 2) / r.camera.aspect) * 180 / Math.PI;
    camera.aspect = r.camera.aspect;
    camera.updateProjectionMatrix();
    const s = r.walk.stand;
    if (!walk) holder.position.set(s[0], s[1], s[2]);
    holder.scale.setScalar(r.tuckHeight);
    key.position.set(s[0] - 2.2, s[1] + 3.2, s[2] + 3.2);
    key.target.position.set(s[0], s[1], s[2]);
    rim.position.set(s[0] + 2.5, s[1] + 2.4, s[2] - 2.5);
    rim.target.position.set(s[0], s[1] + 0.5, s[2]);
    floor.position.set(s[0], s[1] + 0.002, s[2]);
    holder.rotation.y = 0;
  }
  function setFrame(f) {
    if (!f) return;
    renderer.setSize(f.W, f.H, false);
    canvas.style.width = f.W + 'px'; canvas.style.height = f.H + 'px';
    camera.setViewOffset(f.fw, f.fh, -f.ox, -f.oy, f.W, f.H);
    camera.updateProjectionMatrix();
  }
  function project(p) {
    const f = getFrame();
    if (!f) return null;
    v.set(p[0], p[1], p[2]).project(camera);
    return { x: (v.x + 1) / 2 * f.W, y: (1 - v.y) / 2 * f.H };
  }
  function headAt() {
    model3.updateMatrixWorld(true);
    // Above the top of his (big) head: the head bone sits low inside it. Sideways it follows the head as he moves.
    if (head) head.getWorldPosition(v); else v.copy(holder.position);
    return project([v.x, holder.position.y + 1.28 * holder.scale.y, v.z]);
  }
  // Walking: out of the room to one side, into the next from the other.
  function walkTo(target, speed = 0.9) {
    return new Promise((done) => {
      const from = holder.position.clone(), to = new THREE.Vector3(...target);
      const dist = from.distanceTo(to);
      if (dist < 0.02) return done();
      holder.rotation.y = to.x > from.x ? Math.PI / 2 : -Math.PI / 2;
      play('Walk');
      if (actions.Walk) actions.Walk.timeScale = 1.6;
      const t0 = performance.now(), dur = dist / speed * 1000;
      walking = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        holder.position.lerpVectors(from, to, k);
        if (k >= 1) { walking = null; holder.rotation.y = 0; fade(actions.Idle); done(); }
      };
    });
  }
  let walking = null;
  const leave = (dir) => walkTo(dir > 0 ? room.walk.to : room.walk.from, 1.3);
  async function enter(dir) {
    const startAt = dir > 0 ? room.walk.from : room.walk.to;
    holder.position.set(...startAt);
    await walkTo(room.walk.stand, 1.1);
  }

  // The head follows the pointer, gently.
  const aim = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  let lastMove = 0;
  addEventListener('pointermove', (e) => {
    const h = headAt();
    const r = view.getBoundingClientRect();
    if (!h) return;
    aim.x = Math.max(-1, Math.min(1, (e.clientX - r.left - h.x) / (r.width / 2)));
    aim.y = Math.max(-1, Math.min(1, (e.clientY - r.top - h.y) / (r.height / 2)));
    lastMove = performance.now();
  }, { passive: true });
  const q = new THREE.Quaternion(), eul = new THREE.Euler();

  const listeners = [];
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(view);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!onScreen || document.hidden) { if (walking) walking(Infinity); return; }
    if (walking) walking(performance.now());
    mixer.update(dt);
    if (!walking && head) {
      if (performance.now() - lastMove > 5000) { const t = performance.now() / 1000; aim.x = Math.sin(t * 0.35) * 0.45; aim.y = Math.sin(t * 0.21) * 0.12; }
      look.x += (aim.x - look.x) * Math.min(1, dt * 5);
      look.y += (aim.y - look.y) * Math.min(1, dt * 5);
      eul.set(look.y * 0.3, look.x * 0.55, 0, 'YXZ');
      head.quaternion.multiply(q.setFromEuler(eul));
    }
    renderer.render(scene, camera);
    if (walking) listeners.forEach((fn) => fn());
  });
  return { play, room: setRoom, frame: setFrame, project, head: headAt, leave, enter, onFrame: (fn) => listeners.push(fn) };
}
