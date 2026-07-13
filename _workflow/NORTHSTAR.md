# NorthStar

Status: active operator-facing target definition
Updated: 2026-07-12

## Purpose

Define the intended end-state for `mcp-tests` without turning workflow files into ad hoc memory or implementation logs.

## Accepted product target

`mcp-tests` should converge toward a production-grade TEST MCP server that is:

1. Single-route on `/mcp`
   No parallel target route, no target SSE contract, no target transport-session lifecycle.

2. Streamable HTTP only
   The surviving target contract is request/response oriented and does not depend on request-scoped SSE as a destination behavior.

3. OAuth21-ready for the authorized/internal surface
   The authenticated runtime must remain compatible with bounded OAuth21 clients while preserving explicit resource-server identity and auditable auth behavior.

4. Deliberately surface-governed
   Connector-visible MCP tools must stay intentionally split between:
   - public connector-visible tools
   - authorized connector-visible tools
   - hidden server-internal helpers that are not part of the MCP-visible contract

5. Structured and auditable
   Runtime behavior, policy boundaries, workflow truth, and control-plane actions must remain inspectable through specs, smoke guards, and bounded truth tools.

6. Safe to evolve
   The project must support controlled retirement of compatibility debt only after evidence exists across:
   - repository truth
   - runtime truth
   - client/connector compatibility truth

7. Operator-legible
   The project must maintain auditable operator-facing documentation for:
   - target vision
   - current as-is state
   - readiness/maturity
   - dependency-aware roadmap
   - directory-level functional orientation

## Non-goals

- Reopening `/mcp/sessionless` as the final target route
- Reintroducing SSE as target architecture
- Treating workflow notes as a substitute for specs, tests, or live runtime evidence
- Treating persistent memory as the source of truth for project state

## Governing evidence

- `_workflow/WORKFLOW_CANON.md`
- `_workflow/ACTIVE_WORKFLOW_INDEX.md`
- `_workflow/state.json`
- `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`
- `_workflow/operator_decisions/single_route_selection_keep_mcp.md`
- `SERVER_SPEC.json`
- `SERVER_TOOLS_SPEC.json`
