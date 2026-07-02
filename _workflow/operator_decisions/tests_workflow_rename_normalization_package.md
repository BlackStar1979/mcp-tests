# Tests/Workflow Rename-Normalization Package

Status: GREEN / PACKAGE-SCOPING ONLY / NO PUSH
Date: 2026-07-01

## Purpose

Define the next coherent repo-hygiene package after commit-scope isolation showed that the current green baseline already depends on a broader `_tests` / `_workflow` rename-normalization wave.

## Findings

- `_tests` and `_workflow` are still in a mixed migration state rather than a clean post-rename state.
- Mechanical review of `git status --short -- _tests _workflow` found:
  - `_tests`: `256` untracked additions, `248` tracked deletions, `12` tracked modifications
  - `_workflow`: `57` untracked additions, `22` tracked deletions, `40` tracked modifications
  - combined totals in the same scope: `313` untracked additions, `270` tracked deletions
- A normalization pairing pass identified `193` likely direct rename-normalization pairs, proving that this is a real structured migration package rather than isolated one-off edits.
- The remaining unmatched files are mixed across:
  - historical wrapper deletions
  - genuinely new helper manifests and audit docs
  - newer descriptive guards whose semantics go beyond simple prefix trimming
- Current active `run_all` already references the new descriptive test names, so a narrow push of only workflow-truth files would separate active truth from the file-surface that validation already assumes.

## Decision

The next bounded repo-hygiene step is not push preparation in the abstract.

It is one coherent `_tests` / `_workflow` rename-normalization migration package.

That package must distinguish:

1. direct rename-equivalent path replacements
2. historical wrappers that should stay archived or deleted
3. genuinely new active helper manifests / audit docs / targeted guards
4. workflow references that must stay path-aligned with the renamed test surface

## Evidence

- `_tests/RENAME_NORMALIZATION_MIGRATION_AUDIT.md`
- `git status --short -- _tests _workflow`
- `node _tests/run_all_smokes.js --skip-network`

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- push_safe_now: false
- next_step_type: rename_normalization_migration_package
