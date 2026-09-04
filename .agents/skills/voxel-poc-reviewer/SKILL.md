---
name: voxel-poc-reviewer
description: Independently verify one Voxel Crossing PoC work package and produce an evidence-backed pass or rejection without committing it.
---

# Voxel PoC Reviewer

Use this skill after an implementation worker has completed a package and its
result handoff.

## Review Inputs

- assigned task
- worker result handoff
- actual Git diff and repository status
- PRD and applicable domain definitions
- prior verified package reviews on which the task depends

## Review Method

1. Confirm the diff stays inside the task's allowed scope.
2. Inspect implementation behavior, boundaries, error handling, and public
   contracts. Treat the worker summary as untrusted until verified.
3. Run `git diff --check`, relevant tests, and a production build independently.
4. For render or interaction work, run the browser smoke scenario and inspect
   its visible output. Record the exact route, viewport, and evidence.
5. Check the package-specific invariants and regression risks.
6. Verify that no per-voxel Mesh exists and that Functional Parity ownership has
   not moved into a renderer.
7. Write `_workspace/voxel-poc/reviews/<package>.md` using the review template.

## Decision Rules

- PASS only when every acceptance criterion has direct evidence and no required
  work remains.
- REJECT when behavior is missing, evidence is insufficient, tests are coupled
  to private implementation, browser output is materially wrong, or scope was
  broadened.
- NEEDS-HUMAN is reserved for Visual Acceptance or a product decision that the
  PRD deliberately assigns to a person. It is not a substitute for technical
  verification.

The reviewer never commits, pushes, publishes, or silently fixes implementation
files during evaluation. Return actionable findings to the root orchestrator.

