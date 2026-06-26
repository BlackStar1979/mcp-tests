# MCP supervisor scripts

Status: repo implemented, live 3008 migration pending.

## Windows PowerShell

Public runtime example:

```powershell
$env:MCP_SUPERVISOR_PROFILE = 'public'
$env:MCP_SUPERVISOR_AUTH = 'none'
.\scripts\server.ps1
```

OAuth21 tests runtime example:

```powershell
.\scripts\server.ps1 --profile tests --auth oauth21 --oauth-secret-file C:\\Users\\mczyz\\.romion\\tests_oauth_secret.json --restart-trigger 1 --trigger-file C:\\Work\\mcp-tests\\_control\\restart-request.json
```

## Ubuntu / bash

```bash
./scripts/server.sh \
  --profile tests \
  --auth oauth21 \
  --oauth-secret-file /secrets/tests_oauth_secret.json \
  --restart-trigger 1 \
  --trigger-file /work/mcp-tests/_control/restart-request.json
```

## Trigger file

The supervisors set MCP_TEST_ENABLE_RESTART_TRIGGER=1 and default MCP_TEST_RESTART_TRIGGER_FILE to _control/restart-request.json.

```bash
node scripts/request-restart.js --code=42 --reason=manual
```

Controlled codes are 42, 43 and 44. Other exit codes stop the supervisor.

## Argument priority

CLI arguments override `MCP_SUPERVISOR_*` and `MCP_TEST_RESTART_*` environment variables. Unknown CLI arguments are forwarded to `node server.js`. Both `--key value` and `--key=value` are supported.
