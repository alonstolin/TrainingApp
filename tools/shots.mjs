#!/usr/bin/env node
/** Screenshot the main screens with realistic seeded data. Dev tool only. */

import { chromium, devices } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR ?? './shots';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:4173/TrainingApp/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'], baseURL: BASE });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('PAGE ERROR:', String(e)));
page.on('console', (m) => m.type() === 'error' && console.error('CONSOLE:', m.text()));

await page.goto(BASE);
await page.waitForSelector('.page-title');

// Seed ~6 weeks of plausible history so charts and history have something to show.
const seedReport = await page.evaluate(async () => {
  const store = await import('./src/data/store.js');
  const { CURRENT_PROGRAM } = await import('./src/program/index.js');
  const { resolveSession } = await import('./src/core/prescribe.js');
  const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');

  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const start = new Date();
  start.setDate(start.getDate() - 44);
  store.setMeta({ startDate: iso(start), bodyweightKg: 82, onboarded: true });

  const plan = [
    ['lift:B', 0], ['run:easy', 1], ['lift:A', 2], ['lift:C', 4], ['run:long', 5], ['lift:D', 6],
  ];

  let made = 0;
  const errors = [];

  for (let week = 0; week < 6; week++) {
    for (const [key, offset] of plan) {
     try {
      const d = new Date(start);
      d.setDate(d.getDate() + week * 7 + offset);
      if (d > new Date()) continue;

      const st = store.getState();
      const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
      const ctxObj = {
        weekInMeso: c.weekInMeso,
        runWeek: c.run.week,
        coreCompleted: c.core.completed,
        historyFor: makeHistoryLookup(st.sessions, st.index),
      };
      const actual = key.startsWith('lift:') ? c.lift.nextDayKey : key;
      const resolved = resolveSession(CURRENT_PROGRAM, actual, ctxObj);
      const s = store.startSession(resolved, { mesocycle: c.mesocycle, date: iso(d), bodyweightKg: 82 });

      store.updateSession(s.id, (x) => { x.date = iso(d); });

      if (resolved.kind === 'run') {
        const km = resolved.target.km ?? resolved.target.minutes / 6.5;
        store.updateSession(s.id, (x) => {
          x.run = {
            distanceKm: Math.round(km * 10) / 10,
            durationSec: Math.round(km * (355 - week * 3) + (Math.random() * 40 - 20)),
            effort: resolved.variant === 'long' ? 5 : 3,
            notes: '',
          };
        });
      } else {
        // Starting loads for the very first exposure. From week 2 the app's own
        // progression fills set.weightKg in, so these only seed the baseline.
        const BASE = {
          'incline-bench': 80, ohp: 52.5, 'weighted-pullup': 15,
          'back-squat': 120, rdl: 100, 'leg-press': 180, 'leg-curl': 45, 'calf-raise': 80,
          'cable-lateral-raise': 12.5, 'machine-lateral-raise': 15,
          'overhead-cable-tricep': 25, 'ez-overhead-tricep': 30, 'rope-pushdown': 30,
          'chest-supported-row': 70, 'lat-pulldown': 65, 'reverse-pec-deck': 35,
          'face-pull': 25, 'incline-db-curl': 14, 'preacher-curl': 30, 'bayesian-curl': 15,
        };
        for (const entry of s.entries) {
          for (const set of entry.sets) {
            const weight = set.weightKg ?? BASE[entry.exerciseId] ?? 20;
            // Hit the top of the prescribed range at the target RPE, so double
            // progression actually advances week to week and the charts show a trend.
            const reps = set.targetRepMax ?? set.targetReps ?? 8;
            store.logSet(s.id, entry.entryId, set.setId, {
              weightKg: Math.round(weight * 2) / 2,
              reps,
              seconds: set.targetSeconds ?? null,
              // Constant effort. Logging rpe = the week's rising target would make
              // e1RM sawtooth purely from the RPE adjustment, which is a seeding
              // artefact rather than anything a real log would show.
              rpe: 8,
            });
          }
        }
      }
      store.completeSession(s.id, { feeling: 4 });
      made++;
     } catch (e) { errors.push(`${key} w${week}: ${e.message}`); }
    }
  }
  await store.flush();
  return { made, errors: errors.slice(0, 5), inMemory: store.getState().sessions.length };
});
console.log('  seeded:', JSON.stringify(seedReport));

// Verify it actually reached IndexedDB, not just memory.
const raw = await page.evaluate(async () => {
  const db = await import('./src/data/db.js');
  const rows = await db.getAll(db.STORES.sessions);
  return rows.length;
});
console.log('  in IndexedDB before reload:', raw);

await page.goto(BASE);
await page.waitForSelector('.page-title');
console.log('  after reload:', await page.evaluate(async () => {
  const store = await import('./src/data/store.js');
  return store.getState().sessions.length;
}));

const shot = async (hash, name, prep) => {
  await page.goto(BASE + hash);
  await page.waitForTimeout(700);
  if (prep) await prep();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log('  ' + name);
};

console.log('screenshots:');
await shot('', 'today');
await shot('#/history', 'history');
await shot('#/progress', 'progress-lifts');
await shot('#/progress', 'progress-running', async () => {
  await page.locator('.chip', { hasText: 'Running' }).click();
});
await shot('#/settings', 'settings');

// A live lift session.
await page.goto(BASE);
await page.waitForTimeout(500);
const startBtn = page.locator('button.btn--xl').first();
if (await startBtn.count()) {
  await startBtn.click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'session-lift.png') });
  console.log('  session-lift');
}

await browser.close();
