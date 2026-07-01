# Post-Stage 12 Server Environment Analysis

Status: review recorded
Date: 2026-06-24

## Scope

This review was performed after Stage 12 closeout.

Actions explicitly not performed:

- no deploy;
- no runtime restart;
- no connector refresh;
- no public connector reconnect;
- no runtime policy enforcement enablement;
- no allow/deny behavior change;
- no hotplug/list_changed emission;
- no Sessionless MCP migration.

## Repo truth

Current repository state after Stage 12 closeout:

- Stage 12 status: GREEN / CLOSED;
- package version: 0.40.0;
- current workflow package: `stage12_closeout`;
- run_all public section: 6 scripts;
- run_all tests_authenticated section: 152 scripts;
- public expected tool count in profile spec: 13;
- tests_authenticated expected tool count in profile spec: 43.

Runtime policy status in `SERVER_POLICY_RUNTIME_SPEC.json` remains:

- `runtime_enforcement_implemented_now: false`;
- runtime enforcement requires separate operator approval;
- restart plan is required before runtime enforcement;
- connector refresh plan is required before connector-visible changes.

Stage 12 added only read-only/no-apply artifacts:

- `src/enforcement_apply_readiness_report.js`;
- `src/enforcement_wiring_plan.js`;
- `src/enforcement_operator_approval_guard.js`.

`src/runtime/tools_call_handler.js` remains unwired to policy preflight/enforcement.

## Local runtime probes

Port probe on localhost:

| Port | Status | Meaning |
|---:|---|---|
| 3005 | NO_LISTENER / ECONNREFUSED | retired legacy access runtime not listening |
| 3006 | NO_LISTENER / ECONNREFUSED | retired legacy bearer runtime not listening |
| 3008 | LISTENING | OAuth/internal runtime listener present |
| 3009 | LISTENING | public runtime listener present |

Public local tools/list on `127.0.0.1:3009/mcp` returned HTTP 200 with 13 tools:

- `search`
- `fetch`
- `net_http_get_allowlisted`
- `net_fetch_text_allowlisted`
- `net_check_url_head`
- `net_fetch_github_raw`
- `net_check_npm_package`
- `net_check_pypi_package`
- `fs_list_public`
- `fs_get_public_info`
- `fs_read_public_text`
- `fs_read_public_lines`
- `fs_read_public_chunk`

Observed public local tool-name hash from probe: `f2830cb7817520ac`.

Unauthenticated POST probe to OAuth/internal port `127.0.0.1:3008/mcp` with an empty JSON body returned HTTP 401 and `missing_bearer_token`, confirming the listener did not expose unauthenticated access in that probe.

## Truth boundary

This analysis does not prove that deployed/live connector state includes repo-only Stage 12 code. No restart, deploy, or connector refresh was performed.

Current truth separation:

- repo truth: Stage 12 is closed and readiness/no-apply gates exist in code;
- local runtime truth: ports 3008/3009 are listening; public local surface is 13 tools; OAuth port rejects unauthenticated request;
- connector/UI truth: not refreshed and not reconnected during this review.

## Debt register

### D1 - Live/repo drift ledger

Repo has advanced through Stage 12, but no runtime restart/deploy was performed in this review. Maintain an explicit drift ledger before any claim that Stage 12 code is active in a running process.

Recommended remediation:

- add a read-only drift ledger artifact comparing repo HEAD, runtime identity, connector map, and local port status;
- keep it no-deploy/no-restart unless separately approved.

### D2 - Runtime status stage label remains compatibility-oriented

Runtime status may still expose older compatibility labels such as `stage8_20-runtime-status-compact-mode`. This should not be interpreted as repo stage progress.

Recommended remediation:

- keep runtime identity labels separate from workflow stage labels;
- add a documentation guard clarifying this distinction.

### D3 - CRLF warnings in workflow files

`git diff --check` remains OK, but recurring CRLF-to-LF warnings appear for:

- `_tests/smoke_streamable_http_workflow_plan.js`;
- `_workflow/WORKFLOW_CANON.md`.

Recommended remediation:

- do a narrow formatting hygiene stage if desired;
- avoid mixing line-ending normalization with functional code changes.

### D4 - Process-runner ergonomics for long generated text

Long `node -e` arguments and some trace/argument combinations can be blocked by the process runner guard.

Recommended remediation:

- prefer `write_file` for generated artifacts;
- split long generation steps;
- document this in operator workflow notes.

### D5 - Enforcement apply remains intentionally blocked

System is ready for operator review, but not ready for runtime enforcement apply by policy.

Recommended remediation:

- do not wire policy preflight into `tools/call` until a separate approval package exists;
- maintain the Stage 12.3 approval boundary guard.

## Recommended development path

### Stage 13 - Server Environment Debt Remediation and Drift Ledger

Recommended first stage after this review:

1. create a live/repo drift ledger;
2. add a no-deploy runtime identity comparison report;
3. add a narrow CRLF/hygiene plan if accepted;
4. preserve enforcement no-apply boundary.

### Future Stage 14 - Runtime Enforcement Apply Package, No Apply

Only after Stage 13 is clean, prepare an implementation package for runtime policy enforcement. This should still be an apply package only, not automatic runtime modification.

### Future Stage 15 - Runtime Enforcement Apply

This requires separate explicit operator approval, restart/deploy plan, rollback plan, connector-visible impact review, and full run_all/live checks.
