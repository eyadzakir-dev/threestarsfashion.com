// Duty-free route globe, in the constellation style: a night-side dotted Earth with glowing arcs from
// Alexandria to the US, EU and GCC. WebGL (three.js) when motion is allowed; a still flat-canvas drawing otherwise.
// Publishes live pin and arc-head positions on `figure.globeState` for the homepage star journey.
import { landPoints, latLonToVec, PLACES } from './globe-data.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const NARROW = matchMedia('(max-width: 899px)');
const DEG = Math.PI / 180;
const VIEW = { startLon: PLACES.alex.lon, endLon: -14, startTilt: 31, endTilt: 27 };
const ZOOM_START = 1.9;
const RADIUS_FRACTION = 0.4;
const CENTER_Y_FRACTION = 0.52;
const DOT_SAMPLES = { wide: 16000, narrow: 9000 };
const SKY_STARS = { wide: 420, narrow: 220 };
const ARC_LIFT = 0.22;
const ARC_STEPS = 64;
const ARC_TUBE = 0.0075;
const PIN_MIN_Z = 0.12;
const PIN_EDGE_GAP = 8;
const PROGRESS_DAMPING = 5;
const MAX_DT = 0.05;
const PANEL = '#07090f';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v, a, b) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;
const PLACE_VECS = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, latLonToVec(p.lat, p.lon)]));
// One arc per duty-free market, all from Alexandria; the order is the arcs array order.
const ARC_KEYS = ['eu', 'us', 'gcc'];
const RING_KEYS = ['alex', ...ARC_KEYS];

/* ---------- Shared math: both renderers and the HTML pins use the same projection ---------- */

// Same rotation as three.js Euler(tilt, -lon, 0): Ry(-lon) first, then Rx(tilt).
function rotateView([x, y, z], lonDeg, tiltDeg) {
  const cy = Math.cos(lonDeg * DEG), sy = Math.sin(lonDeg * DEG);
  const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
  const cx = Math.cos(tiltDeg * DEG), sx = Math.sin(tiltDeg * DEG);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

function arcPoints(from, to) {
  const angle = Math.acos(Math.min(1, from.reduce((s, c, i) => s + c * to[i], 0)));
  return Array.from({ length: ARC_STEPS + 1 }, (_, i) => {
    const t = i / ARC_STEPS;
    const a = Math.sin((1 - t) * angle) / Math.sin(angle);
    const b = Math.sin(t * angle) / Math.sin(angle);
    const lift = 1 + ARC_LIFT * angle * Math.sin(Math.PI * t);
    return from.map((c, k) => (c * a + to[k] * b) * lift);
  });
}

function pointAlong(points, t) {
  const f = clamp01(t) * (points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return points[i].map((c, k) => lerp(c, points[i + 1][k], f - i));
}

function viewAt(progress) {
  const spin = smooth(progress, 0, 0.85);
  return {
    lon: lerp(VIEW.startLon, VIEW.endLon, spin),
    tilt: lerp(VIEW.startTilt, VIEW.endTilt, spin),
    zoom: lerp(ZOOM_START, 1, easeOutCubic(smooth(progress, 0, 0.45))),
    eu: smooth(progress, 0.3, 0.72),
    gcc: smooth(progress, 0.38, 0.8),
    us: smooth(progress, 0.48, 0.98),
  };
}

function measure(figure) {
  const w = figure.clientWidth;
  const h = figure.clientHeight;
  return { w, h, cx: w / 2, cy: h * CENTER_Y_FRACTION, r: Math.min(w, h) * RADIUS_FRACTION };
}

function zoomed(box, view) {
  return { ...box, r: box.r * view.zoom };
}

function toScreen(v, view, box) {
  const [x, y, z] = rotateView(v, view.lon, view.tilt);
  return { x: box.cx + x * box.r, y: box.cy - y * box.r, z };
}

function scrollProgress(figure) {
  const rect = figure.getBoundingClientRect();
  return clamp01((innerHeight - rect.top) / (innerHeight / 2 + rect.height / 2));
}

/* ---------- HTML pins and the shared state ---------- */

function createPins(figure) {
  return [...figure.querySelectorAll('[data-pin]')].map((el) => ({
    el, key: el.dataset.pin, tag: el.querySelector('.globe__tag'), tagW: 0,
  }));
}

function measurePins(pins) {
  pins.forEach((pin) => { pin.tagW = pin.tag.offsetWidth; });
}

function pinSide(pin, x, box) {
  const outward = x >= box.cx ? 'right' : 'left';
  const room = outward === 'right' ? box.w - x : x;
  if (room >= pin.tagW + PIN_EDGE_GAP * 3) return outward;
  return outward === 'right' ? 'left' : 'right';
}

function isInside(p, box) {
  return p.x > 0 && p.x < box.w && p.y > 0 && p.y < box.h;
}

function placePins(pins, view, box) {
  pins.forEach((pin) => {
    const p = toScreen(PLACE_VECS[pin.key], view, box);
    const drawn = pin.key === 'alex' ? 1 : view[pin.key];
    pin.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    pin.el.dataset.side = pinSide(pin, p.x, box);
    pin.el.classList.toggle('is-hidden', p.z < PIN_MIN_Z || drawn < 0.96 || view.zoom > 1.15 || !isInside(p, box));
  });
}

function publishState(figure, view, box, arcs) {
  figure.globeState = {
    view,
    places: Object.fromEntries(Object.keys(PLACE_VECS).map((k) => [k, toScreen(PLACE_VECS[k], view, box)])),
    heads: Object.fromEntries(ARC_KEYS.map((k, i) => [k, toScreen(pointAlong(arcs[i], view[k]), view, box)])),
  };
}

/* ---------- Background stars (both renderers) ---------- */

function skyStars(count) {
  let seed = 20080101;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: count }, () => ({ x: rand(), y: rand(), s: 0.6 + rand() ** 6 * 1.8, a: 0.25 + rand() * 0.55, p: rand() }));
}

/* ---------- Flat renderer (reduced motion, no WebGL) ---------- */

function drawFlatBackdrop(ctx, stars, box) {
  ctx.fillStyle = PANEL;
  ctx.fillRect(0, 0, box.w, box.h);
  stars.forEach((s) => {
    ctx.fillStyle = `rgba(233,236,246,${s.a.toFixed(2)})`;
    ctx.fillRect(s.x * box.w, s.y * box.h, s.s, s.s);
  });
  const halo = ctx.createRadialGradient(box.cx, box.cy, box.r * 0.92, box.cx, box.cy, box.r * 1.22);
  halo.addColorStop(0, 'rgba(92,128,240,0.35)');
  halo.addColorStop(1, 'rgba(92,128,240,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, box.w, box.h);
}

function drawFlatSphere(ctx, box) {
  const rim = ctx.createRadialGradient(box.cx, box.cy, box.r * 0.6, box.cx, box.cy, box.r);
  rim.addColorStop(0, '#04070f');
  rim.addColorStop(1, '#16244d');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(box.cx, box.cy, box.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlatDots(ctx, dots, view, box) {
  const dot = Math.max(1.2, box.r / 130);
  dots.forEach((v) => {
    const p = toScreen(v, view, box);
    if (p.z <= 0) return;
    const hot = Math.exp(-(((v[0] - PLACE_VECS.alex[0]) ** 2) + ((v[1] - PLACE_VECS.alex[1]) ** 2) + ((v[2] - PLACE_VECS.alex[2]) ** 2)) * 60);
    const a = (0.25 + p.z * 0.65).toFixed(2);
    ctx.fillStyle = hot > 0.35 ? `rgba(255,108,82,${a})` : `rgba(244,239,230,${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, dot / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFlatArc(ctx, points, view, box) {
  ctx.beginPath();
  points.forEach((v, i) => {
    const p = toScreen(v, view, box);
    if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
}

function createFlatRenderer(canvas, dots, arcs) {
  const ctx = canvas.getContext('2d');
  const stars = skyStars(NARROW.matches ? SKY_STARS.narrow : SKY_STARS.wide);
  return {
    resize(box) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(box.w * dpr);
      canvas.height = Math.round(box.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    render(view, box) {
      drawFlatBackdrop(ctx, stars, box);
      drawFlatSphere(ctx, box);
      drawFlatDots(ctx, dots, view, box);
      ctx.lineWidth = Math.max(2, box.r * ARC_TUBE * 2);
      ctx.strokeStyle = 'rgba(255,92,70,0.95)';
      ctx.shadowColor = 'rgba(255,70,50,0.8)';
      ctx.shadowBlur = 8;
      arcs.forEach((points) => drawFlatArc(ctx, points, view, box));
      ctx.shadowBlur = 0;
    },
    isAnimated: false,
  };
}

/* ---------- WebGL renderer: shaders adapted from the constellation prototype ---------- */

const PASS_VERTEX = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const HALO_FRAGMENT = `
  varying vec2 vUv;
  void main() {
    float r = length(vUv * 2.0 - 1.0) * 1.4;
    float ring = exp(-pow((r - 1.0) / 0.09, 2.0)) * 0.45 + smoothstep(1.4, 1.0, r) * 0.12;
    float outside = smoothstep(0.97, 1.02, r);
    gl_FragColor = vec4(vec3(0.36, 0.5, 0.95) * ring * outside * 0.8, 1.0);
  }`;
const SPHERE_VERTEX = `
  varying vec3 vNormal; varying vec3 vObj;
  void main() { vNormal = normalize(normalMatrix * normal); vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPHERE_FRAGMENT = `
  varying vec3 vNormal; varying vec3 vObj;
  void main() {
    float rim = 1.0 - max(vNormal.z, 0.0);
    float lat = asin(clamp(vObj.y / 0.995, -1.0, 1.0));
    float lon = atan(vObj.x, vObj.z);
    float step15 = 0.2618;
    float gLat = abs(fract(lat / step15 + 0.5) - 0.5) * step15;
    float gLon = abs(fract(lon / step15 + 0.5) - 0.5) * step15 * cos(lat);
    float grid = (1.0 - smoothstep(0.0, 0.006, gLat)) + (1.0 - smoothstep(0.0, 0.006, gLon));
    vec3 col = vec3(0.012, 0.022, 0.05) + vec3(0.24, 0.36, 0.8) * pow(rim, 2.8) * 0.55;
    col += vec3(0.5, 0.6, 0.9) * clamp(grid, 0.0, 1.0) * 0.07 * (1.0 - rim);
    gl_FragColor = vec4(col, 1.0);
  }`;
const DOT_VERTEX = `
  uniform float uDotPx; uniform vec3 uAlexDir;
  varying float vAlpha; varying float vHot;
  void main() {
    vec3 n = normalize(normalMatrix * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float d = distance(position, uAlexDir);
    vHot = exp(-d * d * 90.0);
    vAlpha = smoothstep(0.02, 0.5, n.z);
    gl_PointSize = uDotPx * (0.65 + 0.35 * n.z);
  }`;
const DOT_FRAGMENT = `
  varying float vAlpha; varying float vHot;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.28, d) * vAlpha;
    vec3 col = mix(vec3(0.95, 0.92, 0.87), vec3(1.0, 0.42, 0.32), vHot);
    gl_FragColor = vec4(col, a * (0.85 + vHot * 0.15));
  }`;
const ARC_VERTEX = `
  varying float vT;
  void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ARC_FRAGMENT = `
  uniform float uDraw; uniform float uTime; varying float vT;
  void main() {
    if (vT > uDraw) discard;
    float head = exp(-pow((uDraw - vT) / 0.05, 2.0)) * step(uDraw, 0.995);
    float pulse = pow(fract(vT * 2.0 - uTime * 0.28), 14.0);
    vec3 col = mix(vec3(1.0, 0.25, 0.2), vec3(1.0, 0.78, 0.5), vT);
    gl_FragColor = vec4(col * (0.55 + pulse * 0.9 + head * 1.2), 1.0);
  }`;
const RING_VERTEX = `
  attribute float aIndex; uniform vec4 uShow; uniform float uPx;
  varying float vShow; varying float vPhase;
  void main() {
    vShow = aIndex < 0.5 ? uShow.x : (aIndex < 1.5 ? uShow.y : (aIndex < 2.5 ? uShow.z : uShow.w));
    vPhase = aIndex * 0.37;
    vec3 n = normalize(normalMatrix * position);
    vShow *= smoothstep(0.05, 0.35, n.z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uPx;
  }`;
const RING_FRAGMENT = `
  uniform float uTime; varying float vShow; varying float vPhase;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float t = fract(uTime * 0.5 + vPhase);
    float ring = (1.0 - smoothstep(0.0, 0.07, abs(r - t))) * (1.0 - t);
    float core = 1.0 - smoothstep(0.1, 0.18, r);
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.55) * (ring * 0.9 + core) * vShow, 1.0);
  }`;
const SKY_VERTEX = `
  attribute float aSize; attribute float aPhase; attribute float aAlpha;
  uniform float uTime; uniform float uDpr; varying float vAlpha;
  void main() {
    vAlpha = aAlpha * (0.7 + 0.3 * sin(uTime * 1.3 + aPhase * 40.0));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr;
  }`;
const SKY_FRAGMENT = `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(vec3(0.91, 0.93, 0.98) * smoothstep(0.5, 0.1, d) * vAlpha, 1.0);
  }`;

function additive(THREE, options) {
  return new THREE.ShaderMaterial({ ...options, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

function createHalo(THREE) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), additive(THREE, { vertexShader: PASS_VERTEX, fragmentShader: HALO_FRAGMENT, depthTest: false }));
  mesh.renderOrder = -1;
  return mesh;
}

function createSphere(THREE) {
  return new THREE.Mesh(new THREE.SphereGeometry(0.995, 64, 48), new THREE.ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: SPHERE_FRAGMENT }));
}

function createDots(THREE, dots) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dots.flat()), 3));
  const material = new THREE.ShaderMaterial({
    vertexShader: DOT_VERTEX,
    fragmentShader: DOT_FRAGMENT,
    uniforms: { uDotPx: { value: 2 }, uAlexDir: { value: new THREE.Vector3(...PLACE_VECS.alex) } },
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function createArc(THREE, points) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const material = additive(THREE, { vertexShader: ARC_VERTEX, fragmentShader: ARC_FRAGMENT, uniforms: { uDraw: { value: 0 }, uTime: { value: 0 } } });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, ARC_STEPS * 2, ARC_TUBE, 6, false), material);
}

function createRings(THREE) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RING_KEYS.flatMap((k) => PLACE_VECS[k])), 3));
  geometry.setAttribute('aIndex', new THREE.BufferAttribute(new Float32Array(RING_KEYS.map((_, i) => i)), 1));
  const uniforms = { uShow: { value: new THREE.Vector4() }, uPx: { value: 34 }, uTime: { value: 0 } };
  const points = new THREE.Points(geometry, additive(THREE, { vertexShader: RING_VERTEX, fragmentShader: RING_FRAGMENT, uniforms, depthTest: false }));
  points.renderOrder = 5;
  return points;
}

function createSky(THREE, count) {
  const stars = skyStars(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(stars.length * 3), 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(stars.map((s) => s.s * 1.6)), 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(stars.map((s) => s.p)), 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(stars.map((s) => s.a)), 1));
  const uniforms = { uTime: { value: 0 }, uDpr: { value: 1 } };
  const points = new THREE.Points(geometry, additive(THREE, { vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, uniforms, depthTest: false }));
  points.renderOrder = -2;
  return { points, stars };
}

function layoutSky(sky, box) {
  const pos = sky.points.geometry.attributes.position;
  sky.stars.forEach((s, i) => pos.setXYZ(i, (s.x - 0.5) * box.w, (0.5 - s.y) * box.h, -4000));
  pos.needsUpdate = true;
}

async function createGlRenderer(canvas, dots, arcs) {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(PANEL, 1);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  const globe = new THREE.Group();
  const spin = new THREE.Group();
  const points = createDots(THREE, dots);
  const arcMeshes = arcs.map((p) => createArc(THREE, p));
  const rings = createRings(THREE);
  const sky = createSky(THREE, NARROW.matches ? SKY_STARS.narrow : SKY_STARS.wide);
  spin.add(createSphere(THREE), points, ...arcMeshes, rings);
  globe.add(createHalo(THREE), spin);
  scene.add(sky.points, globe);
  return {
    resize(box) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(box.w, box.h, false);
      Object.assign(camera, { left: -box.w / 2, right: box.w / 2, top: box.h / 2, bottom: -box.h / 2 });
      camera.updateProjectionMatrix();
      layoutSky(sky, box);
      sky.points.material.uniforms.uDpr.value = renderer.getPixelRatio();
    },
    render(view, box, time) {
      const dpr = renderer.getPixelRatio();
      globe.position.set(box.cx - box.w / 2, box.h / 2 - box.cy, 0);
      globe.scale.setScalar(box.r);
      spin.rotation.set(view.tilt * DEG, -view.lon * DEG, 0);
      points.material.uniforms.uDotPx.value = Math.min(4, Math.max(1.8, box.r / 105)) * dpr;
      arcMeshes.forEach((m, i) => {
        m.material.uniforms.uDraw.value = view[ARC_KEYS[i]];
        m.material.uniforms.uTime.value = time;
      });
      rings.material.uniforms.uShow.value.set(smooth(view.zoom, 1.3, 1), ...ARC_KEYS.map((k) => smooth(view[k], 0.9, 1)));
      rings.material.uniforms.uPx.value = 34 * dpr;
      rings.material.uniforms.uTime.value = time;
      sky.points.material.uniforms.uTime.value = time;
      renderer.render(scene, camera);
    },
    isAnimated: true,
  };
}

function canUseWebGL() {
  return Boolean(document.createElement('canvas').getContext('webgl2'));
}

async function createRenderer(canvas, dots, arcs) {
  if (REDUCED_MOTION.matches || !canUseWebGL()) return createFlatRenderer(canvas, dots, arcs);
  try {
    return await createGlRenderer(canvas, dots, arcs);
  } catch (error) {
    console.warn('WebGL globe unavailable; drawing the flat globe.', error);
    return createFlatRenderer(canvas, dots, arcs);
  }
}

/* ---------- Lifecycle ---------- */

function startLoop(figure, frame) {
  const state = { raf: 0, visible: false, last: 0 };
  const tick = (now) => {
    state.raf = requestAnimationFrame(tick);
    const dt = state.last ? Math.min(MAX_DT, (now - state.last) / 1000) : 0;
    state.last = now;
    frame(dt, now / 1000);
  };
  const sync = () => {
    const shouldRun = state.visible && !document.hidden;
    if (shouldRun && !state.raf) { state.last = 0; state.raf = requestAnimationFrame(tick); }
    if (!shouldRun && state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
  };
  new IntersectionObserver(([entry]) => { state.visible = entry.isIntersecting; sync(); }).observe(figure);
  document.addEventListener('visibilitychange', sync);
}

export async function initGlobe(figure) {
  const canvas = figure.querySelector('.globe__canvas');
  const dots = landPoints(NARROW.matches ? DOT_SAMPLES.narrow : DOT_SAMPLES.wide).map(([lat, lon]) => latLonToVec(lat, lon));
  const arcs = ARC_KEYS.map((k) => arcPoints(PLACE_VECS.alex, PLACE_VECS[k]));
  const renderer = await createRenderer(canvas, dots, arcs);
  const pins = createPins(figure);
  let box = measure(figure);
  let progress = renderer.isAnimated ? scrollProgress(figure) : 1;

  const draw = (time = 0) => {
    const view = viewAt(progress);
    const zbox = zoomed(box, view);
    renderer.render(view, zbox, time);
    placePins(pins, view, zbox);
    publishState(figure, view, zbox, arcs);
  };
  const resize = () => {
    box = measure(figure);
    renderer.resize(box);
    measurePins(pins);
    draw();
  };

  figure.classList.add('is-live', renderer.isAnimated ? 'is-gl' : 'is-flat');
  new ResizeObserver(resize).observe(figure);
  resize();
  if (!renderer.isAnimated) return;
  startLoop(figure, (dt, time) => {
    const target = scrollProgress(figure);
    progress += (target - progress) * (1 - Math.exp(-PROGRESS_DAMPING * dt));
    if (Math.abs(target - progress) < 1e-4) progress = target;
    draw(time);
  });
}
