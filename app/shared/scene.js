/* Busy's live scenes: a room rendered in the Busy Studio (Unreal Engine) with a live character in it (three.js).
   Used by the apps' home screens (the guide in the front room of the place), the paid apps' expert rooms, and the
   website's places (assets/place.js, which brings its own three.js).

   - The room is drawn into the canvas together with its depth (rendered in Unreal too), so the character stands
     behind the furniture, and the room moves a little with the pointer: near things more than far ones.
   - The character is lit by the room's own lights at this time of day (morning, day, evening), exported from Unreal.
   - The pictures follow the clock: the same room in the morning, by day or in the evening.

   A plain script (no modules), so it also works when the apps are opened from files on disk. The apps load
   shared/vendor/three-busy.js first (window.BusyThree). Without WebGL, or with reduced motion, the page keeps its
   still picture and the guide's drawn pose: nothing here is needed to use Busy. No AI, nothing sent anywhere. */
(function () {
  'use strict';
  const S = window.BusyScene = {};

  // Morning 5-11, day 11-17, evening after that: the room picture and the light that match the clock.
  S.timeOfDay = (d = new Date()) => { const h = d.getHours(); return h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'day' : 'evening'; };
  // ?live=1 in the address shows the live scene even with reduced motion switched on (to preview it).
  S.reduced = () => !/[?&]live=1\b/.test(location.search) && !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  S.canGL = () => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; } };
  // A room's picture at this time of day, if it was rendered then (else by day).
  S.timeFor = (room, tod = S.timeOfDay()) => (room && room.times && room.times.includes(tod) ? tod : 'day');

  // ---------- the plate: the room picture with its depth ----------
  // The depth picture holds the inverse distance (grey 0-255 from far to near, see place_web.py). The shader moves
  // every pixel by the parallax for its own depth and writes that depth, so the character is hidden where the room
  // is nearer than it. The camera moves by (tx, ty) metres and its lens shifts back, so things at the pivot distance
  // stay put: a point at depth z moves fpx * t * (1/pivot - 1/z) pixels. (The same sum moves the spots in the page.)
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FRAG = `
    uniform sampler2D map; uniform sampler2D depthMap;
    uniform vec2 uFull; uniform vec2 uOff; uniform vec2 uView;
    uniform float uNear; uniform float uFar; uniform float uFpx; uniform vec2 uT; uniform float uPivot;
    uniform float uCamNear; uniform float uCamFar;
    varying vec2 vUv;
    float zAt(vec2 uv) { float v = texture2D(depthMap, uv).r; return 1.0 / (1.0 / uFar + v * (1.0 / uNear - 1.0 / uFar)); }
    vec2 shiftOf(float z) {
      float dx = uFpx * uT.x * (1.0 / uPivot - 1.0 / z);
      float dyDown = uFpx * uT.y * (1.0 / z - 1.0 / uPivot);
      return vec2(dx / uFull.x, -dyDown / uFull.y);
    }
    void main() {
      vec2 px = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
      vec2 uv = vec2((px.x - uOff.x) / uFull.x, 1.0 - (px.y - uOff.y) / uFull.y);
      vec2 q = uv - shiftOf(zAt(uv));
      q = clamp(uv - shiftOf(zAt(q)), vec2(0.0005), vec2(0.9995));
      gl_FragColor = texture2D(map, q);
      float z = zAt(q) + 0.04;  // a little further back, so feet on the floor stay in front of it
      float ndc = (uCamFar + uCamNear) / (uCamFar - uCamNear) - 2.0 * uCamFar * uCamNear / ((uCamFar - uCamNear) * z);
      gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
    }`;

  S.plate = function (THREE) {
    const u = {
      map: { value: null }, depthMap: { value: null }, uFull: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() },
      uView: { value: new THREE.Vector2(1, 1) }, uNear: { value: 5 }, uFar: { value: 10 }, uFpx: { value: 1 }, uT: { value: new THREE.Vector2() },
      uPivot: { value: 8 }, uCamNear: { value: 0.1 }, uCamFar: { value: 60 },
    };
    const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: true, depthWrite: true, toneMapped: false });
    mat.depthFunc = THREE.AlwaysDepth;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene(); scene.add(mesh);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const loader = new THREE.TextureLoader();
    const tex = (t, depth) => { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = depth ? THREE.NearestFilter : THREE.LinearFilter; t.needsUpdate = true; return t; };
    let ready = false, token = 0;
    return {
      get ready() { return ready; },
      // Loads a room's picture and depth (URLs or data: URLs); resolves once both are in.
      async load(src, depthSrc, depth) {
        const k = ++token; ready = false;
        const [c, d] = await Promise.all([loader.loadAsync(src), loader.loadAsync(depthSrc)]);
        if (k !== token) { c.dispose(); d.dispose(); return false; }
        if (u.map.value) u.map.value.dispose();
        if (u.depthMap.value) u.depthMap.value.dispose();
        u.map.value = tex(c); u.depthMap.value = tex(d, true);
        u.uNear.value = depth.near; u.uFar.value = depth.far;
        ready = true;
        return true;
      },
      clear() { token++; ready = false; },
      // f: the 16:9 room's place in the view (W, H: the view; fw, fh, ox, oy: the room picture), in CSS pixels.
      frame(f, hfov, camera) {
        u.uFull.value.set(f.fw, f.fh); u.uOff.value.set(f.ox, f.oy); u.uView.value.set(f.W, f.H);
        u.uFpx.value = f.fw / (2 * Math.tan(hfov * Math.PI / 360));
        if (camera) { u.uCamNear.value = camera.near; u.uCamFar.value = camera.far; }
      },
      parallax(tx, ty, pivot) { u.uT.value.set(tx, ty); u.uPivot.value = pivot; },
      render(renderer) { if (ready) renderer.render(scene, cam); },
    };
  };

  // ---------- light: the room's lights from Unreal, for three.js ----------
  // Point lights stay point lights; the window and the rim (rect lights in Unreal) become directional light from where
  // they are towards the character. A light without intensity casts the floor shadow from the brightest one.
  S.lights = function (THREE, room, tod, stand) {
    const g = new THREE.Group();
    const L = room && room.light && room.light[S.timeFor(room, tod)];
    const at = new THREE.Vector3(stand[0], stand[1] + 0.5, stand[2]);
    let best = null, bestE = 0;
    const shadowFrom = (pos, e) => { if (e > bestE) { bestE = e; best = pos; } };
    if (!L) {  // a place without exported light: the house's warm key, cool rim
      g.add(new THREE.HemisphereLight(0xffe6d5, 0x3b2a20, 1.25));
      const key = new THREE.DirectionalLight(0xffd7a8, 2.4); key.position.set(stand[0] - 2.2, stand[1] + 3.2, stand[2] + 3.2);
      const rim = new THREE.DirectionalLight(0x7fe0ff, 2.2); rim.position.set(stand[0] + 2.5, stand[1] + 2.4, stand[2] - 2.5);
      [key, rim].forEach((l) => { l.target.position.copy(at); g.add(l, l.target); });
      best = key.position.clone(); bestE = 1;
    } else {
      const sky = L.sky || { color: '#FFE2CC', intensity: 0.35 };
      g.add(new THREE.HemisphereLight(new THREE.Color(sky.color), 0x3b2a20, Math.max(0.35, sky.intensity * 3.6)));
      L.lights.forEach((l) => {
        const pos = new THREE.Vector3(...l.at), col = new THREE.Color(l.color);
        if (l.kind === 'point') {
          const p = new THREE.PointLight(col, l.cd * 0.2, l.radius || 9, 2); p.position.copy(pos); g.add(p);
          shadowFrom(pos, l.cd * 0.2 / Math.max(1, pos.distanceToSquared(at)));
        } else {
          const d = new THREE.DirectionalLight(col, l.cd * 0.11); d.position.copy(pos); d.target.position.copy(at); g.add(d, d.target);
          shadowFrom(pos, l.cd * 0.11);
        }
      });
    }
    const sh = new THREE.DirectionalLight(0xffffff, 0);
    sh.position.copy(best || at.clone().add(new THREE.Vector3(-2, 3, 3)));
    if (sh.position.y - at.y < 1.2) sh.position.y = at.y + 1.2;  // a low light still gives a shadow on the floor
    sh.target.position.copy(at);
    sh.castShadow = true;
    sh.shadow.mapSize.set(1024, 1024);
    Object.assign(sh.shadow.camera, { left: -1.6, right: 1.6, top: 2.2, bottom: -0.6, near: 0.3, far: 14 });
    sh.shadow.bias = -0.0006;
    g.add(sh, sh.target);
    return g;
  };

  // ---------- the character ----------
  // Normalised to one metre, feet on the floor; moves by name (Idle loops; others play once, then back to Idle).
  S.character = function (THREE, gltf, loops = ['Idle', 'Walk']) {
    const holder = new THREE.Group(), model = gltf.scene;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    holder.add(model);
    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(1 / (box.max.y - box.min.y));
    model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(gltf.animations.map((a) => [a.name, mixer.clipAction(a)]));
    const loop = new Set(loops);
    let current = actions.Idle || Object.values(actions)[0];
    if (current) current.play();
    mixer.addEventListener('finished', () => fade(actions.Idle));
    function fade(next, keep) {
      if (!next) return;
      if (next === current) { if (!keep) next.reset().play(); return; }
      next.reset().setEffectiveWeight(1).fadeIn(0.3).play();
      if (current) current.fadeOut(0.3);
      current = next;
    }
    function play(name, times) {
      const a = actions[name];
      if (!a) return false;
      const l = loop.has(name) && !times;
      a.setLoop(l ? THREE.LoopRepeat : times ? THREE.LoopRepeat : THREE.LoopOnce, l ? Infinity : times || 1);
      a.clampWhenFinished = !l;
      fade(a, l);
      return true;
    }
    return { holder, model, mixer, actions, play, has: (n) => !!actions[n], head: model.getObjectByName('Head'), get playing() { return current && current.getClip().name; } };
  };

  // ---------- a stage: one room with one character, for the apps ----------
  // el: the 16:9 element that shows the room (its <img> stays as the still); scene: window.BusyScenes[...] (the
  // room, its pictures and depth as data); glb: base64; opts: { size, hello, loops, onFrame(head) }.
  // Resolves to { play(name), head() } once the character stands in the room, or rejects (then the still stays).
  S.stage = async function (el, scene, glb, opts = {}) {
    if (!S.canGL() || S.reduced()) throw new Error(S.reduced() ? 'reduced motion' : 'no WebGL');
    const B = window.BusyThree;
    if (!B) throw new Error('three.js is missing');
    const { THREE, GLTFLoader } = B;
    const bin = Uint8Array.from(atob(glb), (ch) => ch.charCodeAt(0)).buffer;
    const gltf = await new Promise((ok, no) => new GLTFLoader().parse(bin, '', ok, no));
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = false;
    const canvas = renderer.domElement;
    canvas.className = 'scene-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    const tod = S.timeFor(scene);
    const plate = S.plate(THREE);
    if (scene.depthMap && scene.depth) await plate.load(scene.plates[tod] || scene.plates.day, scene.depthMap, scene.depth);
    const world = new THREE.Scene();
    const stand = scene.walk.stand;
    world.add(S.lights(THREE, scene, tod, stand));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: tod === 'evening' ? 0.5 : 0.4 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(stand[0], stand[1] + 0.003, stand[2]); floor.receiveShadow = true;
    world.add(floor);
    const who = S.character(THREE, gltf, opts.loops);
    who.holder.position.set(...(opts.at || stand));
    who.holder.scale.setScalar((scene.tuckHeight || 1) * (opts.size || 1));
    if (opts.turn) who.holder.rotation.y = opts.turn;
    world.add(who.holder);

    const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 60);
    const C = scene.camera, base = new THREE.Vector3(...C.position);
    cam.position.copy(base); cam.up.set(0, 1, 0); cam.lookAt(...C.target);
    cam.fov = 2 * Math.atan(Math.tan(C.hfov * Math.PI / 360) / C.aspect) * 180 / Math.PI;
    cam.updateProjectionMatrix();
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
    const pivot = base.distanceTo(new THREE.Vector3(...stand));
    let f = null;
    function frame() {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      f = { W, H, fw: W, fh: W * 9 / 16, ox: 0, oy: 0 };
      renderer.setSize(W, H, false);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      plate.frame(f, C.hfov, cam);
    }
    // The pointer moves the camera a few centimetres; with reduced motion nothing moves (we don't get here then).
    const aim = { x: 0, y: 0 }, par = { x: 0, y: 0 }, look = { x: 0, y: 0 };
    let lastMove = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      aim.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      aim.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      lastMove = performance.now();
    };
    addEventListener('pointermove', onMove, { passive: true });
    const v = new THREE.Vector3(), q = new THREE.Quaternion(), eul = new THREE.Euler();
    let headBase = null;
    function headAt() {
      if (!f) return null;
      who.model.updateMatrixWorld(true);
      if (who.head) who.head.getWorldPosition(v); else v.copy(who.holder.position);
      v.y = who.holder.position.y + 1.12 * who.holder.scale.y;
      v.project(cam);
      return { x: (v.x + 1) / 2 * f.W, y: (1 - v.y) / 2 * f.H };
    }
    frame();
    el.append(canvas);
    const ro = new ResizeObserver(frame);
    ro.observe(el);
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);
    // A page that redraws (the apps' home screen) moves the same stage into its new room element.
    function attach(next) {
      if (next === el) return;
      ro.unobserve(el); io.unobserve(el);
      el = next;
      el.append(canvas);
      ro.observe(el); io.observe(el);
      el.classList.add('scene-live');
      if (plate.ready) el.classList.add('scene-plate');
      frame();
    }
    const clock = new THREE.Clock();
    const AMP = 0.1;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      if (!visible || document.hidden) return;
      const now = performance.now();
      if (now - lastMove > 6000) { const t = now / 1000; aim.x = Math.sin(t * 0.23) * 0.5; aim.y = Math.sin(t * 0.17) * 0.25; }
      par.x += (aim.x - par.x) * Math.min(1, dt * 2.5); par.y += (aim.y - par.y) * Math.min(1, dt * 2.5);
      const tx = par.x * AMP, ty = -par.y * AMP * 0.5;
      cam.position.copy(base).addScaledVector(right, tx).addScaledVector(up, ty);
      if (f) {
        const fpx = f.fw / (2 * Math.tan(C.hfov * Math.PI / 360));
        cam.setViewOffset(f.fw, f.fh, -f.ox - fpx * tx / pivot, -f.oy + fpx * ty / pivot, f.W, f.H);
      }
      plate.parallax(tx, ty, pivot);
      if (who.head && headBase) who.head.quaternion.copy(headBase);  // undo last frame's turn (a clip may not move the head)
      who.mixer.update(dt);
      if (who.head) {
        headBase = who.head.quaternion.clone();
        look.x += (aim.x - look.x) * Math.min(1, dt * 4); look.y += (aim.y - look.y) * Math.min(1, dt * 4);
        eul.set(look.y * 0.25, look.x * 0.5, 0, 'YXZ');
        who.head.quaternion.multiply(q.setFromEuler(eul));
      }
      renderer.clear();
      plate.render(renderer);
      renderer.render(world, cam);
      // Things the page draws on the room (a sign) move with it: shift(z) is the parallax at z metres, in pixels.
      if (opts.onFrame && f) { const fpx = f.fw / (2 * Math.tan(C.hfov * Math.PI / 360)); opts.onFrame(headAt(), (z) => ({ x: fpx * tx * (1 / pivot - 1 / z), y: fpx * ty * (1 / z - 1 / pivot) })); }
    });
    el.classList.add('scene-live');
    if (plate.ready) el.classList.add('scene-plate');
    if (opts.hello) who.play(opts.hello);
    return { play: who.play, has: who.has, head: headAt, attach, get el() { return el; }, get playing() { return who.playing; } };
  };

  // The base64 character files are big strings: load one (shared/places/<dir>/<name>.glb.js) only when needed.
  S.script = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('could not load ' + src)); document.head.append(s); });
})();
