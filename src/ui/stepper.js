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
import { openSheet } from './sheet.js';

/** Two decimals is the finest granularity any gym equipment actually offers. */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Numeric entry for a value the +/- grid cannot reach.
 *
 * `inputmode="decimal"` rather than `type="number"`: iOS gives a proper decimal
 * keypad, and a text input never silently discards a partially-typed value the
 * way a number input does.
 */
function keypadSheet({ label, value, unit, onSubmit }) {
  const input = el('input.numfield.num', {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    value: value == null ? '' : String(value),
    'aria-label': label || 'Value',
  });

  const commit = () => {
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') return onSubmit(null);
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onSubmit(parsed);
  };

  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      commit();
      close();
    }
  });

  const close = openSheet({
    title: label || 'Enter a value',
    subtitle: 'Any value goes in exactly as typed — 6.25 stays 6.25.',
    content: el(
      'label.numfield-wrap',
      null,
      input,
      unit ? el('span.numfield-unit', { text: unit }) : null,
    ),
    actions: [
      { label: 'Set', onSelect: commit },
      { label: 'Cancel', variant: 'ghost' },
    ],
  });

  // The tap that opened the sheet is still the active gesture, so iOS allows
  // focus here and the keypad comes up without a second tap.
  requestAnimationFrame(() => {
    input.focus();
    input.select?.();
  });
}

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
      // Deliberately NOT snapped to the step grid. Snapping used to apply to
      // typed input too, so entering 6.25 on a 2.5 stepper silently became 7.5
      // (round(6.25/2.5)=3, 3*2.5=7.5) — the app quietly logging a weight you
      // did not lift. Rounding to 2dp is enough to stop float drift, and +/-
      // now moves BY the step from wherever you are: 6.25 → 8.75, keeping the
      // offset instead of collapsing it.
      value = Math.min(max, Math.max(min, round2(next)));
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
    onTap(valueBox, () =>
      keypadSheet({ label, value, unit: o.unit ?? '', onSubmit: (v) => set(v) }),
    );
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
