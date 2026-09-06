import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'vite';

const output = process.env.BENCHMARK_OUTPUT ?? 'docs/evidence/benchmark';
await mkdir(output, { recursive: true });
const channel = process.env.BROWSER_CHANNEL ?? 'chromium';
const browser = await chromium.launch({ headless: process.env.BROWSER_HEADLESS !== '0', ...(channel === 'headlessshell' ? {} : { channel }) });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = []; page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); }); page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.BENCHMARK_URL ?? 'http://127.0.0.1:4173');
  await page.locator('#benchmark-profile').fill(process.env.BENCHMARK_PROFILE ?? (channel === 'headlessshell' ? 'constraint-profile-headlessshell' : 'reference-profile-chromium'));
  await page.locator('#benchmark-power').fill(process.env.BENCHMARK_POWER ?? 'unknown');
  await page.locator('#benchmark-run').click();
  await page.locator('#benchmark-download').waitFor({ state: 'visible', timeout: 260000 });
  const download = page.waitForEvent('download'); await page.locator('#benchmark-download').click();
  const artifact = await download; const path = `${output}/benchmark-${new Date().toISOString().replaceAll(':', '-')}.json`;
  await artifact.saveAs(path); const report = JSON.parse(await readFile(path, 'utf8'));
  const vite = await createServer({ root: process.cwd(), logLevel: 'error', server: { middlewareMode: true } });
  try {
    const { validateBenchmarkReport } = await vite.ssrLoadModule('/src/benchmark/index.ts');
    if (errors.length || !validateBenchmarkReport(report) || report.diagnostic) throw new Error(`invalid capture: ${errors.join('; ') || 'report schema'}`);
    console.log(JSON.stringify({ path, profile: report.referenceProfile.renderer, conclusion: report.conclusion }, null, 2));
  } finally { await vite.close(); }
} finally { await browser.close(); }
