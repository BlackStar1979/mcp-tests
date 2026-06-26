# OAuth21 3008 supervisor live migration

Status: GREEN / LIVE 3008 SUPERVISOR-MANAGED / NO CONNECTOR REFRESH

Operator reported successful migration of the OAuth21 3008 runtime to the repository supervisor script. The previous live process was stopped with Ctrl+C, then restarted through `scripts/server.ps1` with profile `tests`, auth `oauth21`, port `3008`, OAuth secret file, restart trigger enabled, and trigger file under `_control/restart-request.json`.

Validation reported by operator:

- server started through `scripts/server.ps1`;
- `healthz` on 3008 succeeded;
- `scripts/request-restart.js --code=42` triggered controlled process exit;
- supervisor restarted the runtime;
- `healthz` succeeded after restart.

Operational rule after migration:

- 3008 must remain supervisor-managed;
- controlled restart must use `scripts/request-restart.js` or the trigger file;
- generic port-kill restart remains forbidden;
- connector refresh is not required for this change.
