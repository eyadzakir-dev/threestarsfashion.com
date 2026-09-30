// Screen-space name tags for the group's production units. Names come from the page's
// [data-units] list; each tag tracks its building's roof-top anchor through the camera.
import * as THREE from '../vendor/three.module.min.js';

const LEADER_PX = 16;
const STACK_GAP_PX = 4;
const EDGE_PX = 8;
const MAX_STACK_PASSES = 12;
const MIN_ALPHA = 0.01;

function createTagElement(name, number) {
  const el = document.createElement('div');
  el.className = 'unit-tag';
  const chip = document.createElement('span');
  chip.className = 'unit-tag__chip';
  const n = document.createElement('b');
  n.className = 'unit-tag__n';
  n.textContent = String(number).padStart(2, '0');
  const label = document.createElement('span');
  label.className = 'unit-tag__name';
  label.textContent = name;
  chip.append(n, label);
  el.append(chip);
  return { el, chip };
}

function readNames(list) {
  return list ? [...list.querySelectorAll('li')].map((li) => li.textContent.trim()) : [];
}

const overlaps = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

// Lifts a chip above any already-placed chip it would cover; the leader line stretches to match.
function stackAbove(rect, placed) {
  const r = { ...rect };
  for (let pass = 0; pass < MAX_STACK_PASSES; pass++) {
    const hit = placed.find((p) => overlaps(r, p));
    if (!hit) break;
    const lift = r.bottom - (hit.top - STACK_GAP_PX);
    r.top -= lift;
    r.bottom -= lift;
  }
  return r;
}

export function createUnitTags({ stage, list, anchors, before }) {
  const names = readNames(list);
  const layer = document.createElement('div');
  layer.className = 'scale__units';
  layer.hidden = true;
  const tags = names.slice(0, anchors.length).map((name, i) => ({ ...createTagElement(name, i + 1), anchor: anchors[i], w: 0, h: 0 }));
  tags.forEach((t) => layer.append(t.el));
  stage.insertBefore(layer, before || null);
  const screen = new THREE.Vector3();
  let isShown = false;
  let isMeasured = false;

  function measure() {
    if (!isShown) {
      isMeasured = false;
      return;
    }
    tags.forEach((t) => {
      t.w = t.chip.offsetWidth;
      t.h = t.chip.offsetHeight;
    });
    isMeasured = true;
  }

  function setShown(shouldShow) {
    if (shouldShow === isShown) return;
    isShown = shouldShow;
    layer.hidden = !shouldShow;
    if (shouldShow && !isMeasured) measure();
  }

  function project(t, i, camera, view, alpha) {
    screen.copy(t.anchor).project(camera);
    const isInView = Math.abs(screen.z) < 1 && Math.abs(screen.x) < 1 && Math.abs(screen.y) < 1;
    if (!isInView || alpha <= MIN_ALPHA) return null;
    return { t, i, alpha, x: (screen.x * 0.5 + 0.5) * view.w, y: (0.5 - screen.y * 0.5) * view.h };
  }

  function chipRect({ t, x, y }, viewW) {
    const left = THREE.MathUtils.clamp(x - t.w / 2, EDGE_PX, viewW - EDGE_PX - t.w);
    return { left, right: left + t.w, top: y - LEADER_PX - t.h, bottom: y - LEADER_PX };
  }

  function paint(item, rect) {
    const { el } = item.t;
    el.style.opacity = item.alpha.toFixed(3);
    el.style.transform = `translate3d(${item.x.toFixed(1)}px, ${item.y.toFixed(1)}px, 0)`;
    el.style.setProperty('--lead', `${(item.y - rect.bottom).toFixed(1)}px`);
    el.style.setProperty('--dx', `${(rect.left + item.t.w / 2 - item.x).toFixed(1)}px`);
  }

  // alphaOf(i) gives each tag's fade (0–1); view is the canvas size in CSS pixels.
  function update(camera, view, alphaOf) {
    const items = tags.map((t, i) => project(t, i, camera, view, alphaOf(i)));
    setShown(items.some(Boolean));
    if (!isShown) return;
    const placed = [];
    tags.forEach((t, i) => { if (!items[i]) t.el.style.opacity = '0'; });
    items.filter(Boolean).sort((a, b) => b.y - a.y).forEach((item) => {
      const rect = stackAbove(chipRect(item, view.w), placed);
      placed.push(rect);
      paint(item, rect);
    });
  }

  return { update, measure };
}
