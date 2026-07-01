# Rename-Normalization Migration Audit

## Purpose

Document the currently mixed `_tests` rename-normalization wave so it can be finished as one coherent migration package instead of leaking through piecemeal pushes.

Audit date: `2026-07-01`

## Current Mechanical State

- Scope inspected: `git status --short -- _tests _workflow`
- `_tests` untracked additions: `256`
- `_tests` tracked deletions: `248`
- `_tests` tracked modifications: `12`
- `_workflow` untracked additions: `57`
- `_workflow` tracked deletions: `22`
- `_workflow` tracked modifications: `40`

Cross-scope totals for the same `_tests`/`_workflow` review:

- total untracked additions: `313`
- total tracked deletions: `270`

## Rename Pairing Snapshot

A mechanical normalization pass over deleted and added paths found:

- `193` likely direct rename-normalization pairs
- `77` unmatched deletions
- `118` unmatched additions

The likely direct pairs are dominated by historical name cleanup such as:

- `smoke_stage12_oauth_dcr_policy.js` -> `smoke_oauth_dcr_policy.js`
- `smoke_stage13_closeout.js` -> `smoke_closeout.js`
- `smoke_stage14_6_sep_sessionless_inventory.js` -> `smoke_sep_sessionless_inventory.js`
- `smoke_c3_cooperative_tool_cancellation.js` -> `smoke_cooperative_tool_cancellation.js`
- archived legacy auth files under `archive/legacy_retired_auth/` with stage prefixes removed

This confirms that a large part of the current worktree is one real rename-normalization wave, not random unrelated drift.

## Unmatched Deletions

The unmatched deletions are not one uniform class.

Primary buckets observed:

- historical `step38*`, `step39*`, `step40*` wrappers whose new names are semantically shorter, not just prefix-trimmed
- older `s10*` / `s11*` / `s13*` sessionless names replaced by more descriptive connector/sessionless names
- placeholder or obsolete guards such as `smoke_stage12_cache_ttl_guard.js`
- stale SSE-specific debt files that no longer map one-to-one to a current active top-level guard

These files require explicit classification per file:

- rename to current descriptive path
- archive as historical wrapper
- keep deleted without replacement

## Unmatched Additions

The unmatched additions are also mixed.

Primary buckets observed:

- genuinely new audit documents and helper manifests:
  - `NON_RUN_ALL_AUDIT.md`
  - `RUN_ALL_ACTIVE_AUDIT.md`
  - `RUN_ALL_MIXED_REVIEW_CLASSIFICATION.md`
  - `run_all_readiness_smoke_scripts.json`
  - `run_all_targeted_debt_smoke_scripts.json`
  - `run_all_workflow_control_plane_smoke_scripts.json`
- newer targeted guards with final descriptive names that did not come from a trivial prefix drop:
  - `smoke_keep_mcp_*`
  - `smoke_connector_*`
  - `smoke_request_cancellation_context.js`
  - `smoke_client_disconnect_write_guard.js`
- newly separated archived directories such as `archive/non_run_all_stale/`

These additions must not be treated as simple renames. Some are genuinely new active control files.

## Active Surface Implication

The default active manifest `run_all_smoke_scripts.json` already points at the neutralized descriptive names.

Therefore:

- the current green `run_all` baseline already depends on the new naming surface
- a narrow push of only the latest workflow-truth files would be misleading
- the rename-normalization package must be treated as an active repo-structure migration, not as cosmetic follow-up

## Immediate Package Shape

The next coherent migration slice should separate at least these buckets:

1. direct rename-normalization pairs that are already functionally equivalent
2. historical wrapper deletions requiring explicit archive/delete decisions
3. genuinely new audits/helper manifests/targeted guards
4. `_workflow` operator-decision and script path normalization that must stay aligned with `_tests`

## Validation

- `git status --short -- _tests _workflow`
- mechanical deleted/addition pairing review on `2026-07-01`
- `node _tests/run_all_smokes.js --skip-network`
