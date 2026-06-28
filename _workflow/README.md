# Workflow

Start every repo/workflow session with this sequence:

1. `_workflow/README.md`
2. `_workflow/ACTIVE_WORKFLOW_INDEX.md`
3. `_workflow/state.json`
4. `_workflow/WORKFLOW_CANON.md`
5. Any referenced operator decision or machine-readable inventory file.

## Next-step recommendation duty

Every recommendation for the next step must explicitly assess blocker validity, connector refresh need, OAuth21 workbench server `3008` restart need, and whether `3008` can be restarted by the assistant without asking the operator.

Current rule: the assistant can restart TESTS_MCP/OAuth21 workbench server on port `3008` when the active workflow step and operator intent authorize it. Do not ask the operator to restart `3008`. Connector refresh is separate and must be requested only when materially required by connector/UI truth, surface change, or diagnostic need.

## `_workflow/state.json`

`state.json` is the compact machine-readable orientation map for the TEST MCP server. It is not a progress log, transcript, diary, scratchpad, or stage-history dump.

Its job is to tell the agent, at startup:

- what server this is;
- which root `SERVER_*_SPEC.json` files define the server;
- which runtime instances exist;
- which tool surfaces exist;
- which policy layers are runtime-enforced or only specified;
- how repo work must be performed safely;
- which authority files must be opened before acting.

Do not append step-by-step work logs to `state.json`. Historical records belong in `_workflow/operator_decisions/`, `_workflow/control_plane/snapshots/`, stage-specific records, or Git history.

If `state.json` grows into a chronological log, it is corrupt and must be repaired back into a compact spec map.

## `_workflow/sessionless_inventory.json`

`sessionless_inventory.json` is a SEP-driven, operator-bound, machine-readable checklist for MCP stateless/sessionless migration.

It is not a temporary note and not a generic progress log. It must track:

- the official MCP SEP source index used for direction;
- all Final SEPs from the official index in `all_seps_index`;
- the core sessionless/stateless/deprecation SEPs in the deep `deprecation_ledger`;
- feature lifecycle state such as `active`, `deprecated`, `removed`, `legacy_compat`, or `operator_non_target`;
- repository implementation status such as `done`, `partial`, `pending`, `blocked_stable_compat`, or `blocked_pending_target_selection`;
- migration path and checklist evidence per protocol feature.

Current rule: all Final SEPs from `https://modelcontextprotocol.io/seps#all-seps` must be represented before declaring the inventory complete. Core sessionless/stateless SEPs require deep ledger entries.

The file may contain operational implications, such as restart resilience, only when those implications are derived from the protocol direction. The actual process-control procedure belongs in a dedicated runtime topology/restart authority record, not as a log inside this inventory.


## `SERVER_RUNTIME_TOPOLOGY_SPEC.json`

This file is the active machine-readable authority for runtime topology. It separates public `3009` from OAuth21 `3008`, defines validation surfaces, and records the restart-authority state. If restart authority is marked missing, OAuth21 live-load work is blocked until that authority is restored.


## `SERVER_RUNTIME_CONFIG_SPEC.json`

`SERVER_RUNTIME_CONFIG_SPEC.json` is the active machine-readable authority for runtime CLI flags, `MCP_TEST_*` environment variables, external HTTP routes, protocol versions, and code-derived behavior toggles. It exists to catch code capabilities that are not otherwise visible in policy/tool specs.

## Root specs

Root `SERVER_*_SPEC.json` files are canonical structured server specifications. They are not progress logs. Workflow files may summarize or map them, but must not replace them as source of truth.

## Logs and history

Progress/history belongs in:

- `_workflow/operator_decisions/*.md`
- `_workflow/control_plane/snapshots/**`
- `_workflow/WORKFLOW_CANON.md` only as concise canonical closeout notes
- Git commits

Progress/history does not belong in:

- `_workflow/state.json`
- root `SERVER_*_SPEC.json`
- `_workflow/sessionless_inventory.json`, except for checklist status fields tied to spec items.
