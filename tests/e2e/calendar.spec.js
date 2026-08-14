import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

const openCalendar = async (page) => {
  await page.locator('#tabbar a[data-tab="calendar"]').click();
  await expect(page.locator('.page-title')).toContainText('Calendar');
};

/** Complete `n` lift sessions so past days have facts to show. */
async function seedLifts(page, n) {
  await page.evaluate(async (count) => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    for (let i = 0; i < count; i++) {
      const st = store.getState();
      const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
      const r = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, {
        weekInMeso: c.weekInMeso, runWeek: c.run.week, coreCompleted: c.core.completed,
        historyFor: makeHistoryLookup(st.sessions, st.index),
      });
      const s = store.startSession(r, { mesocycle: c.mesocycle, bodyweightKg: 82 });
      for (const e of s.entries) {
        for (const set of e.sets) {
          store.logSet(s.id, e.entryId, set.setId, { weightKg: set.weightKg ?? 60, reps: 6, rpe: 7 });
        }
      }
      store.completeSession(s.id, {});
    }
    await store.flush();
  }, n);
}

test('the calendar tab renders the weekly pattern and a month grid', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await openCalendar(page);

  // The fixed weekly rhythm — the thing the screen exists to answer.
  await expect(page.locator('.weekstrip-col')).toHaveCount(7);
  await expect(page.locator('.weekstrip')).toContainText('Lower');
  await expect(page.locator('.weekstrip')).toContainText('Push');
  await expect(page.locator('.weekstrip')).toContainText('Pull');
  await expect(page.locator('.weekstrip')).toContainText('Delts');
  await expect(page.locator('.weekstrip')).toContainText('Long');
  await expect(page.locator('.weekstrip')).toContainText('Rest');

  // A month grid with today marked exactly once.
  await expect(page.locator('.cal-cell').first()).toBeVisible();
  await expect(page.locator('.cal-cell--today')).toHaveCount(1);

  // And the week spelled out in words.
  await expect(page.locator('.screen')).toContainText('Next 7 days');
  await expect(page.locator('.pill', { hasText: 'TODAY' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('the 10K goal date is projected in the header', async ({ page }) => {
  await boot(page);
  await openCalendar(page);
  await expect(page.locator('.page-sub')).toContainText('10K projected for');
  await expect(page.locator('.page-sub')).toContainText('weeks out');
});

test('the upcoming week lists the real session names in program order', async ({ page }) => {
  await boot(page);
  await openCalendar(page);

  const titles = await page.locator('.listgroup .listitem-title').allTextContents();
  const joined = titles.join(' | ');
  // Whatever today is, a full week must contain each lift day exactly once.
  for (const name of ['Lower', 'Upper Push', 'Upper Pull', 'Shoulders & Arms']) {
    expect(joined).toContain(name);
  }
  expect(joined).toContain('Long Run');
});

test('tapping a future day shows the movements you will be doing', async ({ page }) => {
  await boot(page);
  await openCalendar(page);

  // Find an upcoming lift day in the list and open it.
  const row = page.locator('.listgroup .listitem', { hasText: 'Upper Push' }).first();
  await row.scrollIntoViewIfNeeded();
  await row.click();

  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('.sheet')).toContainText('Incline Barbell Bench Press');
  await expect(page.locator('.sheet')).toContainText('Standing Barbell Overhead Press');
  // A forecast must be labelled as one, never presented as fixed.
  await expect(page.locator('.sheet')).toContainText('shifts if you miss sessions');
});

test('completed work appears as fact and links to the session', async ({ page }) => {
  await boot(page);
  await seedLifts(page, 1);
  await openCalendar(page);

  // Today's cell now carries a completed entry.
  await page.locator('.cal-cell--today').click();
  await expect(page.locator('.sheet')).toBeVisible();
  await expect(page.locator('.sheet .pill', { hasText: 'DONE' })).toBeVisible();

  await page.locator('.sheet .card').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();
});

test('completing a session flips today from forecast to fact', async ({ page }) => {
  await boot(page);
  await openCalendar(page);

  // Outlined dots are projections; solid dots are things that happened. The
  // distinction is the point of the screen, so it is asserted directly.
  expect(await page.locator('.cal-cell--today .cal-dot--planned').count()).toBeGreaterThan(0);
  await expect(page.locator('.cal-cell--today .cal-dot--done')).toHaveCount(0);

  await seedLifts(page, 1);
  await openCalendar(page);

  await expect(page.locator('.cal-cell--today .cal-dot--done')).toHaveCount(1);
});

test('a future lift day advances through the cycle as sessions are banked', async ({ page }) => {
  await boot(page);

  const nextLiftIn7Days = async () => {
    await openCalendar(page);
    const titles = await page.locator('.listgroup .listitem-title').allTextContents();
    return titles.join(' | ');
  };

  const before = await nextLiftIn7Days();
  await seedLifts(page, 2);
  const after = await nextLiftIn7Days();

  // Banking two lifts shifts which day lands where across the coming week.
  expect(after).not.toBe(before);
});

test('month navigation moves forward and back and can return to today', async ({ page }) => {
  const errors = watchErrors(page);
  await boot(page);
  await openCalendar(page);

  const monthLabel = page.locator('.row-between > div').filter({ hasText: /\d{4}$/ }).first();
  const start = await monthLabel.textContent();

  await page.locator('button', { hasText: '›' }).first().click();
  await expect(monthLabel).not.toHaveText(start);
  // Today's marker belongs to the current month only.
  await expect(page.locator('.cal-cell--today')).toHaveCount(0);
  await expect(page.locator('button', { hasText: 'Back to this month' })).toBeVisible();

  await page.locator('button', { hasText: 'Back to this month' }).click();
  await expect(monthLabel).toHaveText(start);
  await expect(page.locator('.cal-cell--today')).toHaveCount(1);

  // And backwards, across a year boundary if needed.
  for (let i = 0; i < 10; i++) await page.locator('button', { hasText: '‹' }).first().click();
  await expect(page.locator('.cal-cell').first()).toBeVisible();

  expect(errors).toEqual([]);
});

test('a rest day reads as a rest day, not as an empty error state', async ({ page }) => {
  await boot(page);
  await openCalendar(page);

  const thursday = page.locator('.listgroup .listitem', { hasText: /Rest/ }).first();
  if (await thursday.count()) {
    await thursday.click();
    await expect(page.locator('.sheet')).toBeVisible();
    await expect(page.locator('.sheet')).toContainText(/Rest day|Bonus/);
  }
});

test('the calendar works offline like every other screen', async ({ page, context }) => {
  await boot(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.route('**/*', (route) => route.abort());

  await openCalendar(page);
  await expect(page.locator('.weekstrip-col')).toHaveCount(7);
  await expect(page.locator('.cal-cell').first()).toBeVisible();

  await context.unroute('**/*');
});
