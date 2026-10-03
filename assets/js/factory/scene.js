// Factory model: one renderer, one camera on a CatmullRom path through the chapters' keyframes.
// The caller drives the camera with setProgress(u), u in keyframe units (0 … keyframes.length - 1).
import * as THREE from '../vendor/three.module.min.js';
import * as W from './world.js';
import * as M from './machines.js';
import { createUnitTags } from './unit-tags.js';

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
const DISPATCH_DAILY = 100000;
const SHELL_LIFT = 46;
const PORTRAIT_REACH = 1.25;
const PORTRAIT_REACH_WIDE = 3.4;
const PORTRAIT_REACH_SITE = 2.5;
const CAROUSEL_INDEX_S = 1.7;
const KNIT_RATE = 0.6;
const REEL_RATE = 1.8;
const EMB_TRAVEL = 0.14;
const NEEDLE_RATE = 14;
const NEEDLE_STROKE = 0.05;
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LIGHT_OFFSET = new THREE.Vector3(-0.55, 1, -0.3).normalize().multiplyScalar(160);

const COLORS = {
  day: new THREE.Color('#f3f1ec'),
  dusk: new THREE.Color('#1e2230'),
};

const HUD_LABELS = {
  entry: '00 · Model Factory',
  knitting: '01 · Knitting',
  dyeing: '02 · Dyeing',
  cutting: '03 · Cutting room',
  sewing: '04 · Sewing hall',
  embellishment: '05 · Print',
  dispatch: '06 · Dispatch dock',
  site: '07 · The group, 24/7',
};

const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function buildKeyframes(focus) {
  const f = (dx, dy, dz) => v3(focus.x + dx, dy, focus.z + dz);
  return [
    { name: 'entry', chapter: 'entry', frame: 'wide', pos: v3(-200, 84, 214), target: v3(70, 0, -4) },
    { name: 'entryHold', chapter: 'entry', frame: 'wide', pos: v3(-150, 64, 168), target: v3(56, 0, -2) },
    // Interior views look east-south-east with the flow, so each zone-to-zone move barely turns.
    { name: 'knitA', chapter: 'knitting', pos: v3(-86, 17, 30), target: v3(-66, 0.8, -6) },
    { name: 'knitB', chapter: 'knitting', pos: v3(-79, 4.6, 5), target: v3(-66, 1.4, -12) },
    { name: 'dyeA', chapter: 'dyeing', pos: v3(-44, 12, 22), target: v3(-26, 1.2, -8) },
    { name: 'dyeB', chapter: 'dyeing', pos: v3(-40, 5.2, 4.5), target: v3(-25, 1.8, -12) },
    { name: 'cutA', chapter: 'cutting', pos: v3(6, 44, 50), target: v3(20, 0, 2) },
    // Looks along the tables toward the sewing hall, so the dive into the sewing close-up barely turns.
    { name: 'cutB', chapter: 'cutting', pos: v3(-4, 13, 34), target: v3(22, 0.9, -8) },
    { name: 'sewA', chapter: 'sewing', pos: f(-2.3, 1.55, 1.9), target: f(0.05, 0.92, 0.35) },
    { name: 'sewHold', chapter: 'sewing', pos: f(-2.7, 1.8, 2.3), target: f(0.1, 0.9, 0.3) },
    { name: 'sewMid', chapter: 'sewing', pos: f(-13, 10, 18), target: f(12, 0, -4) },
    { name: 'sewEnd', chapter: 'sewing', pos: v3(42, 118, 96), target: v3(92, 0, -4) },
    // Carousels in front, embroidery rows behind; then down to the carousels on the way to the dock.
    { name: 'embA', chapter: 'embellishment', pos: v3(152, 15, 22), target: v3(170, 0.8, -20) },
    { name: 'embB', chapter: 'embellishment', pos: v3(158, 5.2, 17), target: v3(172, 1.3, 1) },
    { name: 'dispA', chapter: 'dispatch', pos: v3(226, 14, 30), target: v3(252, 1.4, -1) },
    { name: 'dispB', chapter: 'dispatch', pos: v3(233, 8.5, 25), target: v3(254, 1.6, -1) },
    { name: 'siteA', chapter: 'site', reach: PORTRAIT_REACH_SITE, pos: v3(60, 760, 560), target: v3(84, 0, 4) },
    { name: 'siteB', chapter: 'site', reach: PORTRAIT_REACH_SITE, pos: v3(24, 700, 515), target: v3(84, 0, 8) },
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
  addStatic(scene, M.buildKnittingStock(), clay);
  addStatic(scene, M.buildDyehouseStatic(), clay);
  addStatic(scene, W.buildCuttingStatic(), clay);
  addStatic(scene, W.buildCarouselBase(), clay);
  addStatic(scene, M.buildEmbroideryStatic(), clay);
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

  const knitting = M.createKnittingFloor(clay);
  const jetReels = M.createJetReels(clay);
  const embroidery = M.createEmbroideryMovers(clay);
  scene.add(knitting.bodies, knitting.rotors, jetReels, embroidery.frames, embroidery.needles);

  return {
    shell, shellMaterial, sewing, sewUniforms, site, siteUniforms, rotors, conveyor, knitting, jetReels, embroidery,
    cutters: createCutters(scene, clay),
  };
}

// ---------- Scene factory ----------

export async function initScene({ canvas, stage, counters, hudLabel, hudFill, unitList, isPanelBeside = () => true, onChapter = () => {} }) {
  const isMobile = window.matchMedia('(max-width: 640px), (pointer: coarse)').matches;
  const dprCap = isMobile ? DPR_CAP_MOBILE : DPR_CAP_DESKTOP;
  const renderer = createRenderer(canvas, isMobile);
  const scene = new THREE.Scene();
  scene.background = COLORS.day.clone();
  scene.fog = new THREE.Fog(COLORS.day.clone(), 30, 200);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 5000);
  const lights = createLights(scene);
  const world = buildWorld(scene);
  const unitTags = createUnitTags({ stage, list: unitList, anchors: W.unitAnchors(), before: hudLabel.closest('dl') });
  const carouselCenters = W.carouselCenters();
  const knitterCenters = M.knitterCenters();
  const jetReelPoints = M.jetReelPoints();
  const embroideryOrigins = M.embroideryOrigins();
  const keyframes = buildKeyframes(world.sewing.focus);
  const index = Object.fromEntries(keyframes.map((k, i) => [k.name, i]));
  const posCurve = new THREE.CatmullRomCurve3(keyframes.map((k) => k.pos), false, 'centripetal');
  const targetCurve = new THREE.CatmullRomCurve3(keyframes.map((k) => k.target), false, 'centripetal');

  const forcedQuality = Number.parseInt(new URLSearchParams(window.location.search).get('q'), 10);
  const isQualityLocked = forcedQuality >= 0 && forcedQuality < QUALITY_LEVELS.length;
  const state = {
    uTarget: 0, u: 0, pointer: { x: 0, y: 0, tx: 0, ty: 0 },
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

  function resize() {
    state.viewW = stage.clientWidth || window.innerWidth;
    state.viewH = stage.clientHeight || window.innerHeight;
    state.aspect = state.viewW / state.viewH;
    camera.aspect = state.aspect;
    applyQuality();
    unitTags.measure();
  }

  function setProgress(u) {
    state.uTarget = THREE.MathUtils.clamp(u, 0, keyframes.length - 1);
  }

  function blendFrames(u, valueOf) {
    const i = Math.min(keyframes.length - 1, Math.floor(u));
    const j = Math.min(keyframes.length - 1, i + 1);
    return THREE.MathUtils.lerp(valueOf(keyframes[i]), valueOf(keyframes[j]), u - i);
  }

  // Leaves room for a panel laid over the left (landscape) or bottom (portrait) of the stage.
  function frameShift(u) {
    if (!isPanelBeside()) return 0;
    const isPortrait = state.aspect < 1;
    const shiftOf = (k) => {
      if (isPortrait) return k.frame === 'wide' ? -0.12 : -0.19;
      return k.frame === 'wide' ? 0.12 : 0.15;
    };
    return blendFrames(u, shiftOf);
  }

  // Portrait screens pull the camera back; wide establishing shots and the site plan need more room.
  function portraitPullback(u) {
    const reach = blendFrames(u, (k) => k.reach ?? (k.frame === 'wide' ? PORTRAIT_REACH_WIDE : PORTRAIT_REACH));
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
    // Roof is clear by knitA, the first interior view; a later finish drops the path through the shell.
    const lift = smootherstep(clamp01((state.u - index.entryHold) / (index.knitA - index.entryHold)));
    world.shell.position.y = lift * SHELL_LIFT;
    world.shellMaterial.opacity = 1 - lift;
    world.shell.visible = lift < 0.995;

    const sew = beat('sewHold', 'sewEnd');
    const reveal = 1 + (W.SEWING_TOTAL - 1) * (sew ** 2.2);
    const grow = 1 + SEW_GROW_MAX * sew;
    world.sewUniforms.uGrow.value = grow;
    world.sewUniforms.uReveal.value = reveal + grow * sew;
    setCounter('sewing', Math.min(W.SEWING_TOTAL, Math.floor(reveal)));

    setCounter('printing', Math.round((easeInOut(beat('embA', 'embB')) * PRINT_DAILY) / 100) * 100);
    setCounter('dispatch', Math.round((easeInOut(beat('dispA', 'dispB')) * DISPATCH_DAILY) / 100) * 100);

    const rise = clamp01((state.u - index.dispB - 0.3) / (index.siteA - index.dispB - 0.3));
    const others = W.UNIT_TOTAL - 1;
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
      onChapter(k.chapter);
    }
    hudFill.style.setProperty('--progress', (state.u / (keyframes.length - 1)).toFixed(4));
  }

  function spinInstances(mesh, centers, axis, angleOf) {
    centers.forEach((c, i) => {
      tmp.q.setFromAxisAngle(axis, angleOf(i));
      tmp.m.compose(c, tmp.q, tmp.s);
      mesh.setMatrixAt(i, tmp.m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  function animateCutters(t) {
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
  }

  function animateCarousels(t) {
    const step = (i) => t / CAROUSEL_INDEX_S + i * 0.37;
    const pitch = (Math.PI * 2) / W.LAYOUT.printing.arms;
    spinInstances(world.rotors, carouselCenters, THREE.Object3D.DEFAULT_UP,
      (i) => (Math.floor(step(i)) + easeInOut(clamp01((step(i) % 1) * 1.8))) * pitch);
  }

  function animateEmbroidery(t) {
    const { frames, needles } = world.embroidery;
    embroideryOrigins.forEach((o, i) => {
      const phase = i * 1.3;
      tmp.m.makeTranslation(o.x + Math.sin(t * 0.9 + phase) * EMB_TRAVEL, 0, o.z + Math.sin(t * 1.4 + phase * 2) * EMB_TRAVEL * 0.6);
      frames.setMatrixAt(i, tmp.m);
      tmp.m.makeTranslation(o.x, -Math.abs(Math.sin(t * NEEDLE_RATE + phase)) * NEEDLE_STROKE, o.z);
      needles.setMatrixAt(i, tmp.m);
    });
    frames.instanceMatrix.needsUpdate = true;
    needles.instanceMatrix.needsUpdate = true;
  }

  function animateConveyor(t) {
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

  function animateMachines(t) {
    animateCutters(t);
    animateCarousels(t);
    spinInstances(world.knitting.rotors, knitterCenters, THREE.Object3D.DEFAULT_UP, (i) => t * KNIT_RATE + i * 0.7);
    spinInstances(world.jetReels, jetReelPoints, Z_AXIS, (i) => -t * REEL_RATE - i);
    animateEmbroidery(t);
    animateConveyor(t);
  }

  // The main building's tag leads the rise; each other tag fades in as its building grows.
  function unitTagAlpha(i) {
    const reveal = world.siteUniforms.uReveal.value;
    return i === 0 ? clamp01(reveal * 2) : clamp01(reveal - (i - 1));
  }

  function updateUnitTags() {
    unitTags.update(camera, { w: state.viewW, h: state.viewH }, unitTagAlpha);
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
    updateUnitTags();
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
  observer.observe(stage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  const stageObserver = new ResizeObserver(resize);
  stageObserver.observe(stage);
  document.fonts?.ready.then(() => unitTags.measure());

  function destroy() {
    state.destroyed = true;
    observer.disconnect();
    stageObserver.disconnect();
    stop();
    window.removeEventListener('pointermove', handlePointerMove);
  }

  resize();
  updateBeats();
  updateCamera();
  renderer.compile(scene, camera);
  start();
  return {
    keyframes: keyframes.map(({ name, chapter }) => ({ name, chapter })),
    setProgress,
    stop: destroy,
  };
}
