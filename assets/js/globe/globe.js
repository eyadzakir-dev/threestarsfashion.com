// Duty-free route globe: an orthographic dotted Earth with arcs from Alexandria to the US and EU.
// WebGL (three.js) when motion is allowed; a still, flat-canvas drawing otherwise.
import { landPoints, latLonToVec, PLACES } from './globe-data.js';

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
const NARROW = matchMedia('(max-width: 899px)');
const DEG = Math.PI / 180;
const VIEW = { startLon: PLACES.alex.lon, endLon: -14, startTilt: 26, endTilt: 30 };
const RADIUS_FRACTION = 0.43;
const CENTER_Y_FRACTION = 0.52;
const DOT_SAMPLES = { wide: 16000, narrow: 9000 };
const ARC_LIFT = 0.22;
const ARC_STEPS = 64;
const ARC_TUBE = 0.0065;
const PIN_MIN_Z = 0.12;
const PIN_EDGE_GAP = 8;
const PROGRESS_DAMPING = 5;
const MAX_DT = 0.05;
const COLORS = { paper: '#faf9f5', shade: '#e6e2d9', ink: '#111111', red: '#e52222', grid: 'rgba(17,17,17,0.08)' };

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v, a, b) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const PLACE_VECS = Object.fromEntries(Object.entries(PLACES).map(([k, p]) => [k, latLonToVec(p.lat, p.lon)]));

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

function viewAt(progress) {
  const spin = smooth(progress, 0, 0.85);
  return {
    lon: lerp(VIEW.startLon, VIEW.endLon, spin),
    tilt: lerp(VIEW.startTilt, VIEW.endTilt, spin),
    eu: smooth(progress, 0.3, 0.72),
    us: smooth(progress, 0.48, 0.98),
  };
}

function measure(figure) {
  const w = figure.clientWidth;
  const h = figure.clientHeight;
  return { w, h, cx: w / 2, cy: h * CENTER_Y_FRACTION, r: Math.min(w, h) * RADIUS_FRACTION };
}

function scrollProgress(figure) {
  const rect = figure.getBoundingClientRect();
  return clamp01((innerHeight - rect.top) / (innerHeight / 2 + rect.height / 2));
}

/* ---------- HTML pins and rim ---------- */

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

function placePins(pins, view, box) {
  pins.forEach((pin) => {
    const [x, y, z] = rotateView(PLACE_VECS[pin.key], view.lon, view.tilt);
    const px = box.cx + x * box.r;
    const py = box.cy - y * box.r;
    const drawn = pin.key === 'alex' ? 1 : view[pin.key];
    pin.el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
    pin.el.dataset.side = pinSide(pin, px, box);
    pin.el.classList.toggle('is-hidden', z < PIN_MIN_Z || drawn < 0.96);
  });
}

function placeRim(rim, box) {
  rim.style.width = rim.style.height = `${(box.r * 2).toFixed(1)}px`;
  rim.style.transform = `translate(${(box.cx - box.r).toFixed(1)}px, ${(box.cy - box.r).toFixed(1)}px)`;
}

/* ---------- Flat renderer (reduced motion, no WebGL) ---------- */

function drawFlatArc(ctx, points, view, box) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const [x, y] = rotateView(p, view.lon, view.tilt);
    const px = box.cx + x * box.r, py = box.cy - y * box.r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function drawFlatSphere(ctx, box) {
  const shade = ctx.createRadialGradient(box.cx, box.cy, box.r * 0.55, box.cx, box.cy, box.r);
  shade.addColorStop(0, COLORS.paper);
  shade.addColorStop(1, COLORS.shade);
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(box.cx, box.cy, box.r, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlatDots(ctx, dots, view, box) {
  const dot = Math.max(1, box.r / 150);
  dots.forEach((v) => {
    const [x, y, z] = rotateView(v, view.lon, view.tilt);
    if (z <= 0) return;
    ctx.fillStyle = `rgba(17,17,17,${(0.25 + z * 0.6).toFixed(2)})`;
    ctx.fillRect(box.cx + x * box.r - dot / 2, box.cy - y * box.r - dot / 2, dot, dot);
  });
}

function createFlatRenderer(canvas, dots, arcs) {
  const ctx = canvas.getContext('2d');
  return {
    resize(box) {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(box.w * dpr);
      canvas.height = Math.round(box.h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    render(view, box) {
      ctx.clearRect(0, 0, box.w, box.h);
      drawFlatSphere(ctx, box);
      drawFlatDots(ctx, dots, view, box);
      ctx.lineWidth = Math.max(2, box.r * ARC_TUBE * 2);
      ctx.strokeStyle = COLORS.red;
      arcs.forEach((points) => drawFlatArc(ctx, points, view, box));
    },
    isAnimated: false,
  };
}

/* ---------- WebGL renderer ---------- */

const SPHERE_VERTEX = `
  varying vec3 vNormal; varying vec3 vObj;
  void main() { vNormal = normalize(normalMatrix * normal); vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SPHERE_FRAGMENT = `
  varying vec3 vNormal; varying vec3 vObj;
  void main() {
    float rim = 1.0 - max(vNormal.z, 0.0);
    float lat = asin(clamp(vObj.y / 0.992, -1.0, 1.0));
    float lon = atan(vObj.x, vObj.z);
    float step15 = 0.2618;
    float gLat = abs(fract(lat / step15 + 0.5) - 0.5) * step15;
    float gLon = abs(fract(lon / step15 + 0.5) - 0.5) * step15 * cos(lat);
    float grid = clamp((1.0 - smoothstep(0.0, 0.004, gLat)) + (1.0 - smoothstep(0.0, 0.004, gLon)), 0.0, 1.0);
    vec3 col = mix(vec3(0.980, 0.976, 0.961), vec3(0.902, 0.886, 0.851), pow(rim, 2.2) * 0.9);
    col = mix(col, vec3(0.067), grid * 0.08 * (1.0 - rim));
    gl_FragColor = vec4(col, 1.0);
  }`;
const DOT_VERTEX = `
  uniform float uDotPx; uniform vec3 uAlexDir;
  varying float vAlpha; varying float vHot;
  void main() {
    vec3 n = normalize(normalMatrix * position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    float d = distance(position, uAlexDir);
    vHot = exp(-d * d * 60.0);
    vAlpha = smoothstep(0.0, 0.35, n.z);
    gl_PointSize = uDotPx * (0.6 + 0.4 * n.z);
  }`;
const DOT_FRAGMENT = `
  varying float vAlpha; varying float vHot;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.3, d) * vAlpha;
    vec3 col = mix(vec3(0.067), vec3(0.898, 0.133, 0.133), vHot);
    gl_FragColor = vec4(col, a * (0.82 + vHot * 0.18));
  }`;
const ARC_VERTEX = `
  varying float vT;
  void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ARC_FRAGMENT = `
  uniform float uDraw; uniform float uTime; varying float vT;
  void main() {
    if (vT > uDraw) discard;
    float pulse = pow(fract(vT * 1.4 - uTime * 0.22), 18.0);
    gl_FragColor = vec4(mix(vec3(0.898, 0.133, 0.133), vec3(0.42, 0.04, 0.05), pulse), 1.0);
  }`;

function createSphere(THREE) {
  const material = new THREE.ShaderMaterial({ vertexShader: SPHERE_VERTEX, fragmentShader: SPHERE_FRAGMENT });
  return new THREE.Mesh(new THREE.SphereGeometry(0.992, 64, 48), material);
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
  const material = new THREE.ShaderMaterial({
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    uniforms: { uDraw: { value: 0 }, uTime: { value: 0 } },
  });
  return new THREE.Mesh(new THREE.TubeGeometry(curve, ARC_STEPS * 2, ARC_TUBE, 6, false), material);
}

async function createGlRenderer(canvas, dots, arcs) {
  const THREE = await import('../vendor/three.module.min.js');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -5000, 5000);
  const globe = new THREE.Group();
  const spin = new THREE.Group();
  const points = createDots(THREE, dots);
  const arcMeshes = arcs.map((p) => createArc(THREE, p));
  spin.add(createSphere(THREE), points, ...arcMeshes);
  globe.add(spin);
  scene.add(globe);
  return {
    resize(box) {
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
      renderer.setSize(box.w, box.h, false);
      Object.assign(camera, { left: -box.w / 2, right: box.w / 2, top: box.h / 2, bottom: -box.h / 2 });
      camera.updateProjectionMatrix();
      globe.position.set(box.cx - box.w / 2, box.h / 2 - box.cy, 0);
      globe.scale.setScalar(box.r);
      points.material.uniforms.uDotPx.value = Math.max(1.6, box.r / 120) * renderer.getPixelRatio();
    },
    render(view, box, time) {
      spin.rotation.set(view.tilt * DEG, -view.lon * DEG, 0);
      arcMeshes[0].material.uniforms.uDraw.value = view.eu;
      arcMeshes[1].material.uniforms.uDraw.value = view.us;
      arcMeshes.forEach((m) => { m.material.uniforms.uTime.value = time; });
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
  const rim = figure.querySelector('.globe__rim');
  const dots = landPoints(NARROW.matches ? DOT_SAMPLES.narrow : DOT_SAMPLES.wide).map(([lat, lon]) => latLonToVec(lat, lon));
  const arcs = [arcPoints(PLACE_VECS.alex, PLACE_VECS.eu), arcPoints(PLACE_VECS.alex, PLACE_VECS.us)];
  const renderer = await createRenderer(canvas, dots, arcs);
  const pins = createPins(figure);
  let box = measure(figure);
  let progress = renderer.isAnimated ? scrollProgress(figure) : 1;

  const draw = (time = 0) => {
    const view = viewAt(progress);
    renderer.render(view, box, time);
    placePins(pins, view, box);
  };
  const resize = () => {
    box = measure(figure);
    renderer.resize(box);
    measurePins(pins);
    placeRim(rim, box);
    draw();
  };

  figure.classList.add('is-live');
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
