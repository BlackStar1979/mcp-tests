# Code-to-spec gap audit

Date: 2026-06-25
Status: GREEN / CODE-DERIVED SPEC GAPS REPAIRED / NO RUNTIME CHANGE

## Scope

Scan active code for runtime capabilities that were not represented in root/workflow specs. This pass used code as the source, then repaired specs and guards.

## Findings repaired

- Active code exposes `/docs/<id>` but root specs did not have a dedicated runtime configuration/route authority.
- Active code uses a larger `MCP_TEST_*` environment surface than the existing root specs described.
- Active code has CLI/runtime behavior in `server_cli_args`, `auth_bootstrap_config_resolver`, `accept_policy`, `batch_payload_dispatcher`, CORS and Host guards that was spread across code but not captured as a single machine-readable spec.
- Flat `tools/*.js` contains root-only legacy auth files; this was partially documented, but there was no clear source-layout rule stating that MCP loader authority is `tools/public` and `tools/authorized`, not the flat directory itself.
- `server.js` header still said the server exposes only search/fetch and port 3009 by default, which is stale after profiles/auth-mode topology.

## Repairs

- Added `SERVER_RUNTIME_CONFIG_SPEC.json`.
- Linked it from `SERVER_SPEC.json`, `_workflow/state.json`, and `_workflow/README.md`.
- Added `_tests/smoke_runtime_config_spec.js`, which scans active `src/` and `tools/` for `MCP_TEST_*` tokens and checks they are listed in the spec. It also extracts route literals from active route dispatchers.
- Updated `SERVER_TOOLS_SPEC.json` with `source_layout` clarifying active loader authority and root-only legacy auth files.
- Added `_tests/smoke_tool_source_layout_spec.js`.
- Updated stale `server.js` header comments.

## Validation

- `smoke_runtime_config_spec` -> ok
- `smoke_tool_source_layout_spec` -> ok
- full `run_all_smokes --skip-network` -> ok, public=6, tests_authenticated=171

## Current truth

Root specs now include a code-derived runtime configuration authority. Future code changes adding `MCP_TEST_*` variables or route literals must update `SERVER_RUNTIME_CONFIG_SPEC.json` or fail the guard.
