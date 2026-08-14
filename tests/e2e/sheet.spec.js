import { test, expect } from '@playwright/test';

/** Swipe-down-to-dismiss on bottom sheets. */

const boot = async (page) => {
  await page.goto('./');
  await expect(page.locator('.page-title')).toBeVisible({ timeout: 10_000 });
};

/** Open the "Something else" sheet from Today. */
async function openSheet(page) {
  const other = page.locator('button', { hasText: 'Something else' });
  if (await other.count()) await other.click();
  else await page.locator('button', { hasText: 'Train something anyway' }).click();
  await expect(page.locator('.sheet')).toBeVisible();
  // Wait out the entry animation. Measuring the handle's position mid-slide
  // gives coordinates that are stale by the time the drag starts.
  await expect(page.locator('.sheet--entering')).toHaveCount(0);
}

/**
 * Drag from a point on the sheet downward by `distance`.
 *
 * Dispatches real PointerEvents rather than using page.mouse: under WebKit touch
 * emulation the mouse API produces no events at all, and Playwright's touchscreen
 * API only supports taps, not drags. Pointer events are exactly what iOS Safari
 * synthesises from touch, so this exercises the same code path the phone will.
 *
 * The moves are awaited individually so each event carries a real timestamp —
 * dispatching them in one batch would give every event the same time and make
 * velocity (and therefore flick detection) meaningless.
 */
async function dragDown(page, { from, distance, steps = 12, pause = 12 }) {
  const fire = (type, x, y) =>
    page.evaluate(
      ({ type, x, y }) => {
        const init = {
          pointerId: 1,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true,
        };
        if (type === 'pointerdown') {
          window.__dragTarget = document.elementFromPoint(x, y) ?? document.querySelector('.sheet');
        }
        (window.__dragTarget ?? document.querySelector('.sheet'))
          ?.dispatchEvent(new PointerEvent(type, init));
      },
      { type, x, y },
    );

  await fire('pointerdown', from.x, from.y);
  for (let i = 1; i <= steps; i++) {
    await fire('pointermove', from.x, from.y + (distance * i) / steps);
    if (pause) await page.waitForTimeout(pause);
  }
  await fire('pointerup', from.x, from.y + distance);
}

async function handlePoint(page) {
  const box = await page.locator('.sheet-handle').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('swiping the sheet down dismisses it', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  await dragDown(page, { from: await handlePoint(page), distance: 220 });

  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });
  // And the app underneath is interactive again — no orphaned backdrop.
  await expect(page.locator('.sheet-backdrop')).toHaveCount(0);
  await expect(page.locator('.page-title')).toBeVisible();
});

test('a small drag springs back instead of dismissing', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  await dragDown(page, { from: await handlePoint(page), distance: 30, steps: 6, pause: 40 });

  await expect(page.locator('.sheet')).toBeVisible();
  // It must return to rest, not sit stuck part-way down.
  await page.waitForTimeout(400);
  const transform = await page.locator('.sheet').evaluate((n) => getComputedStyle(n).transform);
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(transform);
});

test('a quick flick dismisses even without much distance', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  // Short travel, minimal delay between moves = high velocity.
  await dragDown(page, { from: await handlePoint(page), distance: 70, steps: 4, pause: 0 });

  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });
});

test('dragging does not fire the button underneath the finger', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  // Start the drag on top of a session row, then swipe the sheet away. The row
  // must not be treated as tapped — otherwise a dismiss starts a workout.
  const row = page.locator('.sheet .listitem').first();
  const box = await row.boundingBox();
  await dragDown(page, {
    from: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    distance: 240,
  });

  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });
  // Still on Today, not pushed into a session.
  await expect(page.locator('.screen--session')).toHaveCount(0);
  await expect(page.locator('.page-title')).toBeVisible();
});

test('dragging a scrolled sheet body scrolls it instead of dismissing', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  // Only meaningful if this sheet actually overflows.
  const scrollable = await page.locator('.sheet').evaluate((n) => {
    n.scrollTop = 60;
    return n.scrollHeight > n.clientHeight + 1 && n.scrollTop > 0;
  });
  test.skip(!scrollable, 'sheet is not tall enough to scroll in this viewport');

  const row = page.locator('.sheet .listitem').first();
  const box = await row.boundingBox();
  await dragDown(page, {
    from: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    distance: 240,
  });

  // Mid-scroll, a downward swipe belongs to the scroller, not to the dismiss
  // gesture — otherwise scrolling back up would keep throwing the sheet away.
  await expect(page.locator('.sheet')).toBeVisible();
});

test('the handle dismisses even when the sheet is scrolled', async ({ page }) => {
  await boot(page);
  await openSheet(page);
  await page.locator('.sheet').evaluate((n) => { n.scrollTop = 60; });

  await dragDown(page, { from: await handlePoint(page), distance: 220 });
  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });
});

test('tapping a row still works after the drag handlers are attached', async ({ page }) => {
  await boot(page);
  await openSheet(page);

  await page.locator('.sheet .listitem').first().click();
  await expect(page.locator('.screen--session')).toBeVisible();
  await expect(page.locator('.sheet')).toHaveCount(0);
});

test('backdrop tap and Escape still dismiss', async ({ page }) => {
  await boot(page);

  await openSheet(page);
  await page.locator('.sheet-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });

  await openSheet(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });
});

test('confirmation sheets are swipeable too, and cancel safely', async ({ page }) => {
  await boot(page);

  // Seed a session so there is something to delete.
  await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { CURRENT_PROGRAM } = await import('./src/program/index.js');
    const { resolveSession } = await import('./src/core/prescribe.js');
    const { deriveCursors, makeHistoryLookup } = await import('./src/core/schedule.js');
    const st = store.getState();
    const c = deriveCursors(st.sessions, CURRENT_PROGRAM);
    const r = resolveSession(CURRENT_PROGRAM, c.lift.nextDayKey, {
      weekInMeso: c.weekInMeso, runWeek: c.run.week, coreCompleted: c.core.completed,
      historyFor: makeHistoryLookup(st.sessions, st.index),
    });
    const s = store.startSession(r, { mesocycle: 1, bodyweightKg: 82 });
    const e = s.entries[0];
    store.logSet(s.id, e.entryId, e.sets[0].setId, { weightKg: 80, reps: 5, rpe: 8 });
    store.completeSession(s.id, {});
    await store.flush();
  });

  await page.goto('./#/history');
  await page.locator('.listitem').first().click();
  await page.locator('button', { hasText: 'Delete this session' }).click();
  await expect(page.locator('.sheet')).toBeVisible();

  await dragDown(page, { from: await handlePoint(page), distance: 220 });
  await expect(page.locator('.sheet')).toHaveCount(0, { timeout: 3000 });

  // Swiping away a confirmation must CANCEL it, never confirm it.
  const remaining = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    return store.getState().sessions.length;
  });
  expect(remaining).toBe(1);
});
