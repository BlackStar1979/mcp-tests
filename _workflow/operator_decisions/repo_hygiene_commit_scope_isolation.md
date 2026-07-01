# Repo Hygiene Commit-Scope Isolation

Status: GREEN / NO SAFE NARROW PUSH YET / WORKFLOW-ONLY
Date: 2026-07-01

## Purpose

Determine whether the currently validated SEP/workflow package can be isolated into a conservative standalone commit and push.

## Findings

- The latest workflow package is locally validated:
  - `node _tests/run_all_smokes.js --skip-network` -> `ok=true`, `version=0.40.0`, `public=7`, `tests_authenticated=209`
- The worktree remains broadly mixed:
  - `git status --short` -> 710 entries
  - `git diff --stat` -> 395 changed files
- The apparently narrow package is not actually independent:
  - several active smoke files now exist only under neutralized names in `_tests/` and are currently untracked additions
  - their older stage-prefixed counterparts are still present in the worktree as tracked deletions
  - active workflow/spec truth already points at the neutralized names
  - run-all execution therefore depends on a wider rename/normalization package than the last SEP/workflow triage alone
- A “small safe push” of only the newest workflow records would be misleading because it would separate active truth from the broader file-renaming migration that the green run_all already assumes.

## Decision

No safe narrow standalone push exists yet.

Push remains blocked until the rename/normalization work is isolated into a coherent migration slice instead of being mixed with historical drift.

## Next bounded step

Prepare one coherent `_tests`/`_workflow` rename-normalization migration package before any push attempt.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- push_safe_now: false
- safe_narrow_commit_available_now: false

## Validation

- `git status --short`
- `git diff --stat`
- `git status --short -- _tests _workflow`
- `node _tests/run_all_smokes.js --skip-network`
