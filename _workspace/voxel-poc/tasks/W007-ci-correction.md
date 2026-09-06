# W007 CI correction — event-boundary state observations

Read the worker skill and W007 task/result/review. Allowed edits: only
`tests/e2e/smoke.spec.ts` and `results/W007-ci-correction.md`.
No commits/pushes, runtime/renderer changes, or benchmark recapture/score tuning.

CI34032828450 failed two fixed-distance assertions: toggle delta12.095 exceeded10,
and cancellation drift7.907 exceeded5. Browser protocol/actionability latency
allows legitimate simulation progression between separate awaited operations.

Implement an observation helper around a real Playwright locator click. Capture
the relevant scene-root data attributes atomically in the browser immediately
before the application's click handler (capture event), and again after the
handler (document bubbling event), so no RAF can intervene. Observe only DOM;
never mutate gameplay or invoke application handlers directly. Listener cleanup
must be bounded/reliable. The actual button remains clicked via Playwright.

Use this to assert exact train/state preservation at the mode-toggle boundary
and exact restored saved state from benchmark-start before to cancel after.
Keep all meaningful mode/pose/marker/drink assertions and real movement routes.
Do not simply increase distance tolerances. Avoid phase assertions long after
the same click if they can race real simulation progression. Consider equivalent
atomic observed state for successful diagnostic restoration as well.

Run targeted production E2E if port4173 is occupied, report that for root to stop
the known preview before independent verification. Root owns full tests, review,
commit/push, CI rerun and docs; write concise correction result handoff.
