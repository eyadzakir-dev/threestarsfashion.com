// Process machines added ahead of cutting (knitting, dyeing) and in embellishment (embroidery).
// Static parts are merged or instanced; the moving parts are small instanced sets animated by scene.js.
import * as THREE from '../vendor/three.module.min.js';
import { GeometryBuilder, LAYOUT, PALETTE } from './world.js';

const TAU = Math.PI * 2;
const DYE_SHADES = [PALETTE.red, '#3a4763', PALETTE.frame, '#8f8a80', '#3a4763', PALETTE.frameSoft];
const THREAD_SHADES = [PALETTE.red, PALETTE.ink, PALETTE.paper, '#3a4763', PALETTE.stone];

function withGeometry(geometry, use) {
  use(geometry);
  geometry.dispose();
}

function instanced(geometry, material, matrices, { dynamic = false } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (dynamic) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  return mesh;
}

const translation = (v) => new THREE.Matrix4().makeTranslation(v.x, v.y, v.z);

// ---------- Knitting: circular knitting machines ----------

const KNITTER = { legs: 3, bedY: 1.0, bedR: 1.05, headR: 0.72, creelY: 2.35, creelR: 1.0, cones: 14 };

function addKnitterFrame(b) {
  const { legs, bedY, bedR, headR, creelY } = KNITTER;
  const LEG_INSET = 0.1;
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * TAU;
    b.box(0.16, bedY, 0.16, Math.cos(a) * (bedR - LEG_INSET), 0, Math.sin(a) * (bedR - LEG_INSET), PALETTE.frame);
  }
  b.cylinder(bedR, 0.12, 0, bedY, 0, PALETTE.steel, 24);
  b.cylinder(headR, 0.34, 0, bedY + 0.12, 0, PALETTE.frame, 20);
  b.cylinder(headR + 0.04, 0.05, 0, bedY + 0.3, 0, PALETTE.red, 20);
  b.cylinder(0.08, creelY - bedY - 0.46, 0, bedY + 0.46, 0, PALETTE.frameSoft, 8);
}

function addTopCreel(b) {
  const { legs, creelY, creelR, cones } = KNITTER;
  for (let i = 0; i < legs; i++) {
    const a = (i / legs) * TAU + Math.PI / legs;
    b.box(creelR, 0.05, 0.06, (Math.cos(a) * creelR) / 2, creelY - 0.05, (Math.sin(a) * creelR) / 2, PALETTE.frameSoft, -a);
  }
  withGeometry(new THREE.TorusGeometry(creelR, 0.035, 5, 28).rotateX(Math.PI / 2), (ring) => {
    b.add(ring, new THREE.Matrix4().makeTranslation(0, creelY, 0), PALETTE.frameSoft);
  });
  withGeometry(new THREE.CylinderGeometry(0.05, 0.13, 0.3, 8, 1), (cone) => {
    for (let i = 0; i < cones; i++) {
      const a = (i / cones) * TAU;
      const m = new THREE.Matrix4().makeTranslation(Math.cos(a) * creelR, creelY + 0.17, Math.sin(a) * creelR);
      b.add(cone, m, i % 5 === 0 ? PALETTE.stone : PALETTE.paper);
    }
  });
}

export function buildKnitterBody() {
  const b = new GeometryBuilder();
  addKnitterFrame(b);
  addTopCreel(b);
  return b.build();
}

// Fabric tube and take-down frame turn together under the bed.
export function buildKnitterRotor() {
  const b = new GeometryBuilder();
  const POST_X = 0.72;
  b.box(1.6, 0.06, 0.4, 0, 0, 0, PALETTE.frame);
  b.box(0.1, 0.98, 0.1, -POST_X, 0, 0, PALETTE.frame);
  b.box(0.1, 0.98, 0.1, POST_X, 0, 0, PALETTE.frame);
  b.cylinder(0.58, 0.46, 0, 0.52, 0, PALETTE.paper, 20);
  b.box(0.05, 0.46, 0.12, 0.58, 0.52, 0, PALETTE.stone);
  b.box(0.05, 0.46, 0.12, -0.58, 0.52, 0, PALETTE.stone);
  b.box(1.0, 0.24, 0.04, 0, 0.3, 0, PALETTE.paper);
  b.cylinder(0.2, POST_X * 2 - 0.1, 0, 0.3, 0, PALETTE.paper, 14, 'x');
  return b.build();
}

export function knitterCenters() {
  const { xs, zs } = LAYOUT.knitting;
  return xs.flatMap((x) => zs.map((z) => new THREE.Vector3(x, 0, z)));
}

export function createKnittingFloor(material) {
  const matrices = knitterCenters().map(translation);
  const bodies = instanced(buildKnitterBody(), material, matrices);
  const rotors = instanced(buildKnitterRotor(), material, matrices, { dynamic: true });
  return { bodies, rotors };
}

// Greige rolls waiting at the opening to dyeing, and yarn pallets along the west wall.
export function buildKnittingStock() {
  const b = new GeometryBuilder();
  const { x0 } = LAYOUT.building;
  const PALLET_PITCH = 6;
  for (let z = -40; z <= 40; z += PALLET_PITCH) {
    if (Math.abs(z) < LAYOUT.partitions.gap[1]) continue;
    b.box(1.3, 0.14, 1.1, x0 + 2.2, 0, z, PALETTE.stone);
    for (let k = 0; k < 4; k++) b.cylinder(0.2, 0.9, x0 + 1.9 + (k % 2) * 0.6, 0.14, z - 0.25 + Math.floor(k / 2) * 0.5, PALETTE.kraft, 8);
  }
  const rollX = LAYOUT.partitions.xs[0] - 4;
  [-24, -16, 16, 24, 32].forEach((z) => {
    b.box(1.6, 0.14, 2.4, rollX, 0, z, PALETTE.stone);
    for (let k = 0; k < 6; k++) b.cylinder(0.26, 1.4, rollX, 0.4 + Math.floor(k / 3) * 0.5, z - 0.7 + (k % 3) * 0.55, PALETTE.paper, 10, 'x');
  });
  return b.build();
}

// ---------- Dyeing: jet dyeing vessels and a stenter line ----------

const JET = { length: 7, radius: 1.0, axisY: 1.55, housing: 1.5, housingH: 1.1, reelLift: 0.3 };

const jetHousingX = (x) => x + JET.length / 2 - JET.housing / 2 - 0.2;
const jetHousingBase = () => JET.axisY + JET.radius * 0.7;

function jetReelPoint(x, z) {
  return new THREE.Vector3(jetHousingX(x), jetHousingBase() + JET.housingH + JET.reelLift, z);
}

function addJetTank(b, x, z) {
  const { length, radius, axisY } = JET;
  b.cylinder(radius, length, x, axisY, z, PALETTE.stone, 20, 'x');
  [-length / 2, length / 2].forEach((dx) => b.cylinder(radius * 0.94, 0.16, x + dx, axisY, z, PALETTE.steel, 20, 'x'));
  [-length * 0.25, length * 0.1].forEach((dx) => b.cylinder(radius + 0.02, 0.08, x + dx, axisY, z, PALETTE.steel, 20, 'x'));
  [-length * 0.32, 0, length * 0.32].forEach((dx) => b.box(0.3, axisY - radius * 0.6, radius * 1.4, x + dx, 0, z, PALETTE.frame));
}

function addJetPlumbing(b, x, z) {
  const { length, radius, axisY } = JET;
  const endX = x - length / 2;
  b.cylinder(0.13, length * 0.8, x, 0.35, z + radius * 0.55, PALETTE.steel, 8, 'x');
  b.box(0.8, 0.8, 0.7, endX - 0.6, 0, z + 0.4, PALETTE.frame);
  b.cylinder(0.28, 1.9, endX - 0.6, 0, z - 0.55, PALETTE.steel, 12);
  b.cylinder(0.1, axisY - 0.8, endX - 0.3, 0.8, z + 0.4, PALETTE.steel, 8);
}

// Loading housing with the dyed rope running over the reel, a sight slot on top and the control panel.
function addJetHousing(b, x, z, shade) {
  const { length, radius, axisY, housing, housingH, reelLift } = JET;
  const hx = jetHousingX(x);
  const base = jetHousingBase();
  const top = base + housingH;
  b.box(housing, housingH, housing, hx, base, z, PALETTE.paper);
  b.box(housing * 0.5, 0.5, 0.04, hx, base + 0.35, z + housing / 2, PALETTE.ink);
  [-0.3, 0.3].forEach((dx) => b.box(0.05, reelLift + 0.05, 0.9, hx + dx, top - 0.05, z, shade));
  b.box(length * 0.55, 0.05, 0.46, x - length * 0.15, axisY + radius - 0.03, z, shade);
  b.box(0.5, 1.7, 0.35, x + length / 2 + 0.25, 0, z + radius + 0.25, PALETTE.ink);
  b.box(0.3, 0.22, 0.03, x + length / 2 + 0.25, 1.25, z + radius + 0.44, PALETTE.steel);
  b.box(0.1, 0.1, 0.05, x + length / 2 + 0.25, 1.58, z + radius + 0.44, PALETTE.red);
}

function jetSlots() {
  const { xs, zs } = LAYOUT.dyeing;
  return zs.flatMap((z, row) => xs.map((x, col) => ({ x, z, shade: DYE_SHADES[(row * xs.length + col) % DYE_SHADES.length] })));
}

function addStenter(b, { x0, x1, z }, shade) {
  const FEED = 4;
  const CHAMBERS = 6;
  const DEPTH = 3;
  const ovenLen = x1 - x0 - FEED * 2;
  const pitch = ovenLen / CHAMBERS;
  for (let i = 0; i < CHAMBERS; i++) {
    const cx = x0 + FEED + pitch * (i + 0.5);
    b.box(pitch - 0.2, 2.3, DEPTH, cx, 0.2, z, PALETTE.paper);
    b.box(pitch - 0.2, 0.2, DEPTH + 0.06, cx, 0, z, PALETTE.frame);
    b.cylinder(0.2, 0.7, cx, 2.5, z - 0.6, PALETTE.steel, 8);
  }
  b.box(ovenLen, 0.06, DEPTH + 0.1, x0 + FEED + ovenLen / 2, 1.2, z, PALETTE.red);
  b.box(1.4, 1.2, DEPTH - 0.4, x0 + 0.9, 0, z, PALETTE.frame);
  b.cylinder(0.45, DEPTH - 0.6, x0 + 0.9, 1.65, z, shade, 16, 'z');
  b.box(FEED - 1.6, 0.03, DEPTH - 0.8, x0 + FEED / 2 + 0.8, 1.1, z, shade);
  b.box(FEED - 1.6, 0.03, DEPTH - 0.8, x1 - FEED / 2 - 0.8, 1.1, z, shade);
  b.box(1.2, 0.5, DEPTH - 0.4, x1 - 1, 0, z, PALETTE.frame);
  b.cylinder(0.55, DEPTH - 0.6, x1 - 1, 1.05, z, shade, 16, 'z');
}

function addDyedRolls(b) {
  const x = LAYOUT.partitions.xs[1] - 3;
  [14, 20, 26, -16, -24].forEach((z, i) => {
    const shade = DYE_SHADES[i % DYE_SHADES.length];
    b.box(1.6, 0.14, 2.4, x, 0, z, PALETTE.stone);
    for (let k = 0; k < 6; k++) b.cylinder(0.26, 1.4, x, 0.4 + Math.floor(k / 3) * 0.5, z - 0.7 + (k % 3) * 0.55, shade, 10, 'x');
  });
}

export function buildDyehouseStatic() {
  const b = new GeometryBuilder();
  jetSlots().forEach(({ x, z, shade }) => {
    addJetTank(b, x, z);
    addJetPlumbing(b, x, z);
    addJetHousing(b, x, z, shade);
  });
  addStenter(b, LAYOUT.dyeing.stenter, PALETTE.red);
  addDyedRolls(b);
  return b.build();
}

// Winch reel over each vessel's loading end; white so the instance colour gives the dyed shade.
export function buildJetReel() {
  const b = new GeometryBuilder({ ao: false });
  const WIDTH = 1.1;
  const PADDLES = 6;
  const AXIS = new THREE.Vector3(0, 0, 1);
  b.cylinder(0.22, WIDTH, 0, 0, 0, '#ffffff', 12, 'z');
  withGeometry(new THREE.BoxGeometry(1, 1, 1), (paddle) => {
    for (let i = 0; i < PADDLES; i++) {
      const a = (i / PADDLES) * TAU;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0),
        new THREE.Quaternion().setFromAxisAngle(AXIS, a),
        new THREE.Vector3(0.2, 0.05, WIDTH),
      );
      b.add(paddle, m, '#ffffff');
    }
  });
  return b.build();
}

export function jetReelPoints() {
  return jetSlots().map(({ x, z }) => jetReelPoint(x, z));
}

export function createJetReels(material) {
  const slots = jetSlots();
  const reels = instanced(buildJetReel(), material, slots.map(({ x, z }) => translation(jetReelPoint(x, z))), { dynamic: true });
  slots.forEach(({ shade }, i) => reels.setColorAt(i, new THREE.Color(shade)));
  return reels;
}

// ---------- Embroidery: computerized multi-head machines ----------

const EMBROIDERY = { depth: 1.5, tableY: 1.0, beamY: 1.75, conesPerHead: 2 };

function headXs() {
  const { length, heads } = LAYOUT.embroidery;
  const pitch = (length - 1) / heads;
  return Array.from({ length: heads }, (_, i) => -length / 2 + 0.5 + pitch * (i + 0.5));
}

const hoopZ = () => -EMBROIDERY.depth / 2 + 0.55;

function addEmbroideryTable(b, x, z) {
  const { length } = LAYOUT.embroidery;
  const { depth, tableY } = EMBROIDERY;
  b.box(length, tableY - 0.06, depth * 0.7, x, 0, z - depth * 0.1, PALETTE.frameSoft);
  b.box(length + 0.2, 0.06, depth, x, tableY - 0.06, z, PALETTE.paper);
  [-1, 1].forEach((side) => b.box(0.5, tableY + 0.02, depth + 0.1, x + side * (length / 2), 0, z, PALETTE.frame));
  b.box(0.5, 1.5, 0.4, x + length / 2 + 0.6, 0, z + 0.2, PALETTE.ink);
  b.box(0.36, 0.26, 0.03, x + length / 2 + 0.6, 1.1, z + 0.41, PALETTE.steel);
}

function addEmbroideryBeam(b, x, z, machine) {
  const { length } = LAYOUT.embroidery;
  const { depth, tableY, beamY, conesPerHead } = EMBROIDERY;
  const beamZ = z - depth / 2 + 0.25;
  [-length / 2, 0, length / 2].forEach((dx) => b.box(0.3, beamY + 0.3 - tableY, 0.4, x + dx, tableY, beamZ, PALETTE.frame));
  b.box(length + 0.4, 0.34, 0.5, x, beamY, beamZ, PALETTE.frame);
  b.box(length + 0.4, 0.05, 0.02, x, beamY + 0.2, beamZ + 0.26, PALETTE.red);
  withGeometry(new THREE.CylinderGeometry(0.035, 0.07, 0.2, 7, 1), (cone) => {
    headXs().forEach((hx, i) => {
      b.box(0.34, 0.5, 0.62, x + hx, beamY - 0.3, z + hoopZ() - 0.05, PALETTE.paper);
      b.box(0.26, 0.28, 0.04, x + hx, beamY - 0.26, z + hoopZ() + 0.28, PALETTE.steel);
      for (let k = 0; k < conesPerHead; k++) {
        const shade = THREAD_SHADES[(i + k * 2 + machine) % THREAD_SHADES.length];
        b.add(cone, new THREE.Matrix4().makeTranslation(x + hx + (k - 0.5) * 0.16, beamY + 0.44, beamZ), shade);
      }
    });
  });
}

export function buildEmbroideryStatic() {
  const b = new GeometryBuilder();
  const { x, zs } = LAYOUT.embroidery;
  zs.forEach((z, i) => {
    addEmbroideryTable(b, x, z);
    addEmbroideryBeam(b, x, z, i);
  });
  return b.build();
}

// Pantograph frame with one hooped panel under each head.
export function buildEmbroideryFrame() {
  const b = new GeometryBuilder({ ao: false });
  const { length } = LAYOUT.embroidery;
  const y = EMBROIDERY.tableY + 0.01;
  const z = hoopZ();
  [-0.36, 0.36].forEach((dz) => b.box(length - 0.6, 0.04, 0.06, 0, y, z + dz, PALETTE.steel));
  headXs().forEach((hx, i) => b.box(0.34, 0.012, 0.34, hx, y + 0.02, z, i % 4 === 0 ? PALETTE.red : PALETTE.paper));
  return b.build();
}

// All needle bars on a multi-head machine stitch in unison, so one row moves as a unit.
export function buildNeedleBars() {
  const b = new GeometryBuilder({ ao: false });
  const y = EMBROIDERY.beamY - 0.52;
  headXs().forEach((hx) => b.box(0.04, 0.24, 0.04, hx, y, hoopZ(), PALETTE.ink));
  return b.build();
}

export function embroideryOrigins() {
  const { x, zs } = LAYOUT.embroidery;
  return zs.map((z) => new THREE.Vector3(x, 0, z));
}

export function createEmbroideryMovers(material) {
  const matrices = embroideryOrigins().map(translation);
  return {
    frames: instanced(buildEmbroideryFrame(), material, matrices, { dynamic: true }),
    needles: instanced(buildNeedleBars(), material, matrices, { dynamic: true }),
  };
}
