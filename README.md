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

Install the pinned runtime and test dependencies before first use:

```powershell
npm install
```

The structured Markdown tools use the unified/remark parser stack. Dependency versions are pinned in `package.json`; do not replace the parser with regular-expression-only heading detection.

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
tools/                   Public, authorized, and internal tool facade modules
_tests/                  Smoke tests, guards, stress checks, and fixtures
_workflow/               Workflow canon, state, baselines, and control scripts
_docs/                   Local reference-doc area; only README is tracked by default
_public_sandbox/         Small public filesystem fixtures used by tests
plugins/                 Sample plugin candidates
profiles/                Runtime profile configs
docker/                  Docker/devcontainer scaffolding
```

## Operator-Facing Documentation

The operator-facing documentation contract lives in:

- `_workflow/NORTHSTAR.md`
- `_workflow/STATE.md`
- `_workflow/READINESS.md`
- `_workflow/ROADMAP.md`
- `DIRECTORY.md`

## Workspace Roots

Authorized workspace-readonly filesystem tools resolve bare paths under `C:\Work` on Windows by default. Extra explicit roots can be added with `MCP_TEST_EXTRA_ROOTS` using `alias=path;alias2=path2`, then addressed as `@alias/...`.

The authorized/tests surface also exposes bounded read-only truth tools for repo/workflow drift inspection and change-flow planning. They do not mutate runtime, connector config, auth state, or files.

### Remote site operations

The live remote-site tools take an explicit `vps_config_ref`. On the maintained Windows workstation the operational reference is `C:\Work\www\remote-site-tools-config.json`, owned by the separate `www` repository. `mcp-tests` does not copy or own that configuration. Credential material remains outside `mcp-tests`; private keys must never be committed to this repository.

## Structured File Operations

The authorized surface includes tools for exact large-file work without transferring the whole file through model context:

- `file_inspect` resolves byte, line, anchor, or Markdown-section selectors and returns bounded context plus hashes.
- `content_stage` stores large generated UTF-8 content as owner-bound chunks for later mutation calls.
- `file_transform` inserts, replaces, deletes, or appends exact ranges in one physical file.
- `file_split` writes one source into multiple files without deleting the source implicitly.
- `file_merge` combines ordered source files into one destination without deleting the sources implicitly.
- `markdown_inspect` and `markdown_transform` use a Markdown AST for heading-aware inspection and mutation.

Mutations use `preview -> receipt -> commit`. Re-inspect and re-preview whenever a receipt is stale or a hash no longer matches. Agents should load `.agents/skills/using-structured-file-tools/SKILL.md` for routing rules and recovery behavior.

## GitHub Import Policy

This workspace contains local operational artifacts that must not be part of the first GitHub import. The `.gitignore` excludes logs, backups, generated workflow snapshots, external code-sample corpora, imported reference-doc copies, and large local research sandboxes.

Before pushing, review:

```powershell
git status --short --ignored
```

See `GITHUB_PUBLISHING.md` for the first-push checklist.

## License

No open-source license has been selected yet. Until a license file is added, treat the project as all-rights-reserved.
