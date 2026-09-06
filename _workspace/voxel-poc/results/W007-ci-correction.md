# W007 CI correction — event-boundary observations

## Status

IMPLEMENTED; root verification pending.

## Summary

Added a bounded Playwright helper that installs capture and document-bubble
listeners before a real locator click, snapshots the scene-root data attributes
inside the same click task, and reliably removes listeners in `finally`. Mode
toggle checks now require the mode to change while pose, marker, train phase /
offset, and drink state remain exact at the event boundary. Benchmark start and
cancel use the same observation path; cancellation compares the complete
restored state to the exact benchmark-start capture, with no distance tolerance.

## Files Changed

- `tests/e2e/smoke.spec.ts` — atomic DOM-only click observation and exact
  boundary/restoration assertions.
- `_workspace/voxel-poc/results/W007-ci-correction.md` — this handoff.

## Acceptance Evidence

- The actual controls remain clicked through Playwright locators; application
  handlers are never invoked directly and the observer only reads DOM data.
- Capture runs before the target handler and bubbling runs after it; both
  snapshots occur synchronously, preventing RAF interleaving.
- Fixed-distance toggle and cancellation drift assertions were removed. Train
  offset and full saved state are compared exactly at the relevant boundaries.
- Existing movement routes, phase waits, mode/pose/marker/drink assertions, and
  six-leg diagnostic download/schema checks remain in place.

## Checks Run

- `npm run typecheck` — PASS.
- `git diff --check` — PASS.
- Production E2E — NOT RUN; root owns execution against the production preview.

## Assumptions or Deviations

- `CONTEXT.md`, the task, review, runtime/domain handoffs, and current
  implementation were inspected.
- Existing unrelated root changes to `_workspace/voxel-poc/reviews/W007.md`
  and the task file were not modified.

## Unresolved Risks

- Root should verify the exact event-boundary state attributes against the
  current production preview and confirm cancellation restoration succeeds.

## Reviewer Focus

- Confirm the capture/bubble listeners observe the same target click and that
  every non-mode state attribute is unchanged across each mode-toggle boundary.
- Confirm diagnostic cancellation restores `started.before` exactly without
  reintroducing a wall-time tolerance.
