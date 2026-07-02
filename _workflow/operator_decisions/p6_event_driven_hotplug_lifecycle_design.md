# P6 Event-Driven Hotplug Lifecycle Design

Date: 2026-06-21
Status: design only; no runtime hotplug or list-changed emission enabled in this checkpoint.

## Operator decision implemented by this design

D9: stop treating connector/tool freshness as a static refresh/check problem. Target architecture should be event-driven Hotplug lifecycle: tools are dynamically registered/unregistered/updated and clients are notified through list-change semantics so they can re-fetch `tools/list`.

## Current source-derived state

Reviewed source/spec/test paths:

- `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json`
- `SERVER_DATABASE_POLICY_SPEC.json`
- `SERVER_STAGE12.json`
- `src/list_changed_notification_bus.js`
- `src/list_changed_harness.js`
- `src/list_changed_audit_receipt.js`
- `src/list_changed_pipeline.js`
- `src/tools_list_diff.js`
- `src/plugin_visibility.js`
- `src/plugin_visibility_state.js`
- `src/plugin_visibility_state_store_preview.js`
- `src/plugin_visibility_state_store_receipt.js`
- `src/plugin_visibility_state_store_pipeline.js`
- `src/plugin_visibility_state_store_apply_gate.js`
- `src/session_toolset.js`
- `src/security_first_preflight.js`
- `_tests/smoke_list_changed_readiness_contract.js`
- `_tests/smoke_list_changed_notification_bus_dry_run.js`
- `_tests/smoke_list_changed_local_harness.js`
- `_tests/smoke_list_changed_audit_receipt.js`
- `_tests/smoke_list_changed_dry_run_pipeline.js`
- `_tests/smoke_plugin_visibility_state_store_preview.js`
- `_tests/smoke_plugin_visibility_state_store_receipt.js`
- `_tests/smoke_plugin_visibility_state_store_pipeline.js`
- `_tests/smoke_state_store_apply_readiness_gate.js`
- `_tests/smoke_security_first_preflight.js`

Observed state:

1. The repo already has a dry-run `notifications/tools/list_changed` stack.
2. `list_changed_notification_bus.js` defines `LIST_CHANGED_METHOD = "notifications/tools/list_changed"` and returns dry-run envelopes with `list_changed_enabled_now: false`.
3. Multiple tests assert that real server emission is not enabled yet and that `server.js` / initialize response do not emit `notifications/tools/list_changed`.
4. `plugin_visibility` and `session_toolset` are preview/planning only; they report that real visibility changes would require client refresh or list_changed support.
5. `plugin_visibility_state_store_*` modules model state store preview, receipts, dry-run pipeline, and readiness gate, but runtime state store writes and list_changed emission remain disabled.
6. `security_first_preflight.js` is explicitly security-first and denies list_changed emission requests now.
7. `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json` already states that hotplug apply requires a separate operator-approved runtime step and that tools/list changes must be audited.

## Target architecture

Hotplug should be event-driven, not periodic/manual refresh-driven.

Core components:

1. Dynamic tool registry
   - Holds currently visible tools and their descriptors/handlers.
   - Provides deterministic `tools/list` snapshots.
   - Produces diff records for add/remove/update.

2. Visibility state store
   - Persists approved visibility state changes.
   - Records receipts and rollback metadata.
   - Does not allow arbitrary mutation without policy approval.

3. List-change event bus
   - Emits list-changed events only after receipt verification and security preflight.
   - For the current stable Streamable HTTP era, this can use the existing list_changed dry-run semantics and active stream/harness model.
   - For future sessionless/draft direction, align with `subscriptions/listen` or equivalent list-change notification delivery.

4. Client/UI invalidation path
   - Receives a list-changed event.
   - Invalidates stale tool list cache.
   - Re-fetches `tools/list`.
   - Does not execute tools whose descriptors vanished or changed incompatibly.

5. Audit and rollback
   - Every hotplug change has a diff, preflight result, receipt, and rollback plan.
   - Failed or partially applied changes must fail closed and keep the previous registry snapshot.

## Proposed implementation stages

### HPL1 - Tool registry abstraction

Create an internal dynamic registry abstraction that can render the current static tool set without changing visible behavior.

Acceptance:

- `tools/list` output is byte/shape compatible with current static loader output.
- No list_changed emitted.
- Full `run_all --skip-network` remains green.

Likely guards:

- dedicated registry/static-equivalence guard (active descriptive filename not yet fixed in repo)
- existing descriptor/profile audits.

### HPL2 - Diff model integration

Connect the registry abstraction to existing `tools_list_diff.js` and list_changed dry-run pipeline.

Acceptance:

- add/remove/update diffs are deterministic;
- no runtime mutation yet;
- list_changed remains dry-run.

Likely guard:

- `_tests/smoke_tools_list_diff_model.js`

### HPL3 - State store apply gate

Promote existing state-store apply-readiness checks into a formal gate for any future real hotplug change.

Acceptance:

- no state-store write without verified receipt;
- no list_changed emission without preflight;
- rollback metadata required.

Likely guard:

- `_tests/smoke_state_store_apply_readiness_gate.js`

### HPL4 - Local harness emission only

Enable list_changed emission only in a local mock harness, not in live runtime.

Acceptance:

- event envelope uses expected list_changed method;
- transport send is mock-only;
- audit receipt verifies;
- live server still does not emit.

Likely guard:

- existing `_tests/smoke_list_changed_local_harness.js`
- `_tests/smoke_list_changed_audit_receipt.js`

### HPL5 - Runtime apply prototype behind feature flag

Only after HPL1-HPL4 and operator approval, allow a feature-flagged runtime prototype.

Acceptance:

- disabled by default;
- cannot affect public connector;
- OAuth/internal only;
- explicit operator approval required;
- live connector refresh plan required if visible tool surface changes.

### HPL6 - Sessionless/draft alignment

After P5/S1/S2 target selection, align notification delivery with the chosen protocol era:

- stable 2025-11-25: current GET/SSE and list_changed model;
- draft/sessionless: `subscriptions/listen` or equivalent request-scoped/listen delivery.

## Non-goals for P6

- No runtime hotplug implementation.
- No real `notifications/tools/list_changed` emission.
- No connector refresh.
- No public connector reconnection.
- No state-store write enablement.
- No tool surface mutation.

## Acceptance for P6

P6 is complete if:

- existing dry-run list_changed/plugin visibility stack is mapped;
- target hotplug architecture is recorded;
- implementation stages are ordered and gated;
- current no-emission security posture remains unchanged.

## Recommended next action after P6

Do not implement hotplug immediately. Finish P7 workflow archive compaction first, then select whether to start HPL1 or S1 based on operator priorities.
