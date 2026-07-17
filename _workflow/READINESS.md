# Readiness

Status: active technical component readiness report
Updated: 2026-07-17

## Purpose

Track the distance between the validated current state and the accepted NorthStar target in a form that is directly usable for autonomous planning.

This file is the execution bridge between:

- `NORTHSTAR.md` as the target contract
- `STATE.md` as the validated as-is picture
- `ROADMAP.md` as the ordered queue derived from readiness

If autonomous planning becomes ambiguous, this file decides:

- which component is actually closest to the target
- which blocker has the highest downstream leverage
- which bounded package should move next by default

## Maturity scale

- `4/4` stable for the current target and governed by specs/tests/evidence
- `3/4` strong and usable, but still carrying bounded debt or missing one important proof
- `2/4` partially aligned; meaningful blocker still controls the next step
- `1/4` scoped but not execution-ready

## Autonomous planning rule

Choose the next package by walking this order:

1. pick the highest-priority component whose blocker is still real in current evidence
2. prefer the blocker that unlocks more than one downstream component
3. prefer a package that can be bounded by smoke coverage, runtime evidence, or both
4. do not jump to a lower component only because it is easier or more available

## Component maturity

| ID | Component | Maturity | NorthStar role | Depends on | Current evidence | Main blocker | Default next bounded package | Done signal |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DOC-1 | Operator-facing documentation contract | 3/4 | Keep the project operator-legible and handoff-safe | none | `NorthStar/State/Readiness/Roadmap` exist, core `DIRECTORY.md` coverage exists, and workflow docs are already smoke-guarded. | Planning still depends too much on reading several files together unless `READINESS` stays execution-grade. | Keep `READINESS`, `ROADMAP`, and the active index synchronized so the next package is inferable without operator intervention. | Next bounded package is obvious from docs alone, with no cross-reading required. |
| OBS-1 | Server-side request/response observability | 3/4 | Preserve structured, auditable runtime truth | DOC-1 | Bounded `rpc_received` and `rpc_response_sent` audit coverage exists on active `/mcp` paths, including authenticated local validation. | Observability is good enough for diagnosis, but still needs disciplined use as the source for client-entry decisions. | Use live trail evidence before adding any broader logging or diagnostics churn. | Active client-entry questions can be answered from existing bounded observability without new logging work. |
| AUTH-1 | OAuth21 authorized runtime | 3/4 | Keep the internal authorized surface production-grade and stable | DOC-1 | Resource-server identity, throttling, oversized-body aborts, bounded DCR growth, SQLite durability, and explicit prune control-plane all exist. | Stability must remain ahead of change pressure; new auth churn now has to be problem-driven. | Hold runtime auth steady and only touch auth when fresh evidence shows a real failure or gap. | Runtime auth work is driven only by a current defect or an approved target change. |
| SURF-1 | Connector-visible surface governance | 3/4 | Keep MCP-visible tools intentionally governed | DOC-1, AUTH-1 | Repo/runtime truth says `13 + 56 = 69` visible tools, and fresh evidence shows `mcp__workbench` is callable again from the Codex model runtime layer. | UI-visible enumeration can still drift from callable/runtime truth. | Revalidate UI-visible enumeration only when it changes an active decision; do not conflate it with runtime callability. | Repo truth, runtime truth, and client-facing enumeration are explicitly separated in current evidence. |
| COMP-1 | Legacy `initialize` retirement readiness | 2/4 | Retire the main remaining protocol-debt path safely | OBS-1, AUTH-1, SURF-1 | Repo-native no-handshake support is real, and the current `2026-07-17` client-entry report still shows an `initialize_only` window for `codex-mcp-client 0.145.0-alpha.18` with `2` successful legacy `initialize` responses and no fresh same-window `server/discover`. The blocker matrix now confirms persistence across retained-evidence windows: `1d` still blocks on `codex-mcp-client 0.145.0-alpha.18`, `2d` still blocks on `0.145.0-alpha.18` plus `0.144.2`, and only wider `7d+` windows add the older operational tail. | Real client-family entry behavior still blocks retirement. | Gather or refresh real client compatibility evidence before any retirement decision package, using freshness-filtered retained evidence and blocker-matrix windows when the question is about current operational blocker lines versus broader historical risk. | A fresh operational client family proves `server/discover` entry behavior or the remaining `initialize` dependence is explicitly accepted. |
| CTRL-1 | OAuth21 durable-state hygiene control plane | 3/4 | Keep state maintenance explicit and auditable | AUTH-1, DOC-1 | Preview/receipt/gate/apply/rollback helpers and bounded records/backups exist under `_workflow/control_plane/`. | Remaining value is operational discipline, not more automation. | Keep apply explicit and operator-visible; do not auto-wire maintenance into runtime. | Maintenance remains control-plane-only and does not leak into runtime behavior. |
| DEBT-1 | Session-bound outbound/sampling helper debt | 2/4 | Close residual local-helper debt without reopening target architecture | OBS-1 | Scope is explicitly recorded as bounded helper debt, not active route architecture. | No evidence yet that removing it outranks client-entry compatibility work. | Leave deferred until it blocks a higher-priority component or creates measurable execution drag. | Future work is either an intentional cleanup package or an explicit retention decision. |
| DOC-2 | Directory-level functional orientation | 2/4 | Make every high-value area self-describing for handoff/restart continuity | DOC-1 | Core operational directories already have `DIRECTORY.md`, but coverage is still partial outside normalized areas. | Repo-wide expansion would create churn unless it targets high-change directories. | Extend `DIRECTORY` coverage only where churn or handoff cost is currently real. | Remaining high-churn directories are covered without documentation sprawl. |
| RETR-1 | Workspace retrieval ergonomics | 2/4 | Reduce agent execution friction without changing product truth | DOC-1, SURF-1 | `workbench` callability and repository indexing are materially better than before. | Retrieval quality still depends on environment freshness and ranking heuristics. | Improve only when it materially shortens current target work or reduces evidence-gathering friction. | Retrieval issues stop being a recurring blocker on active packages. |

## Dependency spine

Read the queue through this dependency spine:

1. `DOC-1` documentation contract
   - keeps orientation durable
   - makes autonomous selection trustworthy
2. `OBS-1` observability
   - provides the truth source for runtime/client interpretation
3. `AUTH-1` authorized runtime
   - must stay stable while evidence is gathered
4. `SURF-1` surface governance
   - matters when client truth and runtime truth need reconciliation
5. `COMP-1` initialize retirement readiness
   - remains the main protocol-debt gate
6. `CTRL-1`, `DEBT-1`, `DOC-2`, `RETR-1`
   - operational support tracks; do not let them outrank the protocol gate without evidence

## Current blockers by leverage

1. `COMP-1`
   Real client-family entry behavior still blocks `initialize` retirement, and the blocker remains present even in the freshest retained operational windows.

2. `SURF-1`
   Runtime callability and UI-visible enumeration are still different evidence layers and must not be collapsed into one claim.

3. `DOC-2`
   Directory coverage is still incomplete outside the currently normalized operational areas.

## Autonomous execution packages

Use these package IDs directly when selecting work. Do not invent a parallel queue unless one of these packages is completed, blocked by external timing, or disproved by fresh evidence.

| Package | Targets | Why now | Primary evidence source | Stop condition | If blocked |
| --- | --- | --- | --- | --- | --- |
| `COMP-1A` | `COMP-1`, `OBS-1` | Highest-leverage open gate still controls compatibility retirement. | `_logs/.mcp-tests-audit.jsonl`, `observability_status`, `_workflow/operator_decisions/initialize_client_compatibility_evidence.md` | Current operational client-family evidence is refreshed into a clear `initialize_only` or `server_discover_entry` verdict. | Hold compatibility steady and move to `DOC-2A` only if the blocker is waiting on fresh external client traffic rather than missing repo work. |
| `COMP-1B` | `COMP-1`, `SURF-1` | Only worth doing after `COMP-1A` narrows the blocker or changes the decision boundary. | Fresh `COMP-1A` result plus `_workflow/operator_decisions/initialize_retirement_decision_prep.md` | A bounded retirement-decision delta exists or the blocker is restated with tighter current evidence. | Fall back to `SURF-1A` only if connector/UI truth is the deciding ambiguity. |
| `SURF-1A` | `SURF-1` | Connector/UI verification matters only when it changes the protocol-debt decision. | Codex/OpenAI UI evidence, runtime callability evidence, connector-facing tool inventory evidence | UI-visible enumeration is either confirmed decision-relevant or explicitly ruled irrelevant to the current package. | Return to `COMP-1A`; do not let UI verification become autonomous churn. |
| `DOC-2A` | `DOC-1`, `DOC-2` | Safe fallback package when higher-leverage protocol evidence is externally timing-bound. | `READINESS.md`, `ROADMAP.md`, `ACTIVE_WORKFLOW_INDEX.md`, current directory maps | One real high-churn documentation gap is closed and the next bounded package remains inferable from docs alone. | Stop if the work would become repo-wide documentation sprawl instead of a bounded orientation fix. |

## Default next package

Unless fresh live evidence changes the order, the next package should be:

1. `COMP-1A`: refresh or restate the current operational client-entry blocker from bounded live evidence
2. `COMP-1B`: only if `COMP-1A` changes the decision surface
3. `SURF-1A`: only if UI-visible surface truth is what still prevents the decision
4. `DOC-2A`: only when protocol evidence is timing-bound and a real documentation gap remains

## Latest supporting package

- `2026-07-17`: read-only remote-site flows (`list`, `read`, runtime status, retention preview) no longer create remote ops directories as a side effect. Guarded by `smoke_remote_site_lifecycle` and the full `run_all_smokes --skip-network` suite.

## Current readiness rule

Do not treat a maturity score as permission to remove compatibility paths without:

- repo evidence
- live runtime evidence
- client/connector evidence
- smoke coverage
