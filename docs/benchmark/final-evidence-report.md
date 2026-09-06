# Voxel Crossing PoC — measured evidence

Date: 2026-09-06. Technical delivery is verified; product recommendation:
**REVISE before expanding content**. The primary draw-call and p95 targets were
missed. Human Visual Acceptance remains pending, so this is not product approval.

## Method and retained evidence

Each standard capture contains six alternating Baseline/Voxel legs, three per
mode, in one production application session. Each leg excludes mounting and a
5-second warm-up, then samples 30 seconds at 1600 × 900 / DPR1. The three fixed
cameras receive equal sample windows. Simulation is replayed from the same
initial state using elapsed time; frame intervals are not gameplay-clamped.
Tables use the median of the three per-leg metrics, not pooled frames.

- Primary: [Apple M4 Metal standard JSON](../evidence/metal/benchmark-2026-09-06T12-14-47.383Z.json).
- Host: Mac mini Mac16,10, M4 10-core CPU / 10-core GPU, 24 GB RAM,
  macOS 26.5.2, AC power. Chromium channel, headless, version 151.0.0.0.
- [Reference Profile and browser backends](../evidence/reference-profile.md).
- [Diagnostic restore evidence](../evidence/diagnostic-dpr3.json) is not a
  performance acceptance run.

## Primary results: Apple M4 Metal

| Metric | Baseline | Voxel | Interpretation |
| --- | ---: | ---: | --- |
| Draw calls, median | 51 | 31 | 39.22% reduction; target ≥50% missed |
| p95 frame time, ms | 26.500 | 26.525 | 0.09% regression; target ≥20% improvement missed |
| p50 frame time, ms | 16.450 | 16.650 | Explanatory |
| Mean frame time, ms | 16.054 | 16.156 | Explanatory |
| Triangles, median | 16,320 | 15,846 | Includes shared infrastructure |
| Textures / shader programs | 0 / 4 | 1 / 7 | Voxel atlas and material paths add cost |
| Adapter mount time, ms | 1.600 | 61.200 | Includes adapter disposal/rebuild; excluded from frame samples |
| Adapter geometry buffer bytes | 43,356 | 120,956 | Unique underlying buffers including indices; not total GPU memory |

The draw-call benefit is real for this local control, but is insufficient for
the agreed threshold. Nearly unchanged p95 does not demonstrate a user-visible
speedup. It also does not prove the styles perform identically on other devices.

## Secondary profile

[SwiftShader standard JSON](../evidence/software/benchmark-2026-09-06T12-18-59.891Z.json)
uses headless shell 151.0.7922.34 on the same physical host, not a second low-end
GPU/device. Its independently captured six-leg report passed schema validation
and browser error checks.

| Metric | Baseline | Voxel |
| --- | ---: | ---: |
| Median draw calls | 51 | 31 |
| p95 frame time, ms | 23.480 | 23.190 |
| p50 / mean frame time, ms | 18.200 / 18.730 | 18.400 / 18.941 |
| Triangles | 16,320 | 15,846 |
| Textures / shader programs | 0 / 4 | 1 / 7 |
| Adapter mount time, ms | 1.300 | 35.700 |
| Adapter geometry bytes | 43,356 | 120,956 |

Secondary p95 regression is **−1.24%** (a 1.24% improvement), satisfying the
no-more-than-10% regression check for this browser constraint profile only.
GPU timer is `unsupported`. The raw reports each assess their own primary
thresholds and leave `secondaryRegressionPct=null`; this cross-report comparison
is calculated here as `(Voxel p95 / Baseline p95 − 1) × 100`.
Do not interpret its lower p95 than the Metal session as faster software
rendering: these are separate browser configurations and presentation schedules.

## Correctness and delivery gates

- Functional Parity: PASS. Shared collision/interaction contracts, deterministic
  crossing phases, relay/vending operation, visible drink, and state-preserving
  mode switching have unit and production browser evidence.
- Automated checks: 60 unit tests; typecheck; production build; 4 production
  Playwright scenarios. Root additionally checked actual DPR restoration and
  real WebGL context-loss invalidation on the Metal backend.
- [Baseline crossing](../evidence/visuals/baseline-crossing.png),
  [Voxel crossing](../evidence/visuals/voxel-crossing.png), and paired drink
  screenshots are technical evidence, not human Visual Acceptance.
- Visual Acceptance: **PENDING**. No automated agent grants this approval.
- GPU timer: `not-measured` on the retained primary profile. Query collection is
  not implemented; values are null, not inferred from frame time.
- Pages: workflow ready behind `ENABLE_PAGES_DEPLOYMENT == 'true'`;
  repository variables/settings were not changed and no public deployment is claimed.

## Code and asset cost

[Explanatory metrics](explanatory-metrics.json) record 1,717 nonblank source lines,
854,487 serialized Voxel Asset bytes, 121,256 canonical generated mesh bytes,
548,768 production output bytes, and a 712.685 ms local build invocation.
Canonical mesh bytes include all generated assets/palette data; adapter geometry
bytes above describe mounted geometry buffers, so they are different measures.

These are current-project measurements, not a comparison against upstream source.
The compiler and asset pipeline add implementation/data cost; fewer draw calls
do not establish less code, lower total memory, or cheaper maintenance.

## Reproducibility and limitations

The measured production build truthfully records source parent
`6c6a5fdbe5494280e16eebca61fc06df27c315d3` and `dirtyBuild=true`: W007 was
tested before its verified commit. This evidence package commits that worktree.
The measured `dist/assets/index-DybRWakB.js` SHA-256 is
`5e1d6a6f437b96f1a653388fae575e1a81858bd285c687cdc6f887d9cff7e9e0`.
A clean rebuild will embed its own commit/dirty metadata and need not have this hash.

Both browser profiles are headless. Presentation/frame pacing and uncontrolled
background host activity limit timing generalization. No heavy root test/build
job ran alongside retained standard capture. The secondary profile is not
independent hardware certification. The Baseline is a modest local primitive
control, not the complete upstream renderer. The two-car train uses one rigid
surface seat, not the PRD's bent-once strategy; colliders remain static.

An earlier full run was excluded because its capture had a `/favicon.ico` 404.
The [rejected artifact](../evidence/rejected/README.md) is retained for provenance,
not selected for headline results. The favicon request was corrected before the
retained runs; render geometry and quality were not tuned to improve scores.

## Recommendation

Do not start the full town. Obtain human Visual Acceptance and, if further
optimization is approved, investigate cross-asset/material batching and voxel
mount cost, then repeat the same measurement. Primary performance misses already
justify a provisional REVISE even while the separate visual gate is pending.
