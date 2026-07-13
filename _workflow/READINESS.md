# Readiness

Status: active maturity map
Updated: 2026-07-12

## Purpose

Track the distance between current state and the NorthStar target without mixing maturity assessment with raw implementation logs.

## Maturity scale

- `4/4` stable and governable for the current target
- `3/4` functionally strong but still carrying bounded compatibility or verification debt
- `2/4` partially aligned; key follow-up still open
- `1/4` scoping/design only

## Component maturity

| Component | Maturity | Current state | Next path |
| --- | --- | --- | --- |
| Single surviving `/mcp` route | 3/4 | Surviving target route is selected and active repo direction is clear. | Keep stable while retiring residual compatibility debt only with evidence. |
| No-SSE target migration | 3/4 | POST JSON-only and GET SSE teardown are already repo-applied and workflow-tracked. | Continue bounded cleanup and compatibility evidence; do not reopen SSE target semantics. |
| OAuth21 authorized runtime | 3/4 | Resource-server metadata, health shape, and bounded OAuth21 behavior are in place. | Preserve auth stability and keep client compatibility evidence current. |
| Server-side request/response observability | 3/4 | Repo and live OAuth21 `3008` truth now include bounded `rpc_received` plus `rpc_response_sent` correlation on active `/mcp` paths, including a confirmed authenticated local `initialize` probe. | Use the live trail for real client compatibility diagnosis before considering any broader logging expansion. |
| Connector-visible surface governance | 3/4 | Repo/runtime truth says `13 + 56 = 69` visible tools, with hidden helpers separated. | Revalidate connector/UI enumeration only when needed from fresh client truth. |
| OAuth21 durable-state hygiene control plane | 3/4 | Explicit preview/receipt/gate/apply/rollback helpers exist, records/backups are bounded under `_workflow/control_plane/`, and workflow docs now describe the operator-controlled path. | Keep apply explicit and control-plane-only; promote only after future runtime need is proven. |
| Legacy `initialize` retirement readiness | 2/4 | Repo evidence already shows useful no-handshake operation on `/mcp`. | Gather/maintain explicit client compatibility evidence before any retirement decision. |
| Session-bound outbound/sampling helper debt | 2/4 | Scope is now explicitly recorded as bounded helper debt. | Choose explicit retention, redesign, or retirement package when justified. |
| Operator-facing documentation contract | 3/4 | Core operator docs exist, bounded `_workflow` directory maps were expanded, and the OAuth21 prune control-plane now has an explicit operator decision record. | Continue conservative `DIRECTORY` rollout only where churn or handoff risk justifies it. |
| Workspace retrieval ergonomics | 1/4 | Local connector/workspace index availability is inconsistent across environments. | Add bounded operational support only if it materially improves work quality. |

## Current readiness blockers

1. Fresh connector/UI truth can still drift from repo/runtime truth.
2. Legacy `initialize` removal is still blocked by client compatibility evidence, not by repo request-flow capability.
3. Fresh real Codex client evidence now confirms the live `initialize -> notifications/initialized -> tools/list -> tools/call` path, but the same current client family still does not provide matching fresh `server/discover` entry evidence in that window.
4. Operator-facing `DIRECTORY` coverage is still partial outside the currently normalized operational directories.

## Current readiness rule

Do not treat a maturity score as permission to remove compatibility paths without:

- repo evidence
- live runtime evidence
- client/connector evidence
- smoke coverage
