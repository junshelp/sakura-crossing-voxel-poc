---
name: voxel-poc-orchestrator
description: Orchestrate the Sakura Crossing Voxel PoC through bounded implementation workers, root-owned verification, durable handoffs, and approval-gated commits.
---

# Voxel PoC Orchestrator

Use this skill to implement the approved Voxel Crossing PoC PRD through small,
reviewable work packages.

## Goal

Deliver a playable Miniature Crossing Slice with Baseline Mode, Voxel Mode,
Functional Parity, spherical projection, deterministic interactions, and an A/B
Benchmark Run. Do not expand beyond the approved PRD.

## Durable Inputs

- `CONTEXT.md`
- `docs/voxel-crossing-poc-prd.md`
- `docs/harness/voxel-poc-workflow.md`
- `docs/harness/voxel-poc-work-packages.md`
- `_workspace/voxel-poc/summary.md`

Read all applicable inputs before assigning or reviewing work. Use the project
domain terms exactly as defined in `CONTEXT.md`.

## Roles

### Root orchestrator

- Owns sequencing, scope, independent verification, browser review, commits,
  pushes, issue updates, and approval gates.
- Never delegates final validation or Git/GitHub mutation.
- Reviews the actual diff and repository state rather than trusting a worker
  summary.

### Implementation worker

- Prefer a fast lower-cost coding model such as `gpt-5.6-luna` with medium
  reasoning for one bounded package.
- Uses the `voxel-poc-worker` skill.
- May read files, edit only assigned scope, and run relevant local checks.
- Must not commit, push, create issues, change labels, publish deployments, or
  broaden the package.

### Verification reviewer

- Is run by the root orchestrator with the `voxel-poc-reviewer` skill.
- Repeats tests independently, examines contracts and regressions, and records a
  pass or rejection under `_workspace/voxel-poc/reviews/`.

## Work Package Loop

1. Select the first uncompleted package whose dependencies are verified.
2. Create `_workspace/voxel-poc/tasks/<package>.md` from the task template. Copy
   the exact scope, acceptance criteria, allowed files, and required checks.
3. Delegate only that task to one implementation worker. Do not run overlapping
   packages in parallel unless their allowed file sets are disjoint and the
   root can review both diffs independently.
4. Require the worker to write `_workspace/voxel-poc/results/<package>.md`.
5. Inspect the diff, result handoff, test output, and current repository status.
6. Run the reviewer checks and write
   `_workspace/voxel-poc/reviews/<package>.md`.
7. If rejected, send the concrete findings back to the same worker when
   practical. The worker updates the result handoff after correcting the diff.
8. If accepted, confirm that the applicable commit/push approval gate is open.
   Only the root orchestrator may commit or push.
9. Update `_workspace/voxel-poc/summary.md` with the verified commit and the next
   eligible package.

## Allowed Tools

- Root: repository reads, `apply_patch`, local commands, browser automation,
  image inspection, Git, and GitHub CLI subject to approval gates.
- Worker: repository reads, `apply_patch`, and non-destructive local commands.
- Reviewer: repository reads, local tests/builds, browser automation, image
  inspection, and review handoff edits. Reviewer does not mutate implementation
  files while evaluating a package.

## Approval Gates

- G0: User approves the drafted Harness before its first commit and push.
- G1: User explicitly authorizes the root to create and push implementation
  commits after each package passes verification. If authorization is scoped to
  one package, stop after that package.
- G2: Any GitHub issue creation, label change, release, Pages setting change, or
  pull request requires explicit approval unless the user has already authorized
  that exact action.
- G3: Visual Acceptance is always a human approval. Automated screenshots may
  expose regressions but cannot grant it.
- G4: Expanding beyond the Miniature Crossing Slice requires a new product
  decision and is never inferred from implementation success.

## Validation Checks

Every implementation package must pass:

- `git diff --check`
- the package-specific unit and integration tests
- a production build
- no unassigned file changes
- no per-voxel Three.js Mesh construction
- no gameplay ownership inside Voxel Assets

Packages that affect rendering or interaction must additionally pass a browser
smoke test at the package's fixed camera or scripted route. Record screenshots or
telemetry paths in the review handoff when they materially support the decision.

The final package additionally requires:

- both modes load and switch without shared-state reset
- Functional Parity checks pass
- the complete Benchmark Run exports valid JSON
- Reference Profile evidence is recorded
- Visual Acceptance remains explicitly pending or explicitly approved

## Handoff Contract

Task, result, review, and approval records are durable project artifacts. A
worker message is not a substitute for the corresponding `_workspace` file.
Never put Harness mechanics or tool vocabulary into `CONTEXT.md`.

