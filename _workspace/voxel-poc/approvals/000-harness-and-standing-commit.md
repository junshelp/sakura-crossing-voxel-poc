# G0/G1 Harness and Verified Commit Gate

## Scope

- Commit and push the drafted project-local Harness artifacts.
- After the root orchestrator independently records PASS for a package W001-W007,
  allow the root orchestrator to create and push that package's focused commit
  without requesting another commit approval.

This approval does not include new GitHub issues, label changes, releases, Pages
repository-setting changes, pull requests, scope expansion, or Visual Acceptance.

## Evidence Reviewed

- `docs/harness/voxel-poc-workflow.md`
- `docs/harness/voxel-poc-work-packages.md`
- the orchestrator, worker, and reviewer skills
- durable task, result, review, and approval templates
- Harness structure and forbidden-reference validation output

## Decision

APPROVED

## Authority

User approval in the active Codex task on 2026-09-04.

## Notes

The root orchestrator owns verification and commits. Implementation workers may
not mutate Git or GitHub state.

