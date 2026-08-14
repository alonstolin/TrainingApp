/** Transient messages, with an undo affordance. */

import { el, onTap } from './dom.js';

const host = () => document.getElementById('toast-host');

export function toast(message, { action, onAction, duration = 4000, kind = '' } = {}) {
  const h = host();
  if (!h) return () => {};

  const node = el(
    `div.toast${kind ? `.toast--${kind}` : ''}`,
    null,
    el('span.grow', { text: message }),
    action
      ? onTap(el('button', { type: 'button', text: action }), () => {
          onAction?.();
          dismiss();
        })
      : null,
  );

  const timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    node.remove();
  }

  h.appendChild(node);
  // Never stack more than three; older ones fall off the top.
  while (h.children.length > 3) h.firstChild.remove();
  return dismiss;
}

/** Undo lives on every destructive or easily-mistapped action. */
export const undoToast = (message, onUndo) =>
  toast(message, { action: 'Undo', onAction: onUndo, duration: 6000 });
