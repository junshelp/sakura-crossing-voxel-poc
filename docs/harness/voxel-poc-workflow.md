# Voxel Crossing PoC Harness Workflow

## Outcome

Implement the approved Voxel Crossing PoC with fast bounded coding workers while
the root agent retains verification, browser review, and Git/GitHub ownership.

## Workflow Shape

The repository uses an orchestrator plus two specialist skills and durable
`_workspace` handoffs:

- `voxel-poc-orchestrator`: sequences packages and owns gates
- `voxel-poc-worker`: implements exactly one bounded package
- `voxel-poc-reviewer`: independently verifies the package
- `_workspace/voxel-poc`: stores tasks, results, reviews, approvals, and summary

This is intentionally sequential by default. The implementation has deep shared
contracts, so speculative parallel edits would create more reconciliation work
than useful speed. Bounded workers may still be reused across packages.

## Ownership Boundary

| Concern | Implementation worker | Root orchestrator |
|---|---|---|
| Read specifications | yes | yes |
| Edit assigned implementation | yes | correction only after review cycle |
| Run package checks | yes | repeats independently |
| Browser and visual review | supporting evidence only | owns decision |
| Write result handoff | owns | reads |
| Write verification review | no | owns |
| Commit and push | never | only after approval and PASS |
| GitHub issues, labels, releases | never | explicit gate only |

## Package Lifecycle

```text
READY -> ASSIGNED -> IMPLEMENTED -> REVIEWING
      -> REJECTED -> ASSIGNED
      -> VERIFIED -> APPROVED_FOR_COMMIT -> COMMITTED -> PUSHED
```

`VERIFIED` is a technical state. It does not imply Visual Acceptance. A package
may be technically verified while its visual decision is marked NEEDS-HUMAN.

## Commit Policy

- One verified work package should normally produce one focused commit.
- Handoff files for that package travel in the same commit so the reasoning and
  evidence remain attached to the code.
- The root reviews staged content before committing.
- Commit messages name the delivered behavior rather than the worker or model.
- Failed experiments are documented in results but are not committed unless the
  root determines the evidence itself is valuable and the approval gate permits
  it.

## Approval Gates

1. Approve the Harness draft before its first commit and push.
2. Approve root-owned commits and pushes for verified implementation packages.
3. Approve any new GitHub issue or repository setting change separately.
4. Record Visual Acceptance separately after reviewing the built scene.
5. Do not expand to the full town without a new approved plan.

## Definition of Done

The Harness run is complete when all packages W001-W007 have PASS reviews, the
production build is deployed or ready for the approved deployment gate, benchmark
evidence is recorded, and the final decision report states continue, revise, or
reject. Visual Acceptance must be explicit; silence is pending, not approval.

