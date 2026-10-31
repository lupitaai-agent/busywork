/* Tuck, the Busy Home helper, live on the Busy Home page. Tuck is made in the Busy Studio (Unreal Engine):
   the model, its skeleton and four movements come from there as one glTF file (tuck.glb), shown here with
   three.js. Tuck is not an AI: it follows a little script. It looks at the pointer, says something about
   the part of the page you're reading or the tool you point at, reacts when poked, and celebrates when you
   watch it cancel the gym in time.

   What it says lives in the page (data-tuck-say, data-tuck-move), written by build.py.
   Without 3D (no WebGL) or with motion turned off, the still picture and the speech bubble stay. */
const stage = document.querySelector('[data-tuck-stage]');
if (stage) start();

function start() {
  const hero = document.querySelector('[data-tuck-hero]');
  const bubble = stage.querySelector('[data-tuck-bubble]');
  const back = document.querySelector('[data-tuck-back]');
  // Motion turned off: Tuck stays a picture (add ?tuck=move to the address to see it move anyway).
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&]tuck=move\b/.test(location.search);
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } } };
  let tuck = null; // the 3D side, once it's loaded
  let lastSaid = 0;

  // ---------- talking ----------
  function say(text, move, force) {
    if (!text) return;
    const now = performance.now();
    if (!force && now - lastSaid < 2500 && bubble.textContent === text) return;
    lastSaid = now;
    bubble.classList.remove('pop');
    bubble.textContent = text;
    void bubble.offsetWidth; // restart the little pop
    bubble.classList.add('pop');
    if (move && tuck) tuck.play(move);
  }

  // The part of the page you're reading.
  const seen = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting && !stage.classList.contains('away')) say(e.target.dataset.tuckSay, e.target.dataset.tuckMove);
  }), { threshold: 0.45 });
  document.querySelectorAll('section[data-tuck-say]').forEach((s) => seen.observe(s));

  // The tool you point at.
  document.querySelectorAll('.feat[data-tuck-say]').forEach((card) => {
    const tell = () => say(card.dataset.tuckSay, card.dataset.tuckMove);
    card.addEventListener('pointerenter', tell);
    card.addEventListener('focusin', tell);
  });

  // Poking Tuck.
  const pokes = JSON.parse(stage.dataset.tuckPokes || '[]');
  let poke = 0;
  stage.querySelector('[data-tuck-poke]').addEventListener('click', () => {
    const [text, move] = pokes[poke++ % pokes.length] || [];
    say(text, move, true);
  });

  // "Watch Tuck cancel the gym in time."
  const tryIt = document.querySelector('[data-tuck-try]');
  if (tryIt) tryIt.addEventListener('click', () => {
    say(tryIt.dataset.tuckSay, 'Victory', true);
    if (!calm) confetti(stage);
    if (stage.classList.contains('docked') === false) stage.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
  });

  // Sending Tuck away, and back.
  const away = (yes) => {
    stage.classList.toggle('away', yes);
    if (back) back.hidden = !yes;
    store.set('busy.tuck.away', yes ? '1' : '');
  };
  stage.querySelector('[data-tuck-away]').addEventListener('click', (e) => { e.stopPropagation(); away(true); });
  if (back) back.addEventListener('click', () => { away(false); say(back.dataset.tuckSay, 'Waving', true); });
  if (store.get('busy.tuck.away')) away(true);

  if (calm) return; // the still and the words stay; nothing moves

  // Past the hero, Tuck follows you in a little window in the corner.
  new IntersectionObserver(([e]) => stage.classList.toggle('docked', !e.isIntersecting), { threshold: 0.12 }).observe(hero);

  // The 3D Tuck loads once the page itself is ready, so it never slows the first view.
  const go = () => load3D(stage).then((t) => { tuck = t; stage.classList.add('live'); }, (err) => console.info('Tuck stays a picture:', err && err.message));
  if (document.readyState === 'complete') idle(go); else addEventListener('load', () => idle(go), { once: true });
}

function idle(fn) { (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(fn); }

// ---------- the 3D side ----------
async function load3D(stage) {
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no WebGL');
  const THREE = await import('three');
  const { GLTFLoader } = await import('../vendor/three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(stage.dataset.tuckModel);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  stage.querySelector('[data-tuck-poke]').prepend(canvas);

  // The Busy Studio light: warm key from the front left, cool and coral rims from behind.
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffe6d5, 0x2b2240, 1.1));
  const key = new THREE.DirectionalLight(0xffd7a8, 2.6);
  key.position.set(-1.6, 2.6, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.2, near: 0.5, far: 8 });
  key.shadow.bias = -0.0005;
  scene.add(key);
  const rimCool = new THREE.DirectionalLight(0x7fe0ff, 3.0);
  rimCool.position.set(1.6, 1.9, -2.2);
  scene.add(rimCool);
  const rimWarm = new THREE.DirectionalLight(0xff8a5b, 1.8);
  rimWarm.position.set(-1.9, 1.2, -1.6);
  scene.add(rimWarm);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Tuck: one metre tall, feet on the floor, facing us.
  const model = gltf.scene;
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  model.rotation.y = Number(stage.dataset.tuckTurn || 0) * Math.PI / 180;
  scene.add(model);
  model.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(model);
  const s = 1 / (box.max.y - box.min.y);
  model.scale.setScalar(s);
  model.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(model);
  const c = box.getCenter(new THREE.Vector3());
  model.position.x -= c.x;
  model.position.z -= c.z;
  model.position.y -= box.min.y;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
  const frame = () => {
    const docked = stage.classList.contains('docked');
    camera.position.set(0, docked ? 0.62 : 0.66, docked ? 3.0 : 3.45);
    camera.lookAt(0, docked ? 0.5 : 0.62, 0); // room above the head for the speech bubble
  };

  // Movements: Idle loops; the others play once and fall back to Idle.
  const mixer = new THREE.AnimationMixer(model);
  const actions = Object.fromEntries(gltf.animations.map((a) => [a.name, mixer.clipAction(a)]));
  let current = actions.Idle;
  if (current) current.play();
  mixer.addEventListener('finished', () => fade(actions.Idle));
  function fade(next) {
    if (!next || next === current) return;
    next.reset().setEffectiveWeight(1).fadeIn(0.25).play();
    if (current) current.fadeOut(0.25);
    current = next;
  }
  function play(name) {
    const a = actions[name];
    if (!a) return;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    if (a === current) { a.reset().play(); return; }
    fade(a);
  }

  // The head follows the pointer, gently.
  const head = model.getObjectByName('Head');
  const neck = model.getObjectByName('Neck');
  const aim = { x: 0, y: 0 }, look = { x: 0, y: 0 };
  let lastMove = performance.now();
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    aim.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2)));
    aim.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height * 0.3)) / (innerHeight / 2)));
    lastMove = performance.now();
  }, { passive: true });
  const turn = new THREE.Quaternion(), euler = new THREE.Euler();

  // Size, visibility and the loop.
  const resize = () => {
    const w = canvas.parentElement.clientWidth, h = canvas.parentElement.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    frame();
  };
  new ResizeObserver(resize).observe(canvas.parentElement);
  new MutationObserver(resize).observe(stage, { attributes: true, attributeFilter: ['class'] });
  resize();
  let onScreen = true;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(stage);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!onScreen || document.hidden || stage.classList.contains('away')) return;
    mixer.update(dt);
    if (performance.now() - lastMove > 6000) { // nobody moving: look around a little
      const t = performance.now() / 1000;
      aim.x = Math.sin(t * 0.35) * 0.5;
      aim.y = Math.sin(t * 0.23) * 0.15;
    }
    look.x += (aim.x - look.x) * Math.min(1, dt * 5);
    look.y += (aim.y - look.y) * Math.min(1, dt * 5);
    if (head) {
      euler.set(look.y * 0.32, look.x * 0.55, 0, 'YXZ');
      head.quaternion.multiply(turn.setFromEuler(euler));
    }
    if (neck) {
      euler.set(look.y * 0.12, look.x * 0.2, 0, 'YXZ');
      neck.quaternion.multiply(turn.setFromEuler(euler));
    }
    renderer.render(scene, camera);
  });
  return { play };
}

// ---------- a little confetti ----------
function confetti(near) {
  const cv = document.createElement('canvas');
  cv.className = 'tuck-confetti';
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.append(cv);
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const r = near.getBoundingClientRect();
  const ox = r.left + r.width / 2, oy = r.top + r.height * 0.35;
  const colors = ['#FF8A5B', '#FFC93C', '#2FD18C', '#4DA3FF', '#9B6BFF', '#FF7AC6'];
  const bits = Array.from({ length: 110 }, () => ({ x: ox, y: oy, vx: (Math.random() - 0.5) * 14, vy: Math.random() * -12 - 4, s: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.4, c: colors[Math.floor(Math.random() * colors.length)] }));
  let n = 0;
  (function tick() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits.forEach((b) => { b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.a += b.va; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); });
    if (++n < 140) requestAnimationFrame(tick); else cv.remove();
  })();
}
