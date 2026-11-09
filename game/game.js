/* Busy Street: Tuck's Errand. Plays the levels in levels.js. See PLAN.md and LEVELS.md.

   The characters stand in the rooms rendered in the Busy Studio, through each room's own camera, with its depth and lights
   (app/shared/scene.js). The locks are Busy's own puzzles (website/assets/games/engine.js). What the figures say is written in
   lines.js and picked by rules. Tools are separate things a figure picks up and holds, never part of its model. No AI, nothing sent anywhere. */
(async function () {
  'use strict';
  if (window.SNIP_I18N) await window.SNIP_I18N.ready;  // other languages swap the words before anything reads them
  const { THREE, GLTFLoader } = window.BusyThree, S = window.BusyScene, G = window.BusyGames;
  const ASSETS = window.SNIP_ASSETS || '../small-business-tools/website/assets/';  // publish.py sets this for the website and the app
  const $ = (q) => document.querySelector(q);
  const stage = $('[data-stage]'), film = $('[data-film]'), promptEl = $('[data-prompt]'), sayEl = $('[data-say]'), lessonEl = $('[data-lesson]');
  const LEVELS = window.SNIP_LEVELS, LINES = window.SNIP_LINES;
  let paid = null;  // the paid edition's extra layer (ai/paid.js); the free game never loads it
  const EDITION = location.search.includes('web') ? 'web' : location.search.includes('paid') ? 'paid' : (window.SNIP_EDITION || 'download');  // the web build sets this to 'web'; ?web shows it here

  // Each figure has only the moves its levels need. Who can do what is here too.
  const FIGURES = {
    tuck: { name: 'Tuck', glb: 'assets/tuck.glb', size: 1, can: ['hop', 'hide', 'use', 'grab', 'roll', 'toss'] },
    rivet: { name: 'Rivet', glb: 'assets/rivet.glb', size: 0.95, can: ['hop', 'hide', 'use', 'hit', 'lift', 'toss'] },
    pim: { name: 'Pim', glb: 'assets/pim.glb', size: 1.1, can: ['hop', 'hide', 'use', 'climb', 'bar', 'flip', 'toss'] },
    ivy: { name: 'Ivy', glb: 'assets/figures/ivy.glb', size: 1.15, can: ['hop', 'hide', 'use', 'pull', 'swing', 'toss'] },
    olaf: { name: 'Olaf', glb: 'assets/figures/olaf.glb', size: 1.15, can: ['hop', 'hide', 'use', 'reveal', 'toss'] },
    juno: { name: 'Juno', glb: 'assets/figures/juno.glb', size: 1.1, can: ['hop', 'hide', 'use', 'write', 'toss'] },
    zip: { name: 'Zip', glb: 'assets/figures/zip.glb', size: 1.3, can: ['hop', 'hide', 'use', 'grab', 'roll', 'toss', 'flip', 'swing', 'bar', 'vault'] },  // a guest in level 2: the post never stops
    tally: { name: 'Tally', glb: 'assets/figures/tally.glb', size: 0.82, can: [] },
    inspector: { name: 'The inspector', glb: 'assets/figures/inspector.glb', size: 1.25, can: [] },
    tapeling: { name: 'Tapeling', glb: 'assets/figures/tapeling.glb', size: 0.68, can: [] },
    tapeling2: { name: 'Tapeling', glb: 'assets/figures/tapeling.glb', size: 0.68, can: [] },
    snarl: { name: 'Snarl', glb: 'assets/figures/snarl.glb', size: 0.5, can: [] },  // a ball of tape: no rig, it bounces
  };
  const LOOPS = ['Idle', 'Walk', 'Run', 'Sneak', 'Crouch', 'Stagger', 'Charge', 'Stumble', 'Look', 'Climb', 'Rope', 'Ladder', 'Down', 'Alert', 'RopeHang', 'Hang', 'BarL', 'BarR', 'Tightrope', 'Carry', 'PullUp'];
  const CLIMBS = ['Rope', 'Climb', 'Ladder', 'Walk'];
  const IN_AIR = ['Backflip', 'Vault', 'PullUp', 'Catch', 'RopeHang', 'Hang', 'BarL', 'BarR'];  // the game moves these up and down itself
  const PACE = { Pick: 2.6, Hop: 1.7, Fall: 2.4, Snip: 1.3, Stagger: 1.1, Hammer: 1.3, Throw: 1.75, Catch: 1.5, Roll: 1.6, Backflip: 1.9, Vault: 1.4, PullUp: 1.3 };  // how much faster than Meshy's library a move plays
  const TOOLS = { scissors: 'assets/scissors.glb', hammer: 'assets/props/hammer.glb', can: 'assets/props/can.glb' };
  const prop = (n) => `assets/props/${n}.glb`;

  // ---------- the scene ----------
  const canvas = $('[data-gl]');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.autoClear = false;
  const world = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60), plate = window.SnipPlate(THREE);
  const roomCache = {}, FLAT = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  const OWN_ROOMS = ['level1'];  // rooms made for the game, in the game's own folder; the others are the website's
  const roomBase = (place) => (paid && paid.roomBase(place)) || (OWN_ROOMS.includes(place) ? `assets/rooms/${place}/` : `${ASSETS}${place}/`);
  async function roomsOf(place) {
    if (!roomCache[place]) roomCache[place] = Object.fromEntries((await fetch(`${roomBase(place)}rooms.json`).then((r) => r.json())).rooms.map((r) => [r.id, r]));
    return roomCache[place];
  }
  let lights = null, room = null, ox = 0, things = new THREE.Group(); world.add(things);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.ShadowMaterial({ opacity: 0.42 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.003; floor.receiveShadow = true; world.add(floor);

  function size() {
    const W = stage.clientWidth, H = stage.clientHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); renderer.setSize(W, H, false);
    if (room) plate.frame({ W, H, fw: W, fh: W * 9 / 16, ox: 0, oy: 0 }, room.camera.hfov, cam);
  }
  new ResizeObserver(size).observe(stage);
  async function showRoom(p, id, asked) {
    room = (await roomsOf(p))[id];
    const C = room.camera, t = asked && room.times.includes(asked) ? asked : 'day', sea = S.seasonFor(room);
    ox = C.position[0];
    cam.position.fromArray(C.position); cam.up.set(0, 1, 0); cam.lookAt(...C.target);
    cam.fov = 2 * Math.atan(Math.tan(C.hfov * Math.PI / 360) / C.aspect) * 180 / Math.PI;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const base = roomBase(p), name = t === 'day' ? '' : '-' + t;
    await plate.load(`${base}room-${id}${sea}${name}-1920.jpg`, room.depth ? `${base}room-${id}-depth.png` : FLAT, room.depth || { near: 5, far: 40 }, t === 'dark' ? `${base}room-${id}-1920.jpg` : null);
    if (room.loops && room.loops.includes(t)) plate.video(`${base}loop-${id}${name}.mp4`);
    if (lights) world.remove(lights);
    lights = S.lights(THREE, room, t, [ox, 0, -0.1]);
    lights.traverse((l) => { if (l.isDirectionalLight && l.castShadow) Object.assign(l.shadow.camera, { left: -3.6, right: 3.6, top: 2.6, bottom: -1, far: 18 }); });
    if (t === 'evening') lights.add(new THREE.HemisphereLight(0xffdfc0, 0x2c2030, 0.75));  // dusk in the room's picture, but you still have to see who you are
    world.add(lights);
    floor.position.x = ox;
    size();
  }

  // ---------- the figures ----------
  const loader = new GLTFLoader(), figCache = {};
  function onTheSpot(gltf) {  // the game moves the figures itself, so the moves stay on the spot
    for (const clip of gltf.animations) {
      for (const tr of clip.tracks) {
        if (!/Hips\.position$/.test(tr.name)) continue;
        const v = tr.values, keep = clip.name === 'Hop' || CLIMBS.includes(clip.name) || clip.name === 'Down' || IN_AIR.includes(clip.name);
        for (let i = 0; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; if (keep) v[i + 1] = v[1]; }
      }
    }
    return gltf;
  }
  async function figure(key) {
    if (figCache[key]) return figCache[key];
    const f = FIGURES[key], who = S.character(THREE, onTheSpot(await loader.loadAsync(f.glb)), LOOPS);
    for (const [n, k] of Object.entries(PACE)) if (who.actions[n]) who.actions[n].timeScale = k;
    who.holder.scale.setScalar(f.size); who.holder.visible = false; world.add(who.holder);
    who.key = key;
    figCache[key] = who;
    return who;
  }
  const act = (who, names, times) => { for (const n of names) if (who.has(n)) { if (who.playing !== n || times) who.play(n, times); return n; } return false; };

  // ---------- Red Tape that fits: loops on the bones, sized from the body itself, so they bend with the figure ----------
  const red = new THREE.MeshStandardMaterial({ color: 0xe8382a, roughness: 0.5, emissive: 0x8a120a, emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0xb8261b, roughness: 0.6, emissive: 0x5c0c07, emissiveIntensity: 0.9 });
  function measure(who) {
    if (who.fit) return who.fit;
    let mesh = null;
    who.model.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
    const fit = {};
    if (!mesh) return (who.fit = fit);
    const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, sk = mesh.skeleton;
    const v = new THREE.Vector3(), pts = {};
    for (let i = 0; i < pos.count; i += 2) {
      let best = 0, w = 0;
      for (let k = 0; k < 4; k++) { const wk = sw.getComponent(i, k); if (wk > w) { w = wk; best = si.getComponent(i, k); } }
      const bone = sk.bones[best];
      if (!bone) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.bindMatrix).applyMatrix4(sk.boneInverses[best]);
      (pts[bone.name] = pts[bone.name] || []).push([v.x, v.y, v.z]);
    }
    for (const [name, list] of Object.entries(pts)) {
      if (list.length < 12) continue;
      const cx = list.reduce((a, p) => a + p[0], 0) / list.length, cz = list.reduce((a, p) => a + p[2], 0) / list.length;
      const rs = list.map((p) => Math.hypot(p[0] - cx, p[2] - cz)).sort((a, b) => a - b), ys = list.map((p) => p[1]).sort((a, b) => a - b);
      fit[name] = { cx, cz, r: rs[Math.floor(rs.length * 0.9)], y0: ys[Math.floor(ys.length * 0.1)], y1: ys[Math.floor(ys.length * 0.9)] };
    }
    return (who.fit = fit);
  }
  function tangle(who, seed = 1) {
    const fit = measure(who), loops = [];
    const rnd = (k) => { const x = Math.sin(seed * 12.9 + k * 78.2) * 43758.5; return x - Math.floor(x); };
    let k = 0;
    for (const [name, at] of [['Spine', 0.5], ['Spine01', 0.45], ['Spine02', 0.55], ['neck', 0.5], ['LeftArm', 0.55], ['RightArm', 0.4], ['LeftForeArm', 0.45], ['RightForeArm', 0.6], ['LeftUpLeg', 0.5], ['RightUpLeg', 0.35], ['LeftLeg', 0.5], ['RightLeg', 0.55]]) {
      const bone = who.model.getObjectByName(name), f = fit[name];
      if (!bone || !f) continue;
      const m = new THREE.Mesh(new THREE.TorusGeometry(f.r * 1.08, Math.max(f.r * 0.13, 0.001), 6, 22), k % 2 ? dark : red);
      m.position.set(f.cx, f.y0 + (f.y1 - f.y0) * at, f.cz);
      m.rotation.set(Math.PI / 2 + (rnd(k) - 0.5) * 0.7, (rnd(k + 9) - 0.5) * 0.7, 0);
      m.castShadow = true; bone.add(m); loops.push(m); k++;
    }
    return loops;
  }
  function untangle(loops, fallDown) {
    for (const m of loops) {
      if (!fallDown) { m.removeFromParent(); m.geometry.dispose(); continue; }
      things.attach(m);  // keeps where it is in the room, then drops
      m.userData.drop = 0; game.dropping.push(m);
    }
    loops.length = 0;
  }

  // ---------- things in the room ----------
  let puffTex = null;
  function puff() {  // a soft round puff, drawn here
    if (puffTex) return puffTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    puffTex = new THREE.CanvasTexture(c); puffTex.colorSpace = THREE.SRGBColorSpace;
    return puffTex;
  }
  const modelCache = {};
  const model = async (url) => { if (!(url in modelCache)) modelCache[url] = await loader.loadAsync(url).then((g) => g.scene).catch(() => null); return modelCache[url]; };
  function placed(src, height, opts = {}) {  // a copy of a model at the height asked for, standing on the floor
    const c = src.clone(true);
    c.updateMatrixWorld(true);
    let bx = new THREE.Box3().setFromObject(c);
    const sz = bx.getSize(new THREE.Vector3());
    const k = opts.width ? opts.width / sz.x : height / sz.y;
    const g = new THREE.Group(); g.add(c); c.scale.setScalar(k); c.updateMatrixWorld(true);
    bx = new THREE.Box3().setFromObject(c);
    const m = bx.getCenter(new THREE.Vector3());
    c.position.set(-m.x, -bx.min.y, -m.z);
    c.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.size = bx.getSize(new THREE.Vector3());
    return g;
  }
  const wood = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.85, emissive: 0x3a2412, emissiveIntensity: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x6f7a74, roughness: 0.55, metalness: 0.2, emissive: 0x2a2e2c, emissiveIntensity: 0.6 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.5, roughness: 0.4 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d0, roughness: 0.8, emissive: 0x6b5d45, emissiveIntensity: 0.8 });
  const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; };
  let crateModel = null;
  const addAt = (o, x, y = 0, z = -0.1) => { o.position.set(ox + x, y, z); things.add(o); return o; };

  function makeTape(x) {
    const g = new THREE.Group();
    [[0.28, 0.5], [0.62, -0.5], [0.98, 0.5], [1.32, -0.5]].forEach(([y, a], k) => { const s = box(1.05, 0.075, 0.012, k % 2 ? dark : red); s.position.y = y; s.rotation.z = a; g.add(s); });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), red); knot.position.y = 0.8; knot.castShadow = true; g.add(knot);
    return addAt(g, x);
  }
  function makeSpot(a, b) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b - a, 0.55), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.7, depthWrite: false, depthTest: false, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = -1;
    return addAt(m, (a + b) / 2, 0.02, -0.1);
  }
  function makePointer() {  // a little arrow over something you have to go and get
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 12), new THREE.MeshBasicMaterial({ color: 0xffe066, depthTest: false, toneMapped: false }));
    m.rotation.x = Math.PI; m.renderOrder = 5;
    things.add(m);
    return m;
  }
  function pointAt(t) { const m = makePointer(); m.position.set(ox + t.x, t.y + 0.55, t.z === undefined ? 0.02 : t.z); m.userData.y = t.y + 0.55; return m; }
  function makeStack(x) {  // taller than the figures, on the wall side of the walk line
    const g = new THREE.Group(), w = 0.72;
    let y = 0;
    for (let row = 0; y < 1.25; row++) {
      let h = 0.5;
      for (let k = 0; k < 2; k++) {
        const c = placed(crateModel, 0, { width: w });
        h = c.userData.size.y;
        c.position.set(x + (k - 0.5) * w * 1.02 + (row % 2 ? 0.05 : 0), y, -0.72);
        c.rotation.y = (row + k) % 2 ? 0.05 : -0.04;
        g.add(c);
      }
      y += h;
    }
    g.position.x = ox; things.add(g);
    return [x - w, x + w, -1.35];
  }
  function makeSmash(x, tall = 1.3) {
    const g = new THREE.Group();
    let y = 0;
    for (let row = 0; y < tall; row++) {
      const c = placed(crateModel, 0, { width: 0.72 }), h = c.userData.size.y;
      c.position.set(row % 2 ? 0.05 : -0.03, y, 0); c.rotation.y = row % 2 ? 0.12 : -0.08;
      g.add(c); y += h;
    }
    return addAt(g, x);
  }
  function makeFall(x, phase, oneShot) {
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 22), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 }));
    shadow.rotation.x = -Math.PI / 2; addAt(shadow, x, 0.012, -0.1);
    const stack = new THREE.Group();
    for (let k = 0; k < 6; k++) { const s = box(0.62, 0.075, 0.46, k === 3 ? red : paperMat); s.position.set(Math.sin(k * 3.1) * 0.03, k * 0.08 + 0.04, 0); s.rotation.y = Math.sin(k * 1.7) * 0.1; stack.add(s); }
    addAt(stack, x, 5, -0.1);
    return { x, phase, shadow, stack, oneShot, t: 0 };
  }

  // ---------- the game's state ----------
  const game = { level: 0, at: 0, tries: 0, started: false, frozen: true, paused: false, lesson: 0, time: 0, dropping: [] };
  const fresh = () => ({ marks: [], arrow: null, taken: null, coda: null, freedAt: 0, swap: null, throwing: null, grace: 0, mats: {}, lows: [], bars: [], ropes: [], pots: [], targets: [], throwns: [], shards: [], lantern: null, secrets: [], form: null, mouse: null, bait: null, steams: [], valves: [], slots: [], flyers: [], brake: null, seed: null, notes: [], box: null, cat: null, shredder: null, biglever: null, tubes: [], ledges: [], climbs: [], coil: null, pigeons: [], alarm: 0, roller: null, keyHeld: false, knots: [], pulls: [], gate: null, doors: {}, plates: [], smash: null, crate: null, hide: null, spot: null, items: [], guard: null, sight: null, snarls: [], boss: null, falls: [], lever: null, press: null, animals: [], beam: null, dropT: 0 });
  Object.assign(game, fresh());
  const team = [];
  let active = 0;
  const hero = () => team[active];
  const actor = (k) => team.find((a) => a.key === k) || { x: -9, tool: false };
  // At most two on screen, in a level that says so. Whoever is off screen stands at x -9, so nothing in the room can reach them.
  const lvl = () => LEVELS[game.level];
  const onlyOne = (m) => { const t = team.find((a) => FIGURES[a.key].can.includes(m)); return t ? FIGURES[t.key].name : 'someone else'; };
  const moveOK = (m) => !!lvl().stage || (!!lvl().moves && game.at >= lvl().moves[m]);  // level 1 hands the new moves out one room at a time
  const homeZ = (a) => { const l = game.ledges.find((k) => k.z !== undefined && a.x >= k.from - 0.1 && a.x <= k.to + 0.1 && (a.y >= k.y - 0.03 || (a.pull && a.pull.y1 === k.y))); return l ? l.z : -0.1; };  // a roof that stands further back
  const waiting = () => (game.at >= (lvl().joinAt || 0) ? team.filter((a) => a.off) : []);

  const keys = new Set(), pressed = new Set();
  const down = (k) => { if (!keys.has(k)) pressed.add(k); keys.add(k); };
  addEventListener('keydown', (e) => {
    if (e.target && e.target.matches && e.target.matches('input, textarea')) return;  // typing to someone isn't playing
    if ([' ', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    if (e.key === 'h' || e.key === '?') toggleHelp();
    if (e.key === 'm') toggleSound();
    if (game.talking && /^[1-4]$/.test(e.key)) { const q = game.talking.questions[game.talking.asked]; if (q && +e.key <= q.a.length) answer(game.talking, +e.key - 1); }
    down(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());
  document.querySelectorAll('[data-key]').forEach((b) => {
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); ear(); down(b.dataset.key); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((n) => b.addEventListener(n, () => keys.delete(b.dataset.key)));
  });
  const held = (...k) => k.some((x) => keys.has(x)), hit = (...k) => k.some((x) => pressed.has(x));
  function toggleHelp(force) {
    const el = $('[data-help]'), open = force !== undefined ? force : el.hidden;
    el.hidden = !open; game.paused = open; keys.clear();
  }
  $('[data-ask]').onclick = () => toggleHelp(true);
  $('[data-hclose]').onclick = () => toggleHelp(false);

  // ---------- sound: made here, no files ----------
  let ac = null, soundOn = true;
  try { soundOn = localStorage.getItem('snip.sound') !== 'off'; } catch (e) { /* private window */ }
  function ear() {
    if (!ac && (window.AudioContext || window.webkitAudioContext)) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
  }
  addEventListener('keydown', ear); addEventListener('pointerdown', ear);
  function tone(freq, dur, type = 'sine', vol = 0.12, slide = 0, when = 0) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime + when, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.14, freq = 900, when = 0) {
    if (!ac || !soundOn) return;
    const t = ac.currentTime + when, n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    s.connect(f).connect(g).connect(ac.destination); s.start(t);
  }
  const SOUND = {
    hop: () => tone(260, 0.16, 'sine', 0.1, 260),
    land: () => noise(0.06, 0.09, 500),
    step: () => noise(0.035, 0.022, 700),
    pick: () => { tone(520, 0.08, 'triangle', 0.1); tone(780, 0.14, 'triangle', 0.1, 0, 0.08); },
    snip: () => { noise(0.05, 0.16, 5000); noise(0.05, 0.16, 5000, 0.08); },
    hide: () => tone(300, 0.2, 'sine', 0.07, -140),
    out: () => tone(220, 0.14, 'sine', 0.06, 120),
    caught: () => { tone(340, 0.3, 'sawtooth', 0.07, -230); noise(0.2, 0.08, 400); },
    thud: () => { tone(90, 0.22, 'sine', 0.24, -50); noise(0.14, 0.14, 500); },
    hit: () => { tone(150, 0.1, 'square', 0.1, -80); noise(0.08, 0.16, 1600); },
    smash: () => { noise(0.34, 0.24, 1100); tone(110, 0.25, 'sine', 0.2, -60); },
    swap: () => tone(620, 0.09, 'triangle', 0.07, 200),
    click: () => tone(1100, 0.03, 'square', 0.04),
    wrong: () => tone(200, 0.13, 'triangle', 0.08, -60),
    done: () => [523, 659, 784].forEach((f, k) => tone(f, 0.2, 'triangle', 0.1, 0, k * 0.09)),
    free: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tone(f, 0.28, 'triangle', 0.12, 0, k * 0.12)),
    charge: () => noise(0.5, 0.1, 280),
    press: () => { tone(70, 0.25, 'sine', 0.28, -30); noise(0.09, 0.2, 900); },
    lever: () => { tone(180, 0.07, 'square', 0.08); tone(120, 0.1, 'square', 0.08, 0, 0.07); },
  };
  const sfx = (n) => { if (SOUND[n]) SOUND[n](); };
  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem('snip.sound', soundOn ? 'on' : 'off'); } catch (e) { /* private window */ }
    $('[data-mute]').textContent = soundOn ? '♪ Sound on' : '♪ Sound off';
  }
  $('[data-mute]').textContent = soundOn ? '♪ Sound on' : '♪ Sound off';
  $('[data-mute]').onclick = toggleSound;

  // ---------- who says what: rules, no AI ----------
  // A line fits when its conditions hold; a line made for this very moment (with conditions) goes first; nothing repeats until
  // every fitting line has been heard. Lines wait their turn, except the ones that must be heard (force).
  const heard = new Set(), facts = { hidTimes: 0, here: 0, read: new Set(), shown: false, placed: new Set(), kept: new Set(), letters: 0 };
  let sayT = 0, sayWho = null, quiet = 0;
  const fits = (c) => (!c || ((c.minTries === undefined || game.tries >= c.minTries) && (c.maxTries === undefined || game.tries <= c.maxTries)
    && (c.minHere === undefined || facts.here >= c.minHere) && (c.maxHere === undefined || facts.here <= c.maxHere)
    && (c.hidTimes === undefined || facts.hidTimes >= c.hidTimes)));
  function chooseLine(moment) {
    const m = LINES[moment];
    if (!m) return null;
    const all = m.lines.map((l) => (typeof l === 'string' ? { t: l } : { t: l[0], c: l[1] })).filter((l) => fits(l.c));
    let pool = all.filter((l) => !heard.has(moment + l.t));
    if (!pool.length) { all.forEach((l) => heard.delete(moment + l.t)); pool = all; }
    const special = pool.filter((l) => l.c && Object.keys(l.c).length);
    if (special.length) pool = special;
    const l = pool[Math.floor(Math.random() * pool.length)];
    if (!l) return null;
    heard.add(moment + l.t);
    return { who: m.who, text: l.t.replace('{tries}', game.tries + 1) };
  }
  // Someone who isn't on the team, and has tape on them, talks like the tape
  const isTangled = (k) => !!(figCache[k] && figCache[k].tape && figCache[k].tape.length);
  function speak(moment, { force = false, chance = 1, who = null } = {}) {
    if (!force && (sayT > 0 || quiet > 0)) return false;
    if (chance < 1 && Math.random() > chance) return false;
    const l = chooseLine(moment);
    if (!l) return false;
    const m = who || l.who;
    const speaker = m === 'hero' ? hero().key : (figCache[m] && (figCache[m].holder.visible)) ? m : hero().key;
    sayWho = speaker;
    sayEl.innerHTML = `<b>${FIGURES[speaker].name}</b>`; sayEl.append(l.text);
    const tangled = isTangled(speaker);
    sayEl.classList.toggle('tangled', tangled);
    sayEl.classList.toggle('shout', tangled && l.text === l.text.toUpperCase());
    sayEl.hidden = false;
    sayT = Math.max(2.4, Math.min(5.5, l.text.length * 0.065));
    game.spoken = (game.spoken || []).concat(moment);  // for checking
    return true;
  }
  function placeBubble() {
    if (sayEl.hidden || !sayWho) return;
    const fig = figCache[sayWho];
    if (!fig || !fig.holder.visible) { sayEl.hidden = true; return; }
    const v = fig.holder.position.clone(); v.y += 1.08 * fig.holder.scale.y; v.project(cam);
    const w = sayEl.offsetWidth / stage.clientWidth * 50 + 1;
    const x = (v.x + 1) * 50, cx = Math.max(w, Math.min(100 - w, x));
    Object.assign(sayEl.style, { left: cx + '%', top: Math.max(30, (1 - v.y) * 50) + '%' });
    sayEl.style.setProperty('--tail', Math.max(10, Math.min(90, 50 + (x - cx) / (w * 2) * 100)) + '%');
  }
  const psay = (moment) => {
    const l = chooseLine(moment), el = $('[data-psay]');
    el.hidden = !l;
    if (l) el.textContent = `${FIGURES[l.who === 'hero' || !figCache[l.who] ? hero().key : l.who].name}: "${l.text}"`;
  };

  function faceTo(obj, angle, dt, rate = 10) {
    let d = angle - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    obj.rotation.y += d * Math.min(1, dt * rate);
  }
  const inZone = (a = hero()) => game.hide && a.x > game.hide[0] && a.x < game.hide[1] && a.y === 0;
  const screen = () => LEVELS[game.level].screens[game.at];

  // What the running game offers to the lessons in levels.js
  const api = {
    onStage: (k) => team.some((a) => a.key === k && !a.off), lifting: () => team.some((a) => a.carry && a.carry.friend), onRope: () => !!hero().rope, hanging: () => !!hero().hang,
    matOpen: (id) => !!game.mats[id] && game.mats[id].open, bellRung: () => !!game.press && game.press.stopped > 0, keyWith: (k) => !!actor(k).carry && actor(k).carry.name === 'key', carryingPot: () => !!hero().carry && hero().carry.name === 'pot',
    get hero() { return hero(); }, get guard() { return game.guard; }, get boss() { return game.boss; },
    actor, inZone: () => inZone(), gateOpen: () => !!game.gate && game.gate.fall >= 0,
    smashed: () => !game.smash || game.smash.broken, plateDown: () => game.plates.some((p) => p.down),
    snarls: () => game.snarls.filter((s) => !s.flat).length,
    ropeDown: () => !game.coil || game.coil.down, hasKey: () => game.keyHeld, knotsLeft: () => game.knots.filter((k) => !k.done).length,
    grown: () => !!game.seed && game.seed.grown, read: (id) => facts.read.has(id), catMoved: () => !!game.cat && game.cat.moved, boxOn: () => game.plates.some((p) => p.down), wallOpen: () => Object.values(game.doors).some((d) => d.shut && d.open), shredded: () => !!game.shredder && game.shredder.done, talked: () => !!game.boss && game.boss.mode === 'dizzy',
    ropeGrown: () => game.ropes.some((r) => r.grows && r.u >= 0.98), heard: () => !!game.guard && !!game.guard.heard, everyoneHere: () => team.every((a) => !a.off), taken: (n) => game.taken === n, sinceFree: () => (game.boss && game.boss.freed ? game.time - game.freedAt : 0),
    hasLamp: () => !!game.lantern, pullsHeld: () => game.pulls.filter((l) => team.some((a) => Math.abs(a.x - l.x) < 0.5)).length,
    formTried: () => !!game.form && (game.form.tried || game.form.asked > 0), formDone: () => !!game.form && game.form.done, revealed: () => game.secrets.length > 0 && game.secrets.every((x) => x.shown),
    carrying: (n) => team.some((t) => t.carry && (!n || t.carry.name === n)), baitDown: () => !!game.bait, chewed: () => Object.values(game.doors).filter((d) => d.chewed).length,
    placed: () => game.slots.filter((x) => x.filled).length, valved: (id) => game.steams.some((x) => x.id === id && x.stopped > 0), reading: () => !!game.guard && game.guard.read > 0,
    letters: () => facts.letters, cutBy: (k) => game.knots.some((x) => x.by === k && x.done), braked: () => !!game.boss && !!game.boss.braked,
  };

  function showLesson() {
    const l = screen().lessons[game.lesson];
    lessonEl.hidden = !l;
    if (l) lessonEl.innerHTML = l.html;
  }
  function hud() {
    $('[data-where]').textContent = screen().title;
    $('[data-dots]').innerHTML = LEVELS[game.level].screens.map((_, k) => `<i class="${k <= game.at ? 'on' : ''}"></i>`).join('');
    $('[data-tries]').textContent = game.tries ? `Tries: ${game.tries + 1}` : '';
    const tabs = $('[data-team]');
    tabs.hidden = team.length < 2;
    const named = team.filter((t) => !t.off || waiting().includes(t));
    tabs.hidden = named.length < 2;
    if (named.length > 2) tabs.innerHTML = team.map((t, k) => (named.includes(t) ? `<span class="${k === active ? 'me' : t.off ? 'away' : ''}">${k + 1} ${FIGURES[t.key].name}</span>` : '')).join('');
    else tabs.textContent = named.length > 1 ? `You are ${FIGURES[hero().key].name}` : '';
  }
  // The bar: what each action does right now, for whoever you are
  function bar(useLabel, climbHere) {
    const l = screen().lessons[game.lesson], teach = l && l.teach, a = hero(), can = FIGURES[a.key].can;
    const now = { walk: !a.hidden, run: !a.hidden, hop: !a.hidden && can.includes('hop'), hide: can.includes('hide') && (a.hidden || inZone()), use: !!useLabel, hit: !a.hidden && can.includes('hit') && a.tool === 'hammer', switch: team.filter((t) => !t.off).length > 1, throw: !!a.aim || throwable(a), call: waiting().length > 0 && !a.hidden };
    if (can.includes('roll') && !inZone() && a.y < 0.1 && moveOK('roll')) now.hide = !a.hidden;
    const shown = { hit: team.some((t) => FIGURES[t.key].can.includes('hit')), switch: team.length > 1, throw: moveOK('toss'), call: waiting().length > 0 };
    for (const el of document.querySelectorAll('[data-do]')) {
      const id = el.dataset.do;
      el.hidden = id in shown && !shown[id];
      el.classList.toggle('off', !now[id]);
      el.classList.toggle('lit', !!now[id] && (id === 'hide' || id === 'use' || id === 'hit' || id === 'throw'));
      el.classList.toggle('teach', teach === id);
    }
    $('[data-label="hopkey"]').textContent = climbHere === 'up' || climbHere === 'no' ? '↑' : 'Space';
    $('[data-label="hop"]').textContent = climbHere === 'up' ? 'Climb' : 'Hop';
    $('[data-label="use"]').textContent = useLabel || 'Use';
    $('[data-label="hide"]').textContent = a.hidden ? 'Come out' : !inZone() && moveOK('roll') && can.includes('roll') ? 'Roll' : 'Hide';
    const other = team.find((t, k) => k !== active && !t.off);
    $('[data-label="switch"]').textContent = other ? `Swap to ${FIGURES[other.key].name}` : 'Swap';
    if (waiting().length) $('[data-label="call"]').textContent = `Call ${FIGURES[waiting()[0].key].name}`;
  }

  // ---------- building a screen ----------
  async function enter(n, silent) {
    game.frozen = true;
    film.classList.remove('clear');
    await new Promise((r) => setTimeout(r, silent ? 120 : 280));
    game.at = n;
    const sc = screen(), lv = LEVELS[game.level];
    if (sc.everyone) team.forEach((a) => { a.off = false; });  // this job takes all of them
    world.remove(things); things = new THREE.Group(); world.add(things);
    if (game.lantern) { world.remove(game.lantern.light); game.lantern = null; }
    clearAir();
    await showRoom(sc.place || lv.place, sc.room, sc.time);
    Object.assign(game, fresh(), { time: 0, lesson: 0, dropping: [] });  // lessons already done pass by themselves
    if (!silent) { facts.here = 0; facts.shown = false; facts.placed = new Set(); facts.kept = new Set(); facts.letters = 0; }  // a retry keeps what you got done in this room
    for (const f of Object.values(figCache)) { f.holder.visible = false; f.holder.rotation.set(0, Math.PI / 2, 0); if (f.tape && f.tape.length) untangle(f.tape, false); }
    team.forEach((a, k) => {
      if (a.carry) { if (a.carry.mesh) a.who.holder.remove(a.carry.mesh); a.carry = null; }
      if (a.lampMesh) { a.lampMesh.removeFromParent(); a.lampMesh = null; }
      Object.assign(a, { x: -2.4 + team.map((_, i) => team[(active + i) % team.length]).filter((t) => !t.off).indexOf(a) * 0.36, y: 0, z: -0.1, vy: 0, dir: 1, hidden: false, busy: 0, climb: null, fly: null, hang: null, rope: null, pull: null, aim: null, lifted: null, roll: 0, flipped: false, noGrab: 0 });
      if (a.off) { a.x = -9; a.who.holder.position.x = -99; return; }
      a.who.holder.visible = true; a.who.holder.position.set(ox + a.x, 0, a.z); act(a.who, ['Idle']);
    });
    aimDots.visible = aimRing.visible = false;
    makeAir(sc.air);
    for (const t of sc.things) {
      const before = things.children.length;
      await addThing(t);
      if (t.hidden) keepSecret(t, things.children.slice(before));
    }
    hud(); showLesson();
    film.classList.add('clear');
    game.frozen = false;
    sayEl.hidden = true; sayT = 0; quiet = 0.5;
    game.still = 0; game.hiddenFor = 0; game.closeDone = false; game.mutter = 3 + Math.random() * 2;
    setTimeout(() => speak(silent ? game.retryWith || 'retry' : 'enter_' + (sc.say || sc.room), { force: true }), silent ? 450 : 650);
    if (paid) paid.enterRoom(sc, game.level, game);
  }

  async function addThing(t) {
    switch (t.t) {
      case 'crate': {
        if (t.baked) { game.crate = { x: t.x, h: t.h, half: t.half || 0.31 }; break; }  // it is in the room's picture
        const c = placed(crateModel, 0, { width: 0.62 });
        addAt(c, t.x);
        game.crate = { x: t.x, h: c.userData.size.y, half: 0.31 };
        break;
      }
      case 'stack': game.hide = t.baked ? [t.x - 0.72, t.x + 0.72, -1.35] : makeStack(t.x); game.spot = makeSpot(game.hide[0], game.hide[1]); break;
      case 'lantern': {  // lights up the dark room around whoever carries it
        const src = await model(prop('lantern'));
        const mesh = src ? placed(src, 0.42) : box(0.2, 0.3, 0.2, brass);
        addAt(mesh, t.x, 0, 0.02);
        game.items.push({ x: t.x, pocket: 'lantern', lamp: true, mesh, y0: 0 });
        break;
      }
      case 'hide': game.hide = [t.from, t.to, t.z]; game.spot = makeSpot(t.from, t.to); break;
      case 'tool': {
        if (team.some((a) => a.tool === t.tool)) break;
        const src = await model(TOOLS[t.tool]);
        let mesh;
        if (src) { mesh = placed(src, 0.36); mesh.rotation.set(t.y ? 0 : Math.PI / 2, 0, 0.6); } else mesh = box(0.3, 0.05, 0.08, brass);  // up high you'd only see the edge of it if it lay flat
        addAt(mesh, t.x, 0.05 + (t.y || 0), t.z === undefined ? 0.02 : t.z);
        game.items.push({ x: t.x, tool: t.tool, for: t.for, mesh, ly: t.y || 0, pointer: t.y ? pointAt(t) : null });
        break;
      }
      case 'gate': {
        const y = t.y || 0, mesh = makeTape(t.x); mesh.position.y = y;
        game.gate = { x: t.x, y, lock: t.lock, level: t.level || 1, mesh, fall: -1 };
        if (t.lock === 'key') { const src = await model(prop('padlock')); if (src) { game.gate.lockMesh = addAt(placed(src, 0.34), t.x, y + 0.58, 0.02); } }
        break;
      }
      case 'seed': {  // water it, and a vine grows that anyone can climb
        const src = await model(prop('vine'));
        const mesh = src ? placed(src, t.y + 0.5) : box(0.1, t.y + 0.4, 0.1, wood);
        addAt(mesh, t.x, 0, -0.32); mesh.scale.set(0.3, 0.02, 0.3);
        const mound = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 })); mound.scale.y = 0.45; addAt(mound, t.x, 0.02, -0.28);
        game.seed = { x: t.x, y: t.y, mesh, grow: -1, grown: false };
        break;
      }
      case 'note': {  // a note on a post: read it with E
        const src = await model(prop('sign'));
        const mesh = src ? placed(src, 0.95) : box(0.5, 0.7, 0.05, paperMat);
        addAt(mesh, t.x, t.y || 0, t.y ? -0.2 : -0.55);
        game.notes.push({ x: t.x, id: t.id, text: t.text, mesh, y: t.y || 0 });
        break;
      }
      case 'pushbox': {  // only someone strong moves this
        const c = placed(crateModel, 0, { width: 0.62 });
        addAt(c, t.x);
        game.crate = { x: t.x, h: c.userData.size.y, half: 0.31, pushable: true, mesh: c, max: t.max };
        break;
      }
      case 'cat': {
        const src = await model('assets/animals/cat.glb');
        if (!src || !game.crate) break;
        const m = placed(src, 0.42); addAt(m, game.crate.x, game.crate.h, -0.1);
        game.cat = { mesh: m, moved: false, t: -1 };
        break;
      }
      case 'shredder': {
        const src = await model(prop('shredder'));
        const m = src ? placed(src, 0.95) : box(0.8, 0.9, 0.6, iron);
        addAt(m, t.x, 0, -0.1);
        game.shredder = { x: t.x, x0: t.x, to: t.to, mesh: m, on: false, dir: 1, done: false };
        break;
      }
      case 'biglever': {  // only Ivy can move this one
        const src = await model(prop('lever'));
        const m = src ? placed(src, 0.62) : box(0.1, 0.7, 0.08, iron);
        addAt(m, t.x, src ? 0.5 : 0.75, -0.75);
        game.biglever = { x: t.x, mesh: m, used: false, brake: t.brake };
        break;
      }
      case 'tube': {  // the post: only the small fit
        const src = await model(prop('tube'));
        for (const x of [t.x, t.to]) { const m = src ? placed(src, 1.6) : box(0.5, 1.6, 0.5, brass); addAt(m, x, 0, -0.7); }
        game.tubes.push({ x: t.x, to: t.to, fits: t.fits }, { x: t.to, to: t.x, fits: t.fits });
        break;
      }
      case 'talker': {  // not a fight: answer back
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + t.x, 0, -0.1); w.holder.rotation.set(0, -Math.PI / 2, 0);
        act(w, ['Talk', 'Idle']);
        w.tape = tangle(w, 6);
        game.boss = { who: w, key: t.who, kind: 'talk', x: t.x, dir: -1, mode: 'talk', t: 0, freed: false, puzzle: t.puzzle, level: t.level, questions: t.questions, asked: 0 };
        break;
      }
      case 'pots': {  // anyone can throw one of these. Nobody has ever needed this many
        const g = new THREE.Group();
        [[-0.17, 0, 0.05], [0.17, 0, -0.04], [0, 0.24, 0]].forEach(([dx, dy, dz]) => { const m = makePot(); m.position.set(dx, dy, dz); g.add(m); });
        addAt(g, t.x, t.y || 0, t.z !== undefined ? t.z : t.y ? -0.3 : -0.42);
        game.pots.push({ x: t.x, y: t.y || 0 });
        break;
      }
      case 'bell': {  // hit it with something
        const src = await model(prop('bell')), g = new THREE.Group();
        const line = box(0.018, 1.4, 0.018, iron); line.position.y = 0.7; g.add(line);
        const m = src ? placed(src, 0.4) : box(0.3, 0.3, 0.3, brass); m.position.y = -0.34; g.add(m);
        addAt(g, t.x, t.y + 0.14, -0.1);
        game.targets.push({ x: t.x, y: t.y, does: t.does, mesh: g, swing: 0 });
        break;
      }
      case 'mat': {  // sticky tape all over the floor
        const g = new THREE.Group(), w = t.to - t.from;
        const under = box(w, 0.018, 0.62, dark); under.position.set(0, 0.01, 0); g.add(under);
        for (let k = 0; k < Math.ceil(w / 0.3); k++) { const b = box(0.09, 0.02, 0.66, red); b.position.set(-w / 2 + 0.15 + k * 0.3, 0.022, 0); b.rotation.y = (k % 2 ? 1 : -1) * 0.5; g.add(b); }
        addAt(g, (t.from + t.to) / 2, 0, -0.1);
        game.mats[t.id] = { from: t.from, to: t.to, mesh: g, open: false, roll: 1 };
        break;
      }
      case 'low': {  // tape at chest height: only something small gets under it
        const m = makeTape(t.x); m.position.y = 0.62; m.scale.y = 0.72;
        game.lows.push({ x: t.x, mesh: m, gone: false });
        break;
      }
      case 'bar': {  // a pipe up high, for hanging from
        const g = new THREE.Group(), w = t.to - t.from, pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, w, 12), iron);
        pipe.rotation.z = Math.PI / 2; pipe.position.set((t.from + t.to) / 2, t.y, -0.1); pipe.castShadow = true; g.add(pipe);
        for (const px of [t.from, t.to]) { const b = box(0.04, 1.4, 0.04, iron); b.position.set(px, t.y + 0.7, -0.1); g.add(b); }
        g.position.x = ox; things.add(g);
        game.bars.push({ from: t.from, to: t.to, y: t.y });
        break;
      }
      case 'swing': {  // a rope that swings by itself. Catch it as it comes
        const g = new THREE.Group(), line = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, t.len, 8), new THREE.MeshStandardMaterial({ color: 0xc8ad78, roughness: 0.95, emissive: 0x3a2c14, emissiveIntensity: 0.6 }));
        line.position.y = -t.len / 2; line.castShadow = true; g.add(line);
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), line.material); knot.position.y = -t.len; g.add(knot);
        addAt(g, t.x, t.y, -0.1);
        const A = t.sway === undefined ? 0.56 : t.sway;
        const r = { x: t.x, y: t.y, len: t.len, mesh: g, th: A, om: 0, on: null, A, grows: !!t.grows, grown: !t.grows, line, knot, u: 1 };
        if (t.grows) {  // a hanging basket: water it and it comes down
          const pot = makePot(); pot.scale.setScalar(1.5); pot.position.y = -0.74; g.add(pot);
          r.u = 0.42; line.scale.y = r.u; line.position.y = -t.len * r.u / 2; knot.visible = false;
        }
        game.ropes.push(r);
        break;
      }
      case 'ledge': {
        if (t.rope) {  // a tightrope: anyone who gets up here can walk it, carefully
          const g = new THREE.Group(), w = t.to - t.from, line = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, w, 8), new THREE.MeshStandardMaterial({ color: 0x8f6c3a, roughness: 0.95, emissive: 0x3a2c14, emissiveIntensity: 0.5 }));
          line.rotation.z = Math.PI / 2; line.position.set((t.from + t.to) / 2, t.y - 0.02, -0.1); line.castShadow = true; g.add(line);
          const p = box(0.05, t.y + 0.1, 0.05, wood); p.position.set(t.from + 0.02, (t.y + 0.1) / 2, -0.1); g.add(p);
          g.position.x = ox; things.add(g);
          game.ledges.push({ from: t.from, to: t.to, y: t.y, rope: true });
          break;
        }
        if (t.baked) { game.ledges.push({ from: t.from, to: t.to, y: t.y, grab: t.grab, z: t.z }); break; }
        const g = new THREE.Group(), w = t.to - t.from, top = box(w, 0.1, 0.52, wood);
        top.position.set((t.from + t.to) / 2, t.y - 0.05, -0.1); g.add(top);
        for (let k = 0; k <= Math.floor(w / 1.2); k++) { const px = t.from + 0.12 + k * Math.min(1.2, w - 0.24); const b = box(0.12, t.y - 0.1, 0.12, wood); b.position.set(px, (t.y - 0.1) / 2, -0.42); g.add(b); }
        g.position.x = ox; things.add(g);
        game.ledges.push({ from: t.from, to: t.to, y: t.y, grab: t.grab });
        break;
      }
      case 'vine': {  // only a climber goes up this
        const src = await model(prop('vine'));
        if (src) addAt(placed(src, t.y + 0.5), t.x, 0, -0.32); else { const m = box(0.1, t.y + 0.4, 0.1, wood); addAt(m, t.x, (t.y + 0.4) / 2, -0.32); }
        game.climbs.push({ x: t.x, y: t.y, only: 'climb', on: true });
        break;
      }
      case 'ladder': {
        const src = t.baked ? null : await model(prop('ladder'));
        if (src) addAt(placed(src, t.y + 0.35), t.x, 0, -0.28);
        game.climbs.push({ x: t.x, y: t.y, on: true });
        break;
      }
      case 'coil': {  // a rope on a ledge: drop it, and everyone can come up
        const src = await model(prop('rope'));
        const mesh = src ? placed(src, 0, { width: 0.42 }) : box(0.3, 0.12, 0.3, wood);
        addAt(mesh, t.x, t.y, 0.02);
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, t.y, 8), new THREE.MeshStandardMaterial({ color: 0xb79c6c, roughness: 0.95 }));
        line.castShadow = true; line.visible = false; addAt(line, t.x, t.y / 2, 0.08);
        game.coil = { x: t.x, y: t.y, mesh, line, down: false };
        game.climbs.push({ x: t.x, y: t.y, on: false, rope: true });
        break;
      }
      case 'pocket': {  // anyone can carry this: the key
        const src = await model(prop(t.name));
        const mesh = src ? placed(src, 0, { width: t.name === 'cheese' ? 0.28 : 0.34 }) : box(0.3, 0.05, 0.08, brass);
        addAt(mesh, t.x, 0.06 + (t.y || 0), t.z === undefined ? 0.02 : t.z);
        game.items.push({ x: t.x, pocket: t.name, mesh, y0: 0.06 + (t.y || 0), ly: t.y || 0, loose: t.loose, stow: t.stow, pointer: t.stow ? pointAt(t) : null });
        break;
      }
      case 'pigeon': {
        const src = await model('assets/animals/pigeon.glb');
        if (!src) break;
        const m = placed(src, 0.3); addAt(m, t.x, 0, 0.12); m.rotation.y = t.x % 2 ? 0.8 : -0.8;
        game.pigeons.push({ x: t.x, mesh: m, up: false, t: 0 });
        break;
      }
      case 'roller': {
        const src = await model(`assets/animals/${t.name}.glb`);
        if (!src) break;
        const inner = placed(src, 0.34), m = new THREE.Group(); inner.position.y = -0.17; m.add(inner);
        addAt(m, t.from, 0.17, 0);
        game.roller = { mesh: m, x: t.from, from: t.from, to: t.to, speed: t.speed || 1, dir: 1 };
        break;
      }
      case 'knot': {  // one of several anchors; the gate falls when all are cut
        const src = await model(prop('spool'));
        const mesh = src ? placed(src, 0.55) : box(0.4, 0.5, 0.4, red);
        addAt(mesh, t.x, t.y || 0, 0.02);
        game.knots.push({ x: t.x, y: t.y || 0, by: t.by, how: t.how, lock: t.lock, level: t.level, mesh, done: facts.kept.has(t.by) });
        if (facts.kept.has(t.by)) { mesh.visible = false; t.hidden && (mesh.userData.kept = true); }
        break;
      }
      case 'walker': {  // a tapeling: legs, no brain
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + t.x, 0, -0.1); w.holder.rotation.set(0, Math.PI / 2, 0); act(w, ['Run', 'Walk']);
        game.snarls.push({ who: w, mesh: w.holder, x: t.x, from: t.from, to: t.to, dir: 1, flat: false, squash: 1, phase: 0, speed: t.speed || 1.05 });
        break;
      }
      case 'pull': {  // a lever Ivy wants; stand by it and she can't have it
        const src = await model(prop('lever'));
        const m = src ? placed(src, 0.42) : box(0.1, 0.6, 0.08, iron);
        addAt(m, t.x, src ? 0.62 : 0.75, -0.8);
        game.pulls.push({ x: t.x, mesh: m, tilt: 0 });
        break;
      }
      case 'bossivy': {
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + 2.2, 0, -0.1); w.holder.rotation.set(0, -Math.PI / 2, 0);
        act(w, ['Look', 'Idle']);
        w.tape = tangle(w, 4);
        game.boss = { who: w, key: t.who, kind: 'levers', x: 2.2, dir: -1, mode: 'wait', t: 3, freed: false, puzzle: t.puzzle, level: t.level, target: null, last: null };
        break;
      }
      case 'door': game.doors[t.id] = { id: t.id, x: t.x, y: 0, mesh: makeTape(t.x), lift: 0, open: false, shut: t.shut, rolls: t.rolls }; break;
      case 'plate': {
        const src = await model('assets/props/plate.glb');
        const m = src ? placed(src, 0.12, { width: 0.7 }) : box(0.7, 0.05, 0.6, brass);
        addAt(m, t.x, src ? 0 : 0.03, -0.1);
        game.plates.push({ x: t.x, opens: t.opens, mesh: m, down: false, y0: m.position.y });
        break;
      }
      case 'smash': { const mesh = makeSmash(t.x, t.y ? 0.5 : 1.3); mesh.position.y = t.y || 0; game.smash = { x: t.x, y: t.y || 0, mesh, broken: false, parts: 0 }; break; }
      case 'lever': {
        const src = await model('assets/props/lever.glb');
        const m = src ? placed(src, 0.42) : box(0.1, 0.6, 0.08, iron);
        addAt(m, t.x, src ? 0.62 : 0.75, -0.8);
        game.lever = { x: t.x, stops: t.stops, secs: t.secs, opens: t.opens, mesh: m };
        break;
      }
      case 'press': {
        const src = await model('assets/props/press.glb');
        if (src) addAt(placed(src, 2.1), t.x, 0, -0.95);
        const head = new THREE.Group(), slab = box(0.9, 0.16, 0.6, iron), rod = box(0.13, 1.8, 0.13, iron);
        rod.position.y = 0.98; head.add(slab, rod);
        addAt(head, t.x, 1.6, -0.1);
        game.press = { id: t.id, x: t.x, head, phase: 0, stopped: 0, down: false, banged: false };
        break;
      }
      case 'guard': {
        if (team.some((a) => FIGURES[a.key].can.includes('write'))) await model(prop('letter'));
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + t.from, 0, -0.1); w.holder.rotation.y = Math.PI / 2; act(w, ['Idle']);
        w.tape = tangle(w, 5);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.75), new THREE.MeshBasicMaterial({ color: 0xff3a24, transparent: true, opacity: 0.32, depthWrite: false, toneMapped: false }));
        m.rotation.x = -Math.PI / 2; addAt(m, t.from, 0.016, -0.1);
        game.sight = m;
        game.guard = { who: w, key: t.who, x: t.from, dir: 1, wait: 0, seen: 0, awake: false, wake: t.wake || 1, speed: (t.speed || 1.05) * (paid ? paid.guardPace() : 1), pause: t.pause || 1.3, see: t.see || 2.1, read: 0, left: t.left === undefined ? -2.3 : t.left, right: t.right === undefined ? 2.3 : t.right };
        if (t.dir) { game.guard.dir = t.dir; w.holder.rotation.y = t.dir * Math.PI / 2; }
        break;
      }
      case 'snarl': {
        const src = await model(FIGURES.snarl.glb);
        const m = src ? placed(src, FIGURES.snarl.size) : new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), red);
        addAt(m, t.x);
        game.snarls.push({ mesh: m, x: t.x, from: t.from, to: t.to, dir: 1, flat: false, squash: 1, phase: Math.random() * 6 });
        break;
      }
      case 'falling': for (let k = 0; k < (t.count || 4); k++) game.falls.push(makeFall(-1.8 + k * 1.2, k * 0.72)); break;
      case 'boss': {
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + 2.2, 0, -0.1); w.holder.rotation.set(0, -Math.PI / 2, 0);
        act(w, ['Stomp', 'Idle'], w.has('Stomp') ? 2 : undefined);
        w.tape = tangle(w, 2);
        game.boss = { who: w, key: t.who, kind: 'floor', x: 2.2, dir: -1, mode: 'roar', t: 2.4, freed: false, puzzle: t.puzzle, level: t.level };
        break;
      }
      case 'beam': {
        const w = await figure(t.who);
        const y = 1.42, g = new THREE.Group();
        const top = box(5.6, 0.12, 0.26, wood); top.position.set(0, y - 0.06, 0); g.add(top);
        for (const px of [-2.75, t.post, 2.75]) { const p = box(0.16, y - 0.1, 0.16, wood); p.position.set(px, (y - 0.1) / 2, 0); g.add(p); }
        addAt(g, 0, 0, -0.1);
        w.holder.visible = true; w.holder.position.set(ox + 1.4, y, -0.1); w.holder.rotation.set(0, -Math.PI / 2, 0);
        act(w, ['Stagger', 'Walk']);
        w.tape = tangle(w, 3);
        game.beam = { y, post: t.post, frame: g, shake: 0 };
        game.boss = { who: w, key: t.who, kind: 'beam', x: 1.4, y, vy: 0, dir: -1, mode: 'walk', t: 0, freed: false, puzzle: t.puzzle, level: t.level };
        game.dropT = 2;
        game.marks = [...game.pots.map((p) => ({ mesh: makeSpot(p.x - 0.4, p.x + 0.4), show: (h) => !h.carry && FIGURES[h.key].can.includes('toss') })), { mesh: makeSpot(t.post - 0.55, t.post + 0.55), show: (h) => h.tool === 'hammer' }];
        game.arrow = makePointer(); game.arrow.visible = false;
        break;
      }
      case 'animal': {
        const src = await model(`assets/animals/${t.name}.glb`);
        if (!src) break;
        const m = placed(src, t.size || 0.25);
        addAt(m, t.x, 0, t.z === undefined ? -0.5 : t.z);
        game.animals.push({ mesh: m, phase: Math.random() * 6, x: t.x });
        break;
      }
      case 'form': {  // a letterbox that wants a form filled in. The answers are in the small print
        const post = await model(prop('sign')), env = await model(prop('letter'));
        if (post) addAt(placed(post, 0.95), t.x, 0, -0.55);
        if (env) addAt(placed(env, 0, { width: 0.32 }), t.x, 0.98, -0.42);
        game.form = { kind: 'form', x: t.x, name: t.name, questions: t.questions, asked: 0, done: false, tried: false };
        break;
      }
      case 'mouse': {  // chews tape. Goes for cheese, if nobody is standing over it
        const src = await model('assets/animals/mouse.glb');
        if (!src) break;
        const m = placed(src, t.size || 0.2); addAt(m, t.x, 0, 0.1);
        game.mouse = { mesh: m, x: t.x };
        break;
      }
      case 'steam': {
        const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.14, 14), iron); noz.castShadow = true; addAt(noz, t.x, 0.07, -0.1);
        const mat = new THREE.SpriteMaterial({ map: puff(), color: 0xf2f9ff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), plume = new THREE.Group();
        for (let k = 0; k < 11; k++) { const c = new THREE.Sprite(mat); c.userData.at = k / 11; plume.add(c); }
        addAt(plume, t.x, 0, -0.1);
        game.steams.push({ id: t.id, x: t.x, on: t.on || 1.3, off: t.off || 1.5, t: t.phase || 0, plume, mat, linked: t.linked, stopped: 0, blow: false });
        break;
      }
      case 'valve': {
        const src = await model(prop('valve'));
        const m = src ? placed(src, 0.5) : box(0.4, 0.4, 0.08, iron);
        addAt(m, t.x, 0.42, -0.8);
        game.valves.push({ x: t.x, stops: t.stops, secs: t.secs || 5, strong: t.strong, mesh: m });
        break;
      }
      case 'slot': {  // the clean patch in the dust where something belongs
        const src = await model(prop(t.name));
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.27, 28), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
        ring.rotation.x = -Math.PI / 2; addAt(ring, t.x, 0.02, -0.1);
        let ghost = null;
        if (src) {
          ghost = placed(src, t.size || 0.5); ghost.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.33; o.castShadow = false; } });
          addAt(ghost, t.x, 0, -0.1);
        }
        const sl = { name: t.name, x: t.x, ring, ghost, filled: false, size: t.size || 0.5 };
        game.slots.push(sl);
        if (facts.placed.has(t.name)) fillSlot(sl, src);
        break;
      }
      case 'thing': {  // has been moved, labelled, and wants to go home
        if (facts.placed.has(t.name)) break;
        const src = await model(prop(t.name));
        const mesh = src ? placed(src, t.size || 0.5) : box(0.3, 0.3, 0.3, brass);
        addAt(mesh, t.x, 0, 0.02);
        game.items.push({ x: t.x, pocket: t.name, mesh, y0: 0, size: t.size || 0.5 });
        break;
      }
      case 'letters': {  // writes at you from a nest of tape
        const w = await figure(t.who);
        w.holder.visible = true; w.holder.position.set(ox + t.x, 0, -0.1); w.holder.rotation.set(0, -Math.PI / 2, 0);
        act(w, ['Stagger', 'Idle']);
        w.tape = tangle(w, 7);
        await model(prop('letter'));
        const src = await model(prop('cocoon'));
        const pod = src ? addAt(placed(src, 1.55), t.x, 0, -0.5) : null;
        const talkNow = facts.letters >= t.pages.length;
        game.boss = { who: w, key: t.who, kind: 'letters', x: t.x, dir: -1, mode: talkNow ? 'talk' : 'throw', t: 3.4, freed: false, puzzle: t.puzzle, level: t.level, pages: t.pages, questions: t.questions, asked: 0, n: 0, pod };
        break;
      }
      case 'bigspool': {  // where it all comes from
        const src = await model(prop('spool'));
        const m = src ? placed(src, t.size || 2.2) : box(1.2, 2, 1.2, red);
        addAt(m, t.x, 0, t.high ? -1.3 : -0.75);  // far enough back for someone to stand on the shelf in front of it
        game.boss = { kind: 'spool', key: 'spool', x: t.x, mode: 'wind', t: 0, freed: false, puzzle: t.puzzle, level: t.level, mesh: m, braked: false, high: t.high };
        game.dropT = 3;
        break;
      }
      default: console.warn('unknown thing', t);
    }
  }

  // ---------- what's in the air: dust in the light, leaves on the wind, smoke. Made here, so it never loops ----------
  let air = [];
  function clearAir() { for (const a of air) { world.remove(a.obj); if (a.obj.geometry) a.obj.geometry.dispose(); if (a.obj.material) a.obj.material.dispose(); } air = []; }
  function points(n, color, size, opacity, place) {
    const pos = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
    for (let k = 0; k < n; k++) place(pos, k * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const obj = new THREE.Points(geo, new THREE.PointsMaterial({ map: puff(), color, size, transparent: true, opacity, depthWrite: false, toneMapped: false, sizeAttenuation: true }));
    obj.frustumCulled = false; world.add(obj);
    return obj;
  }
  function makeAir(a) {
    if (!a) return;
    if (a.dust) {
      const place = (p, i) => { p[i] = ox + (Math.random() - 0.5) * 5.6; p[i + 1] = Math.random() * 2.9; p[i + 2] = -1.9 + Math.random() * 2.6; };
      air.push({ kind: 'dust', place, obj: points(a.dust, a.dustColor || 0xffe8c0, 0.035, 0.75, place), phase: Math.random() * 9 });
    }
    if (a.leaves) {
      const place = (p, i) => { p[i] = ox + (Math.random() - 0.5) * 6.2; p[i + 1] = Math.random() * 2.8; p[i + 2] = -1.2 + Math.random() * 1.8; };
      air.push({ kind: 'leaves', place, obj: points(a.leaves, a.leafColor || 0xd98a3a, 0.07, 0.95, place), phase: Math.random() * 9 });
    }
    if (a.smoke) {
      const mat = new THREE.SpriteMaterial({ map: puff(), color: a.smokeColor || 0xcfc2c8, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), g = new THREE.Group();
      for (let k = 0; k < 14; k++) { const c = new THREE.Sprite(mat.clone()); c.userData.at = k / 14; g.add(c); }
      g.position.set(ox + a.smoke[0], a.smoke[1], a.smoke[2]); world.add(g);
      air.push({ kind: 'smoke', obj: g });
    }
  }
  function moveAir(dt) {
    for (const a of air) {
      if (a.kind === 'smoke') {
        a.obj.children.forEach((c, k) => {
          const u = (c.userData.at + game.time * 0.09) % 1, w = 0.3 + u * 1.5;
          c.position.set(u * u * 1.5 + Math.sin(game.time * 0.7 + k) * 0.08 * u, u * 2.1, 0); c.scale.set(w, w, 1); c.material.opacity = 0.55 * (1 - u) * Math.min(1, u * 8);
        });
        continue;
      }
      const p = a.obj.geometry.attributes.position, A = p.array, wind = a.kind === 'leaves' ? 0.34 : 0.035;
      for (let i = 0; i < A.length; i += 3) {
        const w = game.time * 0.5 + i;
        A[i] += (wind + Math.sin(w) * wind * 0.8) * dt;
        A[i + 1] += (a.kind === 'leaves' ? -0.2 + Math.sin(w * 2.7) * 0.2 : Math.sin(w * 0.8) * 0.018) * dt;
        if (A[i] > ox + 3.1 || A[i + 1] < 0.02 || A[i + 1] > 3) { a.place(A, i); if (a.kind === 'leaves') { A[i] = ox - 3.1; A[i + 1] = 0.4 + Math.random() * 2.3; } }
      }
      p.needsUpdate = true;
    }
  }

  // ---------- what only Olaf sees ----------
  function keepSecret(t, meshes) {
    const of = [...game.items, ...game.notes, ...game.knots, ...game.slots].filter((o) => meshes.includes(o.mesh) || meshes.includes(o.ring));
    of.forEach((o) => { o.hidden = true; });
    const sec = { meshes, of, shown: false };
    game.secrets.push(sec);
    if (facts.shown) showSecret(sec); else meshes.forEach((m) => { m.visible = false; });
  }
  function showSecret(sec) {
    sec.shown = true; sec.of.forEach((o) => { o.hidden = false; });
    sec.meshes.forEach((m) => { if (!m.userData.kept) m.visible = true; });
  }
  function readRoom(a) {
    facts.shown = true; a.busy = 0.7; act(a.who, ['Scratch', 'Talk', 'Look', 'Idle'], 1); sfx('done');
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.34, 40), new THREE.MeshBasicMaterial({ color: 0xbfa5ff, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; addAt(ring, a.x, 0.03, -0.1); game.ripple = { mesh: ring, t: 0 };
    game.secrets.forEach(showSecret);
    speak('olaf_reads', { force: true });
  }

  // ---------- carrying ----------
  function fillSlot(sl, src) {
    sl.filled = true; sl.ring.visible = false;
    if (sl.ghost) sl.ghost.visible = false;
    if (src) addAt(placed(src, sl.size), sl.x, 0, -0.1);
  }
  function placeBack(a, sl) {
    a.who.holder.remove(a.carry.mesh);
    a.carry = null; a.busy = 0.6; act(a.who, ['Pick', 'PointingGesture'], 1); sfx('pick');
    facts.placed.add(sl.name);
    model(prop(sl.name)).then((src) => fillSlot(sl, src));
    sl.filled = true;
    const left = game.slots.filter((x) => !x.filled).length;
    speak(left ? 'thing_back' : 'things_all', { force: true });
    if (!left && game.gate) { game.gate.fall = 0; sfx('done'); if (game.guard) { game.guard.read = 999; act(game.guard.who, ['Idle']); } }  // nothing left to count
  }
  function leaveBait(a) {
    const c = a.carry;
    a.who.holder.remove(c.mesh); a.carry = null; a.busy = 0.5; act(a.who, ['Pick', 'PointingGesture'], 1); sfx('pick');
    c.mesh.position.set(ox + a.x, 0.04, 0.02); c.mesh.rotation.set(0, 0, 0); things.add(c.mesh);
    game.bait = { x: a.x, mesh: c.mesh, item: c.item, eat: 0 };
    speak('cheese_left', { force: true });
  }
  function moveMouse(dt) {
    const mo = game.mouse, b = game.bait;
    if (!mo) return;
    if (b) {
      const shy = Math.abs(hero().x - b.x) < 0.7 && hero().y < 0.5, d = b.x - mo.x;
      if (Math.abs(d) > 0.14) {
        if (!shy) { mo.x += Math.sign(d) * Math.min(1.5 * dt, Math.abs(d)); mo.mesh.rotation.y = Math.sign(d) * Math.PI / 2; mo.mesh.position.y = Math.abs(Math.sin(game.time * 22)) * 0.012; }
        else if (!b.shyDone) { b.shyDone = true; speak('mouse_shy', { force: true }); }
      } else {
        b.eat += dt;
        b.mesh.scale.setScalar(Math.max(0.1, 1 - b.eat / 2));
        mo.mesh.rotation.z = Math.sin(game.time * 30) * 0.06;
        if (b.eat > 1.6) {
          things.remove(b.mesh); game.bait = null; mo.mesh.rotation.z = 0;
          const wall = Object.values(game.doors).find((w) => w.shut && !w.open && Math.abs(w.x - b.x) < 0.8);
          if (wall) { wall.open = true; wall.chewed = true; sfx('snip'); speak('mouse_chews', { force: true }); }
          else {
            const it = b.item; it.mesh.scale.setScalar(1); it.mesh.position.set(ox + it.x, it.y0 || 0, 0.02); things.add(it.mesh); game.items.push(it);
            speak('mouse_wasted', { force: true });
          }
        }
      }
    }
    mo.mesh.position.x = ox + mo.x;
  }

  // ---------- two on screen: you go, they come ----------
  const blockers = () => [...(game.gate && game.gate.fall < 0 && !game.gate.y ? [game.gate.x] : []), ...(game.smash && !game.smash.broken && !game.smash.y ? [game.smash.x] : []), ...Object.values(game.doors).filter((d) => !d.open).map((d) => d.x), ...game.lows.map((l) => l.x)];
  function callIn(inc) {
    const out = hero(), stops = blockers();
    dropFriend(out);
    const toLeft = !stops.some((x) => x < out.x), toRight = !stops.some((x) => x > out.x);
    const dir = toLeft && toRight ? (out.x < 0 ? -1 : 1) : toRight ? 1 : -1;
    // They come in from the way we came, as far as they can get, and never straight into trouble
    let to = Math.min(out.x, ...stops.map((x) => x - 0.45));
    for (const m of Object.values(game.mats)) if (!m.open && to > m.from - 0.35) to = m.from - 0.4;
    for (const n of game.snarls) if (!n.flat && to > n.from - 0.6) to = n.from - 0.6;
    if (game.press && Math.abs(to - game.press.x) < 0.8) to = game.press.x - 0.85;
    to = Math.max(-2.3, to);
    const away = dir * 3.3, outT = Math.max(0.5, Math.abs(away - out.x) / 4.4), inT = Math.max(0.6, (to + 3.3) / 4.4);
    game.swap = { out, inc, t: 0, x0: out.x, y0: out.y, z0: out.z, away, outT, inT, start: 0.25, to, dir };
    Object.assign(inc, { off: false, x: -3.3, y: 0, z: -0.55, vy: 0, dir: 1 });
    inc.who.holder.visible = true; inc.who.holder.rotation.set(0, Math.PI / 2, 0); inc.who.holder.position.set(ox - 3.3, 0, -0.55);
    act(out.who, ['Run', 'Walk']); act(inc.who, ['Run', 'Walk']); sfx('swap'); sfx('hop');
    promptEl.hidden = true; lessonEl.classList.add('dim');
  }
  function moveSwap(dt) {  // everything else waits: a swap never gets you caught
    const s = game.swap, { out, inc } = s;
    s.t += dt;
    const u = Math.min(1, s.t / s.outT), v = Math.max(0, Math.min(1, (s.t - s.start) / s.inT));
    out.x = s.x0 + (s.away - s.x0) * u; out.y = s.y0 > 0.01 ? s.y0 * (1 - u) * (1 - u) + Math.sin(u * Math.PI) * 0.25 : 0; out.z = s.z0 + (-0.55 - s.z0) * Math.min(1, u * 3);
    faceTo(out.who.holder, s.dir * Math.PI / 2, dt, 16);
    out.who.holder.position.set(ox + out.x, out.y, out.z);
    inc.x = -3.3 + (s.to + 3.3) * v; inc.z = -0.55 + 0.45 * Math.min(1, v * 2.2);
    inc.who.holder.position.set(ox + inc.x, 0, inc.z);
    if (s.t >= s.start + s.inT && u >= 1) {
      Object.assign(out, { off: true, x: -9, y: 0, z: -0.1, vy: 0, aim: null, roll: 0 });
      out.who.holder.visible = false; act(out.who, ['Idle']);
      active = team.indexOf(inc); inc.x = s.to; inc.z = -0.1;
      game.swap = null; game.grace = 0.5; lessonEl.classList.remove('dim');
      act(inc.who, ['Wave', 'Cheer', 'Idle'], 1); hud();
      speak('swap_' + inc.key, { chance: 0.8 });
    }
  }

  // ---------- throwing: hold T, the spot moves with the arrows, let go ----------
  const aimDots = new THREE.Group(), aimRing = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.25, 32), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false });
  for (let k = 0; k < 16; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), dotMat); d.renderOrder = 20; aimDots.add(d); }
  aimRing.rotation.x = -Math.PI / 2; aimRing.renderOrder = 20; aimDots.visible = aimRing.visible = false; world.add(aimDots, aimRing);
  const potGeo = new THREE.LatheGeometry([[0.001, 0], [0.085, 0], [0.13, 0.17], [0.15, 0.2], [0.15, 0.25], [0.125, 0.25], [0.11, 0.2], [0.001, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 18);
  const potMat = new THREE.MeshStandardMaterial({ color: 0xc06a3e, roughness: 0.8, emissive: 0x4a1f10, emissiveIntensity: 0.65, side: THREE.DoubleSide });
  function makePot() { const m = new THREE.Mesh(potGeo, potMat); m.castShadow = true; return m; }
  function throwable(a) { return !!(a.carry && a.carry.throwable && FIGURES[a.key].can.includes('toss')); }
  const REACH = { rivet: 4.6 };
  function surfaceAt(x, friend) {
    let y = 0;
    for (const l of game.ledges) if (!l.rope && x >= l.from - 0.05 && x <= l.to + 0.05 && l.y > y) y = l.y;
    if (!friend && game.beam && Math.abs(x) < 2.8) y = Math.max(y, game.beam.y);
    return y;
  }
  function aimRange(a) {
    const r = REACH[a.key] || 3.4;
    let lo = Math.max(-2.55, a.x - r), hi = Math.min(2.55, a.x + r);
    if (a.carry.friend) for (const x of blockers()) { if (x > a.x) hi = Math.min(hi, x - 0.3); else lo = Math.max(lo, x + 0.3); }  // nobody gets thrown past the tape
    return [lo, Math.max(lo, hi)];
  }
  function solveArc(a) {
    const friend = !!a.carry.friend, x0 = a.x, y0 = a.y + (friend ? 1.5 : 1.2);
    let tx = a.aim.x, ty = surfaceAt(tx, friend), snap = null;
    if (!friend) {
      const tg = game.targets.find((t) => Math.abs(t.x - tx) < 0.42);
      if (tg) { tx = tg.x; ty = tg.y; snap = tg; }
      const mate = a.carry.name === 'key' && team.find((t) => t !== a && !t.off && Math.abs(t.x - tx) < 0.5);
      if (mate && !snap) { tx = mate.x; ty = mate.y + 0.85; snap = mate; }
    }
    const air = () => {
      const apex = Math.max(y0, ty) + (friend ? 0.22 : 0.5) + Math.abs(tx - x0) * (friend ? 0.08 : 0.14);  // keep a thrown friend on the screen
      const top = Math.max(Math.min(apex, 2.72), Math.max(y0, ty) + 0.08);  // the top of the screen is about 2.8
      const vy = Math.sqrt(2 * 9.8 * (top - y0));
      return { vy, t: vy / 9.8 + Math.sqrt(2 * (top - ty) / 9.8) };
    };
    const bo = game.boss;
    if (!friend && !snap && a.carry.name === 'pot' && bo && bo.kind === 'beam' && bo.mode === 'walk' && Math.abs(bo.x - tx) < 0.7) {  // on Pim: aim for where Pim will be
      snap = bo; ty = bo.y + 0.6;
      for (let k = 0, x = bo.x; k < 3; k++) { tx = x; x = Math.max(-2.45, Math.min(2.45, bo.x + bo.dir * 0.8 * air().t)); }
    }
    const { vy, t } = air();
    return { x: x0, y: y0, vx: (tx - x0) / t, vy, t, tx, ty, snap };
  }
  function startAim(a) {
    const [lo, hi] = aimRange(a);
    a.aim = { x: Math.max(lo, Math.min(hi, a.aim0 !== undefined ? a.aim0 : a.x + a.dir * 1.5)) };
    sfx('click');
  }
  function drawAim(a) {
    const c = solveArc(a);
    aimDots.children.forEach((d, k) => {
      const t = (k + 1) / 17 * c.t;
      d.position.set(ox + c.x + c.vx * t, c.y + c.vy * t - 4.9 * t * t, -0.1);
      d.scale.setScalar(1 - k * 0.018);
    });
    aimDots.visible = aimRing.visible = true;
    aimRing.position.set(ox + c.tx, c.ty + 0.02, -0.1);
    aimRing.rotation.x = c.snap || c.ty > 0.9 ? 0 : -Math.PI / 2;  // seen from the side up high, it would be a line
    aimRing.material.color.set(c.snap ? 0x7dff9a : 0xffe066);
    return c;
  }
  function releaseThrow(a) {
    const arc = drawAim(a);
    a.aim0 = a.aim.x; a.aim = null; aimDots.visible = aimRing.visible = false;
    a.dir = arc.vx >= 0 ? 1 : -1;
    a.busy = 0.75; act(a.who, ['Throw', 'PointingGesture'], 1);
    game.throwing = { a, t: 0.34, arc };
  }
  function launch(a, arc) {
    const c = a.carry;
    a.carry = null;
    if (!c) return;
    sfx('hop'); noise(0.1, 0.05, 2200);
    if (c.friend) {
      const b = c.friend;
      Object.assign(b, { lifted: null, x: arc.x, y: arc.y, z: -0.1, vy: arc.vy, dir: Math.sign(arc.vx) || 1, fly: { vx: arc.vx, tumble: true, spin: 0 } });
      b.who.holder.rotation.order = 'ZYX'; act(b.who, ['Hop', 'Fall'], 1);
      active = team.indexOf(b); hud();
      speak('thrown_' + b.key, { force: true });
      return;
    }
    a.who.holder.remove(c.mesh);
    c.mesh.position.set(ox + arc.x, arc.y, -0.1); things.add(c.mesh);
    game.throwns.push({ mesh: c.mesh, name: c.name, item: c.item, x: arc.x, y: arc.y, vx: arc.vx, vy: arc.vy, from: a, t: 0, spin: 7 + Math.random() * 5 });
  }
  function breakPot(f) {
    things.remove(f.mesh); f.gone = true;
    noise(0.16, 0.2, 2400); tone(420, 0.09, 'triangle', 0.08, -160);
    for (let k = 0; k < 7; k++) {
      const m = box(0.05 + Math.random() * 0.05, 0.02, 0.05, potMat); addAt(m, f.x, f.y + 0.05, -0.1);
      game.shards.push({ m, x: f.x, y: f.y + 0.05, vx: (Math.random() - 0.5) * 2.6, vy: 1 + Math.random() * 1.8, t: 0, floor: f.floor || 0 });
    }
  }
  function knockDown(b, line) {  // off the beam, and the paper that was on its way goes with it: nobody gets flattened for winning
    b.mode = 'falling'; b.vy = 0; act(b.who, ['Fall', 'Idle'], b.who.has('Fall') ? 1 : undefined); speak(line, { force: true });
    game.falls.forEach((f) => { things.remove(f.stack); things.remove(f.shadow); }); game.falls = [];
  }
  function moveThrowns(dt) {
    if (game.throwing) {
      game.throwing.t -= dt;
      if (game.throwing.t <= 0) { const { a, arc } = game.throwing; game.throwing = null; launch(a, arc); }
    }
    for (const f of game.throwns) {
      f.t += dt; f.vy -= 9.8 * dt;
      const py = f.y;
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.mesh.position.set(ox + f.x, f.y, -0.1); f.mesh.rotation.z -= Math.sign(f.vx || 1) * f.spin * dt;
      if (f.name === 'key') {  // whoever is under it catches it
        const p = team.find((t) => t !== f.from && !t.off && !t.carry && !t.hidden && !t.hang && !t.rope && !t.fly && !t.lifted && Math.abs(t.x - f.x) < 0.5 && f.y > t.y + 0.2 && f.y < t.y + 1.45);
        if (p && f.vy < 1) {
          things.remove(f.mesh); f.gone = true; f.mesh.rotation.set(0, 0, 0); f.mesh.position.set(0, 1.12, 0); p.who.holder.add(f.mesh);
          p.carry = { name: f.name, mesh: f.mesh, item: f.item, throwable: true };
          act(p.who, ['Catch', 'Pick'], 1); sfx('pick'); speak('key_caught', { force: true, who: p.key });
          continue;
        }
      }
      const tg = game.targets.find((t) => Math.hypot(t.x - f.x, t.y - f.y) < 0.32);
      if (tg) {
        tg.swing = 1; [1320, 1980].forEach((n, k) => tone(n, 0.5, 'sine', 0.13, 0, k * 0.03));
        if (tg.does && tg.does.stops && game.press) game.press.stopped = tg.does.secs || 6;
        speak('bell_rung', { force: true });
        if (f.name === 'pot') breakPot(f); else f.vy = 0;
        if (f.gone) continue;
      }
      if (f.name === 'pot') {
        const b = game.boss;
        if (b && b.kind === 'beam' && b.mode === 'walk' && Math.abs(f.x - b.x) < 0.45 && f.y > b.y - 0.1 && f.y < b.y + 1.3) {
          knockDown(b, 'pim_potted'); breakPot(f);
          continue;
        }
        const sn = game.snarls.find((n) => !n.flat && Math.abs(n.x - f.x) < 0.5 && f.y < 0.7);
        if (sn) { sn.flat = true; sfx('smash'); speak('snarl_potted', { force: true }); breakPot(f); continue; }
      }
      if (f.vy < 0) {
        const surface = [...game.ledges.filter((l) => !l.rope), ...(game.beam ? [{ from: -2.8, to: 2.8, y: game.beam.y }] : [])].find((l) => f.x >= l.from && f.x <= l.to && py >= l.y && f.y <= l.y);
        const on = surface ? surface.y : f.y <= 0.05 ? 0 : null;
        if (on !== null) {
          f.y = on; f.floor = on;
          if (f.name === 'pot') {
            breakPot(f);
            if (game.guard && game.guard.awake && game.guard.read <= 0) { game.guard.noise = f.x; game.guard.heard = true; act(game.guard.who, ['Stagger', 'Walk']); speak(game.guard.key + '_hears', { force: true }); } else speak('pot_miss', { chance: 0.3 });
            continue;
          }
          f.gone = true; sfx('land'); f.mesh.rotation.set(0, 0, 0); f.mesh.position.set(ox + f.x, on + 0.06, 0.02);
          if (f.name === 'cheese' && game.mouse && !game.bait) { f.item.x = f.x; game.bait = { x: f.x, mesh: f.mesh, item: f.item, eat: 0 }; speak('cheese_left', { force: true }); continue; }
          game.items.push({ x: f.x, pocket: f.name, mesh: f.mesh, y0: on + 0.06, ly: on, loose: true });
          speak('key_dropped', { chance: 0.8 });
        }
      }
    }
    game.throwns = game.throwns.filter((f) => !f.gone);
    for (const s of game.shards) {
      s.t += dt; s.vy -= 9.8 * dt; s.x += s.vx * dt; s.y = Math.max(s.floor + 0.015, s.y + s.vy * dt);
      s.m.position.set(ox + s.x, s.y, -0.1); s.m.rotation.x += dt * 9; if (s.t > 1) s.m.scale.multiplyScalar(1 - dt * 4);
      if (s.t > 1.5) { things.remove(s.m); s.gone = true; }
    }
    game.shards = game.shards.filter((s) => !s.gone);
    for (const t of game.targets) if (t.swing > 0) { t.swing = Math.max(0, t.swing - dt * 0.55); t.mesh.rotation.z = Math.sin(game.time * 11) * 0.3 * t.swing; }
  }
  function lift(a, f) {
    a.carry = { friend: f, throwable: true }; f.lifted = a; f.who.holder.rotation.order = 'ZYX';
    a.busy = 0.35; sfx('pick'); act(a.who, ['Carry', 'Pick'], 1);
    speak('lifted_' + f.key, { force: true, who: f.key });
  }
  function dropFriend(a) {
    const c = a.carry;
    if (!c || !c.friend) return;
    const b = c.friend;
    a.carry = null; a.aim = null; aimDots.visible = aimRing.visible = false;
    Object.assign(b, { lifted: null, x: Math.max(-2.5, a.x - a.dir * 0.4), y: a.y, vy: 0 });
    act(b.who, ['Idle']); sfx('land');
  }
  function letGo(a) {
    const r = a.rope, s = r.len - 0.15;
    a.fly = { vx: Math.max(-3.2, Math.min(3.2, r.om * s * Math.cos(r.th) * 1.15)) };
    a.vy = Math.max(1.2, r.om * s * Math.sin(r.th) + 1.6);
    a.y += 0.05; a.dir = Math.sign(a.fly.vx) || a.dir;
    a.rope = null; r.on = null; a.noGrab = 0.5; a.flipped = false;
    a.who.holder.rotation.z = 0; act(a.who, ['Hop', 'Idle'], 1); sfx('hop');
    speak(LINES['rope_off_' + a.key] ? 'rope_off_' + a.key : 'rope_off', { chance: 0.4 });
  }
  const handUp = new THREE.Vector3();
  function reach(a) {  // how far above the feet the hands are in this pose
    const h = a.who.model.getObjectByName('RightHand');
    if (!h) return 1.2;
    const p = a.who.holder.position.y, tilt = a.who.holder.rotation.z;
    h.getWorldPosition(handUp);
    return tilt ? 1.2 * a.who.holder.scale.y : Math.max(0.9, Math.min(1.7, handUp.y - p));
  }
  function tryGrabs(a, can) {  // in the air: anything to catch hold of?
    if (a.noGrab > 0) return false;
    const up = FIGURES[a.key].size;
    if (can.includes('swing')) for (const r of game.ropes) {
      if (r.on || r.u < 0.98) continue;
      const s = r.len - 0.15, hx = r.x + s * Math.sin(r.th), hy = r.y - s * Math.cos(r.th);
      if (Math.abs(a.x - hx) < 0.42 && a.y + 1.3 * up > hy && a.y + 0.5 < hy) { a.rope = r; r.on = a; a.fly = null; a.vy = 0; a.pump = 0; a.who.holder.rotation.order = 'ZYX'; act(a.who, ['RopeHang', 'Rope', 'Idle']); sfx('pick'); speak(LINES['rope_on_' + a.key] ? 'rope_on_' + a.key : 'rope_on', { chance: 0.6 }); return true; }
    }
    if (can.includes('bar')) for (const b of game.bars) {
      if (a.x >= b.from - 0.1 && a.x <= b.to + 0.1 && a.y + 1.25 * up >= b.y && a.y + 0.75 < b.y) { a.hang = b; a.fly = null; a.vy = 0; a.x = Math.max(b.from, Math.min(b.to, a.x)); act(a.who, ['Hang', 'Idle']); sfx('pick'); speak(LINES['bar_on_' + a.key] ? 'bar_on_' + a.key : 'bar_on', { chance: 0.5 }); return true; }
    }
    if (can.includes('grab')) for (const l of game.ledges) {
      if (!l.grab || a.vy < -0.2 || a.y >= l.y - 0.02 || a.y + 1.15 * up < l.y) continue;  // on the way up: walking off the end isn't grabbing it
      const left = a.x > l.from - 0.45 && a.x < l.from + 0.12, right = a.x > l.to - 0.12 && a.x < l.to + 0.45;
      if (left || right) { a.pull = { x0: a.x, y0: a.y, x1: left ? l.from + 0.26 : l.to - 0.26, y1: l.y, t: 0 }; a.fly = null; a.vy = 0; act(a.who, ['PullUp', 'Climb', 'Ladder', 'Hop']); sfx('pick'); return true; }
    }
    return false;
  }
  function moveRopes(dt) {
    for (const r of game.ropes) {
      if (r.grown && r.u < 1) { r.u = Math.min(1, r.u + dt * 0.7); r.line.scale.y = r.u; r.line.position.y = -r.len * r.u / 2; r.knot.position.y = -r.len * r.u; r.knot.visible = true; }
      const w2 = 9.8 / r.len, who = r.on;
      r.om += (-w2 * Math.sin(r.th) + (who ? who.pump * 2.1 - r.om * 0.1 : 0)) * dt;
      if (!who) { const E = 0.5 * r.om * r.om + w2 * (1 - Math.cos(r.th)), E0 = w2 * (1 - Math.cos(r.A)); r.om += Math.sign(r.om || 1) * (E < E0 ? 0.7 : -0.7) * dt; }
      r.th += r.om * dt;
      if (Math.abs(r.th) > 1.08) { r.th = Math.sign(r.th) * 1.08; r.om *= -0.4; }
      r.mesh.rotation.z = r.th;
      if (who) {
        const s = r.len - 0.15, c = Math.cos(r.th), n = Math.sin(r.th), h = 1.22 * who.who.holder.scale.y;
        who.x = r.x + (s + h) * n; who.y = r.y - (s + h) * c;
        who.who.holder.rotation.z = r.th;
        who.who.holder.position.set(ox + who.x, who.y, -0.1);
      }
    }
  }

  // ---------- being caught ----------
  function caught(kind, victim) {
    if (game.frozen || game.grace > 0) return;
    if (paid && paid.spare(kind)) return;
    if (paid) paid.caught(kind);
    game.frozen = true; game.tries++;
    facts.here++;
    const a = victim || hero();
    const tape = tangle(a.who, game.tries);
    sfx(kind === 'crushed' ? 'thud' : 'caught');
    speak({ caught: game.guard ? game.guard.key + '_caught' : 'pim_caught', charged: 'rivet_caught', crushed: 'crushed', snarl: 'snarl_caught', pressed: 'crushed', steam: 'steam_caught', letter: 'letter_hit', juno: 'juno_caught', mat: 'mat_caught' }[kind], { force: true });
    game.retryWith = kind === 'charged' ? 'charged' : 'retry';
    act(a.who, ['Fall', 'Idle'], a.who.has('Fall') ? 1 : undefined);
    setTimeout(() => { untangle(tape, false); enter(game.at, true); }, 1200);
  }

  // ---------- the locks ----------
  const RULES = {
    stars: ['A knot of Red Tape', 'One star in every row, column and colour. Stars never touch, not even at a corner. Tap a square.'],
    duo: ['A knot of Red Tape', 'Half suns, half grapes in every row and column, never three in a row, and no two lines the same. Tap a square.'],
  };
  function openPuzzle(kind, level, done, opening) {
    game.frozen = true;
    const p = G.level(kind, level), el = $('[data-puzzle]'), grid = $('[data-grid]'), n = p.size;
    $('[data-ptitle]').textContent = RULES[kind][0]; $('[data-prule]').textContent = RULES[kind][1];
    grid.style.gridTemplateColumns = grid.style.gridTemplateRows = `repeat(${n}, minmax(0, 1fr))`;
    const hues = [8, 45, 130, 200, 265, 320, 90, 170, 300];
    const state = kind === 'stars' ? new Array(n * n).fill(0) : p.givens.slice();
    let finished = false, anyBad = false;
    psay(opening || 'knot_open');
    const cells = Array.from({ length: n * n }, (_, i) => {
      const b = document.createElement('button'); b.type = 'button';
      if (kind === 'stars') b.style.background = `hsl(${hues[p.regions[i] % hues.length]} 62% 76%)`;
      else if (p.givens[i] !== -1) b.classList.add('given');
      b.addEventListener('click', () => {
        if (finished) return;
        if (kind === 'stars') state[i] = state[i] ? 0 : 1;
        else { if (p.givens[i] !== -1) return; state[i] = state[i] === -1 ? 0 : state[i] === 0 ? 1 : -1; }
        sfx('click');
        draw();
        if (anyBad && !finished) { sfx('wrong'); if (Math.random() < 0.5) psay('knot_wrong'); }
      });
      return b;
    });
    grid.replaceChildren(...cells);
    function draw() {
      const r = kind === 'stars' ? G.check.stars(p, state.flatMap((v, i) => (v ? [i] : []))) : G.check.duo(p, state);
      const bad = new Set(r.bad);
      anyBad = bad.size > 0;
      cells.forEach((c, i) => {
        c.textContent = kind === 'stars' ? (state[i] ? '★' : '') : state[i] === 0 ? '☀️' : state[i] === 1 ? '🍇' : '';
        c.classList.toggle('bad', bad.has(i));
      });
      if (r.solved && !finished) { finished = true; sfx('done'); setTimeout(() => { el.hidden = true; game.frozen = false; done(); }, 450); }
    }
    draw();
    $('[data-pback]').onclick = () => { el.hidden = true; game.frozen = false; speak('knot_later', { force: true }); };
    el.hidden = false;
    game.puzzle = p;  // for checking
  }

  function openGate(snip = true) {
    if (!game.gate) return;
    game.gate.fall = 0;
    const a = hero();
    a.busy = a.who.has('Snip') && snip ? 0.8 : 0.3;
    if (snip) { act(a.who, ['Snip', 'Hammer', 'PointingGesture'], 1); sfx('snip'); }
  }

  // The tool goes in the hand: the figure stays one model, the tool stays its own thing
  function holdTool(a, tool) {
    a.tool = tool;
    const hand = a.who.model.getObjectByName('RightHand');
    if (!hand) return;
    if (a.toolMesh) a.toolMesh.removeFromParent();
    model(TOOLS[tool]).then((src) => {
      if (!src) return;
      a.who.model.updateMatrixWorld(true);
      const s = new THREE.Vector3(); hand.getWorldScale(s);
      const m = placed(src, 0.32);
      const c = new THREE.Group(); c.add(m); c.scale.setScalar(1 / s.x); m.position.y -= 0.12;
      c.rotation.set(0, 0, Math.PI / 2);
      hand.add(c); a.toolMesh = c;
    });
  }
  function pickUp(a, it) {
    if (it.pointer) { things.remove(it.pointer); it.pointer = null; }
    a.busy = a.who.has('Pick') ? 1.1 : 0.5; act(a.who, ['Pick', 'PointingGesture'], 1);
    game.items = game.items.filter((x) => x !== it);
    sfx('pick');
    if (it.stow) { setTimeout(() => things.remove(it.mesh), 500); game.taken = it.pocket; speak(it.pocket + '_got', { force: true }); if (game.coda) game.coda(); return; }
    if (it.pocket === 'key' && !it.loose) { setTimeout(() => things.remove(it.mesh), 500); game.keyHeld = true; speak('key_found', { force: true }); return; }
    if (it.lamp) {
      things.remove(it.mesh);
      const hand = a.who.model.getObjectByName('LeftHand');
      if (hand) {
        a.who.model.updateMatrixWorld(true);
        const s = new THREE.Vector3(); hand.getWorldScale(s);
        const c = new THREE.Group(); c.add(it.mesh); it.mesh.position.set(0, -0.32, 0); it.mesh.rotation.set(0, 0, 0); c.scale.setScalar(1 / s.x); hand.add(c); a.lampMesh = c;
      }
      const li = new THREE.PointLight(0xffc98a, 1, 4, 1.4); world.add(li);
      game.lantern = { who: a, light: li, on: 0 };
      speak('lantern_found', { force: true });
      return;
    }
    if (it.pocket) {  // carried on the head, where everyone can see it
      things.remove(it.mesh); it.mesh.position.set(0, 1.12, 0); it.mesh.rotation.set(0, 0, 0); a.who.holder.add(it.mesh);
      a.carry = { name: it.pocket, mesh: it.mesh, item: it, throwable: !!it.loose };
      speak(it.pocket === 'cheese' ? 'cheese_found' : it.loose ? 'key_loose' : 'thing_up', { force: true });
      return;
    }
    setTimeout(() => {
      things.remove(it.mesh);
      holdTool(a, it.tool);
      speak({ hammer: 'hammer', can: 'can_found' }[it.tool] || 'scissors', { force: true });
    }, a.who.has('Pick') ? 550 : 200);
  }

  // ---------- hitting ----------
  function swing() {
    const a = hero();
    a.busy = 0.55; act(a.who, ['Hammer', 'PointingGesture'], 1); sfx('hit');
    const s = game.smash;
    if (s && !s.broken && Math.abs(a.x - s.x) < 1.05) {
      s.broken = true; s.parts = 0; sfx('smash');
      speak('smash', { force: true });
      return;
    }
    const kn = game.knots.find((k) => !k.done && k.how === 'hit' && Math.abs(a.x - k.x) < 1 && near(a, k.y));
    if (kn) { cutKnot(kn); return; }
    const sn = game.snarls.find((x) => !x.flat && Math.abs(a.x - x.x) < 1);
    if (sn) { sn.flat = true; sfx('smash'); speak(sn.who ? 'tapeling_hit' : 'snarl_hit', { force: true }); if (sn.who) act(sn.who, ['Fall', 'Idle'], 1); return; }
    const b = game.boss, bm = game.beam;
    if (bm && b && !b.freed && Math.abs(a.x - bm.post) < 0.85) {
      bm.shake = 0.5; sfx('thud');
      if (b.mode === 'walk' && Math.abs(b.x - bm.post) < 1.9) {
        knockDown(b, 'pim_fell');
      } else speak('post_miss', { force: true });
      return;
    }
    speak('hit_nothing', { chance: 0.6 });
  }

  function sendLetter(a) {
    const g = game.guard;
    a.busy = 0.5; act(a.who, ['Open', 'Talk', 'PointingGesture'], 1); sfx('pick');
    speak('juno_writes', { force: true });
    model(prop('letter')).then((src) => {
      const m = src ? placed(src, 0, { width: 0.3 }) : box(0.3, 0.02, 0.2, paperMat);
      addAt(m, a.x, 0.9, -0.1);
      g.letter = { mesh: m, x: a.x };
    });
  }

  function cutKnot(k) {
    k.done = true; sfx('smash'); facts.kept.add(k.by);
    k.mesh.userData.drop = 0;
    const left = game.knots.filter((n) => !n.done).length;
    speak(left ? 'knot_part' : game.boss && game.boss.kind === 'spool' ? 'spool_end' : 'knots_all', { force: true });
    if (!left && game.gate) { game.gate.fall = 0; sfx('snip'); }
  }

  // ---------- notes and answers ----------
  function readNote(a, n) {
    facts.read.add(n.id); sfx('pick');
    sayWho = a.key;
    sayEl.innerHTML = '<b>The note says</b>'; sayEl.append(n.text);
    sayEl.classList.remove('tangled', 'shout'); sayEl.hidden = false;
    sayT = Math.max(4, n.text.length * 0.075);
  }
  function openTalk(b) {
    game.frozen = true;
    const el = $('[data-talk]'), q = b.questions[b.asked], list = $('[data-answers]');
    $('[data-tname]').textContent = b.name || FIGURES[b.key].name;
    $('[data-tsay]').textContent = q.q;
    $('[data-treply]').hidden = true;
    if (paid && q.scene && paid.answerBox(b, q, list)) { el.hidden = false; game.talking = b; return; }
    list.replaceChildren(...q.a.map((text, k) => {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'answer'; btn.textContent = `${k + 1}. ${text}`;
      btn.onclick = () => answer(b, k);
      return btn;
    }));
    el.hidden = false;
    game.talking = b;
  }
  function answer(b, k) {
    const q = b.questions[b.asked], reply = $('[data-treply]');
    reply.hidden = false;
    if (k !== q.right) {
      sfx('wrong'); facts.here++; b.tried = true;
      reply.textContent = q.wrong;
      reply.classList.add('no');
      if (b.who) act(b.who, ['Talk', 'Idle'], b.who.has('Talk') ? 1 : undefined);
      return;
    }
    reply.classList.remove('no');
    reply.textContent = q.yes;
    sfx('done');
    const tape = (b.who && b.who.tape) || [], drop = Math.ceil(tape.length / (b.questions.length - b.asked));
    const gone = tape.splice(0, b.asked === b.questions.length - 1 ? 0 : drop);
    for (const g of gone) { g.removeFromParent(); }
    b.asked++;
    document.querySelectorAll('[data-answers] button').forEach((x) => { x.disabled = true; });
    setTimeout(() => {
      if (b.asked < b.questions.length) { openTalk(b); return; }
      $('[data-talk]').hidden = true; game.talking = null; game.frozen = false;
      if (b.kind === 'form') { b.done = true; if (game.gate) game.gate.fall = 0; sfx('snip'); speak('form_done', { force: true }); return; }
      b.mode = 'dizzy'; b.t = 999; act(b.who, ['Stumble', 'Stagger', 'Idle']);
      speak(b.key + '_done', { force: true });
    }, 1700);
  }
  $('[data-tback]').onclick = () => { $('[data-talk]').hidden = true; game.talking = null; game.frozen = false; };

  // ---------- the win ----------
  function freeFriend() {
    const b = game.boss, lv = LEVELS[game.level];
    b.mode = 'free'; b.freed = true;
    untangle(b.who.tape, true);
    if (b.pod) b.podGone = 0;
    b.who.holder.rotation.z = 0;
    act(b.who, ['Victory', 'Happy', 'Cheer'], 1);
    team.forEach((a) => { act(a.who, ['Cheer', 'Victory', 'Happy'], 1); faceTo(a.who.holder, a.x < b.x ? Math.PI / 2 : -Math.PI / 2, 1); });
    sfx('free');
    faceTo(b.who.holder, b.x > team[0].x ? -Math.PI / 2 : Math.PI / 2, 1);
    speak(b.key + '_free', { force: true });
    const run = game.run, later = (ms, fn) => setTimeout(() => { if (game.run === run) fn(); }, ms);  // only if this is still the level being played
    game.marks.forEach((m) => { m.mesh.visible = false; }); if (game.arrow) game.arrow.visible = false;
    const finish = async () => { game.frozen = true; sayEl.hidden = true; await playFilm(lv.closing); endCard(lv); };
    later(3200, () => speak('team_free', { force: true }));
    if (lv.coda) {  // the new friend joins in straight away: one more job before the film
      team.push({ key: b.key, who: b.who, x: b.x, y: 0, z: -0.1, vy: 0, dir: b.x > team[0].x ? -1 : 1, hidden: false, busy: 0, tool: false, toolMesh: null, off: false });
      game.freedAt = game.time; hud();
      later(6400, () => speak(lv.coda.line, { force: true }));
      game.coda = () => later(lv.coda.wait, finish);
    } else {
      later(6200, () => speak(b.key + '_after', { force: true }));
      if (team.some((a) => a.key === 'zip')) later(8000, () => speak('zip_off', { force: true }));
      later(lv.team.includes('zip') ? 11000 : 9800, finish);
    }
    try { const d = JSON.parse(localStorage.getItem('snip.done') || '[]'); if (!d.includes(lv.id)) d.push(lv.id); localStorage.setItem('snip.done', JSON.stringify(d)); } catch (e) { /* private window */ }
  }
  // The end of the street: nobody to cut loose, so everybody is
  function finale() {
    const b = game.boss, lv = LEVELS[game.level];
    b.mode = 'out'; b.freed = true; b.outT = 0; game.falls.forEach((f) => { things.remove(f.stack); things.remove(f.shadow); }); game.falls = [];
    if (game.guard) { game.guard.read = 999; }
    game.snarls.forEach((x) => { x.flat = true; });
    team.forEach((a) => act(a.who, ['Cheer', 'Victory', 'Happy'], 1));
    sfx('free'); sfx('smash');
    speak('street_free', { force: true });
    const run = game.run, later = (ms, fn) => setTimeout(() => { if (game.run === run) fn(); }, ms);
    later(3400, () => speak('street_after', { force: true }));
    later(7000, () => {
      const l = chooseLine('polite_voice');
      if (l) { sayWho = hero().key; sayEl.innerHTML = '<b>A very polite voice</b>'; sayEl.append(l.text); sayEl.classList.remove('tangled', 'shout'); sayEl.hidden = false; sayT = 5.5; }
    });
    later(12500, async () => {
      game.frozen = true; sayEl.hidden = true;
      world.remove(things); things = new THREE.Group(); world.add(things);
      for (const f of Object.values(figCache)) f.holder.visible = false;
      Object.assign(game, fresh());
      await showRoom('street', 'wide');
      await playFilm(lv.closing);
      endCard(lv);
    });
    try { const d = JSON.parse(localStorage.getItem('snip.done') || '[]'); if (!d.includes(lv.id)) d.push(lv.id); localStorage.setItem('snip.done', JSON.stringify(d)); } catch (e) { /* private window */ }
    window.snip.finished = true;
  }
  // The web edition's word for the download: never in the way, and always next to carrying on here.
  function pitch(level) {
    const el = $('[data-pitch]'), page = window.SNIP_PAGE;
    if (!el) return;
    el.hidden = !(EDITION === 'web' && page);
    if (el.hidden) return;
    const big = level === 0, n = level + 1;
    el.classList.toggle('big', big);
    el.innerHTML = big
      ? `<video src="assets/trailer.mp4" autoplay muted loop playsinline></video><div><b>The free download has a film like that for every level.</b><span>An opening and an ending for all six, full screen, and it plays without the internet.</span><a class="go" href="${page}#get">Download the full game, free</a></div>`
      : `<img src="assets/pitch/l${n}.jpg" alt=""><div><span>This level's ending is a film in the free download.</span><a href="${page}#get">Get the full game</a></div>`;
  }
  function endCard(lv) {
    const c = $('[data-card]');
    c.querySelector('h1').textContent = lv.ending ? lv.ending.title : `${FIGURES[lv.frees].name} is free!`;
    c.querySelector('.lead').textContent = `${lv.title}: done${game.tries ? `, in ${game.tries + 1} tries` : ', first time'}.`;
    $('[data-intro]').textContent = lv.next;
    { const pickLang = $('[data-lang]'); if (pickLang && window.SNIP_I18N) { pickLang.value = window.SNIP_I18N.lang; pickLang.onchange = () => window.SNIP_I18N.setLang(pickLang.value); pickLang.onkeydown = (e) => e.stopPropagation(); } }
  $('[data-note]').textContent = '';
    pitch(game.level);
    menu(LEVELS[game.level + 1] && !LEVELS[game.level + 1].hidden ? game.level + 1 : null);
    if (paid) { paid.endCard(lv, c, game.level); menu(LEVELS[game.level + 1] && !LEVELS[game.level + 1].hidden ? game.level + 1 : null); }
    c.hidden = false;
  }

  // ---------- each frame ----------
  const near = (a, y = 0) => Math.abs(a.y - y) < 0.55;  // on the same floor
  function ground(a) {
    const c = game.crate, x = a.x;
    if (c && Math.abs(x - c.x) < c.half + 0.08) return c.h;
    for (const l of game.ledges) if (x >= l.from && x <= l.to && a.y >= l.y - 0.03) return l.y;
    return 0;
  }
  function tryPrompt(text, x, y = 1.3) {
    if (!text) { promptEl.hidden = true; return; }
    const v = new THREE.Vector3(ox + x, y, -0.1).project(cam);
    Object.assign(promptEl.style, { left: ((v.x + 1) / 2 * 100) + '%', top: ((1 - v.y) / 2 * 100) + '%' });
    if (text !== promptEl.dataset.raw) { promptEl.dataset.raw = text; promptEl.textContent = text.replace(/^(\S+ {2})?(.+)$/, (m, key, label) => (key || '') + (window.SNIP_I18N ? window.SNIP_I18N.t(label) : label)); }
    promptEl.hidden = false;
  }
  function limit(a, nx) {  // what's in the way, walking right
    const c = game.crate;
    if (c && a.y < c.h - 0.02 && Math.abs(nx - c.x) < c.half + 0.12) {
      if (c.pushable && a.key === 'rivet' && nx > a.x && a.x < c.x && !(game.cat && !game.cat.moved) && (!c.max || c.x < c.max)) {
        const by = Math.min(nx - a.x, 0.55 / 60 + (nx - a.x) * 0.45);  // heavy
        c.x += by; c.mesh.position.x = ox + c.x; a.pushing = 0.15;
        if (game.time % 0.5 < 0.04) sfx('land');
        return a.x + by;
      }
      if (c.pushable && a.key !== 'rivet' && nx > a.x && !game.pushHint) { game.pushHint = true; speak('cant_push', { force: true }); }
      if (c.pushable && game.cat && !game.cat.moved && nx > a.x) speak('cat_sits', { chance: 0.05 });
      return a.x;
    }
    const stops = [];
    if (game.gate && game.gate.fall < 0 && near(a, game.gate.y)) stops.push(game.gate.x);
    if (game.smash && !game.smash.broken && near(a, game.smash.y)) stops.push(game.smash.x);
    for (const d of Object.values(game.doors)) if (!d.open && near(a, 0)) stops.push(d.x);
    if (!(a.roll > 0)) for (const l of game.lows) if (a.y < 0.5 || a.fly) stops.push(l.x);
    for (const sx of stops) if (a.x <= sx - 0.2 && nx > sx - 0.25) nx = sx - 0.25;
    return nx;
  }
  // What E does here, for whoever you are. If it's somebody else's job, it says so.
  function useHere(a) {
    if (paid) { const sp = paid.spotHere(a); if (sp) return sp; }
    if (a.carry && a.carry.friend) return { label: `Put ${FIGURES[a.carry.friend.key].name} down`, at: a.x, run: () => dropFriend(a) };
    if (FIGURES[a.key].can.includes('reveal') && game.secrets.some((x) => !x.shown)) return { label: 'Read the room', at: a.x, run: () => readRoom(a) };  // Olaf reads first, always
    const pimDown = game.boss && game.boss.kind === 'beam' && game.boss.mode !== 'walk';  // nothing left to throw at: the next step is what shows
    const pile = !a.carry && !pimDown && FIGURES[a.key].can.includes('toss') && game.pots.find((p) => Math.abs(a.x - p.x) < 0.55 && near(a, p.y));
    if (pile) return { label: 'Pick up a pot', at: pile.x, run: () => {
      const m = makePot(); m.position.set(0, 1.12, 0); a.who.holder.add(m);
      a.carry = { name: 'pot', mesh: m, throwable: true }; a.busy = 0.3; sfx('pick'); act(a.who, ['Pick', 'PointingGesture'], 1); speak('pot_up', { chance: 0.6 });
    } };
    if (FIGURES[a.key].can.includes('write') && game.guard && !(game.guard.read > 0) && !game.guard.letter && !game.knots.some((k) => !k.done && k.by === a.key && Math.abs(a.x - k.x) < 0.7)) return { label: `Send ${FIGURES[game.guard.key].name.replace(/^The /, 'the ')} a letter`, at: a.x, run: () => sendLetter(a) };  // and Juno writes, unless her own spool is right here
    const it = game.items.find((x) => !x.hidden && Math.abs(a.x - x.x) < 0.6 && near(a, x.ly || 0) && !(x.pocket && (x.pocket !== 'key' || x.loose) && a.carry));
    if (it && it.pocket) return { label: `Pick up the ${it.pocket}`, run: () => pickUp(a, it), at: it.x };
    if (it) return it.for === a.key ? { label: 'Pick up', run: () => pickUp(a, it), at: it.x } : { hint: `That's for ${FIGURES[it.for].name}: press Tab`, at: it.x };
    if (a.carry) {
      const open = game.slots.filter((x) => !x.filled && !x.hidden && Math.abs(a.x - x.x) < 0.45), sl = open.find((x) => x.name === a.carry.name) || open[0];
      if (sl) return sl.name === a.carry.name ? { label: `Put the ${sl.name} back`, at: sl.x, run: () => placeBack(a, sl) } : { hint: `That's where the ${sl.name} goes`, at: sl.x };
      if (a.carry.name === 'cheese') return { label: 'Leave the cheese', at: a.x, run: () => leaveBait(a) };
    }
    const fo = game.form;
    if (fo && !fo.done && Math.abs(a.x - fo.x) < 0.65) return { label: 'Fill in the form', at: fo.x, run: () => openTalk(fo) };
    const va = game.valves.find((x) => Math.abs(a.x - x.x) < 0.6);
    if (va) {
      if (va.strong && !FIGURES[a.key].can.includes('pull')) return { hint: 'Far too stiff. Ivy knows about these', at: va.x };
      return { label: 'Turn the valve', at: va.x, run: () => { a.busy = 0.4; act(a.who, ['Pull', 'PointingGesture'], 1); sfx('lever'); game.steams.forEach((x) => { x.stopped = x.id === va.stops ? va.secs : 0; }); va.turn = 1; speak('valve', { chance: 0.7 }); } };
    }
    const gr = game.ropes.find((r) => !r.grown && Math.abs(a.x - r.x) < 1.2 && a.y < 0.5);
    if (gr) return a.tool === 'can' ? { label: 'Water the basket', at: a.x, run: () => { a.busy = 0.9; act(a.who, ['Pick', 'PointingGesture'], 1); sfx('hide'); gr.grown = true; speak('vine_grows', { force: true }); } } : { hint: 'That basket wants water. Ivy has the can', at: a.x };
    const n = game.notes.find((x) => !x.hidden && Math.abs(a.x - x.x) < 0.55 && near(a, x.y));
    if (n) return { label: 'Read the note', at: n.x, run: () => readNote(a, n) };
    const se = game.seed;
    if (se && !se.grown && Math.abs(a.x - se.x) < 0.6) {
      if (a.tool === 'can') return { label: 'Water it', at: se.x, run: () => { a.busy = 0.9; act(a.who, ['Pick', 'PointingGesture'], 1); sfx('hide'); se.grow = 0; speak('vine_grows', { force: true }); } };
      return { hint: 'It wants water', at: se.x };
    }
    const ca = game.cat;
    if (ca && !ca.moved && Math.abs(a.x - game.crate.x) < 0.85) return { label: 'Be nice to the cat', at: game.crate.x, run: () => { act(a.who, ['Wave', 'Pick', 'PointingGesture'], 1); a.busy = 0.5; ca.moved = true; ca.t = 0; sfx('pick'); speak('cat_moves', { force: true }); } };
    const bl = game.biglever;
    if (bl && !bl.used && Math.abs(a.x - bl.x) < 0.65) {
      if (!FIGURES[a.key].can.includes('pull')) return { hint: 'Far too stiff. Ivy knows levers', at: bl.x };
      return { label: bl.brake ? 'Brake the spool' : 'Pull the big lever', at: bl.x, run: () => { bl.used = true; bl.mesh.rotation.z = 0.5; sfx('lever'); a.busy = 0.5; act(a.who, ['Pull', 'PointingGesture'], 1); if (bl.brake) { bl.holder = a; speak('brake_on', { force: true }); return; } game.shredder.on = true; speak('shredder_on', { force: true }); } };
    }
    const tu = game.tubes.find((x) => Math.abs(a.x - x.x) < 0.5);
    if (tu) {
      if (!tu.fits.includes(a.key)) return { hint: 'Too big for the post tube', at: tu.x };
      return { label: 'Post yourself', at: tu.x, run: () => { a.x = tu.to + (tu.to > tu.x ? 0.3 : -0.3); a.dir = tu.to > tu.x ? 1 : -1; sfx('charge'); sfx('pick'); speak('tube', { force: true }); } };
    }
    const l = game.lever;
    if (l && Math.abs(a.x - l.x) < 0.65) {
      return { label: 'Pull the lever', at: l.x, run: () => {
        sfx('lever'); a.busy = 0.4; act(a.who, ['Pull', 'PointingGesture'], 1);
        if (game.press) game.press.stopped = l.secs;
        if (l.opens && game.mats[l.opens]) { game.mats[l.opens].open = true; l.mesh.rotation.z = 0.5; speak('mat_up', { force: true }); return; }
        if (l.opens) { game.doors[l.opens].open = true; for (const w of game.snarls) w.from = Math.max(w.from, l.x); }  // it backs off, so whoever pulled is safe
        l.mesh.rotation.z = 0.5;
        speak('lever', { force: true });
      } };
    }
    const co = game.coil;
    if (co && !co.down && Math.abs(a.x - co.x) < 0.6 && near(a, co.y)) {
      return { label: 'Drop the rope', at: co.x, run: () => {
        co.down = true; a.busy = 0.5; act(a.who, ['Pull', 'Pick', 'PointingGesture'], 1); sfx('lever');
        co.mesh.visible = false; co.line.visible = true;
        game.climbs.find((c) => c.rope).on = true;
        speak('rope_down', { force: true });
      } };
    }
    const kn = game.knots.find((k) => !k.done && !k.hidden && Math.abs(a.x - k.x) < 0.7 && near(a, k.y));
    if (kn) {
      if (kn.by !== a.key) return { hint: `That one's for ${FIGURES[kn.by].name}: press ${actor(kn.by).off ? 'Q' : 'Tab'}`, at: kn.x };
      if (kn.how === 'hit') return null;
      if (kn.lock) return { label: 'Work the knot', at: kn.x, run: () => openPuzzle(kn.lock, kn.level, () => cutKnot(kn)) };
      return { label: { pull: 'Pull it loose', read: 'Read out clause nine', letter: 'Write it a letter' }[kn.how] || 'Cut it', at: kn.x, run: () => { a.busy = 0.6; act(a.who, ['Pull', 'Snip', 'PointingGesture'], 1); cutKnot(kn); } };
    }
    const g = game.gate;
    if (g && g.fall < 0 && Math.abs(a.x - g.x) < 0.75 && near(a, g.y)) {
      if (g.lock === 'none') return { hint: 'Too thick to cut. Something bigger, then', at: g.x };
      if (g.lock === 'form') return { hint: 'Locked, by your own letterbox', at: g.x };
      if (g.lock === 'things') return { hint: `${game.slots.filter((x) => !x.filled).length} things are still out of place`, at: g.x };
      if (g.lock === 'knots') return { hint: `${game.knots.filter((k) => !k.done).length} spools still hold this`, at: g.x };
      if (g.lock === 'key') {
        const carried = a.carry && a.carry.name === 'key';
        if (!game.keyHeld && !carried) return { hint: 'Locked. Somebody dropped a key', at: g.x };
        return { label: 'Use the key', at: g.x, run: () => { if (carried) { a.who.holder.remove(a.carry.mesh); a.carry = null; } sfx('lever'); if (g.lockMesh) things.remove(g.lockMesh); openGate(false); speak('key_used', { force: true }); } };
      }
      if (g.lock) return { label: 'Work the knot', at: g.x, run: () => openPuzzle(g.lock, g.level, () => { openGate(false); speak('knot_done', { force: true }); }) };
      if (a.tool === 'scissors') return { label: 'Snip!', at: g.x, run: () => { openGate(); speak('snip', { force: true }); } };
      if (team.some((t) => t.tool === 'scissors')) return { hint: 'Only Tuck has scissors: press Tab', at: g.x };
    }
    const b = game.boss;
    if (b && b.kind === 'spool' && b.mode === 'end' && Math.abs(a.x - b.x) < 1.35) {
      if (a.key === 'tuck' && b.high && a.y < 1) return { hint: 'The end is too high. Rivet can throw you up there', at: b.x };
      if (a.key === 'tuck') return { label: 'Cut the end', at: b.x, run: () => openPuzzle(b.puzzle, b.level, finale, 'spool_knot_open') };
      if (!(b.high && a.key === 'rivet')) return { hint: 'The end is for Tuck: press 1', at: b.x };
    }
    if (b && (b.kind === 'talk' || b.kind === 'letters') && b.mode === 'talk' && Math.abs(a.x - b.x) < 1.15) return { label: `Answer ${FIGURES[b.key].name}`, at: b.x, run: () => openTalk(b) };
    if (b && b.mode === 'dizzy' && Math.abs(a.x - b.x) < 1.05) {
      if (a.key === 'tuck') return { label: `Cut ${FIGURES[b.key].name} loose`, at: b.x, run: () => openPuzzle(b.puzzle, b.level, freeFriend, b.key === 'rivet' ? 'rivet_knot_open' : 'duo_knot_open') };
      return { hint: lvl().stage ? (actor('tuck').off ? 'Only Tuck has scissors: press Q' : 'Only Tuck has scissors: press Tab') : 'Only Tuck has scissors: press Tab', at: b.x };
    }
    if (lvl().stage || lvl().moves) {
      const can = FIGURES[a.key].can;
      const lo = game.lows.find((x) => Math.abs(a.x - x.x) < 0.65 && a.y < 0.5 && a.x < x.x);
      if (lo) return can.includes('roll') ? { hint: 'Walk at it and press ↓ to roll under', at: lo.x } : { hint: `Too low for ${FIGURES[a.key].name}`, at: lo.x };
      const ro = game.ropes.find((r) => !r.on && Math.abs(a.x - r.x) < 1.05 && a.y < 0.5);
      if (ro && !can.includes('swing')) return { hint: `Only ${onlyOne('swing')} gets up to that rope`, at: ro.x };
      const ba = game.bars.find((r) => a.x > r.from && a.x < r.to && a.y < 0.5);
      if (ba && !can.includes('bar')) return { hint: `Only ${onlyOne('bar')} gets up to that pipe`, at: a.x };
      const lip = game.ledges.find((l) => l.grab && a.y < l.y - 0.1 && (Math.abs(a.x - l.from) < 0.42 || Math.abs(a.x - l.to) < 0.42));
      if (lip && !can.includes('grab')) return { hint: 'Too heavy to pull up there', at: a.x };
      if (lip) return { hint: 'Space: hop up and grab it', at: a.x };
      if (can.includes('lift') && !a.carry) {
        const f = team.find((o) => o !== a && !o.off && Math.abs(o.x - a.x) < 0.8 && near(a, o.y) && !o.fly && !o.hang && !o.rope && !o.pull && !o.climb && !o.hidden);
        if (f) return { label: `Lift ${FIGURES[f.key].name}`, at: f.x, run: () => lift(a, f) };
      }
    }
    return null;
  }

  function moveHero(dt) {
    const a = hero(), who = a.who, can = FIGURES[a.key].can;
    let use = null, climbHere = null;
    if (a.busy > 0) a.busy -= dt;
    a.noGrab = Math.max(0, (a.noGrab || 0) - dt);
    const tied = a.fly || a.rope || a.pull || a.aim || a.roll > 0 || game.throwing;
    if (paid && hit('c') && !tied && !a.lifted) { paid.talkKey(); return; }
    if (team.filter((t) => !t.off).length > 1 && hit('Tab') && !a.hidden && !tied) {
      dropFriend(a);
      do active = (active + 1) % team.length; while (team[active].off);
      sfx('swap'); hud();
      speak('swap_' + hero().key, { chance: 0.6 });
      return;
    }
    const onFloor = !a.climb && !a.hang && a.y <= ground(a) + 0.01;
    if (team.length > 2 && !a.hidden && !tied) {  // with a big team, go straight to someone
      const n = ['1', '2', '3', '4', '5', '6'].findIndex((d) => hit(d));
      if (n >= 0 && n < team.length && n !== active && (!team[n].off || (waiting().includes(team[n]) && onFloor))) {
        if (team[n].off) { callIn(team[n]); return; }
        dropFriend(a);
        active = n; sfx('swap'); hud();
        speak('swap_' + hero().key, { chance: 0.6 });
        return;
      }
    }
    if (hit('q') && waiting().length && !a.hidden && !tied && onFloor) { callIn(waiting()[0]); return; }  // you go, they come
    if (a.pull) {  // pulling up onto a ledge
      const p = a.pull; p.t = Math.min(1, p.t + dt / 0.62);
      const e = p.t * p.t * (3 - 2 * p.t);
      a.y = p.y0 + (p.y1 - p.y0) * Math.min(1, e * 1.2); a.x = p.x0 + (p.x1 - p.x0) * e * e;
      faceTo(who.holder, Math.PI, dt);
      if (p.t >= 1) { a.y = p.y1; a.x = p.x1; a.pull = null; a.vy = 0; act(who, ['Idle']); sfx('land'); speak('pulled_up', { chance: 0.5 }); }
      bar(null); tryPrompt(null);
      return;
    }
    if (a.rope) {  // on a swinging rope
      a.pump = (held('ArrowRight', 'd') ? 1 : 0) - (held('ArrowLeft', 'a') ? 1 : 0);
      faceTo(who.holder, a.rope.om >= 0 ? Math.PI / 2 : -Math.PI / 2, dt, 5);
      if (hit(' ', 'ArrowDown', 's', 'ArrowUp', 'w')) letGo(a);
      bar(null); tryPrompt('← → Swing   Space: let go', a.x, a.y + 1.45);
      return;
    }
    if (a.hang) {  // hanging from a pipe, hand over hand
      const b = a.hang, m = (held('ArrowRight', 'd') ? 1 : 0) - (held('ArrowLeft', 'a') ? 1 : 0);
      if (m) { a.x = Math.max(b.from, Math.min(b.to, a.x + m * 1.15 * dt)); a.dir = m; }
      act(who, [m > 0 ? 'BarR' : m < 0 ? 'BarL' : 'Hang', 'Hang', 'Idle']);
      faceTo(who.holder, 0, dt);
      a.y += (b.y - reach(a) - a.y) * Math.min(1, dt * 14);
      if (hit(' ', 'ArrowDown', 's')) { a.hang = null; a.vy = 0; a.noGrab = 0.3; act(who, ['Idle']); sfx('out'); }
      bar(null); tryPrompt('← → Along the pipe   Space: let go', a.x, b.y + 0.24);
      return;
    }
    if (a.fly) {  // in the air, thrown or flung
      if (!a.fly.tumble && can.includes('flip') && !a.flipped && hit(' ')) { a.flipped = true; a.vy = 3.4; act(who, ['Backflip', 'Hop'], 1); sfx('hop'); }
      if (!a.fly.tumble) { faceTo(who.holder, a.dir * Math.PI / 2, dt); tryGrabs(a, can); }
      bar(null); tryPrompt(null);
      return;
    }
    if (a.aim) {  // holding T: the spot moves, nobody else waits
      const [lo, hi] = aimRange(a), m = (held('ArrowRight', 'd') ? 1 : 0) - (held('ArrowLeft', 'a') ? 1 : 0);
      a.aim.x = Math.max(lo, Math.min(hi, a.aim.x + m * 2.3 * dt));
      a.dir = a.aim.x >= a.x ? 1 : -1;
      faceTo(who.holder, a.dir * Math.PI / 2, dt);
      if (['Walk', 'Run', 'Carry', 'Tightrope'].includes(who.playing)) act(who, ['Idle']);
      const arc = drawAim(a);
      if (!held('t')) releaseThrow(a);
      bar(null); tryPrompt(arc.snap ? 'Let go of T: right on it' : '← → Aim   Let go of T to throw', a.x, a.y + 1.75);
      return;
    }
    if (a.climb) {
      const c = a.climb, up = held('ArrowUp', 'w', ' '), dn = held('ArrowDown', 's');
      a.x = c.x; a.z += (-0.26 - a.z) * Math.min(1, dt * 7);
      if (up) a.y = Math.min(c.y, a.y + 1.25 * dt);
      if (dn) a.y = Math.max(0, a.y - 1.25 * dt);
      const clip = act(who, dn && who.has('Down') ? ['Down', ...CLIMBS] : CLIMBS);
      if (clip && who.actions[clip]) who.actions[clip].timeScale = up || dn ? 1 : 0;
      faceTo(who.holder, Math.PI, dt);
      if ((up && a.y >= c.y) || (dn && a.y <= 0)) {
        if (clip && who.actions[clip]) who.actions[clip].timeScale = 1;
        a.climb = null; a.vy = 0; act(who, ['Idle']); sfx('land');
        if (a.y >= c.y) { a.x += 0.2; speak('climbed', { chance: 0.5 }); }
      }
      bar(null);
      tryPrompt('↑ Up   ↓ Down', a.x, a.y + 1.3);
      return;
    }
    if (a.hidden) {
      a.z += (game.hide[2] - a.z) * Math.min(1, dt * 7);
      if (!game.boss) { const mid = (game.hide[0] + game.hide[1]) / 2; a.x += (Math.max(mid - 0.25, Math.min(mid + 0.25, a.x)) - a.x) * Math.min(1, dt * 6); }  // right behind the cover
      faceTo(who.holder, Math.PI, dt);
      act(who, ['Crouch', 'Idle']);
      if (a.busy <= 0 && held('t') && throwable(a)) { startAim(a); bar(null); return; }  // from behind the crates, nobody sees who threw it
      if (hit('ArrowUp', 'w', 'ArrowDown', 's', 'ArrowLeft', 'ArrowRight', 'a', 'd', ' ')) { a.hidden = false; sfx('out'); speak('come_out', { chance: 0.5 }); }
      game.hiddenFor += dt;
      if (game.hiddenFor > 5 && !game.boss) { speak('hide_wait'); game.hiddenFor = -3; }
    } else {
      a.z += (homeZ(a) - a.z) * Math.min(1, dt * 7);
      const free = a.busy <= 0;
      const left = free && held('ArrowLeft', 'a'), right = free && held('ArrowRight', 'd'), run = held('Shift');
      const onRope = game.ledges.some((l) => l.rope && a.x >= l.from && a.x <= l.to && Math.abs(a.y - l.y) < 0.02);
      const dirn = (right ? 1 : 0) - (left ? 1 : 0), speed = onRope ? 0.95 : a.carry && a.carry.friend ? 1.2 : run ? 2.9 : 1.55;
      if (a.roll > 0) {  // under the tape
        a.roll -= dt;
        a.x = Math.max(-2.6, limit(a, a.x + a.dir * 2.75 * dt));
        faceTo(who.holder, a.dir * Math.PI / 2, dt, 18);
        if (a.roll <= 0) act(who, ['Idle']);
      } else if (dirn) {
        a.dir = dirn;
        a.x = Math.max(-2.6, limit(a, a.x + dirn * speed * dt));
        const mv = onRope && who.has('Tightrope') ? 'Tightrope' : a.carry && a.carry.friend && who.has('Carry') ? 'Carry' : run && who.has('Run') ? 'Run' : 'Walk';
        if (a.pushing > 0) { a.pushing -= dt; act(who, ['Push', mv]); } else act(who, [mv, 'Idle']);
        if (who.actions[mv]) who.actions[mv].timeScale = mv === 'Run' ? 1 : run ? 1.9 : 1.05;
        faceTo(who.holder, dirn * Math.PI / 2, dt);
        a.stepT = (a.stepT || 0) - dt;
        if (a.stepT <= 0 && a.y === 0) { sfx('step'); a.stepT = run ? 0.18 : 0.32; }
      } else if (free) {
        if (['Walk', 'Run', 'Crouch', 'Push', 'Carry', 'Tightrope'].includes(who.playing)) act(who, ['Idle']);
        faceTo(who.holder, a.dir * Math.PI / 2, dt);
      }
      const g = ground(a), cl = game.climbs.find((c) => c.on && Math.abs(a.x - c.x) < 0.42);
      if (a.y <= g + 0.001) a.flipped = false;
      else if (tryGrabs(a, can)) { bar(null); tryPrompt(null); return; }
      climbHere = cl && a.y < 0.05 ? (!cl.only || can.includes(cl.only) ? 'up' : 'no') : cl && Math.abs(a.y - cl.y) < 0.05 ? 'down' : null;
      if (free && climbHere === 'up' && hit('ArrowUp', 'w')) { a.climb = cl; sfx('pick'); speak('climb_start', { chance: 0.4 }); }
      else if (free && climbHere === 'down' && hit('ArrowDown', 's')) { a.climb = cl; }
      else if (free && climbHere === 'no' && hit('ArrowUp', 'w')) speak('cant_climb', { force: true });
      else if (free && a.roll <= 0 && hit(' ', 'ArrowUp', 'w') && a.y <= g + 0.001) { a.vy = 3.9 * (game.hopBoost || 1); act(who, can.includes('vault') && game.crate && Math.abs(a.x - game.crate.x) < 0.9 ? ['Vault', 'Hop'] : ['Hop'], 1); sfx('hop'); speak('hop', { chance: 0.35 }); }
      else if (free && hit(' ') && a.y > g + 0.05 && can.includes('flip') && !a.flipped) { a.flipped = true; a.vy = 3.6; act(who, ['Backflip', 'Hop'], 1); sfx('hop'); speak(LINES['flip_' + a.key] ? 'flip_' + a.key : 'flip', { chance: 0.3 }); }
      if (free && a.roll <= 0 && moveOK('roll') && dirn && can.includes('roll') && !inZone() && a.y <= g + 0.001 && hit('ArrowDown', 's')) { a.roll = 0.62; act(who, ['Roll', 'Slide', 'Crouch'], 1); sfx('hop'); speak('roll', { chance: 0.35 }); }
      if (free && held('t') && throwable(a)) { startAim(a); bar(null); return; }
      if (free && can.includes('hide') && inZone() && hit('ArrowDown', 's')) { a.hidden = true; facts.hidTimes++; if (paid) paid.hid(); game.hiddenFor = 0; sfx('hide'); speak(game.boss ? 'hide_van' : 'hide', { force: true }); }
      if (free && can.includes('hit') && a.tool === 'hammer' && hit('f')) swing();
      use = useHere(a);
      if (use && use.run && free && hit('e', 'Enter')) use.run();
      else if (use && use.hint && hit('e', 'Enter')) speak('not_my_job', { force: true });
    }
    bar(use && use.label, climbHere);
    const moving = held('ArrowLeft', 'a', 'ArrowRight', 'd');
    game.still = moving || a.hidden ? 0 : game.still + dt;
    if (game.still > 9) { speak('idle'); game.still = 0; }
    game.runFor = moving && held('Shift') ? (game.runFor || 0) + dt : 0;
    if (game.runFor > 1) { speak('run', { chance: 0.25 }); game.runFor = -6; }
    if (paid && a.x <= -2.59 && held('ArrowLeft', 'a') && paid.goBack()) return;
    if (a.x >= 2.6 && !a.carry?.friend && canLeave() && (!paid || paid.mayLeave()) && game.at < LEVELS[game.level].screens.length - 1) { enter(game.at + 1); return; }
    if (a.x > 2.6) a.x = 2.6;
    const hint = a.hidden ? 'Hidden' : use ? (use.label ? 'E  ' + use.label : use.hint) : climbHere === 'up' ? '↑  Climb' : climbHere === 'down' ? '↓  Climb down' : climbHere === 'no' ? 'Only Pim climbs that' : inZone() && can.includes('hide') ? '↓  Hide here' : game.hide && !(game.boss && game.boss.freed) ? 'Hiding spot' : '';
    const downB = game.boss && game.boss.kind === 'beam' && game.boss.mode === 'dizzy' && !use;
    if (downB) tryPrompt(a.key === 'tuck' ? `Go to ${FIGURES[game.boss.key].name}` : `Only Tuck has scissors: press ${actor('tuck').off ? 'Q' : 'Tab'}`, a.x, a.y + 1.35);
    else if (hint === 'Hiding spot') tryPrompt(hint, (game.hide[0] + game.hide[1]) / 2, 0.45);
    else tryPrompt(hint, a.hidden ? a.x : use ? use.at : a.x, (use ? 1.45 : 1.25) + a.y);
    if (game.spot) { game.spot.visible = !(game.boss && game.boss.freed); game.spot.material.opacity = a.hidden ? 0.2 : 0.6 + Math.sin(game.time * 4) * 0.2; }
  }
  const canLeave = () => !hero().climb && !hero().hang && !game.boss && (!game.gate || game.gate.fall >= 0) && (!game.smash || game.smash.broken);

  function physics(dt) {  // falling for everyone; the ones you aren't right now just stand there
    moveRopes(dt);
    team.forEach((a, k) => {
      if (a.off || a.rope) return;
      if (a.pull || a.fly) a.z += (homeZ(a) - a.z) * Math.min(1, dt * 7);
      if (a.climb || a.pull || a.hang) { a.who.holder.position.set(ox + a.x, a.y, a.z); return; }
      if (a.lifted) {  // over somebody's head
        const L = a.lifted;
        a.x = L.x; a.y = L.y + 0.98 * L.who.holder.scale.y; a.z = L.z; a.vy = 0; a.dir = L.dir;
        a.who.holder.position.set(ox + a.x, a.y, a.z); a.who.holder.rotation.y = L.who.holder.rotation.y;
        act(a.who, ['Crouch', 'Idle']);
        return;
      }
      if (a.fly) a.x = Math.max(-2.6, Math.min(2.6, a.fly.tumble || a.fly.vx < 0 ? a.x + a.fly.vx * dt : limit(a, a.x + a.fly.vx * dt)));
      const g = ground(a), was = a.y;
      if (a.y > g || a.vy > 0) { a.vy -= 9.8 * dt; a.y += a.vy * dt; if (a.y <= g) { a.y = g; a.vy = 0; if (was - g > 0.01) sfx('land'); } } else a.y = g;
      if (a.fly && a.vy === 0 && a.y === g) {  // down
        const thrown = a.fly.tumble;
        a.fly = null; a.who.holder.rotation.z = 0;
        if (thrown) {
          a.busy = 0.5; act(a.who, ['Roll', 'Slide', 'Idle'], 1);
          const sn = game.snarls.find((n) => !n.flat && Math.abs(n.x - a.x) < 0.6);
          if (sn) { sn.flat = true; sfx('smash'); speak('snarl_landed', { force: true }); } else speak('landed_' + a.key, { force: true });
        } else act(a.who, ['Idle']);
      }
      if (a.fly && a.fly.tumble) {  // head over heels, around the middle of the body
        a.fly.spin -= Math.sign(a.fly.vx || 1) * dt * 8.5;
        const sp = a.fly.spin; a.who.holder.rotation.z = sp;
        a.who.holder.position.set(ox + a.x + Math.sin(sp) * 0.5, a.y + 0.5 - Math.cos(sp) * 0.5, a.z);
        faceTo(a.who.holder, a.dir * Math.PI / 2, dt, 12);
        return;
      }
      a.who.holder.position.set(ox + a.x, a.y, a.z);
      if (k !== active && !a.ordered && ['Walk', 'Run', 'Push', 'Carry', 'Tightrope'].includes(a.who.playing)) act(a.who, ['Idle']);
    });
  }

  function moveGuard(dt) {
    const g = game.guard; if (!g) return;
    if (g.letter) {  // it flies to them; they have to read it. They can't not
      const d = g.x - g.letter.x;
      g.letter.x += Math.sign(d) * Math.min(4.2 * dt, Math.abs(d)); g.letter.mesh.position.x = ox + g.letter.x; g.letter.mesh.rotation.y += dt * 9;
      if (Math.abs(d) < 0.1) { things.remove(g.letter.mesh); g.letter = null; g.read = 9; g.awake = true; g.wait = 0; act(g.who, ['Talk', 'Look', 'Idle']); sfx('pick'); speak(g.key + '_reads', { force: true }); }
    }
    if (g.read > 0) {
      g.read -= dt;
      g.who.holder.position.x = ox + g.x;
      game.sight.material.opacity = 0.06;
      if (g.read <= 0) { act(g.who, ['Stagger', 'Walk']); speak(g.key + '_turn', { force: true }); }
      return;
    }
    if (!g.awake && game.lesson >= g.wake) { g.awake = true; act(g.who, ['Stagger', 'Walk']); }
    if (g.awake && g.noise !== undefined) {  // something broke: they have to look into it, in the direction of the noise
      const d = g.noise - g.x;
      g.dir = Math.sign(d) || g.dir; g.wait = 0;
      g.x += g.dir * g.speed * 1.7 * dt;
      if (Math.abs(d) < 0.15 || g.x > g.right || g.x < g.left) { g.x = Math.max(g.left, Math.min(g.right, g.x)); g.noise = undefined; g.wait = 3.2; }
    } else if (g.awake) {
      if (g.wait > 0) {
        g.wait -= dt;
        act(g.who, ['Look', 'Idle']);
        if (g.wait <= 0) { g.dir *= -1; act(g.who, ['Stagger', 'Walk']); speak(g.key + '_turn', { chance: 0.6 }); }
      } else {
        if (game.alarm > 0) {  // the pigeons told on you: straight for you, fast
          game.alarm -= dt; g.dir = Math.sign(hero().x - g.x) || g.dir;
          g.x += g.dir * 2.5 * dt;
        } else { g.x += g.dir * g.speed * dt; if (paid) paid.guardWalk(g); }
        if (g.x > g.right) { g.x = g.right; g.wait = g.pause; } else if (g.x < g.left) { g.x = g.left; g.wait = g.pause; }
      }
    }
    g.who.holder.position.x = ox + g.x;
    faceTo(g.who.holder, g.dir * Math.PI / 2, dt, 6);
    const h = hero();
    if (g.awake) {
      game.mutter -= dt;
      if (game.mutter <= 0) { speak(g.key + '_mutter'); game.mutter = 4 + Math.random() * 3; }
      if (h.hidden && Math.abs(h.x - g.x) < 0.9 && !game.closeDone) { speak(g.key + '_near', { force: true }); game.closeDone = 'near'; }
      if (h.hidden && game.closeDone === 'near' && g.dir * (g.x - h.x) > 0.7) { speak('close_call', { force: true }); game.closeDone = true; }
    }
    game.sight.position.x = ox + g.x + g.dir * g.see * 0.52; game.sight.scale.x = g.see / 2.1;
    game.sight.material.opacity = g.awake ? 0.32 : 0.14;
    const dx = h.x - g.x;
    const inSight = Math.sign(dx) === Math.sign(g.dir) && Math.abs(dx) < g.see;
    if (g.awake && !h.hidden && Math.abs(h.z + 0.1) < 0.5 && (inSight || Math.abs(dx) < 0.45)) {
      g.seen += dt;
      if (g.seen > 0.12) caught('caught');
    } else g.seen = 0;
  }

  function moveSnarls(dt) {
    for (const s of game.snarls) {
      if (s.flat) {
        s.gone = (s.gone || 0) + dt;
        if (s.who) { if (s.gone > 1.1) { s.mesh.visible = false; } continue; }
        s.squash = Math.max(0.06, s.squash - dt * 6);
        s.mesh.scale.set(2 - s.squash, s.squash, 2 - s.squash);
        s.mesh.position.y = 0;
        if (s.gone > 1.4) s.mesh.visible = false;
        continue;
      }
      s.x += s.dir * (s.speed || 0.75) * dt;
      if (s.x > s.to) { s.x = s.to; s.dir = -1; } else if (s.x < s.from) { s.x = s.from; s.dir = 1; }
      if (s.who) {
        s.mesh.position.set(ox + s.x, 0, -0.1); faceTo(s.mesh, s.dir * Math.PI / 2, dt, 8);
        for (const a of team) if (!a.hidden && !a.fly && a.y < 0.5 && Math.abs(a.x - s.x) < 0.38) { caught('snarl', a); return; }
        continue;
      }
      const bounce = Math.abs(Math.sin(game.time * 6 + s.phase));
      s.mesh.position.set(ox + s.x, bounce * 0.12, -0.1);
      s.mesh.scale.set(1 + (1 - bounce) * 0.08, 1 - (1 - bounce) * 0.1, 1 + (1 - bounce) * 0.08);
      s.mesh.rotation.y = s.dir > 0 ? 0.5 : -0.5;
      for (const a of team) if (!a.hidden && !a.fly && a.y < 0.5 && Math.abs(a.x - s.x) < 0.4) { caught('snarl', a); return; }
    }
  }

  function moveFalls(dt) {
    if (game.fallsSlow) dt *= game.fallsSlow;
    const T = 2.9;
    if (game.beam && game.boss && game.boss.mode === 'walk') {  // up on the beam, dropping paper where the team stands
      game.dropT -= dt;
      if (game.dropT <= 0) {
        const near = team.reduce((p, a) => (Math.abs(a.x - game.boss.x) < Math.abs(p.x - game.boss.x) ? a : p));
        const x = Math.max(-2.3, Math.min(2.3, near.x + (Math.random() - 0.5) * 0.5));
        game.falls.push(makeFall(x, 0, true));
        game.dropT = 2.1;
        speak('pim_paper', { chance: 0.4 });
      }
    }
    for (const f of game.falls) {
      if (f.oneShot) f.t += dt;
      const t = f.oneShot ? f.t : (game.time + f.phase) % T;
      // warning 0 to 1.05 (the shadow grows), falls 1.05 to 1.3, lies there until 1.95, then gone
      const warn = Math.min(1, t / 1.05);
      f.shadow.material.opacity = t < 1.95 ? 0.15 + warn * 0.4 : 0;
      f.shadow.scale.setScalar(0.45 + warn * 0.55);
      f.stack.position.y = t < 1.05 ? 5 : t < 1.3 ? 5 * (1 - ((t - 1.05) / 0.25) ** 2) : t < 1.95 ? 0 : 5;
      if (t >= 1.27 && !f.banged) { f.banged = true; sfx('thud'); }
      if (t < 1) f.banged = false;
      const h = team.find((a) => Math.abs(a.x - f.x) < 0.36 && a.y < 0.5 && !a.hidden);
      if (t >= 1.2 && t < 1.32 && h) { caught('crushed', h); return; }
      if (t >= 1.3 && !f.near && t < 1.4 && Math.abs(hero().x - f.x) < 0.95) { f.near = true; speak('near_miss', { chance: 0.5 }); }
      if (t < 1) f.near = false;
    }
    game.falls = game.falls.filter((f) => { if (f.oneShot && f.t > 2) { things.remove(f.stack); things.remove(f.shadow); return false; } return true; });
  }

  function moveBoss(dt) {
    const b = game.boss; if (!b || b.freed) return;
    const who = b.who;
    if (b.kind === 'spool') {
      b.braked = !!(game.biglever && game.biglever.used && Math.abs(actor('ivy').x - game.biglever.x) < 0.75);
      if (game.biglever && game.biglever.used && !b.braked) { game.biglever.used = false; game.biglever.mesh.rotation.z = 0; speak('brake_off', { force: true }); }
      b.mesh.rotation.y += dt * (b.braked ? 0.08 : b.mode === 'end' ? 0.3 : 2.4);
      if (!b.braked && b.mode === 'wind') {
        game.dropT -= dt;
        if (game.dropT <= 0) {
          const h = hero();
          game.falls.push(makeFall(Math.max(-2.3, Math.min(2.3, h.x + (Math.random() - 0.5) * 0.4)), 0, true));
          game.dropT = 2.6;
          speak('spool_paper', { chance: 0.3 });
        }
      }
      if (b.mode === 'wind' && !game.knots.some((k) => !k.done)) { b.mode = 'end'; if (game.guard) { game.guard.read = 999; game.guard.noise = undefined; } }  // nothing left to inspect
      return;
    }
    if (b.kind === 'letters') {
      if (b.mode === 'throw') {
        b.t -= dt;
        if (b.t <= 0) {
          b.t = 1.5;
          const red2 = [true, false, true, true, false][b.n++ % 5];
          model(prop('letter')).then((src) => {
            if (game.boss !== b || b.mode !== 'throw') return;
            const m = src ? placed(src, 0, { width: 0.42 }) : box(0.42, 0.02, 0.28, paperMat);
            m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); if (red2) { o.material.color.set(0xe8382a); o.material.emissive = new THREE.Color(0x8a120a); } else { o.material.emissive = new THREE.Color(0xfff2c0); o.material.emissiveIntensity = 0.7; } } });
            addAt(m, b.x - 0.3, 0.42, -0.1);
            game.flyers.push({ x: b.x - 0.3, red: red2, mesh: m });
          });
          act(who, ['Open', 'Talk', 'Stagger'], 1);
          speak('juno_throws', { chance: 0.28 });
        }
      }
      const h = hero();
      for (const f of game.flyers) {
        f.x -= 1.9 * dt; f.mesh.position.x = ox + f.x; f.mesh.rotation.z = Math.sin(game.time * 8 + f.x * 3) * 0.28; f.mesh.position.y = 0.34 + Math.sin(game.time * 9 + f.x) * 0.02;
        if (Math.abs(h.x - f.x) < 0.27 && !f.gone) {
          if (f.red && h.y < 0.33) { caught('letter'); return; }
          if (!f.red && h.y < 1) {
            f.gone = true; things.remove(f.mesh); sfx('pick');
            const page = b.pages[Math.min(facts.letters, b.pages.length - 1)];
            facts.letters++;
            sayWho = h.key; sayEl.innerHTML = '<b>The letter says</b>'; sayEl.append(page); sayEl.classList.remove('tangled', 'shout'); sayEl.hidden = false; sayT = Math.max(4, page.length * 0.075);
            if (facts.letters >= b.pages.length) { b.mode = 'talk'; game.flyers.forEach((x) => things.remove(x.mesh)); game.flyers = []; act(who, ['Look', 'Idle']); setTimeout(() => speak('juno_out', { force: true }), 3600); break; }
          }
        }
        if (f.x < -2.9) { f.gone = true; things.remove(f.mesh); }
      }
      game.flyers = game.flyers.filter((f) => !f.gone);
      if (b.mode === 'throw' && Math.abs(h.x - b.x) < 0.5) { caught('juno'); return; }
      faceTo(who.holder, h.x < b.x ? -Math.PI / 2 : Math.PI / 2, dt, 6);
      return;
    }
    if (b.kind === 'beam') {
      const bm = game.beam, me = hero();
      for (const m of game.marks) { m.mesh.visible = b.mode === 'walk' && m.show(me); m.mesh.material.opacity = 0.45 + Math.sin(game.time * 4) * 0.2; }
      game.arrow.visible = b.mode === 'dizzy'; game.arrow.position.set(ox + b.x, b.y + 1.2 + Math.sin(game.time * 5) * 0.05, -0.1);
      if (bm.shake > 0) { bm.shake -= dt; bm.frame.position.x = ox + Math.sin(game.time * 60) * 0.03; } else bm.frame.position.x = ox;
      if (b.mode === 'walk') {
        b.x += b.dir * 0.8 * dt;
        if (Math.abs(b.x) > 2.45) { b.x = Math.sign(b.x) * 2.45; b.dir *= -1; speak('pim_mutter', { chance: 0.7 }); }
        who.holder.position.set(ox + b.x, bm.y, -0.1);
      } else if (b.mode === 'falling') {
        b.vy -= 9.8 * dt; b.y += b.vy * dt;
        if (b.y <= 0) { b.y = 0; b.mode = 'dizzy'; b.t = 9; sfx('thud'); act(who, ['Stumble', 'Look', 'Idle']); }
        who.holder.position.set(ox + b.x, b.y, -0.1);
      } else if (b.mode === 'dizzy') {
        if (me.key === 'tuck') b.t -= dt;  // Pim stays down until the only one with scissors is on the way
        who.holder.rotation.z = who.has('Stumble') ? 0 : Math.sin(game.time * 7) * 0.08;
        if (b.t <= 0) { who.holder.rotation.z = 0; b.mode = 'climb'; b.t = 1.3; act(who, ['Climb', 'Walk']); speak('rivet_wakes', { force: true, who: 'hero' }); }
      } else if (b.mode === 'climb') {
        b.t -= dt; b.y = Math.min(bm.y, b.y + dt * 1.3);
        who.holder.position.set(ox + b.x, b.y, -0.1);
        if (b.t <= 0) { b.y = bm.y; b.mode = 'walk'; act(who, ['Stagger', 'Walk']); }
      }
      faceTo(who.holder, b.dir * Math.PI / 2, dt, 8);
      return;
    }
    if (b.kind === 'talk') {
      if (b.mode === 'dizzy') { b.t -= dt; if (who.playing !== 'Bow' && !who.has('Stumble')) who.holder.rotation.z = Math.sin(game.time * 3) * 0.03; }
      faceTo(who.holder, hero().x < b.x ? -Math.PI / 2 : Math.PI / 2, dt, 6);
      return;
    }
    if (b.kind === 'levers') {
      const free = () => game.pulls.filter((l) => !team.some((a) => Math.abs(a.x - l.x) < 0.5));
      if (b.mode === 'dizzy') {
        b.t -= dt;
        if (b.t <= 0) { b.mode = 'go'; b.target = null; act(who, ['Stagger', 'Walk']); speak('ivy_wakes', { force: true }); }
      } else if (b.mode === 'wait') {
        b.t -= dt;
        if (b.t <= 0) { b.mode = 'go'; act(who, ['Stagger', 'Walk']); }
      } else if (b.mode === 'pull') {
        b.t -= dt;
        if (b.t <= 0) { b.last = b.target; b.target = null; b.mode = 'wait'; b.t = 0.9; act(who, ['Look', 'Idle']); }
      } else {
        const open = free();
        if (!open.length) {  // nothing left to pull
          b.mode = 'dizzy'; b.t = 9; act(who, ['Stumble', 'Look', 'Idle']); sfx('thud');
          speak('ivy_stuck', { force: true }); setTimeout(() => speak('ivy_now', { force: true }), 2300);
        } else {
          if (!b.target || !open.includes(b.target)) {
            const others = open.filter((l) => l !== b.last);
            b.target = (others.length ? others : open).reduce((p, l) => (Math.abs(l.x - b.x) < Math.abs(p.x - b.x) ? l : p));
          }
          const d = b.target.x - b.x;
          b.dir = Math.sign(d) || b.dir;
          b.x += b.dir * Math.min(1.5 * dt, Math.abs(d));
          if (Math.abs(d) < 0.08) {
            b.mode = 'pull'; b.t = 0.9; act(who, ['Pull', 'Idle'], who.has('Pull') ? 1 : undefined); sfx('lever');
            b.target.mesh.rotation.z = 0.5;
            const h = hero();
            game.falls.push(makeFall(Math.max(-2.3, Math.min(2.3, h.x + (Math.random() - 0.5) * 0.3)), 0, true));
            speak('ivy_pull', { chance: 0.7 });
          }
        }
      }
      for (const l of game.pulls) if (l !== b.target) l.mesh.rotation.z *= 1 - dt * 3;
      who.holder.position.x = ox + b.x;
      faceTo(who.holder, b.dir * Math.PI / 2, dt, 8);
      return;
    }
    b.t -= dt;
    if (b.mode === 'roar') {
      if (!b.roared) { b.roared = true; speak('rivet_roar', { force: true }); }
      if (b.t <= 0) { b.mode = 'charge'; b.roared = false; sfx('charge'); const m = act(who, ['Charge', 'Walk']); if (m === 'Walk') who.actions.Walk.timeScale = 2.5; }
    } else if (b.mode === 'charge') {
      b.x += b.dir * (b.fast ? 4.3 : 3.6) * dt;
      if (Math.abs(b.x) >= 2.25) {
        b.x = Math.sign(b.x) * 2.25; b.mode = 'dizzy'; b.t = 6; sfx('thud'); act(who, ['Stumble', 'Idle']);
        speak('rivet_dizzy', { force: true }); setTimeout(() => speak('rivet_now', { force: true }), 2300);
      }
      const h = hero();
      if (!h.hidden && Math.abs(h.x - b.x) < 0.5 && Math.abs(h.z + 0.1) < 0.5 && h.y < 0.75) caught('charged');
    } else if (b.mode === 'dizzy') {
      if (!who.has('Stumble')) who.holder.rotation.z = Math.sin(game.time * 7) * 0.08;
      if (b.t <= 0) { who.holder.rotation.z = 0; b.dir *= -1; b.mode = 'roar'; b.t = 1.8; act(who, ['Stomp', 'Idle'], who.has('Stomp') ? 1 : undefined); speak('rivet_wakes', { force: true }); b.roared = true; }
    }
    who.holder.position.x = ox + b.x;
    faceTo(who.holder, b.dir * Math.PI / 2, dt, 8);
  }

  function moveWorld(dt) {
    for (const it of game.items) if (it.pointer) { it.pointer.position.y = it.pointer.userData.y + Math.sin(game.time * 5) * 0.06; it.pointer.visible = !(Math.abs(hero().x - it.x) < 0.6 && Math.abs(hero().y - it.ly) < 0.3); }  // once you're there it's only in the way
    for (const m of Object.values(game.mats)) {
      if (m.open) { m.roll = Math.max(0.001, m.roll - dt * 1.5); m.mesh.scale.x = m.roll; m.mesh.position.x = ox + m.to - (m.to - m.from) * m.roll / 2; if (m.roll < 0.01) m.mesh.visible = false; continue; }
      for (const a of team) if (!a.off && !a.fly && !a.rope && !a.hang && !a.pull && !a.lifted && !a.hidden && a.y < 0.06 && a.x > m.from && a.x < m.to) { caught('mat', a); return; }
    }
    for (const p of game.plates) {  // plates and doors
      const wasDown = p.down;
      p.down = team.some((a) => Math.abs(a.x - p.x) < 0.45 && a.y < 0.1) || !!(game.crate && game.crate.pushable && Math.abs(game.crate.x - p.x) < 0.3);
      if (p.down !== wasDown) { sfx('click'); speak(p.down ? 'plate_on' : 'plate_off', { chance: 0.6 }); }
      p.mesh.position.y = p.y0 - (p.down ? 0.025 : 0);
      if (game.doors[p.opens]) game.doors[p.opens].open = p.down;
    }
    for (const p of game.pigeons) {  // run past and they go up, and tell on you
      if (!p.up && game.guard && Math.abs(hero().x - p.x) < 1 && held('Shift') && held('ArrowLeft', 'a', 'ArrowRight', 'd')) {
        p.up = true; sfx('charge'); game.alarm = 3; game.guard.awake = true;
        speak('pigeon_up', { force: true });
      }
      if (p.up) { p.t += dt; p.mesh.position.y = p.t * 2.2; p.mesh.position.x += dt * (p.x % 2 ? 1.1 : -1.1); p.mesh.rotation.z = Math.sin(game.time * 30) * 0.25; if (p.t > 2.5) p.mesh.visible = false; }
    }
    const se = game.seed;
    if (se && se.grow >= 0 && !se.grown) {
      se.grow = Math.min(1, se.grow + dt / 1.3);
      const k = se.grow * se.grow * (3 - 2 * se.grow);
      se.mesh.scale.set(0.3 + 0.7 * k, Math.max(0.02, k), 0.3 + 0.7 * k);
      if (se.grow >= 1) { se.grown = true; game.climbs.push({ x: se.x, y: se.y, on: true }); }
    }
    const ca = game.cat;
    if (ca && ca.moved && ca.t >= 0 && ca.t < 1) {  // down from the crate, and off to one side, unbothered
      ca.t = Math.min(1, ca.t + dt * 1.6);
      ca.mesh.position.x = ox + game.crate.x + ca.t * -1.05;
      ca.mesh.position.y = game.crate.h * (1 - ca.t * ca.t) + Math.sin(ca.t * Math.PI) * 0.25;
      ca.mesh.position.z = -0.1 - ca.t * 0.55;
    }
    const sh = game.shredder;
    if (sh && sh.on) {
      sh.x += sh.dir * 1.1 * dt; sh.mesh.position.x = ox + sh.x + Math.sin(game.time * 50) * 0.008;
      if (game.time % 0.25 < 0.04) sfx('step');
      if (sh.dir > 0 && sh.x >= sh.to) {
        sh.dir = -1; sh.done = true; sfx('smash');
        if (game.gate && game.gate.fall < 0) { game.gate.fall = 0; speak('shredded', { force: true }); }
      }
      if (sh.dir < 0 && sh.x <= sh.x0) { sh.x = sh.x0; sh.on = false; sh.mesh.position.x = ox + sh.x; }
      for (const a of team) if (Math.abs(a.x - sh.x) < 0.55 && a.y < 0.6 && !a.hidden) { caught('pressed', a); return; }
    }
    moveMouse(dt);
    moveAir(dt);
    if (game.lantern) {
      const L = game.lantern, a = L.who, flick = 1 + Math.sin(game.time * 13) * 0.025 + Math.sin(game.time * 31) * 0.015;
      L.on = Math.min(1, L.on + dt * 2.4);
      L.light.position.set(ox + a.x + a.dir * 0.45, a.y + 0.8, a.z + 0.55); L.light.intensity = 1.35 * L.on * flick;
      const v = new THREE.Vector3(ox + a.x, a.y + 0.65, a.z).project(cam);
      plate.lamp((v.x + 1) / 2, (v.y + 1) / 2, 0.42 * flick * L.on, 1);
    }
    const stoppedOne = game.steams.find((x) => x.stopped > 0);
    for (const st of game.steams) {  // shut one pipe, and the pressure goes to the next
      if (st.stopped > 0) { st.stopped -= dt; st.blow = false; }
      else if (st.linked && stoppedOne && stoppedOne !== st) st.blow = true;
      else { st.t = (st.t + dt) % (st.on + st.off); st.blow = st.t < st.on; }
      const warn = !st.blow && !st.stopped && st.t > st.on + st.off - 0.5 && !(stoppedOne);
      st.fade = (st.fade || 0) + ((st.blow ? 1 : 0) - (st.fade || 0)) * Math.min(1, dt * 14);
      st.mat.opacity = Math.max(st.fade * 0.9, warn ? 0.18 : 0);
      st.plume.children.forEach((c, k) => {  // puffs rising from the nozzle, growing as they go
        const u = (c.userData.at + game.time * 1.3) % 1, h = st.fade > 0.05 ? 0.15 + u * 1.75 : 0.15 + u * 0.35, w = 0.36 + u * 0.62;
        c.position.set(Math.sin(game.time * 7 + k * 2.1) * 0.05 * (1 + u * 2), h, 0); c.scale.set(w, w, 1);
      });
      if (st.blow && !st.was) sfx('charge');
      st.was = st.blow;
      if (st.blow) for (const a of team) if (Math.abs(a.x - st.x) < 0.3 && a.y < 1.5 && !a.hidden && !a.climb) { caught('steam', a); return; }
    }
    for (const va of game.valves) if (va.turn > 0) { va.turn -= dt * 1.4; va.mesh.rotation.z += dt * 6; }
    if (game.ripple) {
      game.ripple.t += dt; game.ripple.mesh.scale.setScalar(1 + game.ripple.t * 16); game.ripple.mesh.material.opacity = Math.max(0, 0.9 - game.ripple.t * 1.1);
      if (game.ripple.t > 0.9) { things.remove(game.ripple.mesh); game.ripple = null; }
    }
    const bo = game.boss;
    if (bo && bo.pod && bo.podGone !== undefined) { bo.podGone += dt; bo.pod.scale.setScalar(Math.max(0.01, 1 - bo.podGone * 1.4)); if (bo.podGone > 0.8) { things.remove(bo.pod); bo.pod = null; } }
    if (bo && bo.kind === 'spool' && bo.mode === 'out') {  // all of it goes
      bo.outT += dt; bo.mesh.rotation.y += dt * 11; bo.mesh.scale.setScalar(Math.max(0.05, 1 - bo.outT * 0.13));
    }
    const ro = game.roller;
    if (ro) {  // tape can't hold a hedgehog: it lifts as it rolls through
      ro.x += ro.dir * ro.speed * dt;
      if (ro.x > ro.to) { ro.x = ro.to; ro.dir = -1; } else if (ro.x < ro.from) { ro.x = ro.from; ro.dir = 1; }
      ro.mesh.position.x = ox + ro.x;
      ro.mesh.rotation.z -= ro.dir * ro.speed * dt / 0.17;
      for (const d of Object.values(game.doors)) if (d.rolls) { const op = Math.abs(ro.x - d.x) < 0.8; if (op && !d.open) sfx('click'); d.open = op; }
    }
    for (const k of game.knots) if (k.done && k.mesh.parent) {
      k.mesh.userData.drop += dt;
      k.mesh.scale.multiplyScalar(1 - dt * 2.2); k.mesh.rotation.y += dt * 12;
      if (k.mesh.userData.drop > 0.9) things.remove(k.mesh);
    }
    for (const d of Object.values(game.doors)) {
      d.lift += ((d.open ? 1 : 0) - d.lift) * Math.min(1, dt * 6);
      d.mesh.position.y = d.lift * 1.7;
      d.mesh.scale.y = 1 - d.lift * 0.4;
    }
    const pr = game.press;
    if (pr) {
      if (pr.stopped > 0) {
        pr.stopped -= dt; pr.head.position.y = Math.min(1.7, pr.head.position.y + dt * 2); pr.down = false;
        if (pr.stopped <= 0 && game.lever) game.lever.mesh.rotation.z = 0;
      } else {
        pr.phase = (pr.phase + dt) % 2.6;
        const t = pr.phase;
        pr.head.position.y = Math.max(0.1, t < 1.5 ? 1.7 : t < 1.72 ? 1.7 * (1 - ((t - 1.5) / 0.22) ** 2) : t < 2.1 ? 0.1 : 0.1 + (t - 2.1) / 0.5 * 1.6);
        pr.down = t >= 1.66 && t < 2.1;
        if (t >= 1.7 && !pr.banged) { pr.banged = true; sfx('press'); }
        if (t < 1) pr.banged = false;
        if (pr.down) for (const a of team) if (Math.abs(a.x - pr.x) < 0.5 && !a.hidden) { caught('pressed', a); return; }
      }
    }
    const s = game.smash;  // crates in pieces
    if (s && s.broken && s.mesh.parent) {
      s.parts += dt;
      s.mesh.children.forEach((c, k) => { c.position.x += (k % 2 ? 1 : -1) * dt * 1.6; c.position.y = Math.max(0, c.position.y - dt * 2.2); c.rotation.z += (k % 2 ? 1 : -1) * dt * 3; c.scale.multiplyScalar(1 - dt * 1.2); });
      if (s.parts > 0.8) things.remove(s.mesh);
    }
    const g = game.gate;  // tape falling away
    if (g && g.fall >= 0 && g.mesh.parent) {
      g.fall += dt;
      g.mesh.children.forEach((c, k) => { c.position.y = Math.max(0.02, c.position.y - dt * (1.6 + g.fall * 3)); c.rotation.z *= 1 - dt * 3; c.position.x += Math.sin(k * 2.4) * dt * 0.4; });
      if (g.fall > 1.6) things.remove(g.mesh);
    }
    for (const m of game.dropping) {
      m.userData.drop += dt;
      m.position.y = Math.max(0.03, m.position.y - dt * (0.8 + m.userData.drop * 2.4));
      m.rotation.x += (Math.PI / 2 - m.rotation.x) * Math.min(1, dt * 5);
      m.rotation.y *= 1 - dt * 5;
    }
    for (const n of game.animals) n.mesh.rotation.y = Math.sin(game.time * 0.6 + n.phase) * 0.35;
  }

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    tick(Math.min(clock.getDelta(), 0.05));
    renderer.clear();
    plate.render(renderer);
    renderer.render(world, cam);
  });
  function tick(dt) {
    if (game.paused) { pressed.clear(); return; }
    if (sayT > 0) { sayT -= dt; if (sayT <= 0) sayEl.hidden = true; }
    if (quiet > 0) quiet -= dt;
    placeBubble();
    if (!game.frozen && game.started) {
      if (game.grace > 0) game.grace -= dt;
      if (game.swap) { moveSwap(dt); moveAir(dt); pressed.clear(); for (const f of Object.values(figCache)) f.mixer.update(dt); return; }
      game.time += dt;
      moveHero(dt);
      if (!game.frozen) physics(dt);
      if (!game.frozen) moveThrowns(dt);
      if (!game.frozen) moveGuard(dt);
      if (!game.frozen) moveSnarls(dt);
      if (!game.frozen) moveFalls(dt);
      if (!game.frozen) moveBoss(dt);
      if (!game.frozen) moveWorld(dt);
      if (!game.frozen && paid) paid.tick(dt);
      const l = screen().lessons[game.lesson];
      if (!game.frozen && l && l.back && l.back(api)) { game.lesson--; showLesson(); }
      else if (!game.frozen && l && l.done && l.done(api)) { game.lesson++; showLesson(); }
    } else { promptEl.hidden = true; if (game.started) moveWorld(dt); }
    pressed.clear();
    for (const f of Object.values(figCache)) f.mixer.update(dt);
  }

  // ---------- the films: rendered in Unreal, with the words on top so they can be translated. Any key, or the button, skips ----------
  function playFilm(f) {
    if (!f || window.snip.noFilms || (EDITION === 'web' && !f.web)) return Promise.resolve();  // the films of levels 2 to 6 are the download's
    return new Promise((done) => {
      const el = $('[data-cinema]'), v = $('[data-cvideo]'), line = $('[data-cline]');
      let finished = false;
      const end = () => {
        if (finished) return;
        finished = true;
        removeEventListener('keydown', onKey); v.pause(); v.removeAttribute('src'); v.load();
        el.hidden = true; line.hidden = true;
        done();
      };
      const onKey = (e) => { if ([' ', 'Enter', 'Escape', 'e'].includes(e.key)) { e.preventDefault(); end(); } };
      addEventListener('keydown', onKey);
      $('[data-cskip]').onclick = end;
      v.onended = end; v.onerror = end;
      v.ontimeupdate = () => {
        const l = (f.lines || []).find((x) => v.currentTime >= x.from && v.currentTime < x.to);
        line.hidden = !l;
        if (l) { line.innerHTML = `<b>${l.who}</b>`; line.append(l.text); }
      };
      v.src = f.src; el.hidden = false;
      v.muted = !soundOn;  // the worlds' films have a sound of their room; the rest are silent
      v.play().catch(() => { v.muted = true; v.play().catch(end); });
    });
  }

  // ---------- starting a level ----------
  async function startLevel(n) {
    team.forEach((a) => { if (a.carry && a.carry.mesh) a.who.holder.remove(a.carry.mesh); });  // nothing stays on anyone's head between levels
    game.level = n; game.tries = 0; active = 0; team.length = 0; game.run = (game.run || 0) + 1;
    for (const f of Object.values(figCache)) f.holder.visible = false;
    const lv = LEVELS[n];
    for (const k of lv.team) {
      const who = await figure(k);
      if (who.tape && who.tape.length) untangle(who.tape, false);
      if (who.toolMesh) { who.toolMesh.removeFromParent(); who.toolMesh = null; }
      team.push({ key: k, who, x: -2.4, y: 0, z: -0.1, vy: 0, dir: 1, hidden: false, busy: 0, tool: false, toolMesh: null, off: (lv.offstage || []).includes(k) });
    }
    for (const [k, tool] of Object.entries(lv.tools || {})) holdTool(actor(k), tool);
    $('[data-card]').hidden = true;
    await playFilm(lv.opening);
    game.started = true;
    if (paid) await paid.levelStart(n);
    await enter(0);
  }

  function menu(highlight) {
    let done = [];
    try { done = JSON.parse(localStorage.getItem('snip.done') || '[]'); } catch (e) { /* private window */ }
    $('[data-levels]').replaceChildren(...LEVELS.map((lv, k) => [lv, k]).filter(([lv]) => !lv.hidden || location.search.includes('old')).map(([lv, k]) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'go level' + (k === highlight ? ' next' : '');
      b.textContent = `${k + 1}. ${lv.title}${done.includes(lv.id) ? ' ✓' : ''}`;
      b.onclick = () => { ear(); startLevel(k); };
      if (paid && paid.locked(k, paid.file.d.levels)) { b.disabled = true; b.classList.add('lockedlevel'); b.title = 'Opens when you finish the level before it'; }
      return b;
    }));
  }

  // ---------- begin ----------
  if (EDITION === 'paid') { paid = await (await import('./ai/paid.js')).start({ $, sfx, levels: LEVELS, game, facts, act, answer, FIGURES, LINES, team, hero, actor, faceTo, enter, lift, dropFriend, swing, releaseThrow, useHere, screen, limit, near, makeSpot, endCard, knockDown, caught, THREE, held, hit, playFilm, get ox() { return ox; }, get things() { return things; },
    say: (k, text) => { sayWho = k; sayEl.innerHTML = `<b>${FIGURES[k] ? FIGURES[k].name : k}</b>`; sayEl.append(text); sayEl.classList.remove('tangled', 'shout'); sayEl.hidden = false; sayT = Math.max(2.6, Math.min(6.5, text.length * 0.07)); },
    as: (a, fn) => { const was = active; active = team.indexOf(a); try { return fn(); } finally { active = was; } } }); window.snipPaid = paid; }
  await showRoom('level1', 'front', 'evening');
  film.classList.add('clear');
  crateModel = (await loader.loadAsync('assets/crate/wooden_crate_02_1k.gltf')).scene;
  await Promise.all(['tuck', 'rivet', 'pim'].map(figure));
  menu(0);
  { const get = $('[data-get]'); if (get && EDITION === 'web' && window.SNIP_PAGE) { get.href = window.SNIP_PAGE + '#get'; get.hidden = false; } }
  $('[data-note]').textContent = 'The game teaches you as you go. "? How to play" is always there.';
  window.snip = { world, shot: () => { renderer.clear(); plate.render(renderer); renderer.render(world, cam); return canvas.toDataURL('image/jpeg', 0.82); }, noFilms: false, game, team, api, hero, enter, callIn, startLevel, LEVELS, keys, down, tick, figCache, plate };  // for checking
})().catch((e) => { document.querySelector('[data-note]').textContent = 'Could not start: ' + e.message; console.error(e); });
