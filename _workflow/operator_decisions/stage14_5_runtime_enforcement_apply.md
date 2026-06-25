# Stage 14.5 - Runtime Enforcement Apply

Status: GREEN / RUNTIME ENFORCEMENT APPLIED IN REPO
Date: 2026-06-25

## Scope

Stage 14.5 applies runtime Resource/Operation policy enforcement in the workbench repository. The step started from control-plane snapshot `_workflow/control_plane/snapshots/2026-06-25T04-13-13_stage14-5-preapply`.

## Runtime changes

- Added `src/runtime/policy_enforcement_gate.js`.
- Wired `src/runtime/tools_call_handler.js` after `tool_call_decision` and before input validation / `tool_call_start` / handler execution.
- `SERVER_POLICY_RUNTIME_SPEC.json.runtime_enforced` is now `true`.
- `SERVER_RESOURCE_POLICY_SPEC.json.runtime_enforced` is now `true`.
- `SERVER_POLICY_RUNTIME_SPEC.json.integration_policy.runtime_enforcement_implemented_now` is now `true`.


## Live validation closeout

Commit: d299cfa. Public 3009 process was restarted by test_mcp_restart.ps1 and is now pid=22804 with health=http://127.0.0.1:3009/healthz, auth=none, profile=public, tools_count=13. OAuth21 3008 process was not restarted; it remains pid=3852 with command server.js --profile tests --auth oauth21 --oauth-secret-file ... . TESTS_MCP.test_mcp_runtime_status validated the OAuth21 3008 process read-only, not the restarted 3009 process. Therefore prior wording that coupled 3009 restart with 3008 runtime status was incorrect. OAuth21 live runtime still requires a separate OAuth-aware restart to load the Stage14.5 code. Final targeted backup record: _workflow/control_plane/snapshots/2026-06-25T14-04-36-947Z_stage14-5-live-validated-targeted.json.

## Correction after port/session review

The previous live-validation note mixed two runtimes. Port 3009 is public auth:none and was replaced by the restart script. Port 3008 is OAuth21/internal and was not restarted. TESTS_MCP runtime status observes 3008. Current corrected status: repo committed; public 3009 restarted and health/tools validated; OAuth21 3008 observed healthy but still pending restart if Stage14.5 enforcement must be live there.
