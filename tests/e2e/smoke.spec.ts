import { test, expect, type Page } from '@playwright/test';
test.setTimeout(60000);
test('baseline slice renders, fixed cameras work, and mode switch preserves live state/infrastructure', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  const root = page.locator('#scene-root');
  await expect(root).toHaveAttribute('data-baseline-entity-count', '17');
  await expect(page.locator('#telemetry-frame')).toContainText('Frame');
  await expect(page.locator('#telemetry-draw')).toContainText('Draw');
  await expect(page.locator('#telemetry-triangles')).toContainText('Triangles');
  const infrastructureId = await root.getAttribute('data-continuous-infrastructure-id');
  expect(infrastructureId).toBeTruthy();
  await expect(root).toHaveAttribute('data-continuous-infrastructure-name', 'continuous-infrastructure');
  const childCount = await root.getAttribute('data-continuous-infrastructure-child-count');
  expect(childCount).toBeTruthy();
  await page.waitForTimeout(400);
  const baselineDrawCalls = Number(await root.getAttribute('data-renderer-draw-calls'));
  expect(baselineDrawCalls).toBeGreaterThan(0);
  await expect(root).toHaveAttribute('data-sample-scene-reference', '20260904');
  await page.locator('[data-marker="crossing"]').click();
  await expect(root).toHaveAttribute('data-active-marker', 'crossing');
  const playerBefore = await Promise.all(['x', 'z', 'eye-height', 'yaw', 'pitch'].map((axis) => root.getAttribute(`data-player-${axis}`)));
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(root).toHaveAttribute('data-voxel-entity-count', '17');
  await expect(root).toHaveAttribute('data-voxel-atlas-texture-count', '1');
  await expect(root).toHaveAttribute('data-voxel-chunk-mesh-count', /[1-9][0-9]*/);
  await expect(root).toHaveAttribute('data-voxel-unique-material-count', /[1-5]/);
  await expect(root).toHaveAttribute('data-active-marker', 'crossing');
  await page.waitForTimeout(400);
  const voxelDrawCalls = Number(await root.getAttribute('data-renderer-draw-calls'));
  expect(voxelDrawCalls).toBeGreaterThan(0);
  expect(voxelDrawCalls).toBeLessThan(baselineDrawCalls);
  const playerAfter = await Promise.all(['x', 'z', 'eye-height', 'yaw', 'pitch'].map((axis) => root.getAttribute(`data-player-${axis}`)));
  expect(playerAfter).toEqual(playerBefore);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-id', infrastructureId!);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-child-count', childCount!);
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  const playerRoundTrip = await Promise.all(['x', 'z', 'eye-height', 'yaw', 'pitch'].map((axis) => root.getAttribute(`data-player-${axis}`)));
  expect(playerRoundTrip).toEqual(playerBefore);
  await expect(root).toHaveAttribute('data-active-marker', 'crossing');
  await expect(root).toHaveAttribute('data-continuous-infrastructure-id', infrastructureId!);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-child-count', childCount!);
  await expect(root).toHaveAttribute('data-sample-scene-reference', '20260904');
});

async function moveUntil(page: Page, axis: 'x' | 'z', key: string, predicate: (value: number) => boolean): Promise<void> {
  const root = page.locator('#scene-root'); const deadline = Date.now() + 7000;
  await page.keyboard.down(key);
  try {
    while (Date.now() < deadline) {
      const value = Number(await root.getAttribute(`data-player-${axis}`));
      if (predicate(value)) return;
      await page.waitForTimeout(50);
    }
    throw new Error(`movement timeout for ${axis}/${key}`);
  } finally {
    await page.keyboard.up(key);
    await page.waitForTimeout(80);
  }
}

async function waitForPhase(page: Page, phase: RegExp, timeout = 9000): Promise<void> {
  const root = page.locator('#scene-root'); const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (phase.test((await root.getAttribute('data-crossing-phase')) ?? '')) return;
    await page.waitForTimeout(50);
  }
  throw new Error(`phase timeout: ${phase}`);
}

test('movement prompt and E activation persist across both renderer modes', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  await page.goto('/');
  const root = page.locator('#scene-root');
  // Use coordinate-polled, collision-aware movement routes. Each key is
  // released in a finally block even if the route times out.
  await moveUntil(page, 'x', 'd', (value) => value >= 9.9);
  await moveUntil(page, 'z', 'w', (value) => value <= -0.2);
  await expect(root).toHaveAttribute('data-current-interaction-id', 'call-train');
  await expect(page.locator('#interaction-prompt')).toBeVisible();
  await page.locator('#interaction-prompt').click();
  await expect(root).toHaveAttribute('data-crossing-phase', 'approach');
  await waitForPhase(page, /clearing/); await waitForPhase(page, /^open$/);

  await page.locator('#mode-toggle').click(); await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  await page.keyboard.press('e'); await expect(root).toHaveAttribute('data-crossing-phase', 'approach');
  await page.waitForTimeout(1800); await expect(root).toHaveAttribute('data-crossing-phase', /closing|passing/);
  const beforeToggle = Number(await root.getAttribute('data-train-offset'));
  await page.locator('#mode-toggle').click(); await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  await expect(root).toHaveAttribute('data-crossing-phase', /closing|passing/);
  const afterToggle = Number(await root.getAttribute('data-train-offset'));
  expect(afterToggle).toBeGreaterThan(beforeToggle);
  expect(afterToggle - beforeToggle).toBeLessThan(10);
  await waitForPhase(page, /clearing/); await waitForPhase(page, /^open$/);

  // From the relay, walk east and south around the colliders before returning
  // to the vending machine, then activate it with E in Baseline and click in Voxel.
  await moveUntil(page, 'x', 'd', (value) => value >= 15);
  await moveUntil(page, 'z', 'w', (value) => value <= -11);
  await moveUntil(page, 'x', 'a', (value) => value <= -9.9);
  await moveUntil(page, 'z', 's', (value) => value >= -9.8);
  await expect(root).toHaveAttribute('data-current-interaction-id', 'dispense-drink');
  await page.keyboard.press('e'); await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  await page.locator('#mode-toggle').click(); await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  await page.locator('#interaction-prompt').click(); await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  await page.locator('#mode-toggle').click(); await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  expect(consoleErrors).toEqual([]);
});
