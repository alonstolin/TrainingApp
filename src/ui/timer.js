/**
 * Rest timer and hold timer.
 *
 * CRITICAL: timers are driven by a stored wall-clock START TIMESTAMP, never by a
 * surviving setInterval. iOS suspends and kills backgrounded web apps constantly;
 * an interval-based timer silently pauses (or dies) the moment you put the phone
 * down between sets, which is exactly when a rest timer needs to be running.
 * Recomputing from Date.now() on every tick and on resume is the only correct model.
 */

import { el, onTap } from './dom.js';
import { formatDuration } from '../core/dates.js';

const REST_KEY = 'training.rest';

let tickHandle = null;
let audioCtx = null;

/**
 * iOS gives no vibration API to web apps, so completion is a short beep plus a
 * strong visual flash. AudioContext must be unlocked by a real user gesture —
 * we do that on the "start session" tap.
 */
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    /* audio is a nicety, never a requirement */
  }
}

function beep(times = 2) {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    const t = now + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.start(t);
    osc.stop(t + 0.18);
  }
}

// ---------------------------------------------------------------------------
// Rest timer (persistent bottom bar)
// ---------------------------------------------------------------------------

function readRest() {
  try {
    const raw = localStorage.getItem(REST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRest(v) {
  try {
    if (v) localStorage.setItem(REST_KEY, JSON.stringify(v));
    else localStorage.removeItem(REST_KEY);
  } catch {
    /* private mode — the timer degrades to session-only, which is acceptable */
  }
}

export function startRest(seconds, label = '') {
  writeRest({ startedAt: Date.now(), seconds, label, alerted: false });
  renderRest();
}

export function stopRest() {
  writeRest(null);
  renderRest();
}

export function renderRest() {
  const bar = document.getElementById('rest-bar');
  if (!bar) return;

  const rest = readRest();
  if (!rest) {
    bar.hidden = true;
    bar.className = 'rest-bar';
    clearInterval(tickHandle);
    tickHandle = null;
    return;
  }

  // Recomputed from wall clock every tick — correct after any suspension.
  const elapsed = (Date.now() - rest.startedAt) / 1000;
  const remaining = Math.ceil(rest.seconds - elapsed);
  const over = remaining <= 0;

  if (over && !rest.alerted) {
    beep();
    writeRest({ ...rest, alerted: true });
  }

  // A rest timer left running for over an hour is stale, not informative.
  if (elapsed > 3600) {
    stopRest();
    return;
  }

  const inSession = document.querySelector('.screen--session') != null;
  bar.className = `rest-bar${over ? ' rest-bar--done' : ''}${inSession ? ' rest-bar--session' : ''}`;
  bar.hidden = false;

  if (!bar.dataset.built) {
    bar.dataset.built = '1';
    bar.appendChild(el('div.rest-time.num'));
    bar.appendChild(el('div.grow.small'));
    bar.appendChild(
      onTap(el('button.btn.btn--sm.btn--ghost', { type: 'button', text: 'Skip' }), stopRest),
    );
  }

  bar.children[0].textContent = over
    ? `+${formatDuration(-remaining)}`
    : formatDuration(remaining);
  bar.children[1].textContent = over ? `${rest.label} — ready` : `Rest · ${rest.label}`;

  if (!tickHandle) tickHandle = setInterval(renderRest, 500);
}

/** Re-sync on resume. iOS fires visibilitychange when the app comes back. */
export function attachTimerLifecycle() {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderRest();
  });
  window.addEventListener('pageshow', renderRest);
  renderRest();
}

// ---------------------------------------------------------------------------
// Hold timer (core planks) — count up, target marked
// ---------------------------------------------------------------------------

export function holdTimer({ targetSeconds, onDone }) {
  let startedAt = null;
  let handle = null;
  let elapsed = 0;

  const face = el('div.bigtimer-face.num', { text: '0:00' });
  const target = el('div.bigtimer-target', {
    text: targetSeconds ? `Target ${targetSeconds}s` : 'Hold',
  });

  const paint = () => {
    const secs = startedAt ? (Date.now() - startedAt) / 1000 + elapsed : elapsed;
    face.textContent = formatDuration(secs);
    const hit = targetSeconds && secs >= targetSeconds;
    face.className = `bigtimer-face num${hit ? ' bigtimer-face--over' : ''}`;
    if (hit && !face.dataset.beeped) {
      face.dataset.beeped = '1';
      beep(1);
    }
  };

  const btn = el('button.btn.btn--primary.btn--xl.btn--block', { type: 'button', text: 'Start hold' });

  onTap(btn, () => {
    if (startedAt) {
      elapsed += (Date.now() - startedAt) / 1000;
      startedAt = null;
      clearInterval(handle);
      handle = null;
      btn.textContent = 'Resume';
      paint();
      onDone?.(Math.round(elapsed));
    } else {
      startedAt = Date.now();
      handle = setInterval(paint, 200);
      btn.textContent = 'Stop';
      paint();
    }
  });

  const root = el('div.bigtimer', null, face, target, btn);
  root.stop = () => {
    clearInterval(handle);
    handle = null;
  };
  root.getSeconds = () =>
    Math.round(startedAt ? (Date.now() - startedAt) / 1000 + elapsed : elapsed);
  root.reset = () => {
    root.stop();
    startedAt = null;
    elapsed = 0;
    delete face.dataset.beeped;
    btn.textContent = 'Start hold';
    paint();
  };
  return root;
}

/**
 * Keep the screen awake during a session so it does not sleep between sets.
 * iOS releases the lock on backgrounding, so it must be re-acquired on resume.
 */
export function keepAwake() {
  let lock = null;
  let active = true;

  const acquire = async () => {
    try {
      if (!active || document.hidden) return;
      lock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      /* denied or unsupported — not worth surfacing */
    }
  };
  const onVis = () => {
    if (!document.hidden) acquire();
  };

  acquire();
  document.addEventListener('visibilitychange', onVis);

  return () => {
    active = false;
    document.removeEventListener('visibilitychange', onVis);
    lock?.release?.().catch(() => {});
    lock = null;
  };
}
