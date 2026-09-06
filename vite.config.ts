import { defineConfig } from 'vite';
// @ts-expect-error Vite executes this config in Node; the app intentionally has no Node typings.
import { execFileSync } from 'node:child_process';
function git(args: string[]): string { try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } }
export default defineConfig({ base: './', define: { __SOURCE_COMMIT__: JSON.stringify(git(['rev-parse', 'HEAD'])), __DIRTY_BUILD__: JSON.stringify(git(['status', '--porcelain']) !== '') } });
