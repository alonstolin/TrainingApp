/**
 * Bottom sheet. Used for "do something else", confirmations and pickers.
 *
 * Dismissable three ways: swipe it down, tap the backdrop, or press Escape.
 * The swipe is the one that matters on a phone — reaching up to tap dead space
 * above the sheet is a two-handed move, and this app is designed to be usable
 * one-handed with a thumb.
 */

import { el, clear, onTap } from './dom.js';

const host = () => document.getElementById('sheet-host');

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// Gesture thresholds.
const DRAG_START_PX = 6;   // movement before we commit to a drag (taps stay taps)
const DISMISS_PX = 110;    // drag far enough and it closes on release
const DISMISS_FRACTION = 0.3;
const FLICK_VELOCITY = 0.45; // px/ms downward — a quick flick closes from anywhere

/**
 * Drag-to-dismiss.
 *
 * The tricky part is coexisting with the sheet's own scrolling. A sheet taller
 * than the viewport must scroll, and a downward drag inside a scroller belongs
 * to the scroller, not to us — so:
 *
 *   - Sheets that FIT get `touch-action: none` and drag from anywhere.
 *   - Sheets that SCROLL only drag from the grab handle, which carries its own
 *     `touch-action: none`. Dragging the body scrolls it, as it should.
 *
 * Deciding by measured overflow rather than by guessing avoids the usual failure
 * where the browser starts a native pan, fires pointercancel, and the sheet
 * sticks halfway down.
 */
function attachDragToDismiss({ sheet, backdrop, handle, dismiss }) {
  let tracking = false;
  let dragging = false;
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let suppressClick = false;

  const setOffset = (px) => {
    sheet.style.transform = px ? `translateY(${px}px)` : '';
    const height = sheet.offsetHeight || 1;
    const fade = 1 - Math.min(1, px / height) * 0.85;
    backdrop.style.backgroundColor = `rgba(0, 0, 0, ${(0.6 * fade).toFixed(3)})`;
  };

  const settle = () => {
    sheet.classList.remove('sheet--dragging');
    sheet.classList.add('sheet--settling');
    setOffset(0);
    setTimeout(() => sheet.classList.remove('sheet--settling'), 260);
  };

  const onPointerDown = (ev) => {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    // The handle always drags — it carries `touch-action: none`, so the browser
    // never claims the gesture for a pan and the drag is completely reliable.
    //
    // The body drags too, but only when the sheet is already scrolled to the
    // top: below that, a downward swipe belongs to the scroller. This mirrors
    // how native iOS sheets behave.
    const fromHandle = handle.contains(ev.target);
    if (!fromHandle && sheet.scrollTop > 0) return;

    tracking = true;
    dragging = false;
    startY = lastY = ev.clientY;
    lastT = ev.timeStamp;
    velocity = 0;
  };

  const onPointerMove = (ev) => {
    if (!tracking) return;
    const dy = ev.clientY - startY;

    if (!dragging) {
      // Upward or sideways movement is not ours; hand it back untouched.
      if (dy < DRAG_START_PX) {
        if (dy < -DRAG_START_PX) tracking = false;
        return;
      }
      dragging = true;
      // Grabbing it mid-entry hands control straight to the finger.
      sheet.classList.remove('sheet--entering');
      sheet.classList.add('sheet--dragging');
      try {
        sheet.setPointerCapture(ev.pointerId);
      } catch {
        /* capture is an optimisation, not a requirement */
      }
    }

    const dt = ev.timeStamp - lastT;
    if (dt > 0) velocity = (ev.clientY - lastY) / dt;
    lastY = ev.clientY;
    lastT = ev.timeStamp;

    // Resist upward overdrag rather than letting the sheet fly off the top.
    setOffset(Math.max(0, dy));
    if (ev.cancelable) ev.preventDefault();
  };

  const onPointerUp = () => {
    if (!tracking) return;
    tracking = false;
    if (!dragging) return;
    dragging = false;

    // A drag must not also register as a tap on whatever was under the finger.
    suppressClick = true;
    setTimeout(() => {
      suppressClick = false;
    }, 350);

    const offset = Math.max(0, lastY - startY);
    const limit = Math.min(DISMISS_PX, (sheet.offsetHeight || 1) * DISMISS_FRACTION);
    if (velocity > FLICK_VELOCITY || offset > limit) dismiss();
    else settle();
  };

  const onPointerCancel = () => {
    if (!tracking) return;
    tracking = false;
    if (dragging) {
      dragging = false;
      settle();
    }
  };

  sheet.addEventListener('pointerdown', onPointerDown);
  sheet.addEventListener('pointermove', onPointerMove);
  sheet.addEventListener('pointerup', onPointerUp);
  sheet.addEventListener('pointercancel', onPointerCancel);
  sheet.addEventListener(
    'click',
    (ev) => {
      if (!suppressClick) return;
      ev.preventDefault();
      ev.stopPropagation();
    },
    true, // capture, so it beats the button handlers underneath
  );

  /** Sheets that fit can be grabbed anywhere; measured after layout. */
  return () => {
    if (sheet.scrollHeight <= sheet.clientHeight + 1) sheet.classList.add('sheet--static');
  };
}

export function openSheet({ title, subtitle, content, actions = [] }) {
  const h = host();
  clear(h);

  let closed = false;

  const handle = el(
    'div.sheet-handle',
    { 'aria-hidden': 'true' },
    el('div.sheet-grab'),
  );

  const sheet = el(
    'div.sheet.sheet--entering',
    { role: 'dialog', 'aria-modal': 'true', 'aria-label': title ?? 'Options' },
    handle,
    title ? el('div.sheet-title', { text: title }) : null,
    subtitle ? el('p.small.muted', { text: subtitle }) : null,
    content ? el('div', { style: { marginTop: '1rem' } }, content) : null,
    actions.length
      ? el(
          'div.stack',
          { style: { marginTop: '1.25rem' } },
          ...actions.map((a) =>
            onTap(
              el(`button.btn${a.variant ? `.btn--${a.variant}` : ''}.btn--block`, {
                type: 'button',
                text: a.label,
              }),
              () => {
                close();
                a.onSelect?.();
              },
            ),
          ),
        )
      : null,
  );

  const backdrop = el('div.sheet-backdrop', null, sheet);
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  function teardown() {
    document.removeEventListener('keydown', onKey);
    if (h.contains(backdrop)) clear(h);
  }

  /** Slide out, then remove. Callers can keep calling this synchronously. */
  function close() {
    if (closed) return;
    closed = true;
    if (prefersReducedMotion()) {
      teardown();
      return;
    }
    sheet.classList.remove('sheet--dragging', 'sheet--entering', 'sheet--settling');
    sheet.classList.add('sheet--closing');
    sheet.style.transform = `translateY(${sheet.offsetHeight || 600}px)`;
    backdrop.style.backgroundColor = 'rgba(0, 0, 0, 0)';
    setTimeout(teardown, 220);
  }

  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  const markStatic = attachDragToDismiss({ sheet, backdrop, handle, dismiss: close });

  h.appendChild(backdrop);
  markStatic(); // needs to be in the DOM to measure overflow
  setTimeout(() => sheet.classList.remove('sheet--entering'), 250);

  return close;
}

export function confirmSheet({ title, subtitle, confirmLabel = 'Confirm', variant = 'danger', onConfirm }) {
  return openSheet({
    title,
    subtitle,
    actions: [
      { label: confirmLabel, variant, onSelect: onConfirm },
      { label: 'Cancel', variant: 'ghost' },
    ],
  });
}
