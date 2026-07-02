# S11 Connector Migration Readiness / Stable `/mcp` Coexistence Boundary

Status: GREEN / READINESS BOUNDARY PREPARED / NO CONNECTOR MIGRATION
Date: 2026-06-29

## Purpose

Prepare the post-S10B decision boundary for future connector-route migration without performing that migration now. This record preserves the then-current transition evidence around `/mcp/sessionless`, what remains legacy-compatible on stable `/mcp`, and which future actions still require a separate explicit operator decision.

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

## Readiness boundary

S10B passed the live authenticated sessionless probe on OAuth21 3008. `/mcp/sessionless` was active and validated as a historical transition route for controlled repo-native probing. This does not migrate the connector route and does not change connector-visible truth.

Stable `/mcp` remains the legacy-compatible route. It must stay available while connector/UI evidence for any future sessionless route migration is still missing. Stable session code remains in place and stable `/mcp` removal is forbidden until a separate migration stage proves connector/UI behavior on the sessionless route.

No connector route migration was performed. No connector refresh was performed. No public 3009 start was performed. No OAuth21 3008 restart was performed. No stable session code removal was performed.

## Future migration gate

Future connector migration requires a separate explicit operator decision. That future step must define the connector-visible route change, validation sequence, rollback path, restore path, and the exact evidence required from connector/UI truth.

Connector refresh remains required only when connector-visible route, connector-visible surface, connector-visible auth truth, or explicit UI validation scope changes. No such change was performed in S11, so connector refresh remains false now.

Rollback for any future migration must preserve stable `/mcp` until the sessionless route is proven through connector/UI validation. Restore for any future migration must be able to reassert stable `/mcp` without depending on unproven connector-side assumptions.

## Guard intent

S11 introduces a guard that prevents accidental connector migration framing in workflow truth. The guard requires:

- explicit no-migration wording;
- explicit no-refresh wording;
- explicit stable `/mcp` preservation wording;
- explicit ban on stable `/mcp` removal before separate migration evidence;
- explicit next-step separation from S12.

## Next recommendation

S12 should be a connector migration dry-run plan with no refresh and no live route switch. It should define future validation/rollback evidence before any connector-visible change is attempted.
