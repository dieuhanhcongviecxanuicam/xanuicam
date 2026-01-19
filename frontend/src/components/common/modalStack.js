// Robust modal stacking manager
// - Deduplicates ids so remounting a modal moves it to top
// - Exposes `getZFor(id)` so each modal can compute its own z based on position
// - Keeps BASE and STEP large to avoid colliding with app z-indexes
const BASE = 100000; // base z-index
const STEP = 10; // gap between stacked elements
const MAX_ITEMS = 1000; // maximum stacked items we can reasonably support
const MAX_Z = BASE + MAX_ITEMS * STEP; // cap to avoid absurd z-index values
const stack = [];

function push(id) {
  if (!id) return BASE;
  // If already present, remove and re-push to move it to top
  const existing = stack.lastIndexOf(id);
  if (existing !== -1) stack.splice(existing, 1);
  stack.push(id);
  return getZFor(id);
}

function pop(id) {
  if (!id) return;
  const idx = stack.lastIndexOf(id);
  if (idx !== -1) stack.splice(idx, 1);
}

function topZ() {
  return BASE + stack.length * STEP;
}

function getZFor(id) {
  if (!id) return topZ();
  const idx = stack.indexOf(id);
  // if not found, return topZ (caller may push later)
  if (idx === -1) return topZ();
  // compute z so later items have higher z
  const z = BASE + (idx + 1) * STEP;
  return z > MAX_Z ? MAX_Z : z;
}

function getMaxZ() { return MAX_Z; }

const api = { push, pop, topZ, getZFor, getMaxZ };
export default api;
