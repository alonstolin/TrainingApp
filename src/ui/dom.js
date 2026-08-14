/**
 * Tiny DOM helpers — this is the entire "framework".
 *
 * Screens mount once and then mutate surgically. There is no innerHTML re-render
 * loop, because that pattern destroys focus and uncommitted input values the
 * instant the user is mid-entry. The stepper-first design (see stepper.js) means
 * there is almost never a focused input to lose, which kills that whole bug class
 * structurally rather than working around it.
 */

/**
 * el('div.card', {...props}, ...children)
 * The tag string supports `tag.class.class#id` shorthand.
 */
export function el(spec, props = null, ...children) {
  let tag = 'div';
  const classes = [];
  let id = null;

  const m = String(spec).match(/^([a-zA-Z0-9-]*)((?:[.#][^.#]+)*)$/);
  if (m) {
    if (m[1]) tag = m[1];
    for (const part of m[2].match(/[.#][^.#]+/g) ?? []) {
      if (part[0] === '.') classes.push(part.slice(1));
      else id = part.slice(1);
    }
  } else {
    tag = spec;
  }

  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  if (id) node.id = id;

  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = [node.className, v].filter(Boolean).join(' ');
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (k in node && k !== 'list' && typeof v !== 'object') {
        node[k] = v;
      } else {
        node.setAttribute(k, v === true ? '' : v);
      }
    }
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/**
 * Click handler that will not double-fire.
 * Binding both touchend and click is a real double-logging bug on iOS; `click`
 * alone is correct and, with touch-action:manipulation, has no 300ms delay.
 */
export function onTap(node, fn) {
  node.addEventListener('click', (ev) => {
    ev.preventDefault();
    fn(ev);
  });
  return node;
}

/** Press-and-hold to repeat, accelerating. Used by the +/- steppers. */
export function onHold(node, fn, { initial = 420, min = 55, accel = 0.82 } = {}) {
  let timer = null;
  let delay = initial;
  let fired = false;

  const step = () => {
    fn();
    fired = true;
    delay = Math.max(min, delay * accel);
    timer = setTimeout(step, delay);
  };

  const start = (ev) => {
    if (ev.button != null && ev.button !== 0) return;
    stop();
    fired = false;
    delay = initial;
    fn();
    timer = setTimeout(step, initial);
  };

  const stop = () => {
    clearTimeout(timer);
    timer = null;
  };

  node.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    node.setPointerCapture?.(ev.pointerId);
    start(ev);
  });
  for (const evt of ['pointerup', 'pointercancel', 'pointerleave']) {
    node.addEventListener(evt, stop);
  }
  // The synthetic click that follows pointerdown must not fire the action twice.
  node.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    void fired;
  });

  return node;
}

/** Format a weight without trailing zeros: 72.5 → "72.5", 70.0 → "70". */
export const fmtWeight = (v) =>
  v == null ? '—' : String(Math.round(v * 100) / 100);

export const fmtKg = (v) => (v == null ? '—' : `${fmtWeight(v)}kg`);

/** Render a set list compactly: "82.5×5 @8 · 70×6, 70×6". */
export function fmtSets(sets, { max = 5 } = {}) {
  const done = (sets ?? []).filter((s) => s.done);
  if (!done.length) return '—';
  const parts = done.slice(0, max).map((s) => {
    if (s.seconds != null) return `${s.seconds}s`;
    const w = s.weightKg != null && s.weightKg !== 0 ? fmtWeight(s.weightKg) : null;
    const core = w ? `${w}×${s.reps ?? '?'}` : `${s.reps ?? '?'} reps`;
    return s.rpe ? `${core} @${s.rpe}` : core;
  });
  if (done.length > max) parts.push(`+${done.length - max}`);
  return parts.join(', ');
}

export function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'instant' });
}
