# Sakura Crossing Voxel PoC

A miniature voxel-style railway-crossing proof of concept with deterministic
Baseline/Voxel A/B benchmarking.

The project tests whether a 60 x 60 m playable slice can preserve the visual
identity and interactions of a Japanese suburban crossing while reducing draw
calls and frame time through palette-based voxel chunks, hidden-face removal,
greedy meshing, and a simplified render pipeline.

Planning starts in [the product requirements document](docs/voxel-crossing-poc-prd.md).

## Evidence and current decision

The playable slice, shared interactions, both renderers, and benchmark are
implemented. See the [measured evidence report](docs/benchmark/final-evidence-report.md).
On the Apple M4 Metal reference profile, median draw calls fell from 51 to 31
(39.2%), while p95 frame time remained approximately 26.5 ms. Both primary
performance targets were missed: the recommendation is **revise**, not expand.
This does not establish source-code savings over the upstream project.

Human Visual Acceptance and public Pages deployment remain pending. The train
uses one rigid spherical seat instead of bent-once train geometry, and shared
colliders are static rather than a production moving-train collision system.

## Upstream attribution

The concept and selected architectural ideas are derived from
[Kenton-GMI/sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing),
which is distributed under the MIT License. This repository selectively
reimplements only the systems required by the proof of concept; it does not copy
the upstream audio asset.

## Run and test

Use Node 20+ and run `npm ci`, then `npm run dev` (or `npm run build` followed
by a static server for production). `npm test`, `npm run typecheck`, and
`npm run test:e2e` run the automated checks; the E2E server serves the built
`dist` output in CI.

WASD/arrows move, `1`–`3` select the fixed cameras, `E` activates an interaction,
and the mode button switches Baseline/Voxel. The HUD's **Run standard** performs
six alternating legs (5 s warm-up + 30 s measurement per leg) at 1600×900, DPR
1. Enter the compact Reference Profile and hardware/power fields before starting,
then use **Download JSON** after completion. **Run diagnostic** uses the short
CI-safe timing and its JSON is
explicitly inconclusive. Downloaded JSON includes frame distributions,
renderer metrics, schema/profile metadata, and threshold conclusion. Unknown
hardware or power context is recorded as `unknown`; GPU timers are optional and
never used as CPU frame time. Human Visual Acceptance remains a separate gate.

GitHub Pages is ready but deploys only when repository variable
`ENABLE_PAGES_DEPLOYMENT` is exactly `true`.

For a retained production capture, first serve `dist`, then run
`BENCHMARK_URL=http://127.0.0.1:4173 npm run benchmark:capture`. It uses the
same visible controls and waits long enough for all six standard legs. Set
`BENCHMARK_PROFILE`, `BENCHMARK_POWER`, or `BROWSER_CHANNEL=headlessshell` to
record a constrained environment explicitly.

Run `npm run benchmark:metrics` to emit explanatory nonblank source-line,
serialized Voxel Asset, generated mesh, production-bundle, and build-duration
measurements to `docs/benchmark/explanatory-metrics.json`. These measurements
do not compare this local Baseline control to the upstream source codebase.
