import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const REPO = 'https://github.com/MOE-MK/turbo-frames';
const FILES = 'files/';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const DATA = await fetch('data/frames.json').then((r) => r.json());

/* Frame definitions (mm). Values come from the DXFs and the designer's notes. */
const FRAMES = {
  t35: {
    bottom: DATA.t35_bottom, top: DATA.t35_top, tB: 5, tT: 3, standoff: 25, prop: 44.45,
    motors: [[63.57, 47.63], [-63.57, 47.63], [63.57, -50.04], [-63.57, -50.04]],
  },
  t20: {
    bottom: DATA.t20_bottom, top: DATA.t20_top, tB: 3, tT: 2, standoff: 18, prop: 25.4,
    motors: [[39, 27], [-39, 27], [38.85, -26.4], [-38.85, -26.4]],
  },
};
const near = (a, b, e = 0.06) => Math.abs(a - b) < e;
for (const f of Object.values(FRAMES)) {
  f.posts = f.top.circles.filter((c) => f.bottom.circles.some((b) => near(b.x, c.x) && near(b.y, c.y)));
}
const SETS = {
  s20: (c) => near(Math.abs(c.x), 10) && near(Math.abs(c.y), 10),
  s30: (c) => near(c.d, 3.5),
  s25: (c) => (near(Math.abs(c.x), 18.03) && near(c.y, 0)) || (near(c.x, 0) && near(Math.abs(c.y), 18.03)),
  rear: (c) => (near(Math.abs(c.x), 12.75) && (near(c.y, -37.25) || near(c.y, -62.75))) ||
               (near(Math.abs(c.x), 10) && (near(c.y, -40) || near(c.y, -60))),
};

/* ------------------------------------------------------------------ */
/* Chapters: target state for the 3D scene                            */
/* ------------------------------------------------------------------ */
const CH = {
  hero:      { model: 0, explode: 1,    slide: 0,   posts: 1, props: 0, cam: [2.55, 1.95, 2.95], tgt: [-0.08, 0.05, 0],   view: 'VIEW 01 / ISO' },
  unibody:   { model: 0, explode: 0.9,  slide: 0,   posts: 1, props: 0, cam: [3.0, 0.55, 1.45], tgt: [0.3, 0.1, 0],   view: 'VIEW 02 / SIDE', pins: ['thickB', 'thickT'] },
  stack:     { model: 0, explode: 0.2,  slide: 118, posts: 0, props: 0, cam: [0.5, 3.45, 0.42], tgt: [0.5, 0, 0.02],   view: 'VIEW 03 / TOP',  rings: 'stack', pins: ['p20', 'p30', 'p25', 'pRear'] },
  motors:    { model: 0, explode: 0.3,  slide: 0,   posts: 1, props: 0, cam: [1.6, 1.2, 1.5], tgt: [0.45, 0.02, 0.33], view: 'DETAIL A / MOTOR', rings: 'motor', pins: ['pMotor'] },
  antenna:   { model: 0, explode: 0,    slide: 0,   posts: 1, props: 0, cam: [0.95, 1.15, -2.1], tgt: [0, 0.2, -0.5], view: 'VIEW 04 / REAR', pins: ['pAnt'] },
  assembled: { model: 0, explode: 0,    slide: 0,   posts: 1, props: 1, cam: [1.95, 1.3, 2.05], tgt: [0, 0.12, 0],     view: 'VIEW 05 / ISO' },
  t20:       { model: 1, explode: 0.15, slide: 0,   posts: 1, props: 1, cam: [1.8, 1.35, 2.05], tgt: [0, 0.05, 0],     view: 'VIEW 06 / ISO',  rings: 't20', pins: ['p20stack', 'p20motor'] },
};
const PINS = {
  thickB:  { f: 't35', plate: 'bottom', x: 63.57, y: 58, text: '5.0 mm unibody' },
  thickT:  { f: 't35', plate: 'top', x: -15, y: 0, text: '3.0 mm top' },
  p20:     { f: 't35', plate: 'bottom', x: 10, y: 10, text: '20×20', set: 's20' },
  p30:     { f: 't35', plate: 'bottom', x: 15.25, y: -15.25, text: '30.5×30.5 · M3', set: 's30' },
  p25:     { f: 't35', plate: 'bottom', x: -18.03, y: 0, text: '25.5×25.5 · 45°', set: 's25', left: true },
  pRear:   { f: 't35', plate: 'bottom', x: 12.75, y: -62.75, text: 'Rear 20×20 + 25.5', set: 'rear' },
  pMotor:  { f: 't35', plate: 'bottom', x: 63.57, y: 47.63, text: 'Ø9 – Ø12 slots' },
  pAnt:    { f: 't35', plate: 'top', x: 0, y: -73, text: 'Whip antenna slot' },
  p20stack:{ f: 't20', plate: 'bottom', x: 18.03, y: 0, text: '25×25 AIO · 45°' },
  p20motor:{ f: 't20', plate: 'bottom', x: 39, y: 27, text: '9×9' },
};

/* ------------------------------------------------------------------ */
/* DOM-only features first, so they work even without WebGL           */
/* ------------------------------------------------------------------ */
buildBlueprint();
buildKit();
buildPrints();
buildDownloads();

/* ------------------------------------------------------------------ */
/* 3D                                                                 */
/* ------------------------------------------------------------------ */
const canvas = $('#gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  renderer = null;
}
if (!renderer) {
  $('.stage__fallback').hidden = false;
  $('.stage__hud').hidden = true;
  canvas.hidden = true;
  initScroll(() => {});
} else {
  init3D();
}

function init3D() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);
  camera.position.set(...CH.hero.cam);

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(1.8, 3.2, 1.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 1.4, bottom: -1.4, near: 0.5, far: 8 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 6;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfd8ff, 1.1);
  rim.position.set(-2.5, 1.2, -2);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404650, 0.35));

  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.16 }));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.16;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  /* Materials */
  const { map, bump } = makeCarbonTextures(renderer);
  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map, bumpMap: bump, bumpScale: 0.45, roughness: 0.34, metalness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9,
  });
  const edge = new THREE.MeshStandardMaterial({ color: 0x2e3035, roughness: 0.78, metalness: 0.05 });
  const accentCol = new THREE.Color(cssVar('--accent') || '#2345c7');
  const anodized = new THREE.MeshStandardMaterial({ color: accentCol, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.2 });
  const ringMats = {};
  const ringMat = (k) => (ringMats[k] ??= new THREE.MeshBasicMaterial({ color: accentCol, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const propMat = makePropMaterial();
  const propRing = new THREE.LineBasicMaterial({ color: accentCol, transparent: true, opacity: 0 });

  function syncAccent() {
    accentCol.set(cssVar('--accent') || '#2345c7');
    anodized.color.copy(accentCol);
    Object.values(ringMats).forEach((m) => m.color.copy(accentCol));
    propRing.color.copy(accentCol);
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncAccent);
  new MutationObserver(syncAccent).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* Build each frame */
  const models = {};
  for (const [id, f] of Object.entries(FRAMES)) {
    const g = new THREE.Group();
    const bottom = plateMesh(f.bottom, f.tB, carbon, edge);
    bottom.position.y = f.tB;
    const top = plateMesh(f.top, f.tT, carbon, edge);
    const posts = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(1.9, 1.9, f.standoff, 6);
    for (const c of f.posts) {
      const m = new THREE.Mesh(postGeo, anodized);
      m.position.set(c.x, f.tB + f.standoff / 2, c.y);
      m.castShadow = true;
      posts.add(m);
    }
    // highlight rings
    const rings = {};
    const addRing = (key, x, y, r, tube, h) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 10, 48), ringMat(key));
      m.rotation.x = Math.PI / 2;
      m.position.set(x, h, y);
      m.renderOrder = 3;
      (rings[key] ??= new THREE.Group()).add(m);
    };
    for (const c of f.bottom.circles) {
      for (const [k, test] of Object.entries(SETS)) {
        if (test(c)) addRing(id === 't20' ? 't20' : k, c.x, c.y, c.d / 2 + 1.1, 0.42, f.tB + 0.5);
      }
    }
    for (const [mx, my] of f.motors) {
      addRing(id + 'm9', mx, my, 4.5, 0.26, f.tB + 0.5);
      if (id === 't35') addRing(id + 'm12', mx, my, 6, 0.26, f.tB + 0.5);
    }
    Object.values(rings).forEach((r) => g.add(r));
    // prop ghosts
    const props = new THREE.Group();
    const discGeo = new THREE.CircleGeometry(f.prop, 64);
    const ringGeo = new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos(i / 96 * Math.PI * 2) * f.prop, 0, Math.sin(i / 96 * Math.PI * 2) * f.prop)));
    for (const [mx, my] of f.motors) {
      const d = new THREE.Mesh(discGeo, propMat);
      d.rotation.x = -Math.PI / 2;
      const l = new THREE.Line(ringGeo, propRing);
      const p = new THREE.Group();
      p.add(d, l);
      p.position.set(mx, f.tB + (id === 't35' ? 16 : 11), my);
      props.add(p);
    }
    g.add(bottom, top, posts, props);
    g.scale.setScalar(0.01);
    g.position.y = -0.155;
    scene.add(g);
    models[id] = { g, f, bottom, top, posts, props, rings };
  }

  /* State */
  const S = { model: 0, explode: 1, slide: 0, posts: 1, props: 0, yaw: 0, cam: new THREE.Vector3(...CH.hero.cam), tgt: new THREE.Vector3(...CH.hero.tgt) };
  let T = { ...CH.hero };
  let chapter = 'hero', chapterP = 0.5, stackSel = 'all';
  let dragYaw = 0, dragYawT = 0;
  const ringOpacity = {};

  function setChapter(name) {
    if (!CH[name]) return;
    chapter = name;
    T = CH[name];
    $('#hud-view').textContent = T.view;
    $('#hud-model').textContent = T.model ? 'TURBO20' : 'TURBO35';
    pinEls.forEach((el, k) => el.classList.toggle('is-on', (T.pins || []).includes(k) && pinVisibleForStack(k)));
    if (reduced) snap();
  }
  function pinVisibleForStack(k) {
    const set = PINS[k].set;
    return !set || stackSel === 'all' || set === stackSel;
  }
  function ringTarget(key) {
    const rs = T.rings;
    if (rs === 'stack') {
      if (!['s20', 's25', 's30', 'rear'].includes(key)) return 0;
      return stackSel === 'all' || stackSel === key ? 1 : 0.0;
    }
    if (rs === 'motor') return key.startsWith('t35m') ? 1 : 0;
    if (rs === 't20') return key === 't20' || key === 't20m9' ? 1 : 0;
    return 0;
  }

  /* Pins overlay */
  const pinLayer = $('#pins');
  const pinEls = new Map();
  for (const [k, p] of Object.entries(PINS)) {
    const el = document.createElement('div');
    el.className = 'pin';
    el.innerHTML = p.left ? `<b>${p.text}</b><i></i>` : `<i></i><b>${p.text}</b>`;
    pinLayer.appendChild(el);
    pinEls.set(k, el);
  }

  /* Stack selector */
  const notes = {
    all: 'Every mounting pattern on the bottom plate, lit.',
    s20: '20×20 stack: four M2 holes on a 20 mm square.',
    s25: '25×25 AIO: M2 holes on a 25.5 mm square, turned 45°.',
    s30: '30×30 stack: 30.5 mm square with 3.5 mm holes for M3.',
  };
  document.querySelectorAll('[data-stack]').forEach((b) => b.addEventListener('click', () => {
    stackSel = b.dataset.stack;
    document.querySelectorAll('[data-stack]').forEach((x) => x.classList.toggle('is-on', x === b));
    $('#stack-note').textContent = notes[stackSel];
    setChapter(chapter);
  }));

  /* Drag to rotate */
  let dragging = false, lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; dragYawT += (e.clientX - lastX) * 0.009; lastX = e.clientX; });
  const end = () => { dragging = false; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  let mx = 0, my = 0;
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  /* Resize + view offset: model sits right of the text column on wide screens */
  let W = 1, H = 1, mobile = false, off = 0.25;
  function resize() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    mobile = W < 761;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = mobile ? 44 : 32;
    applyOffset();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  function applyOffset() {
    if (mobile) camera.setViewOffset(W, H, 0, H * 0.24, W, H);
    else camera.setViewOffset(W, H, -W * off, 0, W, H);
    camera.updateProjectionMatrix();
  }
  function snap() {
    Object.assign(S, { model: T.model, explode: T.explode, slide: T.slide, posts: T.posts, props: T.props });
    S.cam.set(...T.cam); S.tgt.set(...T.tgt);
  }

  /* Render loop (only while the stage is on screen) */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe($('.stage'));
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  const camT = new THREE.Vector3(), tgtT = new THREE.Vector3();
  const easeInOut = (x) => x * x * (3 - 2 * x);

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    if (!visible) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3.2);
    const kf = reduced ? 1 : 1 - Math.exp(-dt * 5);
    for (const p of ['model', 'explode', 'slide', 'posts', 'props']) S[p] += (T[p] - S[p]) * k;

    // camera with a slow orbit tied to scroll progress inside the chapter
    camT.set(...T.cam);
    if (!reduced) {
      const orbit = (chapterP - 0.5) * 0.35;
      camT.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit);
      camT.x += mx * 0.12; camT.y -= my * 0.1;
    }
    tgtT.set(...T.tgt);
    if (mobile) camT.multiplyScalar(1.55);
    S.cam.lerp(camT, k); S.tgt.lerp(tgtT, k);
    const offT = chapter === 'hero' || chapter === 't20' ? 0.25 : 0.14;
    if (Math.abs(offT - off) > 0.0005) { off += (offT - off) * k; applyOffset(); }
    camera.position.copy(S.cam);
    camera.lookAt(S.tgt);

    dragYaw += (dragYawT - dragYaw) * kf;
    const sway = !reduced && chapter === 'hero' ? Math.sin(t * 0.35) * 0.22 : 0;

    for (const [id, m] of Object.entries(models)) {
      const on = id === 't35' ? 1 - S.model : S.model;
      const s = easeInOut(Math.min(1, Math.max(0, on)));
      m.g.visible = s > 0.002;
      m.g.scale.setScalar(0.01 * (0.6 + 0.4 * s));
      m.g.rotation.y = dragYaw + sway + (1 - s) * (id === 't35' ? -1.2 : 1.2);
      m.g.position.x = (1 - s) * (id === 't35' ? -1.4 : 1.4);
      const f = m.f;
      const e = S.explode;
      m.top.position.set(S.slide, f.tB + f.standoff + f.tT + e * 40, 0);
      m.posts.position.y = e * 18;
      m.posts.scale.setScalar(Math.max(0.0001, S.posts));
      m.posts.visible = S.posts > 0.01;
      m.props.visible = S.props > 0.01;
      propMat.opacity = 0.22 * S.props;
      propRing.opacity = 0.9 * S.props;
      if (!reduced) m.props.children.forEach((p, i) => { p.rotation.y = t * (i % 2 ? 9 : -9); });
      for (const [key, grp] of Object.entries(m.rings)) {
        const target = ringTarget(key) * (id === 't35' ? 1 - S.model : S.model);
        ringOpacity[key] = (ringOpacity[key] ?? 0) + (target - (ringOpacity[key] ?? 0)) * kf;
        ringMat(key).opacity = ringOpacity[key] * (0.75 + 0.25 * Math.sin(t * 4));
        grp.visible = ringOpacity[key] > 0.01;
        grp.position.y = 0;
      }
    }

    renderer.render(scene, camera);

    // project pins
    for (const [k, el] of pinEls) {
      if (!el.classList.contains('is-on')) continue;
      const p = PINS[k];
      const m = models[p.f];
      const f = m.f;
      const surf = p.plate === 'bottom' ? f.tB : f.tB + f.standoff + f.tT + S.explode * 40;
      const lx = p.plate === 'top' ? p.x + S.slide : p.x;
      v.set(lx, surf + 0.5, p.y).applyMatrix4(m.g.matrixWorld).project(camera);
      const x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      el.style.transform = `translate(${x - (p.left ? el.offsetWidth - 5.5 : 5.5)}px, ${y - 5.5}px)`;
    }
  });

  initScroll((name, p) => {
    if (name !== chapter) setChapter(name);
    chapterP = p;
  });
  setChapter('hero');
  snap();
}

/* ------------------------------------------------------------------ */
/* Scroll: Lenis smooth scroll + ScrollTrigger per chapter              */
/* ------------------------------------------------------------------ */
function initScroll(onChapter) {
  const gsap = window.gsap, ST = window.ScrollTrigger, Lenis = window.Lenis;
  let lenis = null;
  if (gsap && ST) {
    gsap.registerPlugin(ST);
    if (!reduced && Lenis) {
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.9 });
      lenis.on('scroll', ST.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    document.querySelectorAll('.chapter').forEach((el) => {
      ST.create({
        trigger: el, start: 'top 55%', end: 'bottom 55%',
        onUpdate: (s) => s.isActive && onChapter(el.dataset.chapter, s.progress),
        onToggle: (s) => s.isActive && onChapter(el.dataset.chapter, s.progress),
      });
    });
    if (!reduced) {
      gsap.utils.toArray('.section__head').forEach((el) => {
        gsap.from(el, { y: 36, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
    }
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    else if (target === 0) scrollTo({ top: 0 });
    else target.scrollIntoView();
    history.replaceState(null, '', id);
  }));
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                   */
/* ------------------------------------------------------------------ */
function plateMesh(p, t, carbon, edge) {
  const shape = new THREE.Shape(p.outline.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of p.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  for (const c of p.circles) {
    const path = new THREE.Path();
    path.absarc(c.x, c.y, c.d / 2, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.22, bevelSegments: 2, curveSegments: 20,
  });
  const mesh = new THREE.Mesh(geo, [carbon, edge]);
  mesh.rotation.x = Math.PI / 2; // shape y -> world z, extrusion -> down
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeCarbonTextures(renderer) {
  const N = 512, cells = 16, cs = N / cells;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = N; return c; };
  const cm = mk(), ch = mk();
  const a = cm.getContext('2d'), b = ch.getContext('2d');
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < cells; i++) {
    for (let j = 0; j < cells; j++) {
      const horiz = ((i + j) & 3) < 2;
      const x = i * cs, y = j * cs;
      const g1 = horiz ? a.createLinearGradient(x, y, x, y + cs) : a.createLinearGradient(x, y, x + cs, y);
      const tone = 0.9 + rnd() * 0.2;
      g1.addColorStop(0, '#141518');
      g1.addColorStop(0.5, `rgb(${Math.round(40 * tone)},${Math.round(42 * tone)},${Math.round(47 * tone)})`);
      g1.addColorStop(1, '#141518');
      a.fillStyle = g1; a.fillRect(x, y, cs, cs);
      a.globalAlpha = 0.07; a.strokeStyle = '#8a909a'; a.lineWidth = 0.6;
      for (let s = 0; s < 7; s++) {
        const o = rnd() * cs;
        a.beginPath();
        if (horiz) { a.moveTo(x, y + o); a.lineTo(x + cs, y + o); } else { a.moveTo(x + o, y); a.lineTo(x + o, y + cs); }
        a.stroke();
      }
      a.globalAlpha = 1;
      const g2 = horiz ? b.createLinearGradient(x, y, x, y + cs) : b.createLinearGradient(x, y, x + cs, y);
      g2.addColorStop(0, '#000'); g2.addColorStop(0.5, '#fff'); g2.addColorStop(1, '#000');
      b.fillStyle = g2; b.fillRect(x, y, cs, cs);
    }
  }
  const map = new THREE.CanvasTexture(cm);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(ch);
  for (const tx of [map, bump]) {
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(1 / 24, 1 / 24); // one tile per 24 mm, 1.5 mm per tow
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
  }
  return { map, bump };
}

function makePropMaterial() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  r.addColorStop(0, 'rgba(120,140,220,0.0)');
  r.addColorStop(0.2, 'rgba(120,140,220,0.5)');
  r.addColorStop(0.85, 'rgba(120,140,220,0.9)');
  r.addColorStop(1, 'rgba(120,140,220,0)');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
}

/* ------------------------------------------------------------------ */
/* Blueprint (SVG from the same DXF data)                              */
/* ------------------------------------------------------------------ */
function ringPath(pts) { return 'M' + pts.map(([x, y]) => `${x},${-y}`).join('L') + 'Z'; }
function platePath(p) { return [p.outline, ...p.holes].map(ringPath).join(''); }

function buildBlueprint() {
  const host = $('#bp-draw'), tip = $('#bp-tip'), tb = $('#bp-title'), sheet = $('.bp__sheet');
  let frame = 't35', plate = 'bottom';
  const names = { t35: 'Turbo35', t20: 'Turbo20' };
  const files = { t35: { bottom: 'Turbo35_Bottom.dxf', top: 'Turbo35_Top.dxf' }, t20: { bottom: 'Turbo20_Bottom.dxf', top: 'Turbo20_Top.dxf' } };

  function draw(animate) {
    const p = DATA[`${frame}_${plate}`];
    const [minx, miny, maxx, maxy] = p.bbox;
    const w = maxx - minx, h = maxy - miny, big = Math.max(w, h);
    const fs = big / 34, M = big * 0.2, m2 = big * 0.06;
    const vb = [minx - M, -maxy - m2, w + M + m2, h + M + m2];
    const dimY = -miny + M * 0.5, dimX = minx - M * 0.5;
    const a = fs * 0.9;
    const arrowH = (x1, x2, y) => `M${x1},${y}L${x2},${y}M${x1 + a},${y - a * 0.4}L${x1},${y}L${x1 + a},${y + a * 0.4}M${x2 - a},${y - a * 0.4}L${x2},${y}L${x2 - a},${y + a * 0.4}`;
    const arrowV = (y1, y2, x) => `M${x},${y1}L${x},${y2}M${x - a * 0.4},${y1 + a}L${x},${y1}L${x + a * 0.4},${y1 + a}M${x - a * 0.4},${y2 - a}L${x},${y2}L${x + a * 0.4},${y2 - a}`;
    let wb = '';
    const bosses = p.circles.filter((c) => near(c.d, 5));
    let wbLen = null;
    if (bosses.length >= 4) {
      let best = [0, 0, 0];
      for (let i = 0; i < bosses.length; i++) for (let j = i + 1; j < bosses.length; j++) {
        const d = Math.hypot(bosses[i].x - bosses[j].x, bosses[i].y - bosses[j].y);
        if (d > best[0]) best = [d, i, j];
      }
      const [d, i, j] = best, A = bosses[i], B = bosses[j];
      wbLen = d;
      const mx = A.x + (B.x - A.x) * 0.8, my = -(A.y + (B.y - A.y) * 0.8);
      wb = `<path class="bp-wb" d="M${A.x},${-A.y}L${B.x},${-B.y}"/>
        <text class="bp-txt bp-txt--wb" x="${mx + fs * 0.8}" y="${my + fs * 0.2}" font-size="${fs}">WB ${d.toFixed(1)}</text>`;
    }
    const circles = p.circles.map((c, i) => `<circle class="bp-hole" pathLength="1" data-i="${i}" cx="${c.x}" cy="${-c.y}" r="${c.d / 2}"/>`).join('');
    host.innerHTML = `
      <svg viewBox="${vb.join(' ')}" role="img" aria-label="${names[frame]} ${plate} plate drawing, ${w.toFixed(2)} by ${h.toFixed(2)} millimeters" class="${animate && !reduced ? 'bp-draw-in' : ''}">
        <path class="bp-cl" d="M${minx - m2},0L${maxx + m2},0M0,${-maxy - m2}L0,${-miny + m2}"/>
        <path class="bp-line" pathLength="1" fill-rule="evenodd" d="${platePath(p)}"/>
        ${circles}
        ${wb}
        <path class="bp-dim" d="M${minx},${-miny + m2 * 0.4}L${minx},${dimY + fs * 0.5}M${maxx},${-miny + m2 * 0.4}L${maxx},${dimY + fs * 0.5}${arrowH(minx, maxx, dimY)}"/>
        <text class="bp-txt" x="${(minx + maxx) / 2}" y="${dimY - fs * 0.5}" font-size="${fs}" text-anchor="middle">${w.toFixed(2)}</text>
        <path class="bp-dim" d="M${minx - m2 * 0.4},${-maxy}L${dimX - fs * 0.5},${-maxy}M${minx - m2 * 0.4},${-miny}L${dimX - fs * 0.5},${-miny}${arrowV(-maxy, -miny, dimX)}"/>
        <text class="bp-txt" x="${dimX - fs * 0.5}" y="${-(miny + maxy) / 2}" font-size="${fs}" text-anchor="middle" transform="rotate(-90 ${dimX - fs * 0.5} ${-(miny + maxy) / 2})">${h.toFixed(2)}</text>
        <text class="bp-txt" x="${maxx}" y="${-maxy - m2 * 0.35}" font-size="${fs * 0.85}" text-anchor="end">FRONT ↑</text>
      </svg>`;
    const cnt = (d) => p.circles.filter((c) => near(c.d, d)).length;
    const cells = [
      ['Part', `${names[frame]} ${plate}`],
      ['Material', 'T700 carbon'],
      ['Thickness', `${p.t.toFixed(1)} mm`],
      ['Size', `${w.toFixed(2)} × ${h.toFixed(2)}`],
      ['Holes', `${p.circles.length} (${[[2.5, 'M2'], [3.5, 'M3'], [5, 'Ø5']].filter(([d]) => cnt(d)).map(([d, n]) => `${cnt(d)}× ${n}`).join(', ')})`],
      wbLen ? ['Wheelbase', `${wbLen.toFixed(1)} mm`] : ['Cutouts', `${p.holes.length}`],
      ['File', files[frame][plate]],
    ];
    tb.innerHTML = cells.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    host.querySelectorAll('.bp-hole').forEach((el) => {
      el.addEventListener('pointerenter', () => {
        const c = p.circles[+el.dataset.i];
        const kind = near(c.d, 2.5) ? 'M2 clearance' : near(c.d, 3.5) ? 'M3 clearance' : near(c.d, 5) ? 'motor center' : '';
        tip.innerHTML = `Ø${c.d.toFixed(2)} · ${kind}<br>X ${fmt(c.x)}  Y ${fmt(c.y)}`;
        tip.hidden = false;
      });
      el.addEventListener('pointermove', (e) => {
        const r = sheet.getBoundingClientRect();
        const x = Math.min(e.clientX - r.left + 14, r.width - tip.offsetWidth - 6);
        tip.style.left = `${x}px`; tip.style.top = `${e.clientY - r.top + 14}px`;
      });
      el.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }
  const fmt = (n) => (n < 0 ? '−' : ' ') + Math.abs(n).toFixed(2);
  function bindSeg(attr, set) {
    document.querySelectorAll(`[data-${attr}]`).forEach((b) => b.addEventListener('click', () => {
      document.querySelectorAll(`[data-${attr}]`).forEach((x) => { x.classList.toggle('is-on', x === b); x.setAttribute('aria-selected', x === b); });
      set(b.dataset[attr]);
      draw(true);
    }));
  }
  bindSeg('frame', (v) => { frame = v; });
  bindSeg('plate', (v) => { plate = v; });
  draw(false);
}

/* ------------------------------------------------------------------ */
/* Build kit, prints, downloads                                       */
/* ------------------------------------------------------------------ */
function buildKit() {
  const items = [
    [1, '5.0 mm base plate', 'T700 carbon · Turbo35_Bottom.dxf'],
    [1, '3.0 mm top plate', 'T700 carbon · Turbo35_Top.dxf'],
    [10, 'M2 × 25 mm standoffs', ''],
    [20, 'M2 × 8 mm button-head screws', ''],
    [20, 'M2 × 10 mm button-head screws', ''],
    [4, 'M2 × 20 mm button-head screws', ''],
    [12, 'M2 nuts', 'Black'],
  ];
  const KEY = 'turbo35-kit';
  let done = [];
  try { done = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { done = []; }
  const list = $('#kit-list');
  list.innerHTML = items.map(([q, n, s], i) => `
    <li class="${done.includes(i) ? 'done' : ''}"><label for="kit-${i}">
      <input type="checkbox" id="kit-${i}" data-i="${i}" ${done.includes(i) ? 'checked' : ''}>
      <span class="kit__qty">${q}×</span>
      <span class="kit__name">${n}${s ? `<small>${s}</small>` : ''}</span>
    </label></li>`).join('');
  const update = () => {
    const n = done.length;
    $('#kit-count').textContent = `${n} / ${items.length} ready`;
    $('#kit-bar').style.width = `${(n / items.length) * 100}%`;
    try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* storage unavailable */ }
  };
  list.addEventListener('change', (e) => {
    const i = +e.target.dataset.i;
    done = e.target.checked ? [...new Set([...done, i])] : done.filter((x) => x !== i);
    e.target.closest('li').classList.toggle('done', e.target.checked);
    update();
  });
  $('#kit-reset').addEventListener('click', () => {
    done = [];
    list.querySelectorAll('input').forEach((x) => { x.checked = false; x.closest('li').classList.remove('done'); });
    update();
  });
  update();
}

function buildPrints() {
  const parts = [
    ['o4-pro-mount-left.3mf', 'O4 Pro mount, left'],
    ['o4-pro-mount-right.3mf', 'O4 Pro mount, right'],
    ['o4-bumper.3mf', 'O4 bumper'],
    ['dji-o3-camera-mount.3mf', 'DJI O3 camera mount'],
    ['o3-cam.stl', 'O3 cam mount'],
    ['hdzero_nano_90_camera_mount.3mf', 'HDZero Nano 90 mount'],
    ['universal-cam.stl', 'Universal camera mount'],
    ['turbo_16mm_fpv_cam.stl', '16 mm FPV cam mount'],
    ['turbo-gopro.stl', 'GoPro mount'],
    ['bumper.stl', 'Front lip bumper'],
    ['elrs-antenna.3mf', 'ELRS antenna mount'],
    ['turbo-antenna-mount.stl', 'Antenna mount'],
    ['turbo-35-battery-pad.3mf', 'Battery pad'],
  ];
  $('#prints').innerHTML = parts.map(([f, n]) => `
    <li><a href="${FILES}prints/${f}" download>
      <span>${f.split('.').pop()}</span><b>${n}</b>
    </a></li>`).join('');
}

function buildDownloads() {
  const rows = [
    ['t35_bottom', 'Turbo35 bottom', 'Turbo35_Bottom.dxf'],
    ['t35_top', 'Turbo35 top', 'Turbo35_Top.dxf'],
    ['t20_bottom', 'Turbo20 bottom', 'Turbo20_Bottom.dxf'],
    ['t20_top', 'Turbo20 top', 'Turbo20_Top.dxf'],
  ];
  // one shared scale so plates compare at true relative size
  const S = 215;
  $('#dl').innerHTML = rows.map(([k, n, f]) => {
    const p = DATA[k];
    const [minx, miny, maxx, maxy] = p.bbox;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    const circles = p.circles.map((c) => {
      const r = c.d / 2;
      return `M${c.x - r},${-c.y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`;
    }).join('');
    return `<li><a href="${FILES}dxf/${f}" download>
      <div class="dl__thumb"><svg viewBox="${cx - S / 2} ${-cy - S * 0.375} ${S} ${S * 0.75}" aria-hidden="true"><path d="${platePath(p)}${circles}"/></svg></div>
      <div><div class="dl__name">${n}</div></div>
      <div class="dl__meta"><span>${p.t.toFixed(1)} mm T700</span><span>${(maxx - minx).toFixed(0)}×${(maxy - miny).toFixed(0)} mm</span></div>
    </a></li>`;
  }).join('');
}
