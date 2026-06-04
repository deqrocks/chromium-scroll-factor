const DEFAULTS = {
  enabled: true,
  factor: 0.3
};

const enabled = document.getElementById("enabled");
const factor = document.getElementById("factor");
const factorValue = document.getElementById("factorValue");
const testBox = document.querySelector(".test-box");

chrome.storage.sync.get(DEFAULTS, (stored) => {
  const options = normalizeOptions(stored);
  enabled.checked = options.enabled;
  factor.value = options.factor;
  updateFactorValue();
});

enabled.addEventListener("change", save);
factor.addEventListener("input", () => {
  updateFactorValue();
  save();
});

testBox.addEventListener("wheel", (event) => {
  if (!enabled.checked || event.ctrlKey) return;

  const delta = normalizeDelta(event);
  const x = delta.x * Number(factor.value);
  const y = delta.y * Number(factor.value);
  if (!canScrollTestBox(x, y)) return;

  event.preventDefault();
  testBox.scrollLeft += x;
  testBox.scrollTop += y;
}, { passive: false });

function updateFactorValue() {
  factorValue.value = `${Number(factor.value).toFixed(2)}x`;
}

function save() {
  chrome.storage.sync.set({
    enabled: enabled.checked,
    factor: clamp(Number(factor.value), 0.1, 2, DEFAULTS.factor)
  });
}

function normalizeOptions(value) {
  return {
    enabled: Boolean(value.enabled),
    factor: clamp(Number(value.factor), 0.1, 2, DEFAULTS.factor)
  };
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalizeDelta(event) {
  let x = event.deltaX;
  let y = event.deltaY;

  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    x *= 40;
    y *= 40;
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    x *= window.innerWidth;
    y *= window.innerHeight;
  }

  return { x, y };
}

function canScrollTestBox(deltaX, deltaY) {
  const maxX = testBox.scrollWidth - testBox.clientWidth;
  const maxY = testBox.scrollHeight - testBox.clientHeight;
  return canScrollPosition(testBox.scrollLeft, maxX, deltaX) ||
    canScrollPosition(testBox.scrollTop, maxY, deltaY);
}

function canScrollPosition(position, maxPosition, delta) {
  if (!delta || maxPosition <= 0) return false;
  return delta < 0 ? position > 0 : position < maxPosition;
}
