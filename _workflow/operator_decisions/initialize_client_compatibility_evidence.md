# Initialize Client Compatibility Evidence

Status: GREEN / CLIENT EVIDENCE RECORDED / WORKFLOW-ONLY
Date: 2026-07-13

## Purpose

Record real client compatibility evidence for legacy `initialize` on the surviving `/mcp` route, and define the bounded compatibility interpretation so future work does not misread this as authorization for a permanent dual-standard architecture.

## Test setup

An isolated OAuth21 workbench fork was started on fresh local ports with:

- one surviving route: `/mcp`
- Streamable HTTP connector type in Codex desktop UI
- no hidden `/mcp/sessionless`
- no active transport sessions
- legacy `initialize` intentionally disabled in one fork to test true no-handshake client behavior

The tested connector path was refreshed by:

- removing the prior connector entry
- re-adding a new connector with a new port and a new connector name
- completing a fresh OAuth password prompt for the new port

## Confirmed client evidence

The tested Codex desktop connector now provides two distinct evidence points:

1. Fresh OAuth authorization succeeds on the new Streamable HTTP connector.
   - `oauth21_operator_login_accepted`
   - `oauth21_state_saved`
   - `oauth21_access_token_accepted`

2. After successful authorization, the tested client still enters through legacy `initialize`.
   - observed authenticated `POST /mcp` requests with `method: "initialize"`
   - no observed authenticated `server/discover`
   - later observed normal follow-up traffic on the same surviving route:
     - `notifications/initialized`
     - `tools/list`
     - `tools/call`

This means:

- auth success alone does not imply migration to the no-handshake request contract
- at least one real client/connector still depends on legacy `initialize` after OAuth succeeds
- at least one real client/connector still calls legacy `initialize` after OAuth succeeds
- repo-side no-handshake support is not enough to remove legacy `initialize` from the compatibility surface today

## Fresh evidence refresh on 2026-07-13

Current authenticated audit evidence continues to confirm the same compatibility blocker on the surviving `/mcp` route:

- observed authenticated `POST /mcp` requests with `method: "initialize"`
- observed authenticated `initialize_received` events for:
  - `client_name: "codex-mcp-client"`
  - `client_version: "0.144.2"`
- observed follow-up authenticated traffic on the same route for the same real client family:
  - `notifications/initialized`
  - `tools/list`
  - `tools/call`
- no observed authenticated `server/discover` entries in the same fresh real-client audit window for that Codex client family

Current observability interpretation is now narrower and safer than the earlier wording implied:

- if the current server-start window shows only `tools/list` / `tools/call` follow-up traffic but no fresh `initialize` or `server/discover`, treat that window as `followup_traffic_without_fresh_entry`
- do not reinterpret such a stale-entry window as evidence that the client changed entry path
- entry-path conclusions must come from a window that actually contains the reconnect / entry event

The broader retained audit file still contains historical authenticated `server/discover` requests on `/mcp`, but they are older evidence and not part of the current real Codex client entry window. They therefore do not weaken the current blocker interpretation.

This refresh matters because it removes ambiguity about drift since the earlier 2026-07-03 record:

- the blocker is still present on a newer Codex desktop client line
- the real client can still operate normally after legacy `initialize`, so the compatibility blocker is now specifically about the entry path rather than a broader post-auth runtime failure
- stale-entry follow-up windows are now explicitly separated from fresh reconnect evidence, so "no current initialize/server_discover observed" no longer reads as protocol migration evidence by accident
- the current compatibility interpretation remains justified
- initialize retirement on the surviving route is still blocked by real client behavior, not by missing repo support

## Live evidence refresh on 2026-07-15

Current live evidence from `node _workflow/scripts/client_entry_path_report.js` against `_logs/.mcp-tests-audit.jsonl` tightens the interpretation again without weakening the blocker:

- current runtime slice reports:
  - `current_server_start_id: "2026-07-15T17:49:45.348Z"`
  - `followup_traffic_without_fresh_entry: true`
  - `initialize_retirement_readiness.status: "stale_entry_window"`
- that current slice contains follow-up `tools/call` traffic only and therefore does not count as fresh entry-path evidence either way
- the latest retained real-client family evidence across the broader audit file still shows:
  - `client_name: "codex-mcp-client"`
  - `client_version: "0.144.2"`
  - status `initialize_only`
- the same retained broader file also shows other real client families still on legacy `initialize`:
  - `client_name: "openai-mcp"`
  - `client_version: "1.0.0"`
  - status `initialize_only`
  - `client_name: "Anthropic/ClaudeAI"`
  - `client_version: "1.0.0"`
  - status `initialize_only`
- the retained `server_discover_only` evidence in that broader file is currently synthetic validation traffic:
  - `client_name: "step95-discover-smoke"`
  - `client_version: "1"`
- the refreshed report now classifies retained client families explicitly:
  - operational known families remain `initialize_only`
  - synthetic validation families must not be used as retirement evidence
  - the same retained-evidence filters are now also available through runtime-facing `observability_status` using:
    - `client_name`
    - `evidence_scope`
    - `max_age_days`

This refresh matters because it further narrows the safe conclusion:

- the current runtime window is stale for entry-path purposes and must not be overinterpreted
- the retained broader audit evidence still does not show an operational client family migrating away from legacy `initialize`
- the retained broader `server_discover_only` evidence is synthetic validation traffic rather than an operational client family
- initialize retirement therefore remains blocked by current real-client evidence, not by missing server capability and not by ambiguity about stale windows

## Live evidence refresh on 2026-07-17

Fresh evidence from `node _workflow/scripts/client_entry_path_report.js` against `_logs/.mcp-tests-audit.jsonl` replaces the earlier current-window ambiguity with a stronger blocker on the newest observed Codex client line:

- current runtime slice reports:
  - `current_server_start_id: "2026-07-16T17:49:38.692Z"`
  - `diagnostics.status: "initialize_only"`
  - `initialize_retirement_readiness.status: "blocked_initialize_only_current_window"`
  - `current_window_counts.initialize_response_success: 2`
  - `current_window_counts.server_discover_response_success: 0`
- the current real client in that same window is:
  - `client_name: "codex-mcp-client"`
  - `client_version: "0.145.0-alpha.18"`
  - status `initialize_only`
- the same current window also shows:
  - `notifications_initialized: 2`
  - `tools_list: 2`
  - `tools_call: 19`
  - so the runtime still behaves normally after legacy `initialize`; the blocker remains specifically the entry path
- retained broader operational evidence across the file still remains initialize-bound as before:
  - `codex-mcp-client 0.144.2`
  - `openai-mcp 1.0.0`
  - `Anthropic/ClaudeAI 1.0.0`
  - `Anthropic/Toolbox 1.0.0`
- retained `server_discover_only` evidence remains synthetic validation traffic only:
  - `step95-discover-smoke 1`
- therefore the compatibility interpretation tightens again:
  - the surviving `/mcp` route still must preserve legacy `initialize`
  - initialize retirement remains blocked by fresh current operational client behavior
  - no current operational `server_discover_only` reconnect evidence exists yet for the same client family

## Freshness-filtered retained evidence on 2026-07-17

The retained-evidence interpretation is now also freshness-aware:

- `node _workflow/scripts/client_entry_path_report.js --evidence-scope=operational --max-age-days=2 --limit=20`
- current live result still reports:
  - `retirement_evidence_summary.status: "blocked_by_operational_initialize_clients"`
- but the retained operational blocker set is now narrowed to the freshest observed client lines only:
  - `codex-mcp-client 0.145.0-alpha.18`
  - `codex-mcp-client 0.144.2`
- older operational families remain historically relevant, but they no longer need to dominate default retained-evidence summaries when the question is "what is still fresh enough to block retirement now?"

This matters because it improves the safety of the blocker statement without weakening it:

- the blocker still exists
- the blocker is now attributable to fresh Codex client lines, not only to long-tail historical audit residue
- future retirement review can now ask two separate questions without mixing them:
  - what is the full retained operational history?
  - what is the fresh retained operational blocker set?

## Live evidence refresh on 2026-07-27

The connector refresh and subsequent external client traffic created a meaningfully new operational evidence window on the live OAuth21 server:

- explicit report command:
  - `node _workflow/scripts/client_entry_path_report.js --server-start-id=2026-07-27T03:10:26.042Z --evidence-scope=operational --max-age-days=2 --limit=20`
- selected live identity:
  - `server_start_id: 2026-07-27T03:10:26.042Z`
  - server start timestamp `2026-07-27T03:10:26.163Z`
- current live entry result:
  - `diagnostics.status: "initialize_only"`
  - `initialize_retirement_readiness.status: "blocked_initialize_only_current_window"`
  - `retirement_evidence_summary.status: "blocked_by_operational_initialize_clients"`
- operational client family:
  - `openai-mcp 1.0.0`
  - protocol version `2025-11-25`
  - `8` successful legacy `initialize` responses
  - `0` `server/discover` entries
  - latest successful initialize timestamp `2026-07-27T15:23:44.351Z`

The result is current operational evidence, not retained historical inference. It confirms that the compatibility shim must remain and does not authorize `initialize` retirement.

The refresh also exposed and closed a test-evidence integrity defect:

- standalone smoke child-servers could inherit the production `_logs/.mcp-tests-audit.jsonl` path even when their surface, restart, and rate-limit state were hermetic;
- `_tests/helpers/hermetic_server_control_env.js` now assigns a temporary audit path by default and preserves an explicit audit override;
- `_workflow/scripts/client_entry_path_report.js` now accepts `--server-start-id`, selects the named server start, and attributes request events through explicit IDs, request correlation, or active-start context;
- test child-server audit isolation is guarded by bootstrap, repository-hygiene, report-fixture, standalone hash, and full-suite no-pollution checks;
- historical test entries remain preserved in the audit log as evidence; no audit-log deletion or rewriting was performed.

## Live evidence refresh on 2026-07-28

Fresher operational client traffic created a new `COMP-1A` evidence point after the July 27 window. The newest live server start itself is currently a stale entry window, so the report now supports selecting the latest server start that contains a real entry event:

- stale latest-runtime command:
  - `node _workflow/scripts/client_entry_path_report.js --evidence-scope=operational --max-age-days=2 --limit=20`
- stale latest-runtime result:
  - `current_server_start_id: "2026-07-28T16:05:12.562Z"`
  - `initialize_retirement_readiness.status: "stale_entry_window"`
  - `followup_traffic_without_fresh_entry: true`
  - latest entry server start: `2026-07-28T03:49:00.666Z`
- latest-entry command:
  - `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=2 --limit=20`
- selected entry identity:
  - `server_start_id: 2026-07-28T03:49:00.666Z`
  - server start timestamp `2026-07-28T03:49:00.791Z`
- current entry result for that selected window:
  - `diagnostics.status: "initialize_only"`
  - `initialize_retirement_readiness.status: "blocked_initialize_only_current_window"`
  - `retirement_evidence_summary.status: "blocked_by_operational_initialize_clients"`
- operational client family:
  - `codex-mcp-client 0.146.0-alpha.3.1`
  - protocol version `2025-06-18`
  - `2` successful legacy `initialize` responses in the selected window
  - `0` `server/discover` entries in the selected window
  - latest successful initialize timestamp `2026-07-28T04:11:21.465Z`

The result is stronger than the July 27 retained blocker because it confirms the same compatibility dependency on a newer Codex client line. The newest `2026-07-28T16:05:12.562Z` runtime slice must still be treated as stale for entry-path purposes, while `2026-07-28T03:49:00.666Z` is the freshest selected operational entry window.

The refresh also removes a recurring workflow friction point:

- `_workflow/scripts/client_entry_path_report.js` now accepts `--latest-entry-window`;
- the option selects the newest server start that contains `initialize_received` or `server_discover_received` after the `client-name`, `evidence-scope`, and `max-age-days` filters;
- the report always exposes `latest_entry_server_start` so a stale latest runtime can be distinguished from the freshest entry-capable window.

## Live evidence refresh on 2026-08-01

Fresh operational traffic now supersedes the July 28 client sample:

- command: `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=2 --limit=20`
- selected entry identity: `server_start_id 2026-08-01T17:51:19.986Z`
- client: `codex-mcp-client 0.146.0-alpha.9.2`
- protocol version: `2025-06-18`
- selected-window result: `2` legacy `initialize` entries and `0` `server/discover` entries
- retirement verdict: `blocked_by_operational_initialize_clients`

The final `2026-07-28` server adapter is implemented and regression-covered in `_workflow/operator_decisions/mcp_2026_07_28_dual_era_closeout.md`, but operational Codex behavior still requires the compatibility shim.

## Live evidence refresh on 2026-08-02

Traffic newer than the August 1 snapshot created a current-window evidence point on the already loaded production runtime:

- command: `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=2 --limit=30`
- selected and current server start: `2026-08-01T20:29:11.207Z`
- latest matching Codex initialize: `2026-08-02T08:02:55.013Z`
- client: `codex-mcp-client 0.146.0-alpha.9.2`
- protocol: `2025-06-18`
- matching selected-window result: `2` legacy `initialize` entries and `0` `server/discover` entries
- retained matching result within the two-day filter: `14` legacy `initialize` entries and `0` `server/discover` entries
- verdict: `blocked_by_operational_initialize_clients`

The same package now also has independent official SDK v2 proof in `_workflow/operator_decisions/mcp_official_sdk_v2_interop_closeout.md`: the repository server accepts both automatic and pinned modern `2026-07-28` negotiation through `server/discover`, while the SDK default legacy client remains functional through `initialize`. This separates server readiness from the unchanged operational Codex blocker.

## Live evidence refresh on 2026-08-16

Traffic newer than the August 2 sample creates a new operational Codex evidence point:

- command: `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=14 --limit=20`
- selected Codex entry identity: `server_start_id 2026-08-13T19:41:25.994Z`
- latest matching Codex initialize: `2026-08-14T03:09:06.144Z`
- client: `codex-mcp-client 0.147.0-alpha.6.6`
- protocol: `2025-06-18`
- selected-window result: `4` legacy `initialize` entries and `0` `server/discover` entries
- retained matching result in the 14-day filter: `6` legacy `initialize` entries and `0` `server/discover` entries
- retirement verdict: `blocked_by_operational_initialize_clients`

Independent operational evidence now also proves the modern path outside the Codex family:

- `openai-mcp 1.0.0`
- `server/discover` observed at `2026-08-16T15:51:06.166Z`
- protocol `2026-07-28`
- response status `200` with a successful result

This narrows the blocker again: modern `server/discover` is operational, but the latest Codex client family still requires legacy `initialize`. Do not reopen initialize retirement until Codex client-entry traffic newer than the August 14 sample changes that verdict.

## Live evidence refresh on 2026-08-17

Traffic newer than the August 14 sample creates another operational Codex evidence point on the unchanged live runtime:

- command: `node _workflow/scripts/client_entry_path_report.js --latest-entry-window --client-name=codex-mcp-client --evidence-scope=operational --max-age-days=7 --limit=10`
- selected and current server start: `2026-08-16T19:04:37.288Z`
- latest matching Codex initialize: `2026-08-17T03:29:12.566Z`
- client: `codex-mcp-client 0.148.0-alpha.9`
- protocol: `2025-06-18`
- selected-window result: `3` successful legacy `initialize` entries and `0` `server/discover` entries
- audit parse errors: `0`
- retirement verdict: `blocked_by_operational_initialize_clients`

The newer client line does not change the retirement decision. The server's modern `server/discover` path remains independently proven, but operational Codex still requires the legacy compatibility shim. Refresh this evidence again only after Codex client-entry traffic newer than the August 17 sample appears.

## Compatibility interpretation

This record authorizes only a bounded compatibility interpretation on the surviving `/mcp` route:

1. Keep one route only: `/mcp`.
2. Keep one auth boundary only.
3. After auth, tolerate either client entry style:
   - legacy `initialize`
   - modern `server/discover`
4. Route both entry styles into the same surviving server/tool surface.

This is a bounded compatibility shim, not dual-target architecture.

## What this record explicitly does not authorize

This record does not authorize:

- permanent dual-standard protocol direction
- making `initialize` part of the intended end-state contract
- reintroducing SSE or `GET /mcp` stream behavior as target architecture
- reintroducing hidden `/mcp/sessionless` as a destination route
- adding new target-facing capabilities only to the `initialize` path

## Active rule for future work

Until newer client evidence exists, the surviving `/mcp` route may keep bounded dual recognition of:

- legacy `initialize`
- modern `server/discover`

But:

- `server/discover` remains the canonical target-facing request-contract surface
- `initialize` remains compatibility debt only
- any new destination behavior must be specified on the `server/discover` path, not by growing `initialize`

## Evidence

- `_workflow/operator_decisions/initialize_no_handshake_repo_evidence.md`
- `_workflow/operator_decisions/keep_mcp_initialize_retirement_boundary.md`
- `_workflow/scripts/client_entry_path_report.js`
- `observability_status`
- `src/runtime/rpc_message_dispatcher.js`
- `src/runtime/server_discover_message_handler.js`
- `C:\\Users\\mczyz\\AppData\\Local\\Temp\\mcp-tests-fork-audit-3022.jsonl`
- `_logs/.mcp-tests-audit.jsonl`

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: git revert this commit
- restore_path: git revert this commit
