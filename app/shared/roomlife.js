/* The room a tool lives in, following the person's own data: on top of the room the Busy Studio rendered
   (shared/places/<place>/<room>.jpg), the things that change are drawn live with three.js, through the room's own
   camera and lit by its own lights (shared/places/<place>/rooms.js), so they sit in the picture as if rendered:

     Stock Keeper (the stockroom)   a box on the shelves for every product with enough in stock, a red tag for one running low
     Invoices (the counter)         an envelope on the counter for every invoice still to be paid, red when it is overdue
     Skills Map (the trellis)       a leaf on the trellis for every skill, darker the stronger the skill
     Paper Trail (the hallway)      a label on the chest of drawers glows for every document that expires soon

   With no data the room is as it was rendered. Without WebGL the picture stays as it is. Nothing is sent anywhere.
   A plain script (no modules), so it works from files on disk; core.js loads it with shared/scene.js and three.js. */
(function () {
  'use strict';
  const IMG_W = 1920, IMG_H = 1080;
  // A point in a room, as the Busy Studio's room files give it (busy-studio/scripts/places/<place>.py: centimetres,
  // x from the open front to the back wall, y left to right, z up), in three.js metres: the room's camera stands at its middle.
  const at = (cam, x, y, z) => [cam.position[0] + y / 100, z / 100, -x / 100];
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
  const today = () => new Date().toISOString().slice(0, 10);

  // Per tool: its place and room, what in the picture to keep in view (x, y, z as above), and what to draw.
  const ROOMS = {
    stock: { place: 'workshop', room: 'stock', focus: [190, 160, 110], data: async () => BW.store.all('stock'),
      draw(items, T) {
        const good = items.filter((i) => BW.num(i.qty) > BW.num(i.min)), low = items.filter((i) => BW.num(i.qty) <= BW.num(i.min));
        // the free places on the shelves (the rendered boxes keep theirs): the left rack, then the two on the right
        // (the stack of boxes on the floor in front of the right racks hides their lower shelves)
        const slots = [[190, -5, 116], [190, 80, 116], [190, 70, 166], [190, 5, 166], [190, 195, 166], [190, 228, 166], [190, 265, 166],
          [190, 298, 166], [190, 265, 116], [190, 298, 116], [190, 10, 213], [190, 72, 213], [190, 200, 213], [190, 280, 213]];
        good.slice(0, slots.length).forEach((it, k) => T.box(slots[k], 0.25 + 0.02 * ((k * 7) % 3), k));
        // a red tag on the shelf's front edge for each product running low, along the left rack's lowest shelf
        low.slice(0, 6).forEach((it, k) => T.tag([171, -2 + k * 17, 60]));
      } },
    invoices: { place: 'workshop', room: 'counter', focus: [185, 20, 80], data: async () => BW.store.all('invoices'),
      draw(list, T) {
        const now = today();
        const open = list.filter((i) => i.kind === 'invoice' && i.status === 'sent')
          .sort((a, b) => String(b.dueDate || '').localeCompare(String(a.dueDate || '')));  // the overdue ones last: in front
        // filed standing in the pigeonholes either side of the counter, top row first; a second one leans in front
        const holes = [];
        for (const z of [116, 78, 40]) for (const y of [-239, -204, -170]) holes.push([y, z]);
        for (const z of [116, 78, 40]) for (const y of [216, 249, 282]) holes.push([y, z]);
        open.slice(0, holes.length * 2).forEach((inv, k) => {
          const [y, z] = holes[k % holes.length], second = k >= holes.length;
          T.envelope([second ? 178 : 186, y + (second ? 4 : -2), z], k, !!(inv.dueDate && inv.dueDate < now));
        });
      } },
    skills: { place: 'glasshouse', room: 'trellis', focus: [202, 80, 160], data: async () => BW.store.all('skills'),
      draw(skills, T) {
        // leaves along the trellis's lattice, the same places every time; one per skill, up to sixty, growing up from the planter
        const r = rnd(7), spots = [];
        for (let k = 0; k < 60; k++) spots.push([200, -40 + r() * 230, 80 + r() * 180, r() * Math.PI * 2]);
        spots.sort((a, b) => a[2] - b[2]);
        skills.slice(0, 60).forEach((s, k) => T.leaf(spots[k], Math.max(1, Math.min(5, BW.num(s.level) || 2))));
      } },
    papers: { place: 'house', room: 'papers', focus: [160, 120, 70], data: async () => BW.store.all('papers'),
      draw(papers, T) {
        const soon = window.BW.house && BW.house.expiring ? BW.house.expiring(papers, today()) : [];
        // the chest's six drawers, top row first: one glowing label for each document that expires soon
        const fronts = [[118, 65, 77], [118, 120, 77], [118, 175, 77], [118, 65, 35], [118, 120, 35], [118, 175, 35]];
        soon.slice(0, fronts.length).forEach((e, k) => T.label(fronts[k], e.left < 0));
      } },
  };

  // The room band at the top of a tool page (core.js) becomes this room, a little taller, with its things in it.
  window.BusyRoomLife = async function (appId, band, picture) {
    const R = ROOMS[appId], S = window.BusyScene, B = window.BusyThree;
    const data = R && window.BusyRooms && window.BusyRooms[R.place] && window.BusyRooms[R.place][R.room];
    if (!S || !B || !data || !S.canGL()) return;
    const { THREE } = B;
    const tod = S.timeFor(data);
    band.classList.add('alive');
    const canvas = document.createElement('canvas');
    canvas.className = 'room-life';
    band.append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const C = data.camera, cam = new THREE.PerspectiveCamera(30, C.aspect, 0.1, 60);
    cam.position.fromArray(C.position); cam.lookAt(new THREE.Vector3().fromArray(C.target));
    cam.fov = 2 * Math.atan(Math.tan(C.hfov * Math.PI / 360) / C.aspect) * 180 / Math.PI;
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = new THREE.Vector3(...at(C, ...R.focus));
    scene.add(S.lights(THREE, data, tod, [focus.x, 0, focus.z + 1]));
    const things = new THREE.Group(); scene.add(things);

    // ---------- the things, made once and shared ----------
    const mats = {};
    const mat = (k, o) => mats[k] || (mats[k] = new THREE.MeshStandardMaterial(o));
    const P = (p) => new THREE.Vector3(...at(C, ...p));
    const add = (mesh, p, shadow = true) => { mesh.position.copy(p); mesh.castShadow = shadow; mesh.receiveShadow = true; things.add(mesh); return mesh; };
    const leafGeo = (() => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.045, 0.035, 0, 0.1); s.quadraticCurveTo(-0.045, 0.035, 0, 0);
      return new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
    })();
    const T = {
      box(p, size, k) {  // a cardboard box with a strip of tape, standing on the shelf
        const w = size, h = size * 0.78, g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.9), mat('card', { color: 0xb8875a, roughness: 0.92 }));
        const tape = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 0.004, w * 0.92), mat('tape', { color: 0xd8c49c, roughness: 0.5 }));
        tape.position.y = h / 2 + 0.002; body.castShadow = body.receiveShadow = true;
        g.add(body, tape); g.position.copy(P(p)); g.position.y += h / 2; g.rotation.y = ((k * 37) % 11 - 5) * 0.025;
        things.add(g);
      },
      tag(p) {  // a red card hanging from the shelf's edge
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.004), mat('tag', { color: 0xd9503f, roughness: 0.55, emissive: 0x5a0e06, emissiveIntensity: 0.4 })), P(p), false);
        m.position.y -= 0.03;
      },
      envelope(p, k, late) {  // an envelope standing in a pigeonhole, leaning back a little; red when it is overdue
        const m = add(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.006), late ? mat('late', { color: 0xd9503f, roughness: 0.6 }) : mat('paper', { color: 0xf1e6cf, roughness: 0.75 })), P(p));
        m.position.y += 0.065; m.rotation.set(-0.16, Math.sin(k * 2.3) * 0.12, Math.sin(k * 1.7) * 0.05);
      },
      leaf(p, level) {  // a leaf on the lattice, young and light for a new skill, deep green for a strong one
        const greens = [0x9fdc8a, 0x74c46a, 0x4fa957, 0x388f45, 0x267535];
        const m = add(new THREE.Mesh(leafGeo, mat('leaf' + level, { color: greens[level - 1], roughness: 0.6, side: THREE.DoubleSide })), P(p.slice(0, 3)));
        m.rotation.set(-0.25, 0, p[3]); m.scale.setScalar(1.3 + level * 0.15);
      },
      label(p, past) {  // the card in a drawer's brass label holder glows: amber soon, red when it has expired
        const col = past ? 0xff4a30 : 0xffa630;
        add(new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.032), mat('glow' + past, { color: col, emissive: col, emissiveIntensity: 1.6, toneMapped: false })), P(p), false);
        const l = new THREE.PointLight(col, 1.4, 0.7, 2); l.position.copy(P([p[0] - 10, p[1], p[2]])); things.add(l);
      },
    };

    // ---------- the band shows a strip of the room around the things ----------
    function layout() {
      const W = band.clientWidth, H = band.clientHeight;
      if (!W || !H) return;
      const A = W / H, cw = IMG_W, ch = Math.min(IMG_H, cw / A), k = W / cw;
      const f = focus.clone().project(cam), fy = ((1 - f.y) / 2) * IMG_H;
      const y0 = Math.max(0, Math.min(IMG_H - ch, fy - ch * 0.55));
      cam.setViewOffset(IMG_W, IMG_H, 0, y0, cw, ch); cam.updateProjectionMatrix();
      Object.assign(band.style, { backgroundImage: `url('${picture}')`, backgroundSize: `${IMG_W * k}px ${IMG_H * k}px`, backgroundPosition: `0 ${-y0 * k}px` });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(W, H, false);
      renderer.render(scene, cam);
    }
    async function draw() {
      things.clear();
      try { R.draw((await R.data()) || [], T); } catch (e) { /* the room stays as rendered */ }
      layout();
    }
    let soon = 0;
    const again = () => { clearTimeout(soon); soon = setTimeout(draw, 120); };
    document.addEventListener('bw:saved', again);
    if (window.BW && BW.onChange) BW.onChange(again);
    new ResizeObserver(() => layout()).observe(band);
    await draw();
    band.roomLife = { THREE, cam, things, scene, at: (p) => P(p) };  // for checking where things stand
  };
  window.BusyRoomLife.tools = Object.keys(ROOMS);
})();
