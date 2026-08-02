# Memory Task Lifecycle and Queue Repair

Status: GREEN / LIVE LOADED / CLIENT RE-ENUMERATION PENDING
Date: 2026-08-02

## Problem

`workbench` exposed task creation and filtered reads but no task lifecycle mutation. Completed tasks therefore remained `pending`, and the durable queue could not distinguish active work from already delivered packages.

Verified stale examples before the repair:

- `cd798053-8b4c-4bb0-a8f1-912a431f2166` was completed by the CBM skill and live stress package.
- `5e3fd2e8-fb9d-46e1-8b30-0164bb679baf` was completed by the memory embedding activation package.

The active autonomous package is task `a6cf7cac-ba33-427f-bd14-70107c36f2ef`, `Build operational E2E coverage matrix`.

## Decision

Add authorized MCP tool `memory_update_task` with statuses `pending`, `in_progress`, `done`, and `cancelled`.

Task storage remains append-only JSONL. An update appends a complete task snapshot with `updated_by` and `updated_at`; readers resolve the latest snapshot for each task id before status and assignee filtering. This preserves audit history and avoids rewriting the shared task file.

## Surface Impact

- Public tools: unchanged at `13`.
- Authorized tools: `71` to `72`.
- Authenticated total: `84` to `85`.
- Repository combined fingerprint: `b435c9f507d18f12`.
- Live `3008` serves `85` tools at `server_start_id 2026-08-02T09:21:24.828Z`; this already-open model task retains its startup-time `84`-tool map until client re-enumeration.

## Acceptance

- lifecycle regression covers create, transition, idempotent update, latest-snapshot reads, unrelated-task preservation, invalid status, missing task, and raw provenance snapshots;
- root specs, policy bindings, catalog semantics, registry equivalence, and connector counts agree at `85`;
- full offline suite must pass before restart;
- after restart, live inventory must expose `memory_update_task`, direct existing connector calls must remain authorized, and stale completed tasks must be transitioned to `done`.

Offline suite passed at `7 public + 273 authenticated`. Controlled restart `manual-1785662483342` loaded fingerprint `b435c9f507d18f12`; health reports `85`; direct `workbench.get_info` remained authorized without relogin; two completed tasks were appended as `done`; and live `memory_get_tasks` returns only `a6cf7cac-ba33-427f-bd14-70107c36f2ef` as the pending Codex package. Direct named invocation of `memory_update_task` from the already-open model task remains blocked only by its immutable startup tool map.

## Rollback

Remove the additive tool and loader/policy/spec bindings, restore the `84`-tool surface, and leave appended task snapshots intact. Older readers treat snapshots as ordinary task rows, so rollback does not destroy task history.
