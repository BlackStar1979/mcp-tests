# Capability-Adaptive Operator Authorization Design

Date: 2026-08-20
Status: APPROVED FOR IMPLEMENTATION

## Problem

TESTS_MCP currently duplicates host-side approval and converts coarse descriptor/tool-policy metadata into server-side blanket denials. The ChatGPT host permission setting that allows all app actions is not transmitted to the MCP server as a standard permission field. The server therefore cannot read that UI preference directly. At the same time, the current runtime treats all process tools as per-call high-risk MRTR consent targets and treats most `destructive=true` tools as deny-by-default, making normal authorized development operations unusable.

Observed failures include:
- `run_process`/`process_start`/`process_cancel` -> MRTR form capability required; ChatGPT does not advertise `elicitation.form`, so normal calls fail closed.
- `write_file` -> `destructive_tool_denied`, even when creating a new bounded workspace document.
- The connector often renders these server JSON-RPC denials as opaque `UNKNOWN / ExceptionGroup`.

## Design principles

1. Host approval UX and server authorization are separate responsibilities.
2. `destructiveHint` is descriptive host metadata, not an authorization authority.
3. OAuth `mcp:tools` on the internal profile is the standing server authorization for the bounded `authorized_mcp_tools` surface.
4. Normal bounded development actions must remain usable after OAuth authorization.
5. Fresh human consent is reserved for operations explicitly classified by the central policy authority as requiring it; it is not inferred merely from `destructive=true`.
6. MRTR remains the preferred per-call human-input mechanism for tools explicitly classified as `mrtr_human_approval`, but absence of `elicitation.form` must not block tools whose central policy does not require fresh human consent.
7. Existing semantic safety controls remain authoritative: workspace containment, command allowlists, environment sanitization, protected-path guards, no-overwrite semantics, backup/soft-delete behavior, origin/network policy, scope checks and audit.
8. Tool-specific irreversible confirmation flows may remain when explicitly owned by that tool's policy (currently `cbm_delete_project`).
9. Policy semantics must be expressed in the owning registry/policy module and consumed through existing composition seams; no per-handler exception lists.

## Target architecture

### Central authorization metadata

Extend the central tool policy with an explicit `authorization_class` (default `bounded_authorized`) and `consent_mode` (default `none`). Supported consent modes for this change:
- `none`: OAuth/profile/policy controls are sufficient.
- `tool_confirmation`: tool-owned state-handle confirmation flow (for existing CBM deletion compatibility).
- `mrtr_human_approval`: fresh MRTR human approval is required.

`destructive` remains a semantic/annotation property but no longer independently causes a deny decision.

### Process tools

`run_process`, `process_start`, and `process_cancel` become normal bounded authorized operations (`consent_mode=none`) because their execution authority already constrains commands/workspace/environment and the caller is authenticated with `mcp:tools` on the internal profile. They no longer require MRTR for every call.

MRTR support remains available for future tools/classes whose policy explicitly selects `mrtr_human_approval`.

### Workspace mutation tools

`write_file`, `move_path`, `delete_path`, `restore_path`, and remote-site mutation tools are not blanket-denied merely because their descriptor/policy says destructive. Existing implementation-level safety semantics remain in force. `delete_path` is soft-delete; `write_file` backs up before overwrite; move operations do not silently overwrite; protected paths remain guarded.

### Decision runtime

`decision_runtime_policy` must:
1. authenticate/profile/scope-check as today;
2. resolve the tool's central authorization/consent classification;
3. invoke tool-owned confirmation for `tool_confirmation`;
4. emit an MRTR requirement only for `mrtr_human_approval`;
5. otherwise allow the tool to proceed to existing runtime policy/input validation/execution.

It must not use `toolPolicy.destructive === true` as a blanket deny gate.

### Consent runtime

`consent_runtime_policy` must stop owning a hardcoded `PROCESS_CONSENT_TOOLS` list. It resolves consent from central policy metadata plus `SERVER_TOOLS_SPEC` classification metadata and constructs MRTR requirements only when `consent_mode=mrtr_human_approval`.

### Compatibility and surface

No tool names or schemas need to change. The connector-visible surface remains 98 tools unless validation proves otherwise. This is a policy-semantics correction, not a connector-surface expansion.

## Security invariants

- Public profile behavior remains unchanged.
- OAuth scope checks remain fail-closed.
- Unknown tools remain denied.
- Workspace/process/network implementation guards remain unchanged.
- `cbm_delete_project` keeps its exact one-time confirmation path.
- MRTR binding/replay/privacy guarantees remain unchanged for any tool that actually uses MRTR.
- No host-private UI preference is trusted as server authorization because it is not part of the standard MCP request contract.

## Acceptance criteria

1. A normal authenticated internal `run_process` call no longer requests MRTR and reaches execution.
2. `process_start` and `process_cancel` no longer require MRTR solely because they are process tools.
3. `write_file` is no longer blanket-denied by `decision_runtime_policy`.
4. A truly policy-designated `mrtr_human_approval` fixture still produces the existing MRTR flow and fails closed without required client capability.
5. `cbm_delete_project` confirmation remains intact.
6. Public/auth/scope regressions remain GREEN.
7. Full offline suite is GREEN and tool surface/fingerprint expectations are reconciled.
8. Live OAuth21/internal acceptance proves normal process execution works from the ChatGPT connector without `elicitation.form` and without a connector refresh if the surface is unchanged.
