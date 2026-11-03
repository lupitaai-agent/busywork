/* Busy's places: a page as a place you walk through (Tuck's house on Busy Home, the Workshop on Busy
   Business). Every room is a still rendered in the Busy Studio (Unreal Engine) with its own camera; the
   live guide (three.js, the same camera) walks through it, like the pre-rendered screens of a late-1990s
   adventure game. One room per tool: you do the thing, the guide reacts, and "Try it for real" opens the
   tool in the demo.

   The rooms' words and what happens in them live in the page (the <article data-room> list, written by
   build.py); the cameras, spots and decals come from assets/<place>/rooms.json (made by the Busy Studio).
   An act's data-then lists what else happens: "next" (on to the next room), "to:<room>" (straight to that
   room: on Busy Street, a building's close-up), "enter" (through the door: the card's main button, after the
   line), "confetti", "beep", "show:<decal>". A button with
   data-house-go="<room>" goes there too. Decals are flat things in the room the page draws on, like a shop sign in your colour.
   Every room was rendered in the morning, by day and in the evening, with its depth and its lights (busy-studio
   place_web.py): the pictures follow the clock, the guide stands behind the furniture and is lit like the room,
   and the room moves a little with the pointer (the shared engine: app/shared/scene.js).
   Without WebGL the rooms, words and buttons all still work, just without the guide. */
const house = document.querySelector('[data-house]');
if (house) start(house).catch((e) => console.info('The place stays simple:', e && e.message));

async function start(house) {
  const view = house.querySelector('[data-house-view]');
  const plates = [...view.querySelectorAll('[data-house-plate]')];
  const spots = view.querySelector('[data-house-spots]');
  const bubble = view.querySelector('[data-tuck-bubble]');
  const card = house.querySelector('[data-house-card]');
  const title = house.querySelector('[data-house-title]');
  const count = house.querySelector('[data-house-count]');
  const dots = house.querySelector('[data-house-dots]');
  const prev = house.querySelector('.house-nav [data-house-prev]');
  const next = house.querySelector('.house-nav [data-house-next]');
  const decals = view.querySelector('[data-house-decals]');
  const nextLabel = house.dataset.nextLabel || 'Next room →';
  // What the page draws on the room: the decals' words (templates in the page), which are showing, and the brand they wear.
  const decalHtml = Object.fromEntries([...house.querySelectorAll('template[data-decal]')].map((t) => [t.dataset.decal, t.innerHTML]));
  const shown = new Set([...house.querySelectorAll('template[data-decal][data-shown]')].map((t) => t.dataset.decal));
  const brand = { color: house.dataset.brandColor || '#FFC93C', font: '' };
  const steps = [...document.querySelectorAll('[data-room]')].map((a) => ({
    id: a.dataset.room, plate: a.dataset.plate || a.dataset.room, html: a.querySelector('[data-card]').innerHTML, el: a,
    say: a.dataset.say, move: a.dataset.move, acts: [...a.querySelectorAll('[data-act]')].map((t) => ({ id: t.dataset.act, move: t.dataset.move, say: t.dataset.say, then: t.dataset.then, html: t.innerHTML })),
  }));
  const data = await (await fetch(house.dataset.houseRooms)).json();
  // The paid expert's room upstairs (the tour's last room) comes from the experts' own place.
  if (house.dataset.extraRooms) {
    const extra = await (await fetch(house.dataset.extraRooms)).json().catch(() => ({ rooms: [] }));
    extra.rooms.forEach((r) => { r.base = house.dataset.extraPlates; data.rooms.push(r); });
  }
  const roomData = Object.fromEntries(data.rooms.map((r) => [r.id, r]));
  const wide = () => innerWidth * Math.min(devicePixelRatio || 1, 2) > 1400;
  const hour = new Date().getHours(), tod = hour >= 5 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : 'evening';
  const timeOf = (id) => (roomData[id] && roomData[id].times && roomData[id].times.includes(tod) && tod !== 'day' ? '-' + tod : '');
  // The season, by the date (Brazil's are the other way round); summer is the rooms as they always were. ?season=winter shows one.
  const asked = (location.search.match(/[?&]season=(spring|summer|autumn|winter)\b/) || [])[1];
  const north = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][new Date().getMonth()];
  const flip = { spring: 'autumn', summer: 'winter', autumn: 'spring', winter: 'summer' };
  const season = asked || ((document.documentElement.lang || '').toLowerCase() === 'pt-br' ? flip[north] : north);
  const seasonOf = (id) => (roomData[id] && roomData[id].seasons && roomData[id].seasons.includes(season) ? '-' + season : '');
  const base = (id) => (roomData[id] && roomData[id].base) || house.dataset.housePlates;
  const src = (id) => `${base(id)}room-${id}${seasonOf(id)}${timeOf(id)}-${wide() ? 1920 : 1280}.jpg`;
  const depthSrc = (id) => `${base(id)}room-${id}-depth.png`;
  const ready = {};
  const preload = (id) => ready[id] || (ready[id] = new Promise((ok) => { const i = new Image(); i.onload = i.onerror = ok; i.src = src(id); }));

  let at = Math.max(0, steps.findIndex((s) => '#' + s.id === location.hash));
  let tuck = null, busy = false, focusX = 0.5, frame = null, film = null;

  // ---------- framing: the 16:9 room covers the view; on narrow screens it pans to what matters ----------
  function layout() {
    const W = view.clientWidth, H = view.clientHeight;
    let fw = Math.max(W, H * 16 / 9), fh = fw * 9 / 16;
    if (fh < H) { fh = H; fw = H * 16 / 9; }
    const ox = Math.min(0, Math.max(W - fw, W / 2 - focusX * fw)), oy = (H - fh) / 2;
    frame = { W, H, fw, fh, ox, oy };
    plates.concat(film ? [film] : []).forEach((p) => Object.assign(p.style, { width: fw + 'px', height: fh + 'px', left: ox + 'px', top: oy + 'px' }));
    if (tuck) tuck.frame(frame);
    place();
  }
  // Where a point of the room is on screen: the room's own camera (as in Unreal), worked out by hand, so
  // the spots are right before the guide arrives and without WebGL too.
  function onScreen(p, r = roomData[steps[at].plate]) {
    const C = r.camera.position, T = r.camera.target;
    const f = norm(sub(T, C)), rt = norm(cross(f, [0, 1, 0])), up = cross(rt, f);
    const d = sub(p, C), zc = dot(d, f);
    if (zc <= 0) return null;
    const tx = Math.tan(r.camera.hfov * Math.PI / 360), ty = tx / r.camera.aspect;
    const nx = dot(d, rt) / zc / tx, ny = dot(d, up) / zc / ty;
    const sh = tuck ? tuck.shift(zc) : { x: 0, y: 0 };  // the room moves a little with the pointer: so do its spots
    return { x: (nx + 1) / 2 * frame.fw + frame.ox + sh.x, y: (1 - ny) / 2 * frame.fh + frame.oy + sh.y };
  }
  function place() {
    const s = steps[at], r = roomData[s.plate];
    spots.querySelectorAll('[data-spot]').forEach((b) => {
      const h = r.hotspots.find((x) => x.id === b.dataset.spot);
      const pt = h && onScreen(h.at, r);
      if (pt) { b.style.left = pt.x + 'px'; b.style.top = pt.y + 'px'; }
    });
    decals?.querySelectorAll('[data-decal]').forEach((el) => {
      const d = (r.decals || []).find((x) => x.id === el.dataset.decal);
      const pts = d && d.corners.map((c) => onScreen(c, r));
      if (!pts || pts.some((p) => !p)) return;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      Object.assign(el.style, { left: Math.min(...xs) + 'px', top: Math.min(...ys) + 'px', width: w + 'px', height: h + 'px' });
      el.style.setProperty('--h', h + 'px');
    });
    // The bubble sits above the guide's head; while a place has no guide yet, a little right of where it will stand,
    // clear of the things to tap.
    const s0 = r.walk.stand, noGuide = !house.dataset.tuckModel && onScreen([s0[0] + 1, s0[1] + 1.25 * r.tuckHeight, s0[2]], r);
    // On a phone, without a guide, the bubble sits at the bottom of the picture instead.
    bubble.classList.toggle('free', !tuck && frame.W < 760);
    if (!tuck && frame.W < 760) Object.assign(bubble.style, { left: '10px', top: 'auto', bottom: '52px' });
    else if (tuck || noGuide) {
      const head = tuck ? tuck.head() : noGuide;
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
    next.textContent = at === steps.length - 1 ? 'Start again ↺' : nextLabel;
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
      // Tapped again once it's done: the way on that the card offers (the street's "Walk round the Workshop").
      b.addEventListener('click', () => { const way = b.classList.contains('done') && card.querySelector('[data-result]:not([hidden]) a.btn-primary'); if (way) way.click(); else doAct(h.id); });
      spots.append(b);
    });
    drawDecals(r);
    layout();
    stand = standFor(r);
    if (tuck) tuck.room(r, walk, stand);
    focusX = framing(r);
    layout();
    bubble.hidden = !s.say;  // a room without a line (Busy Street's wide shot) doesn't keep the last one
    say(s.say);
    if (s.move && tuck) tuck.play(s.move);
    bindCard();
    if (steps[at + 1]) preload(steps[at + 1].plate);
  }

  // On a narrow screen only part of the room shows. The guide then stands next to the first thing to tap (somewhere
  // along the walk line), so both are in view; the view looks between them.
  let stand = null;
  function standFor(r, h = r.hotspots[0]) {
    const s0 = r.walk.stand;
    if (!frame || !h || frame.W / frame.fw > 0.8) return s0;
    const spot = onScreen(h.at, r), home = onScreen(s0, r);
    if (!spot || !home) return s0;
    const reach = frame.W * 0.42;  // the guide this far from the spot at most
    if (Math.abs(home.x - spot.x) <= reach) return s0;
    const want = spot.x + Math.sign(home.x - spot.x || 1) * reach;
    let best = s0, bestD = Infinity;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40, p = [0, 1, 2].map((i) => r.walk.from[i] + (r.walk.to[i] - r.walk.from[i]) * t);
      const pt = onScreen(p, r);
      if (pt && Math.abs(pt.x - want) < bestD) { bestD = Math.abs(pt.x - want); best = p; }
    }
    return best;
  }
  function framing(r, h = r.hotspots[0]) {
    const xs = [stand || r.walk.stand, ...(h ? [h.at] : [])].map((p) => onScreen(p, r)).filter(Boolean).map((pt) => (pt.x - frame.ox) / frame.fw);
    return xs.length ? Math.min(0.85, Math.max(0.15, xs.reduce((a, b) => a + b, 0) / xs.length)) : 0.5;
  }

  // The decals of this room that are showing, in the brand's colour and font.
  function drawDecals(r = roomData[steps[at].plate]) {
    if (!decals) return;
    decals.innerHTML = '';
    decals.style.setProperty('--brand', brand.color);
    if (brand.font) decals.style.setProperty('--brand-font', brand.font);
    (r.decals || []).filter((d) => shown.has(d.id) && decalHtml[d.id]).forEach((d) => {
      const el = document.createElement('div');
      el.className = 'house-decal'; el.dataset.decal = d.id; el.innerHTML = decalHtml[d.id];
      decals.append(el);
    });
    if (frame) place();
  }

  // Buttons in the card: an act, the next room, or a brand choice (data-paint, data-font) that then does its act.
  function bind(root) {
    root?.querySelectorAll('[data-house-do]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.paint) { brand.color = b.dataset.paint; brand.font = b.dataset.font || ''; shown.add(b.dataset.decal || 'sign'); drawDecals(); }
      doAct(b.dataset.houseDo);
    }));
    root?.querySelectorAll('[data-house-next]').forEach((b) => b.addEventListener('click', () => go(1)));
    root?.querySelectorAll('[data-house-go]').forEach((b) => b.addEventListener('click', () => jump(b.dataset.houseGo)));
  }
  const bindCard = () => bind(card);

  // Doing the room's thing: the guide moves and talks, the result appears in the card.
  async function doAct(id) {
    const s = steps[at];
    const a = s.acts.find((x) => x.id === id);
    if (!a) return;
    const r = roomData[s.plate];
    const h = r.hotspots.find((x) => x.id === id);
    // Frame the guide and the spot together; on a phone the guide first walks over if they're far apart.
    if (h) {
      const st = standFor(r, h);
      const far = tuck && st !== stand && frame.W / frame.fw <= 0.8;
      if (far) stand = st;
      focusX = framing(r, h); layout();
      if (far) await Promise.race([tuck.walk(st), wait(2000)]);
    }
    spots.querySelector(`[data-spot="${id}"]`)?.classList.add('done');
    // "Thinking>Writing>Nodding": one move after the other (the expert at work).
    if (a.move && tuck) a.move.split('>').forEach((m, k) => setTimeout(() => tuck.play(m), k * 1900));
    say(a.say);
    if (a.html.trim()) {
      const out = card.querySelector('[data-result]');
      if (out) { out.innerHTML = a.html; out.hidden = false; out.classList.remove('rise'); void out.offsetWidth; out.classList.add('rise'); }
      bind(out);
      type(out);
      tick(out);
    }
    const then = (a.then || '').split(' ').filter(Boolean);
    then.filter((w) => w.startsWith('show:')).forEach((w) => shown.add(w.slice(5)));
    if (then.some((w) => w.startsWith('show:'))) drawDecals();
    if (then.includes('confetti')) confetti(view);
    if (then.includes('beep')) beep();
    if (then.includes('next')) setTimeout(() => go(1), 1600);
    // "enter": straight through the door after the line (Busy Street's buildings), the way the card's button goes.
    if (then.includes('enter')) setTimeout(() => { const way = card.querySelector('[data-result]:not([hidden]) a.btn-primary'); if (way) way.click(); }, 1500);
    const to = then.find((w) => w.startsWith('to:'));
    if (to) setTimeout(() => jump(to.slice(3)), 700);
  }

  function jump(id) {
    const k = steps.findIndex((x) => x.id === id);
    if (k >= 0 && k !== at) go(k - at);
  }

  async function go(dir) {
    if (busy) return;
    const to = at + dir;
    if (to < 0) return;
    dir = Math.sign(dir);
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
  let sx = null, swiped = false;
  view.addEventListener('pointerdown', (e) => { sx = e.clientX; swiped = false; });
  view.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 60) { swiped = true; go(e.clientX < sx ? 1 : -1); } sx = null; });
  // Tapping the picture itself: the room's thing to do (the one spot, or the nearest), and once it's done, the way
  // on that the card offers (the street's "Walk round the Workshop", "Step inside").
  view.addEventListener('click', (e) => {
    if (swiped || busy || e.target.closest('button, a, [data-tuck-bubble]')) return;
    const r = roomData[steps[at].plate], box = view.getBoundingClientRect();
    const open = r.hotspots.filter((h) => steps[at].el.querySelector(`[data-act="${h.id}"]`) && !spots.querySelector(`[data-spot="${h.id}"].done`));
    const near = open.map((h) => ({ h, pt: onScreen(h.at, r) })).filter((x) => x.pt)
      .map((x) => ({ ...x, d: Math.hypot(x.pt.x - (e.clientX - box.left), x.pt.y - (e.clientY - box.top)) })).sort((a, b) => a.d - b.d)[0];
    if (near && (open.length === 1 || near.d < Math.max(120, box.width * 0.18))) return doAct(near.h.id);
    const way = card.querySelector('[data-result]:not([hidden]) a.btn-primary');
    if (way) way.click();
  });
  new ResizeObserver(layout).observe(view);
  // A link to a room on the same page ("See Juno at work": #upstairs) walks there.
  addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (!steps.some((s) => s.id === id)) return;
    view.scrollIntoView({ block: 'start', behavior: 'smooth' });
    jump(id);
  });

  show(at);
  intro();
  // The intro: the first room's short film (busy-studio render_loops.sh: the camera drifts in and back), once, over the
  // room, then the room itself. It starts and ends on the room's own camera, so the hand-over doesn't jump. Not when the
  // visitor saves data, and any tap ends it.
  function intro() {
    const loops = house.dataset.loops ? JSON.parse(house.dataset.loops) : null;
    const lang = (document.documentElement.lang || 'en').toLowerCase();
    const force = /[?&]film=1\b/.test(location.search);  // ?film=1: a film from another time of day if this one has none (for checking)
    const when = force ? [tod, 'day', 'evening'].find((t) => loops && loops[t]) : tod;
    const file = loops && at === 0 && loops[when] && (loops[when][lang] || (force && loops[when].en));
    // It plays with reduced motion too (the owner's choice, 2026-11-03: the drift is small and slow, like the guides).
    if (!file || (!force && navigator.connection && navigator.connection.saveData)) return;
    film = document.createElement('video');
    Object.assign(film, { muted: true, playsInline: true, preload: 'auto', src: base(steps[0].plate) + file });
    film.className = 'house-film'; film.setAttribute('aria-hidden', 'true');
    view.append(film); house.classList.add('intro'); layout();
    const v = film, end = () => {
      if (v.dataset.end) return;
      v.dataset.end = '1'; v.classList.add('gone'); house.classList.remove('intro');
      setTimeout(() => { v.remove(); if (film === v) film = null; }, 700);
    };
    v.addEventListener('ended', end); v.addEventListener('error', end);
    ['pointerdown', 'keydown', 'wheel'].forEach((e) => house.addEventListener(e, end, { once: true, passive: true }));
    v.play().catch(end);
  }
  // The live guide, once the page itself is there.
  const expert = house.dataset.expert ? { room: house.dataset.expert, model: house.dataset.expertModel, size: +house.dataset.expertSize || 1 } : null;
  const load = () => tuckIn(view, house.dataset.tuckModel, () => frame, +house.dataset.guideHeight || 1, { tod, src, depth: depthSrc, expert }).then((t) => {
    tuck = t; stand = standFor(roomData[steps[at].plate]); tuck.room(roomData[steps[at].plate], false, stand); layout(); place(); view.classList.add('live');
    tuck.onFrame(place);
    if (steps[at].move) tuck.play(steps[at].move);
  }, (e) => console.info('The guide stays away:', e && e.message));
  if (!house.dataset.tuckModel) return;  // no guide yet: the rooms, words and bubble work without one
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

// ---------- the live guide ----------
// The shared scene engine (app/shared/scene.js, a plain script) draws the room with its depth and lights the guide.
const sceneJs = () => window.BusyScene ? Promise.resolve() : new Promise((ok, no) => {
  const t = document.createElement('script'); t.src = new URL('../app/shared/scene.js', import.meta.url).href; t.onload = ok; t.onerror = () => no(new Error('no scene engine')); document.head.append(t);
});

async function tuckIn(view, model, getFrame, size, files) {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
  const THREE = await import('three');
  const { GLTFLoader } = await import('./vendor/three/examples/jsm/loaders/GLTFLoader.js');
  const loader = new GLTFLoader();
  const [gltf] = await Promise.all([loader.loadAsync(model), sceneJs()]);
  const S = window.BusyScene;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  const canvas = renderer.domElement;
  canvas.className = 'house-tuck';
  canvas.setAttribute('aria-hidden', 'true');
  view.querySelector('[data-house-spots]').before(canvas);

  const scene = new THREE.Scene();
  const plate = S.plate(THREE);
  let roomLights = null;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // The guide, one metre tall, feet on the floor (S.character), at their size next to Tuck.
  const who = S.character(THREE, gltf);
  const holder = who.holder, model3 = who.model;
  scene.add(holder);
  // Movements. "Walk" is the steady part of Start Walking, looped (the older Tuck); Meshy guides have a Walk clip.
  const clips = Object.fromEntries(gltf.animations.map((a) => [a.name, a]));
  if (clips.StartWalking && !clips.Walk) { who.actions.Walk = who.mixer.clipAction(THREE.AnimationUtils.subclip(clips.StartWalking, 'Walk', 34, 87, 30)); }
  // Upstairs the guide steps aside and the paid expert stands in the room (loaded the first time it's needed).
  let expert = null, upstairs = false;
  const ex = files.expert;
  const loadExpert = () => expert || (expert = loader.loadAsync(ex.model).then((g) => {
    const w = S.character(THREE, g); w.holder.visible = false; scene.add(w.holder); return w;
  }));
  const active = () => (upstairs && expert && expert.ready ? expert.ready : who);
  function play(name) {
    if (upstairs) { const w = expert && expert.ready; return w && w.play(name); }
    // Short work loops play twice; a long clip once is enough.
    if (name === 'Typing' || name === 'JoggingWithBox') return who.actions[name] && who.play(name, who.actions[name].getClip().duration < 3 ? 2 : 1);
    return who.play(name);
  }

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);
  let room = null, here = null, pivot = 8;
  const base = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const v = new THREE.Vector3();
  const head = model3.getObjectByName('Head');
  function setRoom(r, walk, standAt) {
    room = r;
    upstairs = !!(ex && r.id === ex.room);
    holder.visible = !upstairs;
    if (expert && expert.ready) expert.ready.holder.visible = upstairs;
    if (upstairs) {
      loadExpert().then((w) => {
        expert.ready = w;
        if (room !== r) return;
        const s = r.walk.stand;
        w.holder.position.set(s[0], s[1], s[2]); w.holder.scale.setScalar(r.tuckHeight * ex.size); w.holder.visible = true;
        w.play('Waving');
        listeners.forEach((fn) => fn());
      }, () => {});
    }
    here = standAt || r.walk.stand;
    const p = r.camera.position, t = r.camera.target;
    camera.position.set(p[0], p[1], p[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(t[0], t[1], t[2]);
    camera.fov = 2 * Math.atan(Math.tan((r.camera.hfov * Math.PI / 180) / 2) / r.camera.aspect) * 180 / Math.PI;
    camera.aspect = r.camera.aspect;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    base.copy(camera.position);
    right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
    const s = here;
    pivot = base.distanceTo(v.set(s[0], s[1], s[2]));
    if (!walk) holder.position.set(s[0], s[1], s[2]);
    holder.scale.setScalar(r.tuckHeight * size);
    floor.position.set(s[0], s[1] + 0.003, s[2]);
    holder.rotation.y = 0;
    if (roomLights) scene.remove(roomLights);
    roomLights = S.lights(THREE, r, files.tod, s);
    scene.add(roomLights);
    floor.material.opacity = files.tod === 'evening' ? 0.5 : 0.42;
    // The room itself, drawn with its depth once both pictures are in (the still shows until then).
    view.classList.remove('gl-plate');
    if (r.depth) plate.load(files.src(r.id), files.depth(r.id), r.depth).then((ok) => { if (ok && room === r) view.classList.add('gl-plate'); }, () => {});
    else plate.clear();
    setFrame(getFrame());
  }
  let fr = null;
  function setFrame(f) {
    if (!f) return;
    fr = f;
    renderer.setSize(f.W, f.H, false);
    canvas.style.width = f.W + 'px'; canvas.style.height = f.H + 'px';
    if (room) plate.frame(f, room.camera.hfov, camera);
  }
  // The pointer moves the camera a few centimetres (and its lens back), so near things move more than far ones.
  const AMP = S.reduced() ? 0 : 0.1;
  const par = { x: 0, y: 0, tx: 0, ty: 0 }, paim = { x: 0, y: 0 };
  const fpx = () => (fr && room ? fr.fw / (2 * Math.tan(room.camera.hfov * Math.PI / 360)) : 0);
  const shift = (z) => ({ x: fpx() * par.tx * (1 / pivot - 1 / z), y: fpx() * par.ty * (1 / z - 1 / pivot) });
  function applyCamera() {
    if (!room || !fr) return;
    camera.position.copy(base).addScaledVector(right, par.tx).addScaledVector(up, par.ty);
    const k = fpx();
    camera.setViewOffset(fr.fw, fr.fh, -fr.ox - k * par.tx / pivot, -fr.oy + k * par.ty / pivot, fr.W, fr.H);
    camera.updateProjectionMatrix();
    plate.parallax(par.tx, par.ty, pivot);
  }
  function project(p) {
    const f = getFrame();
    if (!f) return null;
    v.set(p[0], p[1], p[2]).project(camera);
    return { x: (v.x + 1) / 2 * f.W, y: (1 - v.y) / 2 * f.H };
  }
  function headAt() {
    const w = active(), hd = w === who ? head : w.head, hl = w.holder;
    w.model.updateMatrixWorld(true);
    // Above the top of the (big) head: the head bone sits low inside it. Sideways it follows the head as it moves.
    if (hd) hd.getWorldPosition(v); else v.copy(hl.position);
    return project([v.x, hl.position.y + (w === who ? 1.28 : 1.1) * hl.scale.y, v.z]);
  }
  // Walking: out of the room to one side, into the next from the other.
  function walkTo(target, speed = 0.9) {
    return new Promise((done) => {
      const from = holder.position.clone(), to = new THREE.Vector3(...target);
      const dist = from.distanceTo(to);
      if (dist < 0.02) return done();
      holder.rotation.y = to.x > from.x ? Math.PI / 2 : -Math.PI / 2;
      who.play('Walk');
      if (who.actions.Walk) who.actions.Walk.timeScale = 1.6;
      const t0 = performance.now(), dur = dist / speed * 1000;
      walking = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        holder.position.lerpVectors(from, to, k);
        if (k >= 1) { walking = null; holder.rotation.y = 0; who.play('Idle'); done(); }
      };
    });
  }
  let walking = null;
  const leave = (dir) => (upstairs ? Promise.resolve() : walkTo(dir > 0 ? room.walk.to : room.walk.from, 1.3));
  async function enter(dir) {
    if (upstairs) return;
    const startAt = dir > 0 ? room.walk.from : room.walk.to;
    holder.position.set(...startAt);
    await walkTo(here, 1.1);
  }

  // The head follows the pointer, gently; the room shifts with it.
  const aim = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  let lastMove = 0;
  addEventListener('pointermove', (e) => {
    const h = headAt();
    const r = view.getBoundingClientRect();
    if (!h) return;
    aim.x = Math.max(-1, Math.min(1, (e.clientX - r.left - h.x) / (r.width / 2)));
    aim.y = Math.max(-1, Math.min(1, (e.clientY - r.top - h.y) / (r.height / 2)));
    paim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    paim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
    lastMove = performance.now();
  }, { passive: true });
  const q = new THREE.Quaternion(), eul = new THREE.Euler();
  let headBase = null;

  const listeners = [];
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(view);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!onScreen || document.hidden) { if (walking) walking(Infinity); return; }
    if (walking) walking(performance.now());
    const now = performance.now();
    if (now - lastMove > 6000) { const t = now / 1000; paim.x = Math.sin(t * 0.23) * 0.5; paim.y = Math.sin(t * 0.17) * 0.25; }
    const ox = par.tx, oy = par.ty;
    par.x += (paim.x - par.x) * Math.min(1, dt * 2.5); par.y += (paim.y - par.y) * Math.min(1, dt * 2.5);
    par.tx = par.x * AMP; par.ty = -par.y * AMP * 0.5;
    const moved = Math.abs(par.tx - ox) + Math.abs(par.ty - oy) > 0.0004;
    applyCamera();
    if (head && headBase) head.quaternion.copy(headBase);  // undo last frame's turn (a clip may not move the head)
    who.mixer.update(dt);
    if (expert && expert.ready) expert.ready.mixer.update(dt);
    if (!walking && head) {
      headBase = head.quaternion.clone();
      if (now - lastMove > 5000) { const t = now / 1000; aim.x = Math.sin(t * 0.35) * 0.45; aim.y = Math.sin(t * 0.21) * 0.12; }
      look.x += (aim.x - look.x) * Math.min(1, dt * 5);
      look.y += (aim.y - look.y) * Math.min(1, dt * 5);
      eul.set(look.y * 0.3, look.x * 0.55, 0, 'YXZ');
      head.quaternion.multiply(q.setFromEuler(eul));
    } else headBase = null;
    renderer.clear();
    plate.render(renderer);
    renderer.render(scene, camera);
    if (walking || moved) listeners.forEach((fn) => fn());
  });
  const walk = (p) => { here = p; return walkTo(p, 1.1); };
  return { play, room: setRoom, frame: setFrame, project, head: headAt, shift, leave, enter, walk, onFrame: (fn) => listeners.push(fn) };
}
