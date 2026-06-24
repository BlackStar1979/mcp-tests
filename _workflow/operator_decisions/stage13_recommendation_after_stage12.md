# Stage 13 Recommendation After Stage 12

Status: recommendation
Date: 2026-06-24

## Recommended title

Stage 13 - Server Environment Debt Remediation and Drift Ledger

## Rationale

Stage 12 completed the enforcement apply-readiness gate as no-apply work. The repo is ready for operator review but runtime enforcement remains disabled. Before any apply package or runtime change is prepared, the project should reduce operational debt around repo/live drift, runtime identity, connector state, line endings, and process-runner ergonomics.

## Recommended scope

### 13.1 Live/repo drift ledger

Create a deterministic read-only ledger that records:

- repo HEAD and workflow stage;
- package version;
- runtime local port status;
- public local tool surface count/hash;
- OAuth/internal unauthenticated rejection check;
- last known live TESTS_MCP connector/runtime status if available;
- explicit note whether deploy/restart/connector refresh was performed.

### 13.2 Runtime identity versus workflow stage distinction

Document and guard the distinction between runtime compatibility labels and workflow progress labels.

### 13.3 CRLF hygiene plan

Prepare a narrow line-ending normalization plan for recurring warning files, without mixing with functional changes.

### 13.4 Process-runner ergonomics note

Document that long `node -e` arguments can be blocked and generated artifacts should use `write_file` or split writes.

## Explicit non-goals

Stage 13 must not:

- deploy;
- restart runtime;
- refresh connector maps;
- reconnect the public connector;
- enable runtime policy enforcement;
- change allow/deny behavior;
- wire policy preflight into `tools/call`;
- emit hotplug/list_changed;
- migrate to Sessionless MCP.

## Recommended first step

Start with **13.1 Live/repo drift ledger**.

## Future path after Stage 13

- Stage 14: Runtime Enforcement Apply Package, No Apply.
- Stage 15: Runtime Enforcement Apply, only after separate explicit operator approval and rollback/deploy/restart/connector-impact plan.
