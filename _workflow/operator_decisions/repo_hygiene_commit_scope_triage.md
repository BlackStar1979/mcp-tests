# Repo Hygiene Commit-Scope Triage

Status: GREEN / PUSH NOT SAFE YET / WORKFLOW-ONLY
Date: 2026-07-01

## Purpose

Assess whether the current worktree is safe for commit/push after the active SEP and workflow packages were validated.

## Findings

- `git status --short` currently reports 710 worktree entries.
- `git diff --stat` currently reports 395 changed files.
- The worktree is not limited to the latest bounded workflow package.
- Large portions of the diff are historical rename/archive normalization:
  - old `stage*` / `s*` test files deleted
  - new neutralized test names added
  - historical operator-decision and script renames
  - broad root-spec and workflow truth updates
- Because of that mixed scope, a single blind commit/push would not be conservative enough.

## Decision

Push is not safe yet.

Before any push, the repo needs a bounded commit-scope isolation pass that separates:

1. validated workflow-truth and SEP-triage changes
2. historical rename/archive normalization
3. any unrelated or older mixed worktree changes

## Next bounded step

Run a commit-scope isolation pass and decide whether a safe commit can be cut without sweeping in unrelated historical drift.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- push_safe_now: false

## Validation

- `git status --short`
- `git diff --stat`
- `node _tests/run_all_smokes.js --skip-network`
