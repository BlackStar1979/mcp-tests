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
$env:MCP_SUPERVISOR_PROFILE = 'tests'
$env:MCP_SUPERVISOR_AUTH = 'oauth21'
$env:MCP_SUPERVISOR_OAUTH_SECRET_FILE = 'C:\\Users\\mczyz\\.romion\\tests_oauth_secret.json'
.\scripts\server.ps1
```

## Ubuntu / bash

```bash
MCP_SUPERVISOR_PROFILE=tests \
MCP_SUPERVISOR_AUTH=oauth21 \
MCP_SUPERVISOR_OAUTH_SECRET_FILE=/secrets/tests_oauth_secret.json \
./scripts/server.sh
```

## Trigger file

The supervisors set MCP_TEST_ENABLE_RESTART_TRIGGER=1 and default MCP_TEST_RESTART_TRIGGER_FILE to _control/restart-request.json.

```bash
node scripts/request-restart.js --code=42 --reason=manual
```

Controlled codes are 42, 43 and 44. Other exit codes stop the supervisor.
