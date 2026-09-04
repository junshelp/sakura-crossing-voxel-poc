import { test, expect } from '@playwright/test';
test('tracer renders and mode switches without rebuilding shared infrastructure', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#mode-label')).toHaveText('Baseline Mode');
  const root = page.locator('#scene-root');
  const infrastructureId = await root.getAttribute('data-continuous-infrastructure-id');
  expect(infrastructureId).toBeTruthy();
  await expect(root).toHaveAttribute('data-continuous-infrastructure-name', 'continuous-infrastructure');
  const childCount = await root.getAttribute('data-continuous-infrastructure-child-count');
  expect(childCount).toBeTruthy();
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#mode-label')).toHaveText('Voxel Mode');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(root).toHaveAttribute('data-continuous-infrastructure-id', infrastructureId!);
  await expect(root).toHaveAttribute('data-continuous-infrastructure-child-count', childCount!);
});
