# mcp-tests

TEST MCP workbench for validating MCP server behavior, connector-visible contracts, auth modes, runtime metadata, workflow controls, and policy/spec guards.

## Current Runtime

```text
server_version = 0.40.0
connectorShapeVersion = 2025-05-strict-v1
outputMode = structured
default profile = public
```

The runtime entrypoint is `server.js`. It delegates startup to `src/runtime/server_bootstrap_runtime.js`.

## Requirements

```text
Node.js >= 20
PowerShell available for control-plane smoke tests
```

The project currently uses Node built-ins only; no `npm install` step is required for the committed runtime and smoke suite.

## Common Commands

```powershell
npm run self-test
npm test
npm run test:full
npm start
```

Equivalent direct commands:

```powershell
node server.js --self-test
node _tests/run_all_smokes.js --skip-network
node _tests/run_all_smokes.js
node server.js
```

## Repository Layout

```text
server.js                Thin runtime entrypoint
src/                     Runtime, auth, policy, schema, and support modules
tools/                   Public and internal tool facade modules
_tests/                  Smoke tests, guards, stress checks, and fixtures
_workflow/               Workflow canon, state, baselines, and control scripts
_docs/                   Local reference-doc area; only README is tracked by default
_public_sandbox/         Small public filesystem fixtures used by tests
plugins/                 Sample plugin candidates
profiles/                Runtime profile configs
docker/                  Docker/devcontainer scaffolding
```

## GitHub Import Policy

This workspace contains local operational artifacts that must not be part of the first GitHub import. The `.gitignore` excludes logs, backups, generated workflow snapshots, external code-sample corpora, imported reference-doc copies, and large local research sandboxes.

Before pushing, review:

```powershell
git status --short --ignored
```

See `GITHUB_PUBLISHING.md` for the first-push checklist.

## License

No open-source license has been selected yet. Until a license file is added, treat the project as all-rights-reserved.
