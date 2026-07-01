# Keep `/mcp` Hidden Sessionless Route Live Verification

Status: GREEN / LIVE-VERIFIED / RESTART COMPLETED
Date: 2026-07-01

## Purpose

Record the controlled OAuth21 `3008` restart and bounded live verification that load the already repo-applied hidden-route retirement package.

## Controlled restart evidence

- Restart trigger written by `node scripts/request-restart.js --reason=keep_mcp_hidden_sessionless_route_retirement_live_load`.
- Trigger file: `C:\Work\mcp-tests\_control\restart-request.json`
- Restart request id: `manual-1782883488560`
- Requested exit code: `42`
- New live `server_start_id`: `2026-07-01T05:24:50.211Z`

## Live verification evidence

Before restart:

- `GET http://127.0.0.1:3008/mcp/sessionless -> 405`
- body: `{"error":"sessionless_prototype_post_only"}`

After restart:

- `GET http://127.0.0.1:3008/healthz -> 200`
- health profile: `internal`
- health tool count: `43`
- `GET http://127.0.0.1:3008/mcp/sessionless -> 404`
- body: `{"error":"Not found"}`
- authenticated `POST /mcp tools/list -> 200`
- authenticated tool count: `43`
- authenticated tool hash: `8b62ecaf89227335`
- authenticated combined fingerprint: `f43a3eed6fb79bb6`

## Active truth after verification

- live OAuth21 `3008` no longer serves hidden `/mcp/sessionless`;
- active repo runtime and live OAuth21 `3008` are now aligned on hidden-route retirement;
- `restart_required_now` is now `false`;
- connector-visible stable `/mcp` route remains unchanged;
- connector refresh remains unnecessary.

## Explicit non-actions

- no connector refresh;
- no connector route migration;
- no public `3009` start;
- no stable `/mcp` removal;
- no stable session code removal.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: false
- rollback_path: restore the hidden route only through a separate explicit repo/runtime change; do not infer rollback from historical route records
- restore_path: not applicable; live retirement is now the current verified truth
