# State

Status: active as-is summary
Updated: 2026-07-17

## Purpose

Summarize the current validated product state in one operator-facing place without replacing the canonical specs or workflow canon.

## Current as-is state

- Repository: `C:\Work\mcp-tests`
- Branch expectation: `main`
- Runtime entrypoint: `server.js`
- Server identity: `mcp-tests-response-shape`
- Server version: `0.40.0`
- Connector shape version: `2025-05-strict-v1`
- Output mode: `structured`

## Runtime topology

- Public runtime
  - port `3009`
  - auth mode `none`
  - target connector-visible tools `13`

- Authorized runtime
  - port `3008`
  - auth mode `oauth21`
  - profile `tests/internal`
  - target connector-visible tools `69`

## Current validation baseline

- Latest full smoke baseline:
  - `node ./_tests/run_all_smokes.js --skip-network = ok=true, version=0.40.0, public=7, tests_authenticated=253`
- Latest validated public section count: `7`
- Latest validated authenticated smoke count: `253`

## Surface model

- Public MCP-visible tools: `13`
- Authorized MCP-visible tools: `56`
- Authenticated total on authorized runtime: `69`
- Server-internal helper tools remain intentionally hidden from MCP schema/tools-list

## Current workflow track

- `current_working_course = post_53d-initialize-compatibility-debug-and-retirement-scope`
- `next_primary = post_53d-real-client-entry-evidence-refresh`
- `next_secondary = post_53d-decision-relevant-connector-visible-surface-revalidation`

## Verified documentation authorities

- Canonical workflow truth:
  - `_workflow/WORKFLOW_CANON.md`
  - `_workflow/ACTIVE_WORKFLOW_INDEX.md`
  - `_workflow/state.json`

- Canonical server truth:
  - `SERVER_SPEC.json`
  - `SERVER_AUTH_SPEC.json`
  - `SERVER_CONNECTOR_SURFACE_SPEC.json`
  - `SERVER_TOOLS_SPEC.json`
  - related `SERVER_*_SPEC.json` policy/runtime documents

## Current operational caveats

- Workflow truth and runtime truth must stay separated.
- Connector/UI truth may drift from repo/runtime truth and requires live verification.
- Model-runtime callability is a separate layer from external UI visible-tool enumeration.
- Fresh 2026-07-15 evidence confirms `mcp__workbench` is callable again from this Codex runtime session, but full UI visible-tool enumeration is still not independently re-verified in the same step.
- Fresh 2026-07-15 client-entry observability now distinguishes stale entry windows from real reconnect evidence: a current window that shows only follow-up `tools/call` traffic does not by itself prove any change in client entry path.
- Fresh repo-native `2026-07-17` client-entry reporting against `_logs/.mcp-tests-audit.jsonl` now shows the current window on `server_start_id 2026-07-16T17:49:38.692Z` as `initialize_only`, with `2` successful legacy `initialize` responses for `codex-mcp-client 0.145.0-alpha.18` and no matching fresh `server/discover` entry in that same window.
- Live `observability_status` now exposes the same retained blocker-matrix view as the workflow helper, so current-window entry evidence and `1d`/`2d`/`7d`/`30d`/`all` blocker framing no longer depend on a script-only code path.
- `state.json` is an orientation map, not a progress log.
- Operator-facing documentation is now explicit, but directory coverage is not yet complete for every repo directory.
- OAuth21 durable-state hygiene now has an explicit control-plane path with bounded records/backups and approval-gated apply; it is not a connector-visible runtime tool.
- Public unauthenticated OAuth21 routes now have bounded per-IP throttling, and oversized OAuth21 request bodies are force-aborted before they can continue streaming in-process.
- OAuth21 DCR registration now enforces a bounded client-registry cap and opportunistically prunes retention-expired `dead_clients` before admitting new public registrations.
