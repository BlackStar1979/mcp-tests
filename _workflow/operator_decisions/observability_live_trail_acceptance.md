# Observability Live Trail Acceptance

Status: GREEN / LIVE ACCEPTED
Date: 2026-08-17

## Decision

Accept `OBS-1` at `4/4` for the current target. Existing bounded audit events and client-entry diagnostics answer active entry-path questions without raw payload logging or a broader diagnostics surface.

The official MCP `2026-07-28` model is stateless, retires `initialize` for modern traffic, and makes `server/discover` optional. Client-entry evidence must therefore distinguish an actual entry event from later standalone requests rather than infer a handshake from follow-up traffic: `https://blog.modelcontextprotocol.io/posts/2026-07-28/`.

## Live evidence

The current OAuth21 runtime window is `server_start_id = 2026-08-17T04:06:37.912Z`.

`client_entry_path_report.js` read `4073` audit entries with `parse_errors = 0` and reported:

- `initialize_received = 0`
- `server_discover_received = 0`
- `tools_call_start = 11`
- `followup_traffic_without_fresh_entry = true`
- `initialize_retirement_readiness.status = stale_entry_window`

`client_entry_blocker_matrix.js` independently classified retained operational windows `1d`, `2d`, `7d`, `30d`, and `all` as `blocked_by_operational_initialize_clients`, naming `codex-mcp-client 0.148.0-alpha.9`. The latest paired legacy entry response remains HTTP `200` with `has_result = true` and `has_error = false`.

This answers both current questions without adding logging:

1. The post-restart window contains usable follow-up traffic but no fresh entry-path evidence.
2. Retained operational evidence still blocks legacy `initialize` retirement for the Codex client family.

## CLI integrity correction

The acceptance run exposed a real tooling defect: `--name value` arguments were silently ignored because the scripts accepted only `--name=value`.

The three client-entry workflow tools now share `_workflow/scripts/cli_args.js`:

- both argument forms are accepted;
- missing values, duplicate options, unknown options, flag values, and positional arguments fail closed;
- controlled failures expose `error_code` and `argument` without dumping the audit payload.

Regression coverage uses spaced arguments across the report, blocker matrix, and waiter, and verifies controlled missing/unknown-option failures.

## Follow-up CLI integrity sweep

The same defect class was subsequently removed from the remaining workflow and operator-facing helpers that used ad hoc argument lookup:

- `sessionless_live_authenticated_probe.js` and `connector_migration_dry_run_harness.js` now parse every option before executing their bounded behavior;
- `run_operational_e2e_soak.js` accepts both value forms and rejects unknown options instead of silently changing the selected workload;
- `request-restart.js` parses and validates the complete command line before creating a directory or writing a trigger file, so a misspelled option cannot fall through to the default restart request;
- the authoritative parser now lives in `src/util/cli_args.js`; `_workflow/scripts/cli_args.js` remains a compatibility facade for workflow helpers.

Regression coverage verifies spaced values, controlled unknown/missing-option errors, and the no-write invariant for rejected restart requests. No live probe, OAuth flow, restart trigger, connector refresh, or runtime mutation is part of this sweep.

## Validation

- targeted report, matrix, waiter, workflow, directory, and syntax guards: GREEN
- first full-suite job `eabe0420-332d-44e3-b553-c19cd5778f73`: correctly failed because the live-truth update expanded `_workflow/state.json` beyond its `16000`-byte contract
- correction: removed the redundant loaded-commit field from the compact orientation map while retaining the commit in human-readable live evidence; final size `15988` bytes
- second full-suite job `d7edc202-fe7b-482b-b721-e743092e92ea`: functionally GREEN, but the post-run clean-tree check exposed that `smoke_directory_docs_generator.js` left a generated tracked backup map describing fixtures it had already deleted
- hermetic correction: the generator smoke snapshots every tracked `DIRECTORY.md`, restores exact bytes on normal or error exit, and verifies restoration before success
- final full-suite job `e6ffe9e4-1afb-4809-81d0-9695199006ae`: `ok=true`, `public=7`, `tests_authenticated=305`, stderr empty, no output truncation, and no generated backup-map drift
- follow-up CLI-integrity full-suite job `353b4f15-e86a-4ac2-bd57-ffe40ccff010`: `ok=true`, `public=7`, `tests_authenticated=305`, exit `0`, stderr empty, and no output truncation
- `project_truth_audit`: `0` findings
- deploy decision: `repo_or_internal_source`, no runtime restart, no connector refresh, no operator approval

## Deployment decision

- runtime server change: no
- connector-visible change: no
- schema change: no
- runtime restart required: no
- connector refresh required: no
- OAuth reauthorization required: no
- rollback: revert the repository commit; live runtime is unaffected
