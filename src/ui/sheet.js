/** Bottom sheet. Used for "do something else", confirmations and pickers. */

import { el, clear, onTap } from './dom.js';

const host = () => document.getElementById('sheet-host');

export function openSheet({ title, subtitle, content, actions = [] }) {
  const h = host();
  clear(h);

  const sheet = el(
    'div.sheet',
    { role: 'dialog', 'aria-modal': 'true' },
    el('div.sheet-grab'),
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
  // Tapping the backdrop dismisses; taps inside must not bubble out to it.
  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  function close() {
    clear(h);
    document.removeEventListener('keydown', onKey);
  }
  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);

  h.appendChild(backdrop);
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
