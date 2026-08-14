/**
 * Steppers and chip rows — the entire input model of this app.
 *
 * The keyboard NEVER opens by default. Mid-set, one-handed, with a sweaty thumb,
 * a numeric keypad is a genuinely bad input device: it covers half the screen,
 * demands precision, and iOS zooms the viewport on focus. Everything is +/- and
 * tappable chips, with tap-the-number as an escape hatch when a load is wildly
 * different from last time.
 *
 * A pleasant side effect: with no focused input, there is nothing for a re-render
 * to destroy.
 */

import { el, onTap, onHold, fmtWeight } from './dom.js';

/**
 * @param {object} o
 *  value, step, min, max, label, format, onChange, small, allowKeypad
 */
export function stepper(o) {
  const {
    step = 2.5,
    min = 0,
    max = 9999,
    label = '',
    format = fmtWeight,
    onChange,
    small = false,
    allowKeypad = true,
    placeholder = '—',
  } = o;

  let value = o.value ?? null;

  const num = el('div.stepper-num.num', { text: value == null ? placeholder : format(value) });
  const lab = label ? el('div.stepper-label', { text: label }) : null;

  const set = (next, silent = false) => {
    if (next == null) value = null;
    else {
      // Round to the step grid so repeated +/- can never drift to 72.49999.
      const snapped = Math.round(next / step) * step;
      value = Math.min(max, Math.max(min, Math.round(snapped * 1000) / 1000));
    }
    num.textContent = value == null ? placeholder : format(value);
    if (!silent) onChange?.(value);
  };

  const bump = (dir) => set(value == null ? (dir > 0 ? step : min) : value + dir * step);

  const minus = el('button', { type: 'button', text: '−', 'aria-label': `decrease ${label}` });
  const plus = el('button', { type: 'button', text: '+', 'aria-label': `increase ${label}` });
  onHold(minus, () => bump(-1));
  onHold(plus, () => bump(1));

  const valueBox = el('div.stepper-value', null, num, lab);
  if (allowKeypad) {
    onTap(valueBox, () => {
      const raw = window.prompt(`${label || 'Value'}:`, value == null ? '' : String(value));
      if (raw == null) return;
      const parsed = Number(raw.replace(',', '.'));
      if (Number.isFinite(parsed)) set(parsed);
    });
  }

  const root = el(`div.stepper${small ? '.stepper--sm' : ''}`, null, minus, valueBox, plus);
  root.getValue = () => value;
  root.setValue = (v, silent = true) => set(v, silent);
  return root;
}

/**
 * A row of tappable chips.
 * @param {object} o  value, options:[{value,label}], onChange, allowNull
 */
export function chipRow(o) {
  const { options, onChange, allowNull = true, scroll = true } = o;
  let value = o.value ?? null;

  const root = el(`div.chips${scroll ? '.chips--scroll' : ''}`);
  const buttons = new Map();

  const paint = () => {
    for (const [v, btn] of buttons) btn.setAttribute('aria-pressed', String(v === value));
  };

  for (const opt of options) {
    const btn = el(`button.chip${opt.highlight ? '.chip--target' : ''}`, {
      type: 'button',
      text: opt.label,
      'aria-pressed': 'false',
    });
    onTap(btn, () => {
      value = allowNull && value === opt.value ? null : opt.value;
      paint();
      onChange?.(value);
    });
    buttons.set(opt.value, btn);
    root.appendChild(btn);
  }

  paint();
  root.getValue = () => value;
  root.setValue = (v) => {
    value = v;
    paint();
  };
  return root;
}

/** RPE 6 → 10 in half steps. The target is highlighted rather than preselected. */
export function rpeRow({ value, target, onChange }) {
  const options = [];
  for (let r = 6; r <= 10; r += 0.5) {
    options.push({ value: r, label: String(r), highlight: target != null && r === target });
  }
  return chipRow({ value, options, onChange });
}

/** Quick rep picks around the prescribed target. */
export function repRow({ value, target, min = 1, max = 30, onChange }) {
  const centre = target ?? 8;
  const lo = Math.max(min, centre - 3);
  const hi = Math.min(max, centre + 3);
  const options = [];
  for (let r = lo; r <= hi; r++) {
    options.push({ value: r, label: String(r), highlight: r === target });
  }
  return chipRow({ value, options, onChange, allowNull: false });
}
