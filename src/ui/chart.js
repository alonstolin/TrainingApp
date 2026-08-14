/**
 * Hand-rolled SVG charts. No library, no CDN — nothing external can load offline
 * anyway, and this is ~3 chart shapes over a few hundred points.
 *
 * Two deliberate constraints, both of which are the usual way fitness charts
 * mislead:
 *
 *  1. NO dual-axis charts. Plotting distance and pace against two y-axes makes
 *     any relationship between them look real when it is an artefact of the
 *     independent scalings. Running gets two stacked charts sharing an x-axis.
 *  2. NO shared y-axis across the three main lifts. Incline bench e1RM (~90kg)
 *     and weighted pull-up added load (~25kg) on one scale renders the pull-up
 *     as a flat line at the bottom. Lifts get small multiples, each with its own
 *     y-domain, plus an indexed (%-of-start) view for comparing rates.
 *
 * There is no hover on a phone, so the interaction is tap-to-inspect: tapping
 * snaps to the nearest point and writes it into a caption line BELOW the chart,
 * never a floating tooltip that a thumb would cover.
 */

import { el } from './dom.js';
import { formatDate } from '../core/dates.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v != null) n.setAttribute(k, v);
  }
  return n;
};

/** "Nice" axis bounds with a little headroom, snapped to human numbers. */
function niceDomain(values, { zeroBase = false } = {}) {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  if (lo === hi) {
    lo = zeroBase ? 0 : lo * 0.95;
    hi = hi * 1.05 || 1;
  }
  if (zeroBase) lo = 0;
  else {
    const pad = (hi - lo) * 0.12;
    lo -= pad;
    hi += pad;
  }
  const span = hi - lo;
  const mag = 10 ** Math.floor(Math.log10(span || 1));
  const stepChoices = [1, 2, 2.5, 5, 10].map((s) => s * mag);
  const step = stepChoices.find((s) => span / s <= 5) ?? stepChoices.at(-1);
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step, step];
}

/**
 * Line chart.
 * @param {object} o points:[{date,value,...}], color, height, unit, formatValue, zeroBase
 */
export function lineChart(o) {
  const {
    points,
    color = 'var(--accent)',
    height = 150,
    unit = '',
    formatValue = (v) => String(Math.round(v * 10) / 10),
    zeroBase = false,
    caption,
  } = o;

  if (!points || points.length === 0) {
    return el('div.chart-empty', { text: 'No data yet.' });
  }

  const W = 320;
  const H = height;
  const PAD = { t: 10, r: 8, b: 20, l: 34 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const values = points.map((p) => p.value);
  const [lo, hi, step] = niceDomain(values, { zeroBase });
  const x = (i) => PAD.l + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${W} ${H}`,
    width: '100%',
    height: H,
    preserveAspectRatio: 'none',
    role: 'img',
  });

  // Recessive hairline grid — present enough to read against, never competing.
  for (let v = lo; v <= hi + 1e-9; v += step) {
    svg.appendChild(
      svgEl('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }),
    );
    svg.appendChild(
      svgEl('text', {
        x: PAD.l - 5, y: y(v) + 3, 'text-anchor': 'end',
        fill: 'var(--ink-4)', 'font-size': 8, 'font-family': 'var(--mono)',
      }),
    ).textContent = formatValue(v);
  }

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');

  // Soft fill under the line for figure/ground, kept well below the line's weight.
  svg.appendChild(
    svgEl('path', {
      d: `${d} L${x(points.length - 1).toFixed(1)},${PAD.t + ih} L${x(0).toFixed(1)},${PAD.t + ih} Z`,
      fill: color, opacity: 0.1,
    }),
  );
  svg.appendChild(
    svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
  );

  for (let i = 0; i < points.length; i++) {
    svg.appendChild(svgEl('circle', { cx: x(i), cy: y(points[i].value), r: 2.5, fill: color }));
  }

  const marker = svgEl('circle', { r: 5, fill: color, stroke: 'var(--bg)', 'stroke-width': 2, opacity: 0 });
  const rule = svgEl('line', { stroke: 'var(--line-strong)', 'stroke-width': 1, opacity: 0, y1: PAD.t, y2: PAD.t + ih });
  svg.appendChild(rule);
  svg.appendChild(marker);

  const cap = el('div.chart-caption', {
    text: caption ?? `${points.length} session${points.length === 1 ? '' : 's'} · tap the chart to inspect`,
  });

  const inspect = (clientX) => {
    const rect = svg.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dd = Math.abs(x(i) - px);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    const p = points[best];
    marker.setAttribute('cx', x(best));
    marker.setAttribute('cy', y(p.value));
    marker.setAttribute('opacity', 1);
    rule.setAttribute('x1', x(best));
    rule.setAttribute('x2', x(best));
    rule.setAttribute('opacity', 1);
    cap.textContent = `${formatDate(p.date)} · ${formatValue(p.value)}${unit}${p.detail ? ` · ${p.detail}` : ''}`;
  };

  svg.style.touchAction = 'pan-y';
  svg.addEventListener('pointerdown', (ev) => inspect(ev.clientX));
  svg.addEventListener('pointermove', (ev) => {
    if (ev.buttons) inspect(ev.clientX);
  });

  return el('div', null, svg, cap);
}

/** Bar chart. Used for weekly running distance. */
export function barChart(o) {
  const { bars, color = 'var(--accent)', height = 130, unit = 'km', formatValue = (v) => String(v), caption } = o;
  if (!bars || bars.length === 0) return el('div.chart-empty', { text: 'No data yet.' });

  const W = 320;
  const H = height;
  const PAD = { t: 10, r: 8, b: 20, l: 34 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const [lo, hi, step] = niceDomain(bars.map((b) => b.value), { zeroBase: true });
  const y = (v) => PAD.t + ih - ((v - lo) / (hi - lo || 1)) * ih;
  const bw = Math.max(3, (iw / bars.length) * 0.62);

  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, preserveAspectRatio: 'none', role: 'img' });

  for (let v = lo; v <= hi + 1e-9; v += step) {
    svg.appendChild(svgEl('line', { x1: PAD.l, x2: W - PAD.r, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
    svg.appendChild(
      svgEl('text', { x: PAD.l - 5, y: y(v) + 3, 'text-anchor': 'end', fill: 'var(--ink-4)', 'font-size': 8, 'font-family': 'var(--mono)' }),
    ).textContent = formatValue(v);
  }

  const cx = (i) => PAD.l + (i + 0.5) * (iw / bars.length);
  bars.forEach((b, i) => {
    const h = Math.max(0, PAD.t + ih - y(b.value));
    svg.appendChild(
      svgEl('rect', {
        x: cx(i) - bw / 2, y: y(b.value), width: bw, height: h,
        rx: Math.min(2, bw / 3), fill: b.color ?? color, opacity: b.value === 0 ? 0.25 : 1,
      }),
    );
  });

  const cap = el('div.chart-caption', { text: caption ?? `${bars.length} weeks · tap to inspect` });

  svg.style.touchAction = 'pan-y';
  svg.addEventListener('pointerdown', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    bars.forEach((_, i) => {
      const dd = Math.abs(cx(i) - px);
      if (dd < bestD) { bestD = dd; best = i; }
    });
    const b = bars[best];
    cap.textContent = `${b.label} · ${formatValue(b.value)}${unit}`;
  });

  return el('div', null, svg, cap);
}

/**
 * Small multiples — one mini line per series, each with its OWN y-domain.
 * This is the correct default for comparing lifts on wildly different scales.
 */
export function smallMultiples(series) {
  return el(
    'div.stack',
    null,
    ...series.map((s) =>
      el(
        'div',
        null,
        el(
          'div.row-between',
          { style: { marginBottom: '0.35rem' } },
          el('div.row', { style: { gap: '0.5rem' } },
            el('span', { style: { width: '9px', height: '9px', borderRadius: '99px', background: s.color, display: 'inline-block' } }),
            el('span.small', { text: s.name }),
          ),
          el('span.small.num.muted', { text: s.summary ?? '' }),
        ),
        lineChart({
          points: s.points,
          color: s.color,
          height: 108,
          unit: s.unit ?? 'kg',
          caption: s.points.length ? undefined : 'No data yet.',
        }),
      ),
    ),
  );
}
