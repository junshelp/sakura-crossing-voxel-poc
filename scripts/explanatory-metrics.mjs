import { execFileSync } from 'node:child_process';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const sourceFiles = (await files(join(root, 'src'))).filter(path => /\.(ts|css)$/.test(path));
const sourceLines = (await Promise.all(sourceFiles.map(async path => (await readFile(path, 'utf8')).split(/\r?\n/).filter(line => line.trim()).length))).reduce((a, b) => a + b, 0);
const buildStarted = performance.now(); execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' }); const buildMs = performance.now() - buildStarted;
const vite = await createServer({ root, logLevel: 'error', server: { middlewareMode: true } });
try {
  const { VOXEL_ASSETS } = await vite.ssrLoadModule('/src/voxel/assets/index.ts');
  const { compileVoxelAsset } = await vite.ssrLoadModule('/src/voxel/compiler.ts');
  const serializedVoxelAssetBytes = Buffer.byteLength(JSON.stringify(VOXEL_ASSETS));
  let generatedMeshBytes = 0;
  for (const asset of Object.values(VOXEL_ASSETS)) for (const chunk of compileVoxelAsset(asset).chunks) for (const group of chunk.groups) {
    generatedMeshBytes += group.positions.byteLength + group.normals.byteLength + group.colors.byteLength + group.paletteIds.byteLength + group.indices.byteLength;
  }
  const bundleBytes = (await Promise.all((await files(join(root, 'dist'))).map(async path => (await stat(path)).size))).reduce((a, b) => a + b, 0);
  const report = { generatedAt: new Date().toISOString(), sourceNonblankLines: sourceLines, serializedVoxelAssetBytes, generatedMeshBytes, productionBundleBytes: bundleBytes, productionBuildMs: buildMs, note: 'Local Baseline/Voxel renderer comparison does not measure upstream source-code savings.' };
  const output = process.env.METRICS_OUTPUT ?? 'docs/benchmark/explanatory-metrics.json';
  await writeFile(join(root, output), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally { await vite.close(); }
