# W007 Domain Correction

Implemented the benchmark-domain correction requested by the W007 review.

- `FrameSampler` accepts only finite, monotonic intervals fully within the
  post-warmup sample window, rejects duplicate/overlapping intervals and
  frame-duration mismatches, and summarizes frame plus renderer metrics by
  medians.
- `cameraMarkerAt` keeps Overview during warmup and divides the sample into
  three equal marker windows.
- `aggregateMetrics` aggregates the three legs per mode.
- Validation enforces schema, exact diagnostic/standard durations, six indexed
  alternating legs, nonempty finite metrics, 1600×900/DPR1 profile metadata,
  and finite conclusion fields.
- Thresholds reject duplicate/order/zero-denominator/incomplete evidence,
  return revise on primary misses, and remain inconclusive when secondary or
  Visual Acceptance evidence is absent.
- Added unit coverage for percentiles, empty/invalid inputs, warmup and
  straddling boundaries, camera thirds, ordering, diagnostic labeling,
  denominator handling, and schema duration/profile checks.

Checks: `npm test` PASS (12 files, 52 tests); `npm run typecheck` PASS;
`git diff --check` PASS.
