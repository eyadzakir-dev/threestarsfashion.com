// Scroll-driven factory model: one renderer, one camera on a CatmullRom path through the chapters.
import * as THREE from '../vendor/three.module.min.js';
import * as W from './world.js';

const QUALITY_LEVELS = [
  { dpr: 0.75, mapSize: 0 },
  { dpr: 1, mapSize: 1024 },
  { dpr: 2, mapSize: 2048 },
];
const DPR_CAP_DESKTOP = 2;
const DPR_CAP_MOBILE = 1.5;
const FRAME_BUDGET_MS = 28;
const WARMUP_FRAMES = 20;
const SAMPLE_FRAMES = 36;
const CAMERA_DAMPING = 3.4;
const POINTER_DAMPING = 2.4;
const PARALLAX_STRENGTH = 0.02;
const FOV = 38;
const MAX_DT = 0.05;
const MAX_DAMP_DT = 0.25;
const DUSK_DEPTH = 0.62;
const SUN_DAY = new THREE.Color('#fffaf3');
const SUN_DUSK = new THREE.Color('#aebbd9');
const SEW_GROW_MAX = 60;
const PRINT_DAILY = 65000;
const DISPATCH_DAILY = 85000;
const SHELL_LIFT = 46;
const PORTRAIT_REACH = 1.25;
const PORTRAIT_REACH_WIDE = 2.6;
const LIGHT_OFFSET = new THREE.Vector3(-0.55, 1, -0.3).normalize().multiplyScalar(160);

const COLORS = {
  day: new THREE.Color('#f3f1ec'),
  dusk: new THREE.Color('#1e2230'),
};

const HUD_LABELS = {
  entry: '00 · TSF Building (B)',
  sewing: '01 · Sewing hall',
  printing: '02 · Printing',
  dispatch: '03 · Dispatch dock',
  site: '04 · The group, 24/7',
};

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function buildKeyframes(focus) {
  const f = (dx, dy, dz) => v3(focus.x + dx, dy, focus.z + dz);
  return [
    { name: 'entry', chapter: 'entry', at: 0, frame: 'wide', pos: v3(400, 78, 190), target: v3(128, 0, -4) },
    { name: 'entryHold', chapter: 'entry', at: 0.35, frame: 'wide', pos: v3(320, 62, 152), target: v3(118, 0, -2) },
    { name: 'sewA', chapter: 'sewing', at: 0, pos: f(-2.3, 1.55, 1.9), target: f(0.05, 0.92, 0.35) },
    { name: 'sewHold', chapter: 'sewing', at: 0.12, pos: f(-2.7, 1.8, 2.3), target: f(0.1, 0.9, 0.3) },
    { name: 'sewMid', chapter: 'sewing', at: 0.46, pos: f(-13, 10, 18), target: f(12, 0, -4) },
    { name: 'sewEnd', chapter: 'sewing', at: 0.9, pos: v3(42, 118, 96), target: v3(92, 0, -4) },
    { name: 'printA', chapter: 'printing', at: 0.1, pos: v3(149, 9, 21), target: v3(166, 1.2, 0) },
    { name: 'printB', chapter: 'printing', at: 0.78, pos: v3(158, 5.2, 17), target: v3(172, 1.3, 1) },
    { name: 'dispA', chapter: 'dispatch', at: 0.1, pos: v3(226, 14, 30), target: v3(252, 1.4, -1) },
    { name: 'dispB', chapter: 'dispatch', at: 0.78, pos: v3(233, 8.5, 25), target: v3(254, 1.6, -1) },
    { name: 'siteA', chapter: 'site', at: 0.34, pos: v3(40, 600, 430), target: v3(120, 0, 4) },
    { name: 'siteB', chapter: 'site', at: 1, pos: v3(0, 540, 400), target: v3(120, 0, 8) },
  ];
}

function createRenderer(canvas, isMobile) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function createLights(scene) {
  const hemi = new THREE.HemisphereLight('#ffffff', '#aba79f', 1.55);
  const sun = new THREE.DirectionalLight('#fffaf3', 2.9);
  sun.castShadow = true;
  sun.shadow.bias = -0.0004;
  scene.add(hemi, sun, sun.target);
  return { hemi, sun };
}

function addStatic(scene, geometry, material, { cast = true, receive = true } = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.matrixAutoUpdate = false;
  scene.add(mesh);
  return mesh;
}

function createCutters(scene, clay) {
  const { gantry, head } = W.buildCutterGantry();
  const count = W.LAYOUT.cutting.tables.length;
  const gantries = new THREE.InstancedMesh(gantry, clay, count);
  const heads = new THREE.InstancedMesh(head, clay, count);
  [gantries, heads].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  });
  return { gantries, heads };
}

function buildWorld(scene) {
  const clay = W.createClayMaterial();
  addStatic(scene, W.buildSiteGround(), clay, { cast: false });
  addStatic(scene, W.buildArchitecture(), clay);
  addStatic(scene, W.buildCuttingStatic(), clay);
  addStatic(scene, W.buildCarouselBase(), clay);
  addStatic(scene, W.buildRacks(), clay);
  addStatic(scene, W.buildDock(), clay);
  W.createWarehouseStock().forEach((mesh) => scene.add(mesh));

  const shellMaterial = W.createClayMaterial({ transparent: true });
  const shell = addStatic(scene, W.buildShell(), shellMaterial);
  shell.matrixAutoUpdate = true;

  const sewUniforms = { uReveal: { value: 1 }, uGrow: { value: 1 } };
  const sewing = W.createSewingHall(sewUniforms);
  scene.add(sewing.group);

  const siteUniforms = { uReveal: { value: 0 }, uGrow: { value: 1 } };
  const site = W.createSiteBuildings(siteUniforms);
  scene.add(site.bodies, site.windows);

  const rotors = new THREE.InstancedMesh(W.buildCarouselRotor(), clay, W.carouselCenters().length);
  rotors.castShadow = true;
  rotors.frustumCulled = false;
  rotors.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(rotors);

  const conveyor = W.createConveyorCartons();
  scene.add(conveyor);

  return {
    shell, shellMaterial, sewing, sewUniforms, site, siteUniforms, rotors, conveyor,
    cutters: createCutters(scene, clay),
  };
}

// ---------- Scroll mapping ----------

function chapterRange(el, viewportH) {
  const top = el.getBoundingClientRect().top + window.scrollY;
  return { top, span: Math.max(1, el.offsetHeight - viewportH) };
}

function computeAnchors(keyframes, chapters, viewportH) {
  return keyframes.map((k) => {
    const el = chapters[k.chapter];
    if (!el) return 0;
    const { top, span } = chapterRange(el, viewportH);
    return top + k.at * span;
  });
}

function scrollToU(anchors, y) {
  if (y <= anchors[0]) return 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (y < anchors[i + 1]) {
      const f = (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
      return i + smootherstep(clamp01(f));
    }
  }
  return anchors.length - 1;
}

// ---------- Scene factory ----------

export async function initScene({ canvas, stage, tour, chapters, counters, hudLabel, hudFill }) {
  const isMobile = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
  const dprCap = isMobile ? DPR_CAP_MOBILE : DPR_CAP_DESKTOP;
  const renderer = createRenderer(canvas, isMobile);
  const scene = new THREE.Scene();
  scene.background = COLORS.day.clone();
  scene.fog = new THREE.Fog(COLORS.day.clone(), 30, 200);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 5000);
  const lights = createLights(scene);
  const world = buildWorld(scene);
  const keyframes = buildKeyframes(world.sewing.focus);
  const index = Object.fromEntries(keyframes.map((k, i) => [k.name, i]));
  const posCurve = new THREE.CatmullRomCurve3(keyframes.map((k) => k.pos), false, 'centripetal');
  const targetCurve = new THREE.CatmullRomCurve3(keyframes.map((k) => k.target), false, 'centripetal');

  const forcedQuality = Number.parseInt(new URLSearchParams(window.location.search).get('q'), 10);
  const isQualityLocked = forcedQuality >= 0 && forcedQuality < QUALITY_LEVELS.length;
  const state = {
    anchors: [], uTarget: 0, u: 0, pointer: { x: 0, y: 0, tx: 0, ty: 0 },
    viewW: 1, viewH: 1, aspect: 1, quality: isQualityLocked ? forcedQuality : QUALITY_LEVELS.length - 1,
    running: false, raf: 0, last: 0, frames: 0, sampleSum: 0, sampleCount: 0, time: 0,
    counterValues: {}, hudChapter: '', ready: false, destroyed: false,
  };
  const tmp = { pos: new THREE.Vector3(), target: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) };

  function applyQuality() {
    const level = QUALITY_LEVELS[state.quality];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap, level.dpr));
    renderer.shadowMap.enabled = level.mapSize > 0;
    lights.sun.castShadow = level.mapSize > 0;
    if (level.mapSize > 0 && lights.sun.shadow.mapSize.x !== level.mapSize) {
      lights.sun.shadow.mapSize.set(level.mapSize, level.mapSize);
      lights.sun.shadow.map?.dispose();
      lights.sun.shadow.map = null;
    }
    renderer.setSize(state.viewW, state.viewH, false);
  }

  function measure() {
    state.anchors = computeAnchors(keyframes, chapters, window.innerHeight);
    readScroll();
  }

  function resize() {
    state.viewW = stage.clientWidth || window.innerWidth;
    state.viewH = stage.clientHeight || window.innerHeight;
    state.aspect = state.viewW / state.viewH;
    camera.aspect = state.aspect;
    applyQuality();
    measure();
  }

  function readScroll() {
    state.uTarget = scrollToU(state.anchors, window.scrollY);
  }

  function blendFrames(u, valueOf) {
    const i = Math.min(keyframes.length - 1, Math.floor(u));
    const j = Math.min(keyframes.length - 1, i + 1);
    return THREE.MathUtils.lerp(valueOf(keyframes[i]), valueOf(keyframes[j]), u - i);
  }

  function frameShift(u) {
    const isPortrait = state.aspect < 1;
    const shiftOf = (k) => {
      if (isPortrait) return k.frame === 'wide' ? -0.12 : -0.19;
      return k.frame === 'wide' ? 0.12 : 0.15;
    };
    return blendFrames(u, shiftOf);
  }

  // Portrait screens pull the camera back; wide establishing shots need more room.
  function portraitPullback(u) {
    const reach = blendFrames(u, (k) => (k.frame === 'wide' ? PORTRAIT_REACH_WIDE : PORTRAIT_REACH));
    return 1 + (1 - state.aspect) * reach;
  }

  function updateCamera() {
    const n = keyframes.length - 1;
    const t = state.u / n;
    posCurve.getPoint(t, tmp.pos);
    targetCurve.getPoint(t, tmp.target);
    const offset = tmp.pos.sub(tmp.target);
    if (state.aspect < 1) offset.multiplyScalar(portraitPullback(state.u));
    const heroDrift = 1 - clamp01(state.u / Math.max(1, index.sewA));
    offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, Math.sin(state.time * 0.12) * 0.05 * heroDrift);
    const dist = offset.length();
    camera.position.copy(tmp.target).add(offset);
    camera.lookAt(tmp.target);
    tmp.right.setFromMatrixColumn(camera.matrix, 0);
    tmp.up.setFromMatrixColumn(camera.matrix, 1);
    const k = dist * PARALLAX_STRENGTH;
    camera.position.addScaledVector(tmp.right, state.pointer.x * k).addScaledVector(tmp.up, -state.pointer.y * k * 0.6);
    camera.lookAt(tmp.target);
    camera.near = Math.max(0.05, dist * 0.015);
    camera.far = Math.max(600, dist * 8);
    const shift = frameShift(state.u);
    if (state.aspect < 1) camera.setViewOffset(state.viewW, state.viewH, 0, -shift * state.viewH, state.viewW, state.viewH);
    else camera.setViewOffset(state.viewW, state.viewH, -shift * state.viewW, 0, state.viewW, state.viewH);
    camera.updateProjectionMatrix();
    scene.fog.near = dist * 1.1;
    scene.fog.far = dist * 4.2 + 80;
    followShadow(tmp.target, dist);
  }

  function followShadow(target, dist) {
    const sun = lights.sun;
    sun.target.position.copy(target);
    sun.position.copy(target).add(LIGHT_OFFSET);
    const half = THREE.MathUtils.clamp(dist * 1.1, 12, 480);
    const cam = sun.shadow.camera;
    cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half;
    cam.near = 1; cam.far = LIGHT_OFFSET.length() + half * 2;
    cam.updateProjectionMatrix();
    const size = sun.shadow.mapSize.x || 1024;
    sun.shadow.normalBias = (half * 2 / size) * 1.2;
  }

  const beat = (from, to) => clamp01((state.u - index[from]) / (index[to] - index[from]));

  function setCounter(name, value) {
    const el = counters[name];
    if (!el || state.counterValues[name] === value) return;
    state.counterValues[name] = value;
    el.textContent = value.toLocaleString('en-US');
  }

  function updateBeats() {
    const lift = smootherstep(clamp01((state.u - index.entryHold) / (index.sewA - index.entryHold)));
    world.shell.position.y = lift * SHELL_LIFT;
    world.shellMaterial.opacity = 1 - lift;
    world.shell.visible = lift < 0.995;

    const sew = beat('sewHold', 'sewEnd');
    const reveal = 1 + (W.SEWING_TOTAL - 1) * (sew ** 2.2);
    const grow = 1 + SEW_GROW_MAX * sew;
    world.sewUniforms.uGrow.value = grow;
    world.sewUniforms.uReveal.value = reveal + grow * sew;
    setCounter('sewing', Math.min(W.SEWING_TOTAL, Math.floor(reveal)));

    setCounter('printing', Math.round((easeInOut(beat('printA', 'printB')) * PRINT_DAILY) / 100) * 100);
    setCounter('dispatch', Math.round((easeInOut(beat('dispA', 'dispB')) * DISPATCH_DAILY) / 100) * 100);

    const rise = clamp01((state.u - index.dispB - 0.3) / (index.siteA - index.dispB - 0.3));
    const others = W.FACTORY_TOTAL - 1;
    world.siteUniforms.uReveal.value = rise * others;
    setCounter('site', 1 + Math.floor(rise * others + 0.001));

    const dusk = easeInOut(beat('siteA', 'siteB'));
    scene.background.copy(COLORS.day).lerp(COLORS.dusk, dusk * DUSK_DEPTH);
    scene.fog.color.copy(scene.background);
    lights.hemi.intensity = THREE.MathUtils.lerp(1.55, 0.8, dusk);
    lights.sun.intensity = THREE.MathUtils.lerp(2.9, 0.75, dusk);
    lights.sun.color.copy(SUN_DAY).lerp(SUN_DUSK, dusk);
    world.site.windowMaterial.emissiveIntensity = dusk * 3.2;
  }

  function updateHud() {
    const k = keyframes[Math.min(keyframes.length - 1, Math.round(state.u))];
    if (k.chapter !== state.hudChapter) {
      state.hudChapter = k.chapter;
      hudLabel.textContent = HUD_LABELS[k.chapter] || '';
    }
    hudFill.style.setProperty('--progress', (state.u / (keyframes.length - 1)).toFixed(4));
  }

  function animateMachines(t) {
    const { gantries, heads } = world.cutters;
    const { x0, tableLen, tables } = W.LAYOUT.cutting;
    tables.forEach((z, i) => {
      const phase = i * 1.9;
      const x = x0 + 6 + (0.5 - 0.5 * Math.cos(t * 0.32 + phase)) * (tableLen - 6);
      tmp.m.makeTranslation(x, 0, z);
      gantries.setMatrixAt(i, tmp.m);
      tmp.m.makeTranslation(x, 0, z + Math.sin(t * 1.6 + phase) * 0.92);
      heads.setMatrixAt(i, tmp.m);
    });
    gantries.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;

    const INDEX_PERIOD = 1.7;
    W.carouselCenters().forEach((c, i) => {
      const step = t / INDEX_PERIOD + i * 0.37;
      const angle = (Math.floor(step) + easeInOut(clamp01((step % 1) * 1.8))) * ((Math.PI * 2) / W.LAYOUT.printing.arms);
      tmp.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
      tmp.m.compose(c, tmp.q, tmp.s);
      world.rotors.setMatrixAt(i, tmp.m);
    });
    world.rotors.instanceMatrix.needsUpdate = true;

    const C = W.CONVEYOR;
    const len = C.to - C.from;
    const size = v3(0.62, 0.42, 0.52);
    for (let i = 0; i < C.count; i++) {
      const s = (t * 1.1 + (i * len) / C.count) % len;
      tmp.m.compose(v3(C.from + s, C.y + 0.21, C.z), tmp.q.identity(), size);
      world.conveyor.setMatrixAt(i, tmp.m);
    }
    world.conveyor.instanceMatrix.needsUpdate = true;
  }

  function adaptQuality(frameMs) {
    state.frames += 1;
    if (isQualityLocked || state.frames < WARMUP_FRAMES || state.quality === 0) return;
    state.sampleSum += frameMs;
    state.sampleCount += 1;
    if (state.sampleCount < SAMPLE_FRAMES) return;
    const avg = state.sampleSum / state.sampleCount;
    state.sampleSum = 0;
    state.sampleCount = 0;
    if (avg > FRAME_BUDGET_MS) {
      state.quality -= 1;
      applyQuality();
    }
  }

  function tick(now) {
    state.raf = requestAnimationFrame(tick);
    const frameMs = state.last ? now - state.last : 16;
    const dt = Math.min(MAX_DT, frameMs / 1000);
    state.last = now;
    state.time += dt;
    state.u = damp(state.u, state.uTarget, CAMERA_DAMPING, Math.min(MAX_DAMP_DT, frameMs / 1000));
    if (Math.abs(state.u - state.uTarget) < 1e-4) state.u = state.uTarget;
    state.pointer.x = damp(state.pointer.x, state.pointer.tx, POINTER_DAMPING, dt);
    state.pointer.y = damp(state.pointer.y, state.pointer.ty, POINTER_DAMPING, dt);
    updateBeats();
    updateCamera();
    animateMachines(state.time);
    updateHud();
    renderer.render(scene, camera);
    if (!state.ready) {
      state.ready = true;
      stage.classList.add('is-ready');
    }
    adaptQuality(frameMs);
  }

  function start() {
    if (state.running || state.destroyed || document.hidden) return;
    state.running = true;
    state.last = 0;
    state.raf = requestAnimationFrame(tick);
  }

  function stop() {
    state.running = false;
    cancelAnimationFrame(state.raf);
  }

  function handlePointerMove(e) {
    if (e.pointerType === 'touch') return;
    state.pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }

  let visible = true;
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  observer.observe(tour);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  });
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  const stageObserver = new ResizeObserver(resize);
  const pageObserver = new ResizeObserver(measure);
  stageObserver.observe(stage);
  pageObserver.observe(document.body);
  document.fonts?.ready.then(measure);

  function destroy() {
    state.destroyed = true;
    observer.disconnect();
    stageObserver.disconnect();
    pageObserver.disconnect();
    stop();
    window.removeEventListener('scroll', readScroll);
    window.removeEventListener('pointermove', handlePointerMove);
  }

  resize();
  state.u = state.uTarget;
  updateBeats();
  updateCamera();
  renderer.compile(scene, camera);
  start();
  return { stop: destroy };
}
