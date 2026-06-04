const DEFAULTS = {
  enabled: true,
  factor: 0.3
};

let options = { ...DEFAULTS };

chrome.storage.sync.get(DEFAULTS, (stored) => {
  options = normalizeOptions(stored);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  for (const [key, change] of Object.entries(changes)) {
    options[key] = change.newValue;
  }
  options = normalizeOptions(options);
});

window.addEventListener("wheel", onWheel, {
  capture: true,
  passive: false
});

function onWheel(event) {
  if (!options.enabled || event.defaultPrevented || event.ctrlKey) return;

  const delta = normalizeDelta(event);
  const x = delta.x * options.factor;
  const y = delta.y * options.factor;
  const target = scrollTarget(event.target, x, y);
  if (!target) return;

  event.preventDefault();
  applyScroll(target, x, y);
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

function scrollTarget(start, deltaX, deltaY) {
  for (let node = elementFrom(start); node; node = node.parentElement) {
    if (canScroll(node, deltaX, deltaY)) return node;
  }
  const root = document.scrollingElement || document.documentElement;
  return canScroll(root, deltaX, deltaY) ? root : null;
}

function elementFrom(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return node;
  return node.parentElement;
}

function canScroll(element, deltaX, deltaY) {
  if (!(element instanceof Element)) return false;

  const style = getComputedStyle(element);
  return canScrollAxis(
    style.overflowX,
    element.scrollLeft,
    element.scrollWidth - element.clientWidth,
    deltaX
  ) || canScrollAxis(
    style.overflowY,
    element.scrollTop,
    element.scrollHeight - element.clientHeight,
    deltaY
  );
}

function canScrollAxis(overflow, position, maxPosition, delta) {
  if (!delta || !/^(auto|scroll|overlay)$/.test(overflow) || maxPosition <= 0) {
    return false;
  }
  return delta < 0 ? position > 0 : position < maxPosition;
}

function applyScroll(target, x, y) {
  if (target === document.scrollingElement || target === document.documentElement) {
    window.scrollBy(x, y);
    return;
  }

  target.scrollLeft += x;
  target.scrollTop += y;
}
