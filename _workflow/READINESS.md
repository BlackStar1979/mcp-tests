# Readiness

Status: active technical component readiness report
Updated: 2026-07-15

## Purpose

Track the distance between current state and the NorthStar target without mixing maturity assessment with raw implementation logs.

This file is also the agent-planning bridge between:

- `NORTHSTAR.md` as the target contract
- `STATE.md` as the validated as-is picture
- `ROADMAP.md` as the executable queue

If autonomous planning becomes ambiguous, this file is the tie-breaker for what is mature, what is blocked, and what should move next.

## Maturity scale

- `4/4` stable and governable for the current target
- `3/4` functionally strong but still carrying bounded compatibility or verification debt
- `2/4` partially aligned; key follow-up still open
- `1/4` scoping/design only

## Planning rule

When choosing work autonomously, prefer the highest-leverage item that satisfies all of the following:

1. reduces uncertainty or operator re-orientation cost
2. removes a blocker for a higher-target component
3. preserves repo/runtime/client truth separation
4. is bounded enough to guard with smoke or live evidence

Do not pick work only because it is available. Pick the next package that improves target convergence for more than one downstream path.

## Component maturity

| Component | Maturity | Target role | Current state | Primary blocker | Next executable path | Queue weight |
| --- | --- | --- | --- | --- | --- | --- |
| Single surviving `/mcp` route | 3/4 | Final route contract | Surviving target route is selected and active repo direction is clear. | Residual compatibility debt must stay bounded until evidence closes it. | Keep stable while retiring residual compatibility debt only with evidence. | High |
| No-SSE target migration | 3/4 | Destination transport behavior | POST JSON-only and GET SSE teardown are already repo-applied and workflow-tracked. | Remaining compatibility debt still depends on bounded evidence and replacement closeout. | Continue bounded cleanup and compatibility evidence; do not reopen SSE target semantics. | High |
| OAuth21 authorized runtime | 3/4 | Production-grade authenticated surface | Resource-server metadata, health shape, and bounded OAuth21 behavior are in place. | Client/runtime stability must stay stronger than change pressure. | Preserve auth stability and keep client compatibility evidence current. | High |
| Server-side request/response observability | 3/4 | Runtime truth and diagnosis layer | Repo and live OAuth21 `3008` truth now include bounded `rpc_received` plus `rpc_response_sent` correlation on active `/mcp` paths, including a confirmed authenticated local `initialize` probe. | Fresh client-entry evidence is still narrower than full retirement confidence. | Use the live trail for real client compatibility diagnosis before considering any broader logging expansion. | High |
| Connector-visible surface governance | 3/4 | MCP-visible contract control | Repo/runtime truth says `13 + 56 = 69` visible tools, with hidden helpers separated, and fresh 2026-07-15 evidence confirms that `mcp__workbench` is callable again from the Codex model runtime layer. | UI-visible enumeration can still drift from callable runtime truth. | Revalidate full connector/UI enumeration only when needed from fresh client truth; do not collapse callability and UI visibility into one claim. | Medium |
| OAuth21 durable-state hygiene control plane | 3/4 | Safe state maintenance path | Explicit preview/receipt/gate/apply/rollback helpers exist, records/backups are bounded under `_workflow/control_plane/`, and workflow docs now describe the operator-controlled path. | Remaining value is operational discipline, not more runtime coupling. | Keep apply explicit and control-plane-only; promote only after future runtime need is proven. | Medium |
| Legacy `initialize` retirement readiness | 2/4 | Main protocol-debt exit gate | Repo evidence already shows useful no-handshake operation on `/mcp`. | Real client-family entry behavior still blocks retirement. | Gather and maintain explicit client compatibility evidence before any retirement decision. | Highest |
| Session-bound outbound/sampling helper debt | 2/4 | Residual helper cleanup boundary | Scope is now explicitly recorded as bounded helper debt. | No current evidence that removal beats verification work elsewhere. | Choose explicit retention, redesign, or retirement package only when it becomes the highest-leverage bounded cleanup. | Low |
| Operator-facing documentation contract | 3/4 | Continuity and handoff layer | Core operator docs exist, bounded `_workflow` directory maps were expanded, and the OAuth21 prune control-plane now has an explicit operator decision record. | Planning still depends too much on cross-reading several files. | Keep `READINESS` and `ROADMAP` synchronized so the next package is inferable without operator intervention. | High |
| Workspace retrieval ergonomics | 2/4 | Agent execution efficiency | Live `workbench` callability and workspace index usefulness improved materially, but retrieval quality still depends on environment freshness and ranking heuristics. | Retrieval remains operational support, not target-defining product work. | Improve only when it materially reduces execution friction on current target work. | Medium |

## Dependency spine

Use this dependency spine when deciding what to do next:

1. Operator-facing documentation contract
   - reduces context-loss cost
   - makes the queue legible
   - supports every other track
2. Server-side request/response observability
   - supplies trustworthy evidence
   - unblocks compatibility diagnosis
3. Legacy `initialize` retirement readiness
   - remains the main protocol debt gate
   - depends on observability and stable OAuth21 runtime
4. Connector-visible surface governance
   - matters only when client truth or runtime evidence requires it
5. Session-bound outbound/sampling helper debt
   - defer until it clearly outranks the above

## Current readiness blockers

1. Fresh connector/UI truth can still drift from repo/runtime truth, even when the model runtime can already call the connector again.
2. Legacy `initialize` removal is still blocked by client compatibility evidence, not by repo request-flow capability.
3. Fresh real Codex client evidence now confirms the live `initialize -> notifications/initialized -> tools/list -> tools/call` path, but the same current client family still does not provide matching fresh `server/discover` entry evidence in that window.
   - New client-entry observability also distinguishes stale-entry windows from fresh reconnect evidence, so a current window containing only follow-up `tools/list` / `tools/call` traffic is no longer ambiguous and does not count as migration proof.
4. Operator-facing `DIRECTORY` coverage is still partial outside the currently normalized operational directories.

## What should move next by default

Unless fresh live evidence changes priority, autonomous work should default to one of these:

1. tighten the operator-facing documentation contract so the next bounded package is obvious
2. strengthen client-entry evidence quality for the `initialize` retirement track
3. perform bounded connector/runtime verification only when it changes an active decision

## Current readiness rule

Do not treat a maturity score as permission to remove compatibility paths without:

- repo evidence
- live runtime evidence
- client/connector evidence
- smoke coverage
