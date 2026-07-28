# DIRECTORY

Status: active workflow operator decisions directory map
Updated: 2026-07-28

- `initialize_client_compatibility_evidence.md`
  Current operational evidence for legacy `initialize` versus `server/discover` client-entry behavior.
- `initialize_retirement_decision_prep.md`
  Bounded decision-preparation record for any future legacy `initialize` retirement package.
- `connector_*.md`
  Connector refresh, migration, callable-surface, route-coexistence, and reconnect evidence records.
- `keep_mcp_*.md`
  Decision records for retaining `/mcp` as the canonical route while retiring or constraining adjacent route debt.
- `sessionless_*.md, single_route_*.md, subscriptions_listen_*.md`
  Sessionless, single-route, and subscriptions/listen compatibility and migration records.
- `oauth21_*.md, auth_*.md`
  OAuth21/auth control-plane, pruning, and security-adjacent decision evidence.
- `stage*.md, p*.md, post_stage*.md`
  Historical stage/package records retained for traceability; current authority stays in active workflow files.
- `*_closeout.md, *_inventory.md, *_plan.md, *_review.md, *_package.md`
  Bounded work-package lifecycle records used to explain why a change was prepared, accepted, deferred, or closed.

This directory is a decision ledger, not the active queue. Current priority and interpretation still come from `_workflow/READINESS.md`, `_workflow/ROADMAP.md`, `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/WORKFLOW_CANON.md`, and `_workflow/state.json`.
