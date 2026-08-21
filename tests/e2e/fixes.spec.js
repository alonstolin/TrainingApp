import { test, expect } from '@playwright/test';

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

const startFirstSession = async (page) => {
  await page.locator('button.btn--xl').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();
};

// ---------------------------------------------------------------------------
// Decimal weights
// ---------------------------------------------------------------------------

test('a decimal weight is logged exactly as typed', async ({ page }) => {
  // The reported bug: entering 6.25 on a 2.5kg stepper became 7.5, because the
  // keypad value was being snapped onto the +/- grid.
  await boot(page);
  await startFirstSession(page);

  await page.locator('.stepper-value').first().click();
  await expect(page.locator('.sheet')).toBeVisible();
  await page.locator('.numfield').fill('6.25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();

  await expect(page.locator('.stepper-num').first()).toHaveText('6.25');
});

test('stepping from a decimal keeps the offset instead of snapping', async ({ page }) => {
  await boot(page);
  await startFirstSession(page);

  await page.locator('.stepper-value').first().click();
  await page.locator('.numfield').fill('6.25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await expect(page.locator('.stepper-num').first()).toHaveText('6.25');

  await page.locator('.stepper button', { hasText: '+' }).first().click();
  await expect(page.locator('.stepper-num').first()).toHaveText('8.75');
  await page.locator('.stepper button', { hasText: '−' }).first().click();
  await expect(page.locator('.stepper-num').first()).toHaveText('6.25');
});

test('a decimal weight survives being logged and reloaded', async ({ page }) => {
  await boot(page);
  await startFirstSession(page);

  await page.locator('.stepper-value').first().click();
  await page.locator('.numfield').fill('6.25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await expect(page.locator('.setrow--done').first()).toBeVisible();

  const stored = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    await store.flush();
    return store.activeSession().entries[0].sets.find((s) => s.done)?.weightKg;
  });
  expect(stored).toBe(6.25);
});

test('comma decimals are accepted, and junk is ignored', async ({ page }) => {
  await boot(page);
  await startFirstSession(page);

  await page.locator('.stepper-value').first().click();
  await page.locator('.numfield').fill('7,25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await expect(page.locator('.stepper-num').first()).toHaveText('7.25');

  await page.locator('.stepper-value').first().click();
  await page.locator('.numfield').fill('abc');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();
  await expect(page.locator('.stepper-num').first()).toHaveText('7.25', { timeout: 3000 });
});

test('a custom increment changes the suggested load, not just the buttons', async ({ page }) => {
  await boot(page);
  await page.goto('./#/exercise/cable-lateral-raise');
  await expect(page.locator('.page-title')).toContainText('Cable Lateral Raise');

  await page.locator('.stepper-value').first().click();
  await page.locator('.numfield').fill('6.25');
  await page.locator('.sheet button', { hasText: /^Set$/ }).click();

  const applied = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { getExercise } = await import('./src/program/exercises.js');
    await store.flush();
    return {
      meta: store.getState().meta.increments['cable-lateral-raise'],
      live: getExercise('cable-lateral-raise').increment,
    };
  });
  expect(applied.meta).toBe(6.25);
  expect(applied.live).toBe(6.25);

  // And it survives a reload, since it is stored not just held in memory.
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible();
  const afterReload = await page.evaluate(async () => {
    const { getExercise } = await import('./src/program/exercises.js');
    return getExercise('cable-lateral-raise').increment;
  });
  expect(afterReload).toBe(6.25);
});

// ---------------------------------------------------------------------------
// Muscle overlap guard
// ---------------------------------------------------------------------------

/** Complete one specific lift day, dated today, so the guard can see it. */
async function completeDay(page, dayKey) {
  await page.evaluate(async (key) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
    const r = resolveSession(CURRENT_PROGRAM, key, {
      weekInMeso: c.weekInMeso, runWeek: c.run.week, coreCompleted: c.core.completed,
      historyFor: makeHistoryLookup(st.sessions, st.index),
    });
    const s = store.startSession(r, { mesocycle: c.mesocycle, bodyweightKg: 82 });
    for (const e of s.entries) {
      for (const set of e.sets) {
        store.logSet(s.id, e.entryId, set.setId, { weightKg: set.weightKg ?? 40, reps: 6, rpe: 7 });
      }
    }
    store.completeSession(s.id, {});
    await store.flush();
  }, dayKey);
}

test('training back and biceps yesterday warns before repeating them', async ({ page }) => {
  await boot(page);
  await completeDay(page, 'lift:C'); // pull-up heavy, rows, curls

  // Force the cursor to offer Lower, which carries pull-up volume and curls.
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible();

  const offered = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { overlapWarning } = await import('./src/core/schedule.js');
    return overlapWarning(store.getState().sessions, CURRENT_PROGRAM, 'lift:B');
  });
  expect(offered).not.toBeNull();
  expect(offered.muscles).toEqual(['back', 'biceps']);
  expect(offered.suggestion).toBeTruthy();
});

test('the program as designed never triggers the warning', async ({ page }) => {
  await boot(page);
  const clean = await page.evaluate(async () => {
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { overlapWarning } = await import('./src/core/schedule.js');
    const now = Date.now();
    const cycle = CURRENT_PROGRAM.liftCycle;
    const hits = [];
    for (let i = 0; i < cycle.length; i++) {
      const prev = cycle[i];
      const next = cycle[(i + 1) % cycle.length];
      const w = overlapWarning(
        [{ kind: 'lift', status: 'completed', dayKey: prev, completedAt: new Date(now - 18 * 3.6e6).toISOString() }],
        CURRENT_PROGRAM, next, { now },
      );
      if (w) hits.push(`${prev}->${next}: ${w.muscles.join(',')}`);
    }
    return hits;
  });
  expect(clean).toEqual([]);
});

// ---------------------------------------------------------------------------
// Run stopwatch and GPS
// ---------------------------------------------------------------------------

/** Feed a synthetic northward track to watchPosition. */
async function stubGeolocation(page, { points = 60, denied = false } = {}) {
  await page.addInitScript(
    ({ points, denied }) => {
      let watchSeq = 0;
      const timers = new Map();
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          watchPosition(onOk, onErr) {
            const id = ++watchSeq;
            if (denied) {
              setTimeout(() => onErr?.({ code: 1, message: 'denied' }), 10);
              return id;
            }
            let i = 0;
            const startT = Date.now();
            const h = setInterval(() => {
              if (i >= points) return;
              // ~8.9m north per fix, with timestamps 3s apart: ~3 m/s, or 5:37/km.
              // The fix TIMESTAMPS must advance at a plausible pace even though the
              // harness emits them quickly — geo.js rejects implausible speeds, so
              // firing 9m apart every 20ms would look like teleporting and every
              // point would (correctly) be thrown away.
              onOk({
                coords: {
                  latitude: 51.5 + i * 0.00008,
                  longitude: -0.12,
                  accuracy: 6,
                },
                timestamp: startT + i * 3000,
              });
              i++;
            }, 20);
            timers.set(id, h);
            return id;
          },
          clearWatch(id) {
            clearInterval(timers.get(id));
            timers.delete(id);
          },
        },
      });
    },
    { points, denied },
  );
}

/** Get to a run session regardless of what today offers. */
async function startRun(page) {
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const s = store.startSession(
      resolveSession(CURRENT_PROGRAM, 'run:easy', { runWeek: 6, historyFor: () => null }),
      { mesocycle: 1, bodyweightKg: 82 },
    );
    location.hash = `#/session/${s.id}`;
  });
  await expect(page.locator('.screen--session')).toBeVisible();
}

test('the stopwatch fills in the run duration', async ({ page }) => {
  await boot(page);
  await startRun(page);

  await page.locator('button', { hasText: 'Stopwatch' }).click();
  await page.locator('button', { hasText: /^Start timer$/ }).click();
  await expect(page.locator('.bigtimer-face')).toBeVisible();
  await page.waitForTimeout(2200);
  await page.locator('button', { hasText: /^Use this$/ }).click();

  const secs = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.activeSession().run?.durationSec ?? 0;
  });
  expect(secs).toBeGreaterThanOrEqual(2);
  expect(secs).toBeLessThan(15);
});

test('a GPS-tracked run records distance and draws the route', async ({ page }) => {
  await stubGeolocation(page, { points: 80 });
  await boot(page);
  await startRun(page);

  await page.locator('button', { hasText: 'Track with GPS' }).click();
  await page.locator('button', { hasText: /^Start run$/ }).click();
  await page.waitForTimeout(2500);

  // A route should be drawing itself as fixes arrive.
  await expect(page.locator('.trackshape')).toBeVisible();

  await page.locator('button', { hasText: /^Use this$/ }).click();

  const run = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    await store.flush();
    const r = store.activeSession().run ?? {};
    return { km: r.distanceKm, sec: r.durationSec, track: r.track?.length ?? 0 };
  });
  // 80 fixes x ~9m ≈ 0.7km; assert it is in a sane band rather than exact,
  // since the harness cannot control fix timing precisely.
  expect(run.km).toBeGreaterThan(0.2);
  expect(run.km).toBeLessThan(1.5);
  expect(run.sec).toBeGreaterThan(0);
  expect(run.track).toBeGreaterThan(2);
});

test('a GPS run can be logged and its route survives a reload', async ({ page }) => {
  await stubGeolocation(page, { points: 60 });
  await boot(page);
  await startRun(page);

  await page.locator('button', { hasText: 'Track with GPS' }).click();
  await page.locator('button', { hasText: /^Start run$/ }).click();
  await page.waitForTimeout(2000);
  await page.locator('button', { hasText: /^Use this$/ }).click();
  await page.locator('button', { hasText: /^Log run$/ }).click();

  await expect(page.locator('.page-title')).toBeVisible();
  await page.goto('./#/history');
  await page.locator('.listitem').first().click();
  await expect(page.locator('.trackshape')).toBeVisible();
});

test('denied GPS permission explains itself instead of dead-ending', async ({ page }) => {
  await stubGeolocation(page, { denied: true });
  await boot(page);
  await startRun(page);

  await page.locator('button', { hasText: 'Track with GPS' }).click();
  await page.locator('button', { hasText: /^Start run$/ }).click();
  await expect(page.locator('.screen')).toContainText(/permission denied|unavailable/i);

  // Manual entry still works.
  await expect(page.locator('.stepper').first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// Running charts
// ---------------------------------------------------------------------------

test('pace is charted per run type, not as one mixed line', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const iso = (d) => d.toISOString().slice(0, 10);
    for (let w = 0; w < 4; w++) {
      for (const [variant, km, sec] of [['easy', 4 + w * 0.1, 1400], ['long', 6 + w * 0.5, 2500 + w * 200]]) {
        const d = new Date();
        d.setDate(d.getDate() - (28 - w * 7));
        const r = resolveSession(CURRENT_PROGRAM, `run:${variant}`, { runWeek: w + 1, historyFor: () => null });
        const s = store.startSession(r, { mesocycle: 1, date: iso(d), bodyweightKg: 82 });
        store.updateSession(s.id, (x) => { x.run = { distanceKm: km, durationSec: sec, effort: 4, notes: '' }; });
        store.completeSession(s.id, {});
      }
    }
    await store.flush();
  });

  await page.goto('./#/progress');
  await page.locator('.chips button', { hasText: 'Running' }).click();

  await expect(page.locator('.chart-series-label', { hasText: 'Easy runs' })).toBeVisible();
  await expect(page.locator('.chart-series-label', { hasText: 'Long runs' })).toBeVisible();
  await expect(page.locator('.chart-card', { hasText: 'Long run distance' })).toBeVisible();

  // The apologetic caveat is gone because the chart no longer needs one.
  await expect(page.locator('.screen')).not.toContainText('Expect this to drift UP');
});

test('a single run of a type shows a note rather than a broken chart', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const r = resolveSession(CURRENT_PROGRAM, 'run:easy', { runWeek: 1, historyFor: () => null });
    const s = store.startSession(r, { mesocycle: 1, bodyweightKg: 82 });
    store.updateSession(s.id, (x) => { x.run = { distanceKm: 4, durationSec: 1400, effort: 4, notes: '' }; });
    store.completeSession(s.id, {});
    await store.flush();
  });

  await page.goto('./#/progress');
  await page.locator('.chips button', { hasText: 'Running' }).click();
  await expect(page.locator('.screen')).toContainText('a trend needs at least two');
  await expect(page.locator('.screen')).toContainText('None logged yet');
});

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

test('Settings can check for updates and reports the result', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  await page.goto('./#/settings');
  await expect(page.locator('.page-title')).toContainText('Settings');

  const btn = page.locator('button', { hasText: 'Check for updates' });
  await expect(btn).toBeVisible();
  await btn.click();

  // Already on the newest build, so it should say so rather than sit silent.
  await expect(page.locator('.toast')).toContainText(/latest|Downloading|reloading/i, { timeout: 10_000 });
});

test('a worker waiting from a previous launch is applied, not ignored', async ({ page }) => {
  // The exact trap: an update installs, the user does not tap the pill, and the
  // worker sits in `waiting`. On the next launch no `updatefound` fires — it is
  // already installed — so nothing ever applies it.
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);

  const applied = await page.evaluate(async () => {
    const { updateDecision } = await import('./src/core/updates.js');
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      // The registration surface the fix depends on actually exists here.
      hasWaitingProperty: 'waiting' in reg,
      decisionAtLaunch: updateDecision({ waiting: true, activeSession: false }),
      decisionMidWorkout: updateDecision({ waiting: true, activeSession: true }),
      checkExposed: typeof window.__checkForUpdate === 'function',
    };
  });

  expect(applied.hasWaitingProperty).toBe(true);
  expect(applied.decisionAtLaunch).toBe('apply');
  expect(applied.decisionMidWorkout).toBe('prompt');
  expect(applied.checkExposed).toBe(true);
});

test('the version shown in Settings matches the running service worker', async ({ page }) => {
  // If these ever disagree, the app is serving files from an older cache than it
  // thinks — which is precisely the failure that is hard to notice.
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto('./#/settings');

  const shown = await page.locator('.screen').textContent();
  const swVersion = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve(e.data.version);
        navigator.serviceWorker.controller.postMessage({ type: 'VERSION' }, [ch.port2]);
        setTimeout(() => resolve(null), 3000);
      }),
  );
  expect(swVersion).toBeTruthy();
  expect(shown).toContain(swVersion);
});
