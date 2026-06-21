# P4 Runtime Policy Expansion Scope Plan

Date: 2026-06-21
Status: plan only; no runtime implementation in this checkpoint.

## Operator decision implemented by this plan

D7: expand the runtime decision shim toward full Resource/Scope Matrix Enforcement, but only in a separately approved security-boundary stage. This document scopes that stage without modifying runtime behavior.

## Current source-derived state

Reviewed source/spec paths:

- `SERVER_POLICY_RUNTIME_SPEC.json`
- `SERVER_RESOURCE_POLICY_SPEC.json`
- `SERVER_TOOLS_SPEC.json`
- `SERVER_AUTHZ_DECISION_SPEC.json`
- `SERVER_PROFILES_SPEC.json`
- `src/runtime/decision_runtime_context_builder.js`
- `src/runtime/decision_runtime_policy.js`
- `src/runtime/tools_call_handler.js`
- `src/tool_policy.js`
- `src/profile_schema_validator.js`

Observed state:

1. `SERVER_POLICY_RUNTIME_SPEC.json` defines a full composition model but explicitly marks `runtime_enforced: false` and `integration_policy.runtime_enforcement_implemented_now: false`.
2. `tools_call_handler.js` already builds a decision context and evaluates `decision_runtime_policy` before tool execution.
3. `decision_runtime_context_builder.js` currently captures only tool name, auth mode, profile, request id, and sanitized argument shape/hash metadata. It does not resolve resource URIs, policy refs, or concrete resource/scope claims.
4. `decision_runtime_policy.js` currently enforces basic runtime controls:
   - known tool;
   - tool policy exists;
   - profile allowed;
   - auth required vs `auth:none`;
   - public tool/public-safe/public filesystem scope;
   - destructive tools denied.
5. `decision_runtime_policy.js` does not currently enforce full resource-class / operation-class / resource-policy-ref matrix from root specs.
6. `SERVER_TOOLS_SPEC.json` already contains resource class, operation class, and specific policy refs per tool. This is suitable as the declarative catalog source for a fuller policy engine.
7. Category-specific policies already exist in root specs: memory, network, database, plugin visibility. Some runtime utility enforcement exists independently, e.g. network allowlist and filesystem path policy.

## Enforcement gap summary

The current shim is a minimal safety gate. It does not yet:

- resolve a tool call to a `SERVER_TOOLS_SPEC.tool_catalog` entry at runtime;
- verify that a resource class exists in `SERVER_RESOURCE_POLICY_SPEC.resource_classes`;
- verify operation class consistency;
- evaluate profile `allowed_resource_policy_refs` / `denied_resource_policy_refs`;
- evaluate category-specific scope lists such as memory/network/database/plugin scopes from profile surface config;
- extract and classify resource identifiers from tool arguments;
- emit a full resource/scope decision receipt matching the complete spec model;
- distinguish allow/deny outcomes by resource URI or explicit state handle.

## Target direction

The policy runtime should become a declarative policy gateway:

1. The tool catalog is the first-class source of tool resource semantics.
2. Profile surface config defines what resource/scope classes are allowed per profile.
3. Tool arguments are normalized into a bounded `resource_claims` list where possible.
4. The runtime evaluates policy before tool execution and fails closed on ambiguity.
5. Every allow/deny produces a redacted audit receipt.
6. Policy denial should be observable by agents through stable JSON-RPC error reason codes.

## Proposed staged implementation

### R1 - Source-of-truth loader for policy specs

Create a small internal loader for canonical policy specs:

- `SERVER_TOOLS_SPEC.json`
- `SERVER_RESOURCE_POLICY_SPEC.json`
- `SERVER_PROFILES_SPEC.json`
- specific category policies.

Non-goal: no CLI flag and no connector-visible tool.

Guard:

- `_tests/smoke_stage12_runtime_policy_spec_loader.js`

### R2 - Tool catalog runtime resolution

Extend decision context to include:

- `tool_catalog_entry` summary;
- `surface_class`;
- `tool_category`;
- `resource_class`;
- `operation_class`;
- `resource_policy_refs`;
- specific policy refs.

Guard:

- `_tests/smoke_stage12_runtime_policy_tool_catalog_resolution.js`

### R3 - Resource/operation class fail-closed checks

Evaluate existence and consistency of:

- resource class;
- operation class;
- declared policy refs;
- specific category policy refs.

Guard:

- `_tests/smoke_stage12_runtime_policy_resource_class_negative_controls.js`

### R4 - Profile resource/scope matrix enforcement

Enforce profile surface fields already validated by `profile_schema_validator.js`:

- allowed/denied resource policy refs;
- allowed/denied memory scopes;
- allowed/denied network scopes;
- allowed/denied database scopes;
- allowed/denied plugin scopes.

Guard:

- `_tests/smoke_stage12_runtime_policy_profile_scope_matrix.js`

### R5 - Argument resource-claim extraction

Add bounded extraction for common argument shapes:

- file/path-like fields;
- URL/domain fields;
- package/repo identifiers;
- memory agent/task identifiers;
- plugin identifiers.

The extractor must be redaction-safe and must not dump raw secrets or large values.

Guard:

- `_tests/smoke_stage12_runtime_policy_resource_claim_extractor.js`

### R6 - Audit receipt v2

Extend decision receipts with resource/scope fields while preserving redaction:

- policy refs;
- resource class;
- operation class;
- resource claim hashes/counts;
- deny code;
- enforcement version.

Guard:

- `_tests/smoke_stage12_runtime_policy_receipt_v2.js`

### R7 - Controlled enablement

Only after R1-R6 are green, flip the relevant spec/runtime fields from plan to implementation. This needs separate operator approval because it changes the runtime security boundary.

Guard:

- full `run_all --skip-network`;
- focused negative controls for each category;
- live OAuth connector status check after restart if runtime behavior changes.

## Non-goals for the first implementation stage

- No connector refresh in the policy expansion implementation stage unless tool surface changes.
- No public connector reconnection.
- No database or process execution expansion.
- No Sessionless MCP protocol migration in this stage.
- No hotplug implementation in this stage.

## Acceptance criteria

- Runtime policy decisions are derived from canonical specs rather than hard-coded local-only checks.
- Unknown or missing resource policy data fails closed.
- Profile/resource/scope denial uses stable reason codes.
- Receipts are redaction-safe and include enough policy context for audit.
- Existing public `auth:none` and authorized `oauth21` surfaces remain unchanged unless explicitly approved.
- Full `run_all --skip-network` remains green.

## Risk notes

- This is a security-boundary change; it can deny formerly allowed tool calls.
- Resource-claim extraction must be conservative to avoid both leakage and false trust.
- Category policies must remain declarative and auditable; do not bury policy in individual tool handlers.
