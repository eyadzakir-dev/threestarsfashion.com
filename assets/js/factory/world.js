// Procedural factory world in the site palette. Everything is built from boxes and cylinders,
// merged per material or drawn with InstancedMesh.
import * as THREE from '../vendor/three.module.min.js';

export const PALETTE = {
  ground: '#e2dfd7',
  floor: '#ebe8e1',
  paper: '#faf9f5',
  roof: '#d6d3cc',
  disc: '#e1ddd4',
  stone: '#d5d1c8',
  steel: '#a19f98',
  frame: '#262624',
  frameSoft: '#5a5954',
  ink: '#141414',
  red: '#e52222',
  mark: '#e52222',
  glow: '#ffe6bd',
  kraft: '#c4a57c',
  bed: '#cfccc5',
};

// Flow runs west to east: knitting, dyeing, cutting, sewing, embellishment, warehouse, dock.
export const LAYOUT = {
  building: { x0: -86, x1: 244, z0: -50, z1: 50, wallH: 3.2, shellH: 9, roofBays: 18 },
  partitions: { xs: [-46, -6, 38, 145, 190], h: 1.4, gap: [-6, 6] },
  knitting: { xs: [-80, -74, -68, -62, -56], zs: [-40, -34, -28, -22, -16, -10, 10, 16, 22, 28, 34, 40] },
  dyeing: { xs: [-37, -26, -15], zs: [-30, -20, -11, 11, 20, 30], stenter: { x0: -42, x1: -12, z: -43 } },
  cutting: { x0: 2, tableLen: 24, tables: [-26, -18, -10, 10, 18, 26] },
  // 70 × 50 = 3,500 stations, one per sewing machine in the group.
  sewing: { x0: 50, cols: 70, rows: 50, pitchX: 1.25, pairPitch: 3.6, aisleEvery: 35, aisleW: 4 },
  printing: { xs: [156, 167, 178], zs: [-7, 7], radius: 3.4, arms: 8 },
  embroidery: { x: 167, zs: [-20, -27, -34, -41], length: 16, heads: 20 },
  warehouse: { x0: 196, x1: 236, z0: -44, z1: 44, rowPitch: 6.4, bay: 2.7, levels: 4, levelH: 1.35 },
  dock: { wallX: 244, doors: [-12, 0, 12], doorW: 4.4, doorH: 4.2 },
};

export const SEWING_TOTAL = LAYOUT.sewing.cols * LAYOUT.sewing.rows;

const AO_MIN = 0.58;
const AO_HEIGHT = 1.1;
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const tmpColor = new THREE.Color();
const tmpVec = new THREE.Vector3();
const tmpNormal = new THREE.Vector3();
const tmpNormalMatrix = new THREE.Matrix3();

function smoothstep(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Accumulates transformed, vertex-coloured parts into one indexed geometry.
// Ambient occlusion is baked into vertex colours from height above the floor.
export class GeometryBuilder {
  constructor({ ao = true } = {}) {
    this.positions = [];
    this.normals = [];
    this.colors = [];
    this.indices = [];
    this.ao = ao;
  }

  add(geometry, matrix, color) {
    const pos = geometry.attributes.position;
    const nrm = geometry.attributes.normal;
    const base = this.positions.length / 3;
    tmpNormalMatrix.getNormalMatrix(matrix);
    tmpColor.set(color);
    for (let i = 0; i < pos.count; i++) {
      tmpVec.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      tmpNormal.fromBufferAttribute(nrm, i).applyMatrix3(tmpNormalMatrix).normalize();
      const shade = this.ao ? AO_MIN + (1 - AO_MIN) * smoothstep(0, AO_HEIGHT, tmpVec.y) : 1;
      this.positions.push(tmpVec.x, tmpVec.y, tmpVec.z);
      this.normals.push(tmpNormal.x, tmpNormal.y, tmpNormal.z);
      this.colors.push(tmpColor.r * shade, tmpColor.g * shade, tmpColor.b * shade);
    }
    const index = geometry.index;
    const count = index ? index.count : pos.count;
    for (let i = 0; i < count; i++) this.indices.push(base + (index ? index.getX(i) : i));
    return this;
  }

  // Box whose base sits at y.
  box(w, h, d, x, y, z, color, rotY = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y + h / 2, z),
      new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY),
      new THREE.Vector3(w, h, d),
    );
    return this.add(UNIT_BOX, m, color);
  }

  cylinder(r, h, x, y, z, color, segments = 10, axis = 'y') {
    const geo = new THREE.CylinderGeometry(r, r, h, segments, 1);
    const m = new THREE.Matrix4();
    if (axis === 'x') m.makeRotationZ(Math.PI / 2);
    if (axis === 'z') m.makeRotationX(Math.PI / 2);
    m.setPosition(x, axis === 'y' ? y + h / 2 : y, z);
    this.add(geo, m, color);
    geo.dispose();
    return this;
  }

  sphere(r, x, y, z, color) {
    const geo = new THREE.IcosahedronGeometry(r, 1);
    this.add(geo, new THREE.Matrix4().makeTranslation(x, y, z), color);
    geo.dispose();
    return this;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- Materials ----------

export function createClayMaterial(options = {}) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0, ...options });
}

// Grows instances from the floor in gl_InstanceID order as uReveal advances.
const REVEAL_CHUNK = `#include <begin_vertex>
  float revealT = clamp((uReveal - float(gl_InstanceID)) / uGrow, 0.0, 1.0);
  revealT = revealT * revealT * (3.0 - 2.0 * revealT);
  transformed *= revealT;`;

function patchReveal(material, uniforms, key) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = uniforms.uReveal;
    shader.uniforms.uGrow = uniforms.uGrow;
    shader.vertexShader = 'uniform float uReveal;\nuniform float uGrow;\n'
      + shader.vertexShader.replace('#include <begin_vertex>', REVEAL_CHUNK);
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function createRevealMaterials(uniforms, options = {}) {
  const surface = patchReveal(createClayMaterial(options), uniforms, 'reveal-surface');
  const depth = patchReveal(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uniforms, 'reveal-depth');
  return { surface, depth };
}

// ---------- Static architecture ----------

function addWallRun(b, x0, z0, x1, z1, h, gaps = []) {
  const T = 0.5;
  const isX = z0 === z1;
  const from = isX ? x0 : z0;
  const to = isX ? x1 : z1;
  const segments = [];
  let cursor = from;
  gaps.slice().sort((a, c) => a[0] - c[0]).forEach(([g0, g1]) => {
    if (g0 > cursor) segments.push([cursor, g0]);
    cursor = g1;
  });
  if (cursor < to) segments.push([cursor, to]);
  segments.forEach(([a, c]) => {
    const len = c - a;
    const mid = (a + c) / 2;
    if (isX) {
      b.box(len, h, T, mid, 0, z0, PALETTE.paper);
      b.box(len, 0.06, T + 0.02, mid, h, z0, PALETTE.frame);
    } else {
      b.box(T, h, len, x0, 0, mid, PALETTE.paper);
      b.box(T + 0.02, 0.06, len, x0, h, mid, PALETTE.frame);
    }
  });
}

function doorGaps() {
  const { doors, doorW } = LAYOUT.dock;
  return doors.map((z) => [z - doorW / 2, z + doorW / 2]);
}

export function buildArchitecture() {
  const { x0, x1, z0, z1, wallH } = LAYOUT.building;
  const b = new GeometryBuilder({ ao: false });
  b.box(x1 - x0, 0.1, z1 - z0, (x0 + x1) / 2, -0.1, (z0 + z1) / 2, PALETTE.floor);
  addWallRun(b, x0, z0, x1, z0, wallH);
  addWallRun(b, x0, z1, x1, z1, wallH);
  addWallRun(b, x0, z0, x0, z1, wallH);
  addWallRun(b, x1, z0, x1, z1, wallH, doorGaps());
  // Zone partitions with flow openings.
  const { xs, h, gap } = LAYOUT.partitions;
  xs.forEach((px) => addWallRun(b, px, z0, px, z1, h, [gap]));
  addFloorMarkings(b);
  return b.build();
}

function addFloorMarkings(b) {
  const Y = 0.001;
  const LINE = 0.1;
  const WALL_CLEAR = 2;
  const { x0, x1, z0, z1 } = LAYOUT.building;
  // Main transfer aisle along the flow.
  const aisleX0 = x0 + WALL_CLEAR;
  const aisleX1 = LAYOUT.warehouse.x1 + WALL_CLEAR * 2;
  [-2.6, 2.6].forEach((z) => b.box(aisleX1 - aisleX0, 0.01, LINE, (aisleX0 + aisleX1) / 2, Y, z, PALETTE.mark));
  // Sewing cross aisles.
  const s = LAYOUT.sewing;
  const midX = s.x0 + s.aisleEvery * s.pitchX + s.aisleW / 2 - s.pitchX / 2;
  [midX - s.aisleW / 2, midX + s.aisleW / 2].forEach((x) => b.box(LINE, 0.01, z1 - z0 - 8, x, Y, 0, PALETTE.mark));
}

// Building upper walls and roof: lifted off as the camera enters.
export function buildShell() {
  const { x0, x1, z0, z1, wallH, shellH, roofBays } = LAYOUT.building;
  const b = new GeometryBuilder({ ao: false });
  const h = shellH - wallH;
  const T = 0.52;
  b.box(x1 - x0, h, T, (x0 + x1) / 2, wallH, z0, PALETTE.paper);
  b.box(x1 - x0, h, T, (x0 + x1) / 2, wallH, z1, PALETTE.paper);
  b.box(T, h, z1 - z0, x0, wallH, 0, PALETTE.paper);
  b.box(T, h, z1 - z0, x1, wallH, 0, PALETTE.paper);
  b.box(x1 - x0 + 0.6, 0.35, z1 - z0 + 0.6, (x0 + x1) / 2, shellH, 0, PALETTE.roof);
  b.box(x1 - x0 + 0.9, 0.5, 0.3, (x0 + x1) / 2, shellH, z1 + 0.3, PALETTE.paper);
  b.box(x1 - x0 + 0.9, 0.5, 0.3, (x0 + x1) / 2, shellH, z0 - 0.3, PALETTE.paper);
  addSawtoothRoof(b, x0, x1, z0, z1, shellH + 0.35, roofBays);
  addWindowBand(b, x0, x1, z1 + 0.3, shellH * 0.62, PALETTE.frameSoft);
  return b.build();
}

function addSawtoothRoof(b, x0, x1, z0, z1, y, count) {
  const pitch = (x1 - x0) / count;
  for (let i = 0; i < count; i++) {
    const cx = x0 + pitch * (i + 0.5);
    b.box(pitch * 0.1, 1.4, z1 - z0 - 6, cx + pitch * 0.36, y, 0, PALETTE.frameSoft);
    b.box(pitch * 0.72, 0.55, z1 - z0 - 6, cx - pitch * 0.05, y, 0, PALETTE.paper);
  }
}

function addWindowBand(b, x0, x1, z, y, color) {
  const W = 5;
  for (let x = x0 + 6; x < x1 - 6; x += W * 1.6) b.box(W, 1.1, 0.12, x + W / 2, y, z, color);
}

// ---------- Cutting ----------

function addCuttingTable(b, z) {
  const { x0, tableLen } = LAYOUT.cutting;
  const W = 2.3;
  const cx = x0 + tableLen / 2 + 3;
  b.box(tableLen, 0.78, W, cx, 0, z, PALETTE.frame);
  b.box(tableLen + 0.1, 0.06, W + 0.1, cx, 0.78, z, PALETTE.bed);
  const plies = [PALETTE.paper, PALETTE.frameSoft, PALETTE.paper, PALETTE.stone, PALETTE.paper, PALETTE.frameSoft];
  plies.forEach((c, i) => b.box(tableLen * 0.7, 0.022, W * 0.86, cx + tableLen * 0.1, 0.84 + i * 0.022, z, c));
  addMarkerOutlines(b, cx + tableLen * 0.1, z, tableLen * 0.7, W * 0.86, 0.84 + plies.length * 0.022);
  // Spreader roll cradle at the head of the table.
  b.box(1.2, 1.1, W + 0.4, x0 + 2.4, 0, z, PALETTE.frameSoft);
  b.cylinder(0.32, W * 0.9, x0 + 2.4, 1.45, z, PALETTE.paper, 14, 'z');
  // Control desk.
  b.box(0.9, 1.05, 0.7, cx + tableLen / 2 + 0.2, 0, z + W / 2 + 0.6, PALETTE.ink);
  b.box(0.6, 0.4, 0.05, cx + tableLen / 2 + 0.2, 1.1, z + W / 2 + 0.45, PALETTE.steel);
}

// CAD marker: nested pattern-piece outlines drawn on the top ply.
function addMarkerOutlines(b, cx, cz, len, width, y) {
  const COLS = 9;
  const LINE = 0.025;
  const pieceW = len / COLS;
  for (let i = 0; i < COLS; i++) {
    const px = cx - len / 2 + pieceW * (i + 0.5);
    const tall = i % 2 === 0;
    const w = pieceW * 0.82;
    const d = width * (tall ? 0.8 : 0.36);
    const offsets = tall ? [0] : [-width * 0.22, width * 0.22];
    offsets.forEach((oz) => {
      b.box(w, 0.004, LINE, px, y, cz + oz - d / 2, PALETTE.frameSoft);
      b.box(w, 0.004, LINE, px, y, cz + oz + d / 2, PALETTE.frameSoft);
      b.box(LINE, 0.004, d, px - w / 2, y, cz + oz, PALETTE.frameSoft);
      b.box(LINE, 0.004, d, px + w / 2, y, cz + oz, PALETTE.frameSoft);
    });
  }
}

export function buildCuttingStatic() {
  const b = new GeometryBuilder();
  LAYOUT.cutting.tables.forEach((z) => addCuttingTable(b, z));
  // Fabric roll racks along the rear wall.
  for (let i = 0; i < 9; i++) {
    const x = 4 + i * 3.4;
    b.box(3, 0.1, 1.4, x, 1.2, -46, PALETTE.steel);
    for (let k = 0; k < 3; k++) b.cylinder(0.26, 2.6, x, 1.62 + 0, -46.4 + k * 0.45, k === 1 ? PALETTE.frameSoft : PALETTE.paper, 10, 'x');
  }
  return b.build();
}

// One gantry + red cutter head per table, animated in the loop.
export function buildCutterGantry() {
  const W = 2.3;
  const b = new GeometryBuilder({ ao: false });
  b.box(0.7, 0.26, W + 0.7, 0, 1.18, 0, PALETTE.ink);
  b.box(0.5, 0.36, 0.3, 0, 0.82, -W / 2 - 0.2, PALETTE.ink);
  b.box(0.5, 0.36, 0.3, 0, 0.82, W / 2 + 0.2, PALETTE.ink);
  b.box(0.6, 0.06, 0.2, 0, 1.44, W / 2 + 0.1, PALETTE.mark);
  const head = new GeometryBuilder({ ao: false });
  head.box(0.46, 0.5, 0.46, 0, 0.95, 0, PALETTE.red);
  head.box(0.16, 0.12, 0.16, 0, 0.86, 0, PALETTE.ink);
  return { gantry: b.build(), head: head.build() };
}

// ---------- Sewing ----------

export function buildStationGeometry() {
  const b = new GeometryBuilder();
  b.box(1.1, 0.05, 0.62, 0, 0.72, 0, PALETTE.paper);
  b.box(1.0, 0.56, 0.04, 0, 0.14, -0.26, PALETTE.stone);
  b.box(0.05, 0.72, 0.56, -0.5, 0, 0, PALETTE.stone);
  b.box(0.05, 0.72, 0.56, 0.5, 0, 0, PALETTE.stone);
  b.box(0.46, 0.1, 0.2, -0.05, 0.77, -0.04, PALETTE.frame);
  b.box(0.1, 0.26, 0.17, 0.15, 0.87, -0.04, PALETTE.frame);
  b.box(0.36, 0.09, 0.15, 0.01, 1.1, -0.04, PALETTE.frame);
  b.cylinder(0.03, 0.08, 0.17, 1.19, -0.08, PALETTE.red, 6);
  b.box(0.36, 0.05, 0.34, 0, 0.44, 0.58, PALETTE.frameSoft);
  b.box(0.26, 0.02, 0.22, -0.28, 0.77, 0.12, PALETTE.paper);
  return b.build();
}

export function buildOperatorGeometry() {
  const b = new GeometryBuilder();
  const body = new THREE.CylinderGeometry(0.13, 0.19, 0.56, 9, 1);
  b.add(body, new THREE.Matrix4().makeTranslation(0, 0.76, 0.58), '#ffffff');
  body.dispose();
  b.sphere(0.11, 0, 1.17, 0.56, '#ffffff');
  return b.build();
}

// Station transforms, sorted outward from a focus station so gl_InstanceID
// order doubles as the reveal order.
export function computeStationLayout() {
  const s = LAYOUT.sewing;
  const items = [];
  const zStart = -((s.rows / 2) * s.pairPitch) / 2 + s.pairPitch / 2;
  for (let col = 0; col < s.cols; col++) {
    const aisle = col >= s.aisleEvery ? s.aisleW : 0;
    const x = s.x0 + col * s.pitchX + aisle;
    for (let row = 0; row < s.rows; row++) {
      const pair = Math.floor(row / 2);
      const facesBack = row % 2 === 1;
      const z = zStart + pair * s.pairPitch + (facesBack ? -0.36 : 0.36);
      items.push({ x, z, rotY: facesBack ? Math.PI : 0 });
    }
  }
  const focus = items.find((it) => it.x === s.x0 && it.rotY === 0 && Math.abs(it.z) < s.pairPitch / 2 + 0.5)
    || items[0];
  const jitter = (i) => ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 3;
  items.forEach((it, i) => { it.d = Math.hypot(it.x - focus.x, (it.z - focus.z) * 1.15) + Math.abs(jitter(i)); });
  focus.d = -1;
  items.sort((a, c) => a.d - c.d);
  return { items, focus };
}

export function createSewingHall(uniforms) {
  const { items, focus } = computeStationLayout();
  const stationMat = createRevealMaterials(uniforms);
  const operatorMat = createRevealMaterials(uniforms);
  const stations = new THREE.InstancedMesh(buildStationGeometry(), stationMat.surface, items.length);
  const operators = new THREE.InstancedMesh(buildOperatorGeometry(), operatorMat.surface, items.length);
  stations.customDepthMaterial = stationMat.depth;
  operators.customDepthMaterial = operatorMat.depth;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const garments = ['#f6f4ef', '#262624', '#d8d5ce', '#5a5954', '#f6f4ef', '#b8342f', '#e9e6df'].map((c) => new THREE.Color(c));
  items.forEach((it, i) => {
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.rotY);
    m.compose(new THREE.Vector3(it.x, 0, it.z), q, one);
    stations.setMatrixAt(i, m);
    operators.setMatrixAt(i, m);
    operators.setColorAt(i, garments[(i * 7 + (i >> 3)) % garments.length]);
  });
  [stations, operators].forEach((mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
  });
  const group = new THREE.Group();
  group.add(stations, operators);
  return { group, focus };
}

// ---------- Printing ----------

export function buildCarouselBase() {
  const b = new GeometryBuilder();
  const { xs, zs, radius, arms } = LAYOUT.printing;
  xs.forEach((x) => zs.forEach((z) => {
    b.cylinder(radius + 0.9, 0.04, x, 0, z, PALETTE.disc, 32);
    b.cylinder(0.55, 1.9, x, 0, z, PALETTE.frame, 16);
    b.cylinder(0.9, 0.3, x, 0, z, PALETTE.frameSoft, 16);
    // Fixed print heads on an upper ring.
    for (let a = 1; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2;
      const hx = x + Math.cos(ang) * (radius - 0.5);
      const hz = z + Math.sin(ang) * (radius - 0.5);
      const armLen = radius - 0.9;
      b.box(armLen, 0.1, 0.12, x + Math.cos(ang) * (armLen / 2 + 0.4), 1.86, z + Math.sin(ang) * (armLen / 2 + 0.4), PALETTE.frameSoft, -ang);
      b.box(0.56, 0.36, 0.7, hx, 1.56, hz, PALETTE.steel, -ang);
      b.box(0.58, 0.06, 0.16, hx, 1.5, hz, a % 3 === 0 ? PALETTE.red : PALETTE.frame, -ang);
    }
    b.cylinder(0.7, 0.24, x, 1.8, z, PALETTE.frame, 16);
  }));
  return b.build();
}

export function buildCarouselRotor() {
  const b = new GeometryBuilder({ ao: false });
  const { radius, arms } = LAYOUT.printing;
  for (let a = 0; a < arms; a++) {
    const ang = (a / arms) * Math.PI * 2;
    const cx = Math.cos(ang);
    const cz = Math.sin(ang);
    b.box(radius - 0.6, 0.08, 0.12, cx * (radius / 2 + 0.1), 1.18, cz * (radius / 2 + 0.1), PALETTE.steel, -ang);
    b.box(0.6, 0.05, 0.8, cx * (radius - 0.5), 1.26, cz * (radius - 0.5), PALETTE.paper, -ang);
    if (a % 2 === 0) b.box(0.26, 0.012, 0.3, cx * (radius - 0.5), 1.31, cz * (radius - 0.5), PALETTE.red, -ang);
  }
  return b.build();
}

export function carouselCenters() {
  const { xs, zs } = LAYOUT.printing;
  return xs.flatMap((x) => zs.map((z) => new THREE.Vector3(x, 0, z)));
}

// ---------- Warehouse ----------

function warehouseRows() {
  const w = LAYOUT.warehouse;
  const rows = [];
  for (let z = w.z0; z <= w.z1; z += w.rowPitch) {
    if (Math.abs(z) < 3.5) continue;
    rows.push(z);
  }
  return rows;
}

export function buildRacks() {
  const w = LAYOUT.warehouse;
  const b = new GeometryBuilder();
  const len = w.x1 - w.x0;
  const top = w.levels * w.levelH;
  warehouseRows().forEach((z) => {
    for (let x = w.x0; x <= w.x1 + 0.01; x += w.bay) {
      b.box(0.1, top + 0.4, 0.1, x, 0, z - 0.55, PALETTE.steel);
      b.box(0.1, top + 0.4, 0.1, x, 0, z + 0.55, PALETTE.steel);
    }
    for (let l = 1; l <= w.levels; l++) {
      const y = l * w.levelH - 0.6;
      b.box(len, 0.1, 0.08, w.x0 + len / 2, y, z - 0.56, PALETTE.frame);
      b.box(len, 0.1, 0.08, w.x0 + len / 2, y, z + 0.56, PALETTE.frame);
    }
  });
  return b.build();
}

export function createWarehouseStock() {
  const w = LAYOUT.warehouse;
  const rolls = [];
  const cartons = [];
  warehouseRows().forEach((z, rowIndex) => {
    const isFabric = rowIndex % 3 !== 2;
    for (let x = w.x0 + w.bay / 2; x < w.x1; x += w.bay) {
      for (let l = 0; l <= w.levels - 1; l++) {
        const y = l === 0 ? 0 : l * w.levelH - 0.5;
        (isFabric ? rolls : cartons).push({ x, y, z, seed: rolls.length + cartons.length });
      }
    }
  });
  const rollGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.05, 10, 1).rotateZ(Math.PI / 2);
  const rollMesh = new THREE.InstancedMesh(rollGeo, createClayMaterial({ vertexColors: false, color: PALETTE.paper }), rolls.length * 4);
  const cartonMesh = new THREE.InstancedMesh(UNIT_BOX, createClayMaterial({ vertexColors: false, color: '#ffffff' }), cartons.length * 4);
  const m = new THREE.Matrix4();
  let r = 0;
  rolls.forEach(({ x, y, z }) => {
    for (let k = 0; k < 4; k++) {
      const kx = (k % 2) * 1.2 - 0.6;
      const layer = Math.floor(k / 2);
      m.makeTranslation(x + kx, y + 0.29 + layer * 0.55, z);
      rollMesh.setMatrixAt(r++, m);
    }
  });
  const cartonColors = [PALETTE.kraft, '#d3b88f', PALETTE.kraft, PALETTE.paper].map((c) => new THREE.Color(c));
  let c = 0;
  cartons.forEach(({ x, y, z, seed }) => {
    for (let k = 0; k < 4; k++) {
      const kx = (k % 2) * 1.2 - 0.6;
      const ky = Math.floor(k / 2) * 0.46;
      m.compose(new THREE.Vector3(x + kx, y + 0.23 + ky, z), new THREE.Quaternion(), new THREE.Vector3(1.1, 0.44, 0.9));
      cartonMesh.setMatrixAt(c, m);
      cartonMesh.setColorAt(c, cartonColors[(seed + k) % cartonColors.length]);
      c++;
    }
  });
  [rollMesh, cartonMesh].forEach((mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; });
  return [rollMesh, cartonMesh];
}

// ---------- Dock ----------

const DOCK_FLOOR_Y = 1.2;
const FACE_CLEAR = 0.006;
const JAMB_DEPTH = 0.7;
const JAMB_WIDTH = 0.3;
const JAMB_HEADER_H = 0.3;
const TRAILER_WIDTH = 2.44;
const TRAILER_HEIGHT = 2.6;
const TRAILER_LENGTH = 12.2;
const TRAILER_WALL = 0.08;
const TRAILER_LINER = 0.03;
const TRAILER_RIB = 0.36;
const CHASSIS_Y = 0.85;
const CHASSIS_H = DOCK_FLOOR_Y - CHASSIS_Y;
const CHASSIS_INSET = 0.2;
const ROLLER_RADIUS = 0.05;
const ROLLER_PROUD = 0.09;
const CONVEYOR_RUN = 18;
const CONVEYOR_FRAME_H = DOCK_FLOOR_Y - ROLLER_PROUD;
const SIDE_TOP_LIFT = FACE_CLEAR * 2;
const ROOF_TOP_LIFT = FACE_CLEAR;
const FRONT_TOP_LIFT = FACE_CLEAR * 3;

function addUndercarriage(b, { x, z, length, isOpenRear }) {
  // Open-deck chassis stops short of the floor panel so the two tops do not share a plane.
  const height = isOpenRear ? CHASSIS_H - FACE_CLEAR : CHASSIS_H;
  const half = TRAILER_WIDTH / 2;
  b.box(length, height, TRAILER_WIDTH - CHASSIS_INSET, x + length / 2, CHASSIS_Y, z, PALETTE.ink);
  [0.12, 0.3, 0.82, 0.9].forEach((f) => {
    b.cylinder(0.46, 0.3, x + length * f, 0.46, z - half + 0.2, PALETTE.ink, 12, 'z');
    b.cylinder(0.46, 0.3, x + length * f, 0.46, z + half - 0.2, PALETTE.ink, 12, 'z');
  });
}

function addTrailerRibs(b, { x, z, color, length }) {
  const y = DOCK_FLOOR_Y + 0.1;
  const h = TRAILER_HEIGHT - 0.2;
  const half = TRAILER_WIDTH / 2;
  for (let rx = x + 0.3; rx < x + length - 0.2; rx += TRAILER_RIB) {
    b.box(0.12, h, 0.05, rx, y, z - half - 0.02, color);
    b.box(0.12, h, 0.05, rx, y, z + half + 0.02, color);
  }
}

function addTractor(b, { x, z, length }) {
  const nose = x + length;
  const half = TRAILER_WIDTH / 2;
  b.box(2.6, 2.3, TRAILER_WIDTH, nose + 1.7, 0.7, z, PALETTE.frame);
  b.box(0.08, 0.9, TRAILER_WIDTH - 0.4, nose + 3.0, 2.0, z, PALETTE.steel);
  b.cylinder(0.5, 0.34, nose + 2.2, 0.5, z - half + 0.1, PALETTE.ink, 12, 'z');
  b.cylinder(0.5, 0.34, nose + 2.2, 0.5, z + half - 0.1, PALETTE.ink, 12, 'z');
}

function addTrailerLiner(b, { x, z, length }) {
  const gap = FACE_CLEAR;
  const t = TRAILER_LINER;
  const inner = TRAILER_WIDTH / 2 - TRAILER_WALL - gap;
  const y0 = DOCK_FLOOR_Y + gap;
  const y1 = DOCK_FLOOR_Y + TRAILER_HEIGHT + ROOF_TOP_LIFT - TRAILER_WALL - gap;
  const x0 = x + gap;
  const x1 = x + length - TRAILER_WALL - gap;
  const span = x1 - x0 - t - gap;
  const across = (inner - t - gap) * 2;
  b.box(x1 - x0, y1 - y0, t, (x0 + x1) / 2, y0, z - inner + t / 2, PALETTE.ink);
  b.box(x1 - x0, y1 - y0, t, (x0 + x1) / 2, y0, z + inner - t / 2, PALETTE.ink);
  b.box(span, t, across, x0 + span / 2, y1 - t - gap, z, PALETTE.ink);
  b.box(t, y1 - y0 - t - gap * 2, across, x1 - t - gap, y0, z, PALETTE.ink);
}

// Hollow shell. The rear (min x) is open toward the dock; panel tops nest into the roof cap
// at distinct heights so none of them share its plane.
function addOpenTrailerBody(b, trailer) {
  const { x, z, color, length } = trailer;
  const wall = TRAILER_WALL;
  const gap = FACE_CLEAR;
  const half = TRAILER_WIDTH / 2;
  const y0 = DOCK_FLOOR_Y;
  const y1 = y0 + TRAILER_HEIGHT;
  const innerW = TRAILER_WIDTH - wall * 2;
  const deck = length - wall - gap;
  const roofL = length - wall;
  b.box(deck, wall, innerW, x + gap + deck / 2, y0 - wall, z, color);
  b.box(length, TRAILER_HEIGHT + SIDE_TOP_LIFT, wall, x + length / 2, y0, z - half + wall / 2, color);
  b.box(length, TRAILER_HEIGHT + SIDE_TOP_LIFT, wall, x + length / 2, y0, z + half - wall / 2, color);
  b.box(roofL, wall, innerW, x + roofL / 2, y1 + ROOF_TOP_LIFT - wall, z, color);
  b.box(wall, TRAILER_HEIGHT + FRONT_TOP_LIFT, innerW, x + length - wall / 2, y0, z, color);
  addTrailerLiner(b, trailer);
}

function addContainer(b, x, z, options = {}) {
  const trailer = {
    x,
    z,
    color: options.color ?? PALETTE.frame,
    length: options.length ?? TRAILER_LENGTH,
    isOpenRear: Boolean(options.isOpenRear),
  };
  addUndercarriage(b, trailer);
  if (trailer.isOpenRear) addOpenTrailerBody(b, trailer);
  else b.box(trailer.length, TRAILER_HEIGHT, TRAILER_WIDTH, x + trailer.length / 2, DOCK_FLOOR_Y, z, trailer.color);
  addTrailerRibs(b, trailer);
  b.box(trailer.length + 0.05, 0.12, TRAILER_WIDTH + 0.1, x + trailer.length / 2, DOCK_FLOOR_Y + TRAILER_HEIGHT, z, trailer.color);
  addTractor(b, trailer);
}

export function buildDock() {
  const { wallX, doors, doorW, doorH } = LAYOUT.dock;
  const b = new GeometryBuilder();
  // Yard apron outside the dock wall, running up to the site road.
  const yardDepth = SITE_ROADS.xs[1] - wallX;
  b.box(yardDepth, 0.06, 110, wallX + yardDepth / 2, -0.05, 0, '#ddd4c4');
  doors.forEach((doorZ) => {
    b.box(1.4, DOCK_FLOOR_Y, doorW + 0.8, wallX + 0.7, 0, doorZ, PALETTE.stone);
    b.box(JAMB_DEPTH, doorH, JAMB_WIDTH, wallX, 0, doorZ - doorW / 2, PALETTE.frame);
    b.box(JAMB_DEPTH, doorH, JAMB_WIDTH, wallX, 0, doorZ + doorW / 2, PALETTE.frame);
    b.box(JAMB_DEPTH, JAMB_HEADER_H, doorW + JAMB_WIDTH, wallX, doorH, doorZ, PALETTE.frame);
  });
  addContainer(b, wallX + 1.4, doors[1], { color: PALETTE.red, isOpenRear: true });
  addContainer(b, wallX + 1.4, doors[0], { color: PALETTE.frameSoft });
  addContainer(b, wallX + 9, doors[2] + 7, { color: PALETTE.stone });
  // Conveyor bed meets the leveler; its end face sits inside the stone, not on it.
  const cz = doors[1];
  const frameLen = CONVEYOR_RUN + FACE_CLEAR;
  b.box(frameLen, CONVEYOR_FRAME_H, 0.9, wallX - CONVEYOR_RUN + frameLen / 2, 0, cz, PALETTE.steel);
  const rollerY = DOCK_FLOOR_Y - ROLLER_RADIUS;
  for (let x = wallX - CONVEYOR_RUN; x < wallX; x += 0.6) b.cylinder(ROLLER_RADIUS, 0.84, x, rollerY, cz, PALETTE.frame, 6, 'z');
  // Staged pallets inside the dock.
  for (let i = 0; i < 6; i++) {
    const px = wallX - 5 - (i % 3) * 1.6;
    const pz = cz + (i < 3 ? -3.4 : 3.4);
    b.box(1.2, 0.14, 1.0, px, 0, pz, PALETTE.stone);
    b.box(1.1, 0.9, 0.95, px, 0.14, pz, PALETTE.kraft);
  }
  return b.build();
}

export const CONVEYOR = {
  count: 22,
  from: LAYOUT.dock.wallX - CONVEYOR_RUN,
  to: LAYOUT.dock.wallX + 10,
  y: DOCK_FLOOR_Y,
  z: LAYOUT.dock.doors[1],
};

export function createConveyorCartons() {
  const mesh = new THREE.InstancedMesh(UNIT_BOX, createClayMaterial({ vertexColors: false, color: PALETTE.kraft }), CONVEYOR.count);
  mesh.castShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
}

// ---------- Site: the group's other nine production units ----------

// Plot, road grid and blocks keep every unit clear of the roads and the main building.
const SITE_PLOT = { x0: -260, x1: 420, z0: -200, z1: 205 };
const SITE_ROADS = { zs: [-95, 95], xs: [-130, 290], width: 14 };

// Listed in unit order 2–10 (rise order), matching the names in the page's [data-units] list.
export const SITE_BUILDINGS = [
  { x: 80, z: -145, w: 130, d: 70, h: 9 },
  { x: 215, z: -145, w: 110, d: 70, h: 8 },
  { x: 350, z: -45, w: 90, d: 76, h: 10 },
  { x: 350, z: 45, w: 90, d: 76, h: 9 },
  { x: 215, z: 145, w: 110, d: 70, h: 11 },
  { x: 80, z: 145, w: 130, d: 74, h: 9 },
  { x: -60, z: 145, w: 110, d: 70, h: 8 },
  { x: -190, z: 0, w: 90, d: 120, h: 10 },
  { x: -60, z: -145, w: 110, d: 70, h: 8 },
];

export const UNIT_TOTAL = SITE_BUILDINGS.length + 1;

// Roof-top label anchors, main walk-through building first.
export function unitAnchors() {
  const { x0, x1, wallH } = LAYOUT.building;
  const main = new THREE.Vector3((x0 + x1) / 2, wallH, 0);
  return [main, ...SITE_BUILDINGS.map((s) => new THREE.Vector3(s.x, s.h, s.z))];
}

function buildUnitFactoryGeometry() {
  const b = new GeometryBuilder({ ao: false });
  b.box(1, 1, 1, 0, 0, 0, PALETTE.paper);
  b.box(1.004, 0.02, 1.004, 0, 1, 0, PALETTE.roof);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const cx = -0.5 + (i + 0.5) / n;
    b.box(0.02, 0.12, 0.88, cx + 0.06, 1, 0, PALETTE.frameSoft);
    b.box(0.12, 0.05, 0.88, cx - 0.01, 1, 0, PALETTE.paper);
  }
  return b.build();
}

function buildUnitWindowGeometry() {
  const b = new GeometryBuilder({ ao: false });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const cx = -0.5 + (i + 0.5) / n;
    b.box(0.07, 0.16, 0.01, cx, 0.52, 0.505, '#ffffff');
    b.box(0.07, 0.16, 0.01, cx, 0.52, -0.505, '#ffffff');
  }
  return b.build();
}

export function createSiteBuildings(uniforms) {
  const body = createRevealMaterials(uniforms);
  const glow = createRevealMaterials(uniforms, { vertexColors: true, color: PALETTE.frameSoft, emissive: PALETTE.glow, emissiveIntensity: 0 });
  const bodies = new THREE.InstancedMesh(buildUnitFactoryGeometry(), body.surface, SITE_BUILDINGS.length);
  const windows = new THREE.InstancedMesh(buildUnitWindowGeometry(), glow.surface, SITE_BUILDINGS.length);
  bodies.customDepthMaterial = body.depth;
  const m = new THREE.Matrix4();
  SITE_BUILDINGS.forEach((s, i) => {
    m.compose(new THREE.Vector3(s.x, 0, s.z), new THREE.Quaternion(), new THREE.Vector3(s.w, s.h, s.d));
    bodies.setMatrixAt(i, m);
    windows.setMatrixAt(i, m);
  });
  bodies.castShadow = true;
  bodies.receiveShadow = true;
  [bodies, windows].forEach((mesh) => { mesh.frustumCulled = false; });
  return { bodies, windows, windowMaterial: glow.surface };
}

export function buildSiteGround() {
  const b = new GeometryBuilder({ ao: false });
  const ROAD = '#d9d0bf';
  const P = SITE_PLOT;
  const cx = (P.x0 + P.x1) / 2;
  const cz = (P.z0 + P.z1) / 2;
  const { zs, xs, width } = SITE_ROADS;
  b.box(3000, 0.05, 3000, cx, -0.3, 0, PALETTE.ground);
  zs.forEach((z) => b.box(P.x1 - P.x0, 0.04, width, cx, -0.26, z, ROAD));
  xs.forEach((x) => b.box(width, 0.04, P.z1 - P.z0, x, -0.26, cz, ROAD));
  // Plot boundary.
  const T = 0.8;
  b.box(P.x1 - P.x0, 0.05, T, (P.x0 + P.x1) / 2, -0.24, P.z0, PALETTE.frameSoft);
  b.box(P.x1 - P.x0, 0.05, T, (P.x0 + P.x1) / 2, -0.24, P.z1, PALETTE.frameSoft);
  b.box(T, 0.05, P.z1 - P.z0, P.x0, -0.24, (P.z0 + P.z1) / 2, PALETTE.frameSoft);
  b.box(T, 0.05, P.z1 - P.z0, P.x1, -0.24, (P.z0 + P.z1) / 2, PALETTE.frameSoft);
  return b.build();
}
