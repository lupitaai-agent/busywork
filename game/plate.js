/* The room's picture for the game: like BusyScene's plate (app/shared/scene.js), with its depth, and two things more:
   the picture can be a video that loops (things that move in the room, rendered in Unreal), and a second picture can show through a
   circle around a lantern (the room with its lights on, seen in the dark). The website's plate stays as it is. */
window.SnipPlate = function (THREE) {
  const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const FRAG = `
    uniform sampler2D map; uniform sampler2D lit; uniform sampler2D depthMap;
    uniform vec2 uFull; uniform vec2 uOff; uniform vec2 uView; uniform vec3 uLamp; uniform float uLit;
    uniform float uNear; uniform float uFar; uniform float uCamNear; uniform float uCamFar;
    varying vec2 vUv;
    float zAt(vec2 uv) { float v = texture2D(depthMap, uv).r; return 1.0 / (1.0 / uFar + v * (1.0 / uNear - 1.0 / uFar)); }
    void main() {
      vec2 px = vec2(vUv.x * uView.x, (1.0 - vUv.y) * uView.y);
      vec2 q = clamp(vec2((px.x - uOff.x) / uFull.x, 1.0 - (px.y - uOff.y) / uFull.y), vec2(0.0005), vec2(0.9995));
      vec4 c = texture2D(map, q);
      if (uLit > 0.0) {
        float d = length(vec2((q.x - uLamp.x) * uFull.x / uFull.y, q.y - uLamp.y));
        float a = 1.0 - smoothstep(uLamp.z * 0.45, uLamp.z, d + sin(q.x * 40.0 + q.y * 31.0) * 0.004);
        c = mix(c, texture2D(lit, q), a * uLit);
      }
      gl_FragColor = c;
      float z = zAt(q) + 0.04;  // a little further back, so feet on the floor stay in front of it
      float ndc = (uCamFar + uCamNear) / (uCamFar - uCamNear) - 2.0 * uCamFar * uCamNear / ((uCamFar - uCamNear) * z);
      gl_FragDepth = clamp(ndc * 0.5 + 0.5, 0.0, 1.0);
    }`;
  const u = {
    map: { value: null }, lit: { value: null }, depthMap: { value: null }, uFull: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() },
    uView: { value: new THREE.Vector2(1, 1) }, uNear: { value: 5 }, uFar: { value: 10 }, uCamNear: { value: 0.1 }, uCamFar: { value: 60 },
    uLamp: { value: new THREE.Vector3(0.5, 0.5, 0.2) }, uLit: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, depthTest: true, depthWrite: true, toneMapped: false });
  mat.depthFunc = THREE.AlwaysDepth;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), loader = new THREE.TextureLoader();
  const tex = (t, depth) => { t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = depth ? THREE.NearestFilter : THREE.LinearFilter; t.needsUpdate = true; return t; };
  let ready = false, token = 0, vid = null;
  const stopVideo = () => { if (vid) { vid.pause(); vid.removeAttribute('src'); vid.load(); vid = null; } };
  return {
    get ready() { return ready; },
    get playing() { return !!vid; },
    async load(src, depthSrc, depth, litSrc) {
      const k = ++token; ready = false;
      const [c, d, l] = await Promise.all([loader.loadAsync(src), loader.loadAsync(depthSrc), litSrc ? loader.loadAsync(litSrc) : null]);
      if (k !== token) { c.dispose(); d.dispose(); if (l) l.dispose(); return false; }
      stopVideo();
      for (const key of ['map', 'depthMap', 'lit']) if (u[key].value) { u[key].value.dispose(); u[key].value = null; }
      u.map.value = tex(c); u.depthMap.value = tex(d, true); u.lit.value = l ? tex(l) : c; u.uLit.value = 0;
      u.uNear.value = depth.near; u.uFar.value = depth.far;
      ready = true;
      return true;
    },
    // The still stays up until the video really plays, and it stays if the video can't.
    async video(url) {
      const k = token;
      try {
        const blob = await fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); });
        if (k !== token) return false;
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.src = URL.createObjectURL(blob);
        await v.play();
        if (k !== token) { v.pause(); return false; }
        const t = new THREE.VideoTexture(v);
        t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter;
        if (u.map.value) u.map.value.dispose();
        u.map.value = t; vid = v;
        return true;
      } catch (e) { return false; }
    },
    lamp(x, y, r, on) { u.uLamp.value.set(x, y, r); u.uLit.value = on; },
    frame(f, hfov, camera) {
      u.uFull.value.set(f.fw, f.fh); u.uOff.value.set(f.ox, f.oy); u.uView.value.set(f.W, f.H);
      if (camera) { u.uCamNear.value = camera.near; u.uCamFar.value = camera.far; }
    },
    render(renderer) { if (ready) renderer.render(scene, cam); },
  };
};
