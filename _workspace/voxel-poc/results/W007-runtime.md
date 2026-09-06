# W007 runtime correction — implementation handoff

Status: implemented; root verification and standard capture pending.

## Summary

- Replaced the benchmark's nested RAF loop with the application's sole RAF
  driver. Each benchmark frame restores the per-leg initial simulation snapshot
  and steps with elapsed wall time, so both modes replay identical progression.
- Added immediate cancel/visibility/context-loss restoration, blocked benchmark
  inputs, saved renderer DPR/size/camera aspect/player/marker/mode/simulation,
  and unique attribute/index backing-buffer geometry accounting.
- Added explicit standard/diagnostic/cancel/download controls and profile/power
  fields; report download is exposed only after strict validation succeeds.
- Configured production E2E server non-reuse, a real-UI capture script with a
  260-second standard-run allowance, and explanatory measurement output.

## Files changed

`src/main.ts`, `index.html`, `src/style.css`, `package.json`,
`playwright.config.ts`, `tests/e2e/smoke.spec.ts`,
`scripts/benchmark-capture.mjs`, `README.md`, and
`docs/benchmark/final-evidence-report.md`,
`docs/benchmark/explanatory-metrics.json`, and
`scripts/explanatory-metrics.mjs`.

## Checks

- `npm run typecheck`: pass
- `npm test`: pass — 13 files, 60 tests
- `npm run build`: pass (expected Three.js bundle-size warning)
- `npm run test:e2e`: pass — 4 production-build browser scenarios
- `npm run benchmark:metrics`: pass; generated explanatory JSON
- `git diff --check`: pass

## Reviewer focus

Run a root-owned standard production capture and retain its downloaded JSON.
Human Visual Acceptance and secondary-profile evidence remain pending; this
runtime correction makes no performance acceptance claim.
