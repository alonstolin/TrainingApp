import { test, expect } from '@playwright/test';
import { boot, startLift } from './_helpers.js';

/**
 * Two things the athlete asked for after using the app in a real gym:
 * picking a replacement the catalogue does not contain, and tagging which
 * machine a set was done on so the numbers stay comparable — neither of which
 * should require setting up gyms first.
 */

test('the swap sheet searches, and can add an exercise the catalogue has never heard of', async ({ page }) => {
  await boot(page);
  await startLift(page);
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await page.locator('[data-swap]').click();

  // Search narrows 50-odd exercises to the one you mean.
  await page.locator('[data-exercise-search]').fill('hammer');
  await expect(page.locator('[data-pick-exercise]')).toHaveCount(1);
  await expect(page.locator('[data-pick-exercise="hammer-curl"]')).toBeVisible();

  // Nothing matches → the escape hatch offers to create it by that name.
  await page.locator('[data-exercise-search]').fill('Converging row machine');
  await expect(page.locator('[data-pick-exercise]')).toHaveCount(0);
  await expect(page.locator('.sheet')).toContainText('Nothing in the catalogue matches');
  await page.locator('[data-create-exercise]').click();

  await expect(page.locator('.sheet-title')).toHaveText('Add an exercise');
  await expect(page.locator('[data-custom-name]')).toHaveValue('Converging row machine');
  await page.locator('.chip[data-muscle="back"]').click();
  await page.locator('.sheet button', { hasText: /^Add it$/ }).click();

  // It is now the session's exercise, and it is a real exercise: own history,
  // own progression, its own entry in the nav.
  await expect(page.locator('h2', { hasText: 'Converging row machine' })).toBeVisible();
  const state = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const s = store.activeSession();
    const e = s.entries.find((x) => x.exerciseId.startsWith('custom:'));
    return {
      id: e.exerciseId,
      swappedFrom: e.swappedFrom,
      sets: e.sets.length,
      meta: store.getState().meta.customExercises,
    };
  });
  expect(state.id).toBe('custom:converging-row-machine');
  expect(state.swappedFrom).toBe('cable-lateral-raise');
  expect(state.sets).toBe(3);
  expect(state.meta[state.id].muscle).toBe('back');

  // Log a set on it and check it survives a reload — the id has to resolve
  // from stored meta at boot, not from the catalogue.
  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 8; i++) await plus.click();
  await page.locator('button', { hasText: /^Log set$/ }).click();
  await expect(page.locator('.setrow--done').first()).toBeVisible();
  await page.reload();
  await expect(page.locator('.page-title')).toBeVisible();
  const after = await page.evaluate(async () => {
    const store = await import('./src/data/store.js');
    const { getExercise } = await import('./src/program/exercises.js');
    return getExercise('custom:converging-row-machine').name;
  });
  expect(after).toBe('Converging row machine');
});

test('a machine can be tagged from the logging window with no gyms set up, and its numbers stay its own', async ({ page }) => {
  await boot(page);
  await startLift(page);
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();

  // Available without configuring anything.
  const tag = page.locator('[data-station]');
  await expect(tag).toHaveText('⚙ Which machine?');
  await tag.click();
  await page.locator('.sheet button', { hasText: 'Name this machine' }).click();
  await page.locator('.numfield').fill('left stack');
  await page.locator('.sheet button', { hasText: /^Save$/ }).click();
  await expect(tag).toHaveText('⚙ left stack');

  const plus = page.locator('.stepper').nth(0).locator('button', { hasText: '+' });
  for (let i = 0; i < 8; i++) await plus.click(); // 20 kg
  for (let i = 0; i < 3; i++) {
    await page.locator('button', { hasText: /^Log set$/ }).click();
    await page.waitForTimeout(120);
  }
  await page.locator('button', { hasText: /^Finish$/ }).click();
  await page.locator('.sheet button', { hasText: /^Finish$/ }).click();
  await expect(page.locator('.page-title')).toBeVisible();

  // Same machine next time: the load comes back as a target.
  await startLift(page);
  await page.locator('.exnav button', { hasText: 'Cable Lateral' }).click();
  await page.locator('[data-station]').click();
  await page.locator('.sheet button', { hasText: 'left stack' }).click();
  await expect(page.locator('.lasttime-label')).toContainText('left stack');
  await expect(page.locator('.suggestion')).not.toContainText('guide');

  // A different machine: the old number is offered only as a guide.
  await page.locator('[data-station]').click();
  await page.locator('.sheet button', { hasText: 'A different one' }).click();
  await page.locator('.numfield').fill('window side');
  await page.locator('.sheet button', { hasText: /^Save$/ }).click();
  await expect(page.locator('.suggestion')).toContainText('different machine — treat it as a guide');
});
