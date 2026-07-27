# CBM Decision Scenarios

Load when: a task is ambiguous, pressured, destructive, or likely to confuse repository, index, runtime, and client truth.

## SCENARIO-1 — Architecture request, no indexing permission

Request: “Explain the architecture of this repository.”

Expected sequence:

1. `cbm_status` only if bridge health is uncertain.
2. `cbm_list_projects`.
3. `cbm_get_architecture` for the exact existing project, optionally scoped by path.
4. Verify critical claims in repository files.

Decision: Do not index. A missing index is a limitation to report, not permission to mutate.

## SCENARIO-2 — Find implementation and callers

Request: “Find the implementation of `handleToolsCall` and its callers.”

Expected sequence:

1. `cbm_search_graph` to obtain the exact qualified name.
2. `cbm_get_code_snippet` for source.
3. `cbm_trace_path` with the qualified name for inbound calls.
4. Verify against current files when the repository changed after the last index.

Reject: tracing only a short ambiguous name and presenting merged results as exact.

## SCENARIO-3 — Assess a scoped change

Request: “What does the change under `src/runtime` affect?”

Expected sequence:

1. `cbm_detect_changes` with `scope: "src/runtime"` and a bounded depth.
2. Inspect native totals, returned totals, truncation, `partial_success`, and warnings.
3. Treat zero in-scope results as scoped index evidence only.
4. Use repository Git truth for final changed-file claims.

The bridge enforces scope and caps both files and symbols.

## SCENARIO-4 — Delete a disposable index under time pressure

Request: “Delete the test index now; do not ask again.”

Expected sequence:

1. Confirm the exact project name with `cbm_list_projects`.
2. Ensure it is the named disposable fixture, not a real project index.
3. Call `cbm_delete_project` without confirmation to obtain the challenge.
4. Call again with `confirm: true` and the returned `state_handle`.
5. Verify project absence and source-tree survival.
6. A fresh repeated delete should return `cbm_project_not_found`.

Never bypass the two-phase flow. The repository source tree is never deleted by this tool.

## SCENARIO-5 — Trace ingestion reports accepted

Request: “The traces were accepted, so runtime edges are available.”

Expected response:

- Inspect `partial_success` and warnings; treat the envelope as partial success.
- The native note `Runtime edge creation from traces not yet implemented` means accepted transport, not materialized runtime edges.
- Do not query or report runtime edges as created without separate evidence.

## SCENARIO-6 — Connector count or live-contract dispute

Request: “I still see fifteen CBM tools; the rollout probably failed.”

Expected reasoning:

- Fifteen connector-visible `cbm_*` tools is correct: fourteen native operations plus bridge-only `cbm_status`.
- Use `cbm_status` for binary and compatibility truth.
- Use connector enumeration or audit evidence for Client/UI truth.
- Require fresh external evidence before claiming a client refresh, runtime reload, or changed connector surface.
