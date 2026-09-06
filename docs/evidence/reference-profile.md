# Local Reference Profile

Observed by the root reviewer on 2026-09-05 using `system_profiler`, `sw_vers`,
and `pmset -g batt` (device identifiers omitted).

| Field | Observed value |
|---|---|
| Computer | Mac mini, Mac16,10 |
| CPU | Apple M4, 10 cores (4 performance + 6 efficiency) |
| Physical GPU | Apple M4, 10 cores, Metal 4 |
| Memory | 24 GB |
| OS | macOS 26.5.2, build 25F84 |
| Power | AC power |
| Display | 1920 × 1080, 75 Hz |
| Benchmark internal viewport | 1600 × 900, DPR 1 |
| Browser / WebGL renderer | Recorded by each captured JSON; not inferred from physical GPU |

Browser automation runs are local evidence. Headless/virtual presentation,
browser frame pacing, concurrent host activity, and an unavailable independent
secondary device limit generalization. A second browser configuration on this
machine is not a second physical GPU. Human Visual Acceptance remains pending.

Retained standard-run JSON is under `metal/` and `software/`; interpretation is
in [the final evidence report](../benchmark/final-evidence-report.md). Diagnostic
JSON is only functional smoke evidence and cannot satisfy performance acceptance.

## Verified Browser Backends

- Primary profile: Playwright Chromium with `channel: 'chromium'`, headless;
  HeadlessChrome 151.0.0.0. WebGL reports
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)`.
- Constraint profile: default Playwright headless shell;
  HeadlessChrome 151.0.7922.34. WebGL reports
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0) (0x0000C0DE)), SwiftShader driver)`.
- A headed Chromium probe with `--use-angle=metal` also reported Apple M4 Metal.

The four crossing/drink PNGs under `visuals/` were captured at 1600 × 900 / DPR1 from the W006
production build using the software-renderer profile. They demonstrate actual
relay/mode-switch and visible dispensed-drink behavior; they are not timing
evidence or human Visual Acceptance. Crossing captures are successive frames
during one train pass, not pixel-identical simulation instants.

`visuals/benchmark-complete.png` and `diagnostic-dpr3.json` are a separate Metal
diagnostic at a 1000 × 700 browser viewport with device DPR3. The application
caps interactive DPR at2; root verified 2000 × 1400 → 1600 × 900 → 2000 × 1400
canvas restoration. A real `WEBGL_lose_context` event also invalidated the run.
