---
name: voxel-poc-worker
description: Implement one bounded Voxel Crossing PoC work package without committing, publishing, or changing out-of-scope files.
---

# Voxel PoC Worker

Use this skill only when the root orchestrator assigns a task file under
`_workspace/voxel-poc/tasks/`.

## Required Inputs

1. Read the assigned task completely.
2. Read every durable input named by the task.
3. Read `CONTEXT.md` for domain language.
4. Inspect the current implementation and tests in the allowed scope.

## Working Rules

- Implement the smallest change that satisfies the task acceptance criteria.
- Edit only the allowed files or directories listed in the task. If another file
  is required, stop and report it in the result handoff.
- Use `apply_patch` for file edits.
- Preserve existing user changes and do not reformat unrelated code.
- Do not create branches, commits, tags, issues, labels, releases, deployments,
  pushes, or pull requests.
- Do not install unrelated packages or add abstractions for future packages.
- Do not create one Three.js Mesh per voxel.
- Keep gameplay behavior out of Voxel Assets.
- Tests should assert public behavior and invariant outputs, not private helpers.

## Required Output

Write `_workspace/voxel-poc/results/<package>.md` with:

- package identifier and status
- concise implementation summary
- files changed
- acceptance criteria evidence
- commands run and exact outcomes
- assumptions or deviations
- unresolved risks
- suggested reviewer focus

Do not mark the package verified. Only the root reviewer can do that.

