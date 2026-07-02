# S12 Connector Migration Dry-Run Plan / No Refresh

Status: GREEN / DRY-RUN PLAN PREPARED / NO CONNECTOR REFRESH
Date: 2026-06-29

## Purpose

Prepare the first explicit connector-migration dry-run package after S11 without performing any live connector migration, connector refresh, runtime restart, or public runtime start. This record is plan-only workflow truth for a future connector-visible migration rehearsal.

Historical status note: this record is transition-route evidence only. It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md` and `_workflow/operator_decisions/single_route_selection_keep_mcp.md`. Do not use it as the current next-step plan.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false
- backup_required: true via Git commit
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Dry-run scope

S12 does not migrate any connector route. S12 does not refresh the connector. S12 does not restart OAuth21 3008. S12 does not start public 3009. S12 does not remove stable `/mcp`. S12 does not remove stable session code.

This step only prepares the dry-run migration sequence, evidence gates, and rollback expectations for a future connector-visible rehearsal. Stable `/mcp` remains the legacy-compatible route while `/mcp/sessionless` remains historical transition-route evidence from S10B and S11, not the current target architecture.

## Planned future dry-run sequence

The future dry-run should keep connector refresh disabled while rehearsing the workflow package that would be needed before any live route switch:

1. confirm stable `/mcp` preservation and no connector-visible route mutation;
2. capture the connector-visible change statement that would be proposed in a later migration step;
3. define the exact repo/runtime/connector evidence set required before any refresh request;
4. define rollback and restore steps that reassert stable `/mcp` assumptions without depending on unproven sessionless connector behavior;
5. define the operator sign-off checkpoint before any future refresh or live migration.

## Boundaries

Connector migration remains a separate explicit future action. Connector refresh remains required only when connector-visible route truth, surface truth, auth truth, or explicit UI validation scope changes. None of those changes were performed in S12.

The dry-run package must not be misreported as a live migration, a connector refresh, or connector/UI validation. It is governance/evidence preparation only.

## Guard intent

S12 introduces a guard that prevents accidental promotion of the dry-run plan into live migration truth. The guard requires:

- explicit dry-run wording;
- explicit no-refresh wording;
- explicit no-migration wording;
- explicit no-restart/no-3009 wording;
- explicit stable `/mcp` preservation wording;
- explicit next-step separation toward S13.

## Next recommendation

Historical next step at that time:
- Preferred S13: connector migration dry-run execution harness / still no refresh.
- Alternative S13: connector refresh approval package / no execution.
This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`.
