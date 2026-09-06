import { test, expect, type Locator, type Page } from '@playwright/test';
import { validateBenchmarkReport } from '../../src/benchmark';
test.setTimeout(60000);

const OBSERVED_STATE_KEYS = [
  'mode', 'active-marker', 'player-x', 'player-z', 'player-eye-height',
  'player-yaw', 'player-pitch', 'train-offset', 'crossing-phase', 'dispensed-drink',
] as const;
type ObservedState = Record<(typeof OBSERVED_STATE_KEYS)[number], string | null>;
type ClickObservation = { before: ObservedState; after: ObservedState };

/**
 * Observe a real click at the DOM event boundary. The capture listener runs
 * before the application's target handler and the document bubble listener
 * runs after it, both within the same click task (so no RAF can intervene).
 */
async function clickAndObserve(page: Page, button: Locator): Promise<ClickObservation> {
  const id = await button.getAttribute('id');
  if (!id) throw new Error('event-boundary observer requires an id-bearing button');
  const token = `voxel-click-${Date.now()}-${Math.random()}`;
  await page.evaluate(({ id, keys, token }) => {
    const root = document.querySelector<HTMLElement>('#scene-root');
    const target = document.getElementById(id);
    if (!root || !target) throw new Error(`missing click observer target: ${id}`);
    const snapshot = (): ObservedState => Object.fromEntries(
      keys.map((key) => [key, root.getAttribute(`data-${key}`)]),
    ) as ObservedState;
    const observer = {
      before: null as ObservedState | null,
      after: null as ObservedState | null,
      capture: (event: Event) => { if (event.target === target) observer.before = snapshot(); },
      bubble: (event: Event) => { if (event.target === target) observer.after = snapshot(); },
    };
    document.addEventListener('click', observer.capture, true);
    document.addEventListener('click', observer.bubble);
    const observers = ((window as unknown as { __voxelClickObservers?: Record<string, typeof observer> }).__voxelClickObservers
      ??= {});
    observers[token] = observer;
  }, { id, keys: OBSERVED_STATE_KEYS, token });
  try {
    await button.click();
    return await page.evaluate((token) => {
      const observers = (window as unknown as { __voxelClickObservers?: Record<string, ClickObservation & {
        capture?: EventListener; bubble?: EventListener;
      }> }).__voxelClickObservers;
      const observer = observers?.[token] as (ClickObservation & { capture?: EventListener; bubble?: EventListener }) | undefined;
      if (!observer?.before || !observer.after) throw new Error('click event-boundary observer did not see both click phases');
      return { before: observer.before, after: observer.after };
    }, token);
  } finally {
    await page.evaluate((token) => {
      const observers = (window as unknown as { __voxelClickObservers?: Record<string, {
        capture: EventListener; bubble: EventListener;
      }> }).__voxelClickObservers;
      const observer = observers?.[token];
      if (observer) {
        document.removeEventListener('click', observer.capture, true);
        document.removeEventListener('click', observer.bubble);
        delete observers![token];
      }
    }, token).catch(() => undefined);
  }
}

function expectBoundaryPreserved(observation: ClickObservation, changed: keyof ObservedState): void {
  expect(observation.before[changed]).not.toBe(observation.after[changed]);
  for (const key of OBSERVED_STATE_KEYS) {
    if (key !== changed) expect(observation.after[key]).toBe(observation.before[key]);
  }
}

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
  const toVoxel = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(toVoxel, 'mode');
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
  expect(toVoxel.after.mode).toBe('voxel');
  expect(toVoxel.after['player-x']).toBe(playerBefore[0]);
  expect(toVoxel.after['player-z']).toBe(playerBefore[1]);
  expect(toVoxel.after['player-eye-height']).toBe(playerBefore[2]);
  expect(toVoxel.after['player-yaw']).toBe(playerBefore[3]);
  expect(toVoxel.after['player-pitch']).toBe(playerBefore[4]);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-id', infrastructureId!);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-child-count', childCount!);
  const toBaseline = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(toBaseline, 'mode');
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  expect(toBaseline.after.mode).toBe('baseline');
  expect(toBaseline.after['player-x']).toBe(playerBefore[0]);
  expect(toBaseline.after['player-z']).toBe(playerBefore[1]);
  expect(toBaseline.after['player-eye-height']).toBe(playerBefore[2]);
  expect(toBaseline.after['player-yaw']).toBe(playerBefore[3]);
  expect(toBaseline.after['player-pitch']).toBe(playerBefore[4]);
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

  const toVoxel = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(toVoxel, 'mode');
  await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  await page.keyboard.press('e'); await expect(root).toHaveAttribute('data-crossing-phase', 'approach');
  await page.waitForTimeout(1800); await expect(root).toHaveAttribute('data-crossing-phase', /closing|passing/);
  const toBaseline = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(toBaseline, 'mode');
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  expect(toBaseline.after['train-offset']).toBe(toBaseline.before['train-offset']);
  expect(toBaseline.after['crossing-phase']).toMatch(/closing|passing/);
  await waitForPhase(page, /clearing/); await waitForPhase(page, /^open$/);

  // From the relay, walk east and south around the colliders before returning
  // to the vending machine, then activate it with E in Baseline and click in Voxel.
  await moveUntil(page, 'x', 'd', (value) => value >= 15);
  await moveUntil(page, 'z', 'w', (value) => value <= -11);
  await moveUntil(page, 'x', 'a', (value) => value <= -9.9);
  await moveUntil(page, 'z', 's', (value) => value >= -9.8);
  await expect(root).toHaveAttribute('data-current-interaction-id', 'dispense-drink');
  await page.keyboard.press('e'); await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  const drinkToVoxel = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(drinkToVoxel, 'mode');
  await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  expect(drinkToVoxel.after['dispensed-drink']).toBe('true');
  await page.locator('#interaction-prompt').click(); await expect(root).toHaveAttribute('data-dispensed-drink', 'true');
  const drinkToBaseline = await clickAndObserve(page, page.locator('#mode-toggle'));
  expectBoundaryPreserved(drinkToBaseline, 'mode');
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  expect(drinkToBaseline.after['dispensed-drink']).toBe('true');
  expect(consoleErrors).toEqual([]);
});

test('diagnostic benchmark downloads six legs and cancellation restores play state', async ({ page }) => {
  test.setTimeout(30000);
  await page.goto('/');
  const root = page.locator('#scene-root');
  await page.locator('[data-marker="crossing"]').click();
  const started = await clickAndObserve(page, page.locator('#benchmark-diagnostic'));
  await expect(page.locator('#benchmark-cancel')).toBeVisible();
  await expect(root).toHaveAttribute('data-active-marker', 'overview');
  await page.keyboard.press('2'); await page.keyboard.press('e'); await page.keyboard.press('w');
  await expect(root).toHaveAttribute('data-active-marker', 'overview');
  const cancelled = await clickAndObserve(page, page.locator('#benchmark-cancel'));
  await expect(page.locator('#benchmark-status')).toContainText('invalidated: cancelled');
  expect(cancelled.after).toEqual(started.before);
  await page.locator('#benchmark-diagnostic').click();
  await expect(page.locator('#benchmark-download')).toBeVisible({ timeout: 15000 });
  const download = page.waitForEvent('download'); await page.locator('#benchmark-download').click();
  const artifact = await download;
  expect(artifact.suggestedFilename()).toBe('sakura-crossing-benchmark.json');
  const stream = await artifact.createReadStream(); let text = '';
  for await (const chunk of stream!) text += String(chunk);
  const report: unknown = JSON.parse(text);
  expect(validateBenchmarkReport(report)).toBe(true);
  if (!validateBenchmarkReport(report)) throw new Error('Downloaded benchmark report failed schema validation');
  expect(report.diagnostic).toBe(true); expect(report.legs).toHaveLength(6);
  expect(report.legs.map(leg => leg.mode)).toEqual(['baseline', 'voxel', 'baseline', 'voxel', 'baseline', 'voxel']);
  expect(report.legs.every(leg => leg.sampleCount > 0)).toBe(true);
});

test('benchmark invalidates immediately on visibility and context loss', async ({ page }) => {
  await page.goto('/');
  await page.locator('#benchmark-diagnostic').click();
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    window.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#benchmark-status')).toContainText('visibility lost');
  await page.locator('#benchmark-diagnostic').click();
  await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.locator('#benchmark-status')).toContainText('WebGL context lost');
});
