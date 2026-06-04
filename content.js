const DEFAULTS = {
  enabled: true,
  factor: 0.3
};
const MESSAGE_TYPE = "scroll-factor:wheel";

let options = { ...DEFAULTS };
const isFrame = window.self !== window.top;

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
window.addEventListener("message", onMessage);

function onWheel(event) {
  if (!options.enabled || event.defaultPrevented || event.ctrlKey) return;

  const delta = normalizeDelta(event);
  const x = delta.x * options.factor;
  const y = delta.y * options.factor;
  const target = scrollTarget(event.target, x, y);
  if (!target) {
    if (isFrame) {
      event.preventDefault();
      postScrollToParent(x, y);
    }
    return;
  }

  event.preventDefault();
  applyScroll(target, x, y);
}

function onMessage(event) {
  if (!options.enabled || event.source === window) return;
  if (event.data?.type !== MESSAGE_TYPE) return;

  const { x, y } = event.data;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  const target = scrollTarget(frameElementFromEvent(event), x, y);
  if (target) {
    applyScroll(target, x, y);
  } else if (isFrame) {
    postScrollToParent(x, y);
  }
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
    if (isRootScrollerCandidate(node, deltaX, deltaY)) return getDocumentScroller();
    if (canScroll(node, deltaX, deltaY)) return node;
  }
  return canScrollDocument(deltaX, deltaY) ? getDocumentScroller() : null;
}

function elementFrom(node) {
  if (!node) return null;
  if (node.nodeType === Node.ELEMENT_NODE) return node;
  return node.parentElement;
}

function getDocumentScroller() {
  return document.scrollingElement || document.documentElement;
}

function isRootScrollerCandidate(element, deltaX, deltaY) {
  const root = document.documentElement;
  const body = document.body;
  if (!root || !body) return false;

  const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
  const fullSize = horizontal ?
    element.scrollWidth === root.scrollWidth :
    element.scrollHeight === root.scrollHeight;

  if (!fullSize) return false;
  if (isFrame) return canScrollDocument(deltaX, deltaY);
  return overflowIsNotHidden(root, horizontal) &&
    overflowIsNotHidden(body, horizontal) &&
    canScrollDocument(deltaX, deltaY);
}

function canScrollDocument(deltaX, deltaY) {
  const root = getDocumentScroller();
  return canScrollPosition(window.scrollX, root.scrollWidth - window.innerWidth, deltaX) ||
    canScrollPosition(window.scrollY, root.scrollHeight - window.innerHeight, deltaY);
}

function canScroll(element, deltaX, deltaY) {
  if (!(element instanceof Element)) return false;

  const style = getComputedStyle(element);
  return canScrollElementAxis(
    style.overflowX,
    element.scrollLeft,
    element.scrollWidth - element.clientWidth,
    deltaX
  ) || canScrollElementAxis(
    style.overflowY,
    element.scrollTop,
    element.scrollHeight - element.clientHeight,
    deltaY
  );
}

function overflowIsNotHidden(element, horizontal) {
  const property = horizontal ? "overflowX" : "overflowY";
  return getComputedStyle(element)[property] !== "hidden";
}

function canScrollElementAxis(overflow, position, maxPosition, delta) {
  if (!delta || !/^(auto|scroll|overlay)$/.test(overflow) || maxPosition <= 0) {
    return false;
  }
  return canScrollPosition(position, maxPosition, delta);
}

function canScrollPosition(position, maxPosition, delta) {
  if (!delta || maxPosition <= 0) return false;
  return delta < 0 ? position > 0 : position < maxPosition;
}

function applyScroll(target, x, y) {
  const isDocumentScroller =
    target === document.scrollingElement || target === document.documentElement;
  const scroller = isDocumentScroller ? getDocumentScroller() : target;
  const previousScrollBehavior = scroller.style.scrollBehavior;

  scroller.style.scrollBehavior = "auto";
  scroller.scrollLeft += x;
  scroller.scrollTop += y;
  scroller.style.scrollBehavior = previousScrollBehavior;
}

function postScrollToParent(x, y) {
  window.parent.postMessage({ type: MESSAGE_TYPE, x, y }, "*");
}

function frameElementFromEvent(event) {
  for (const frame of document.querySelectorAll("iframe, frame")) {
    if (frame.contentWindow === event.source) return frame;
  }
  return document.body;
}
