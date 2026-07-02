"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { HOTPLUG_LIFECYCLE_READINESS_VERSION, buildHotplugLifecycleReadiness } = require("../src/hotplug_lifecycle_readiness");
const ROOT = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
(async () => {
  const result = await buildHotplugLifecycleReadiness();
  assert.equal(result.success, true);
  assert.equal(result.mode, "event-driven-hotplug-lifecycle-readiness");
  assert.equal(result.readiness_version, HOTPLUG_LIFECYCLE_READINESS_VERSION);
  assert.equal(result.list_changed_method, "notifications/tools/list_changed");
  assert.equal(result.hpl.hpl1_registry_abstraction.status, "done");
  assert.equal(result.hpl.hpl2_diff_model.status, "done");
  assert.equal(result.hpl.hpl3_state_store_apply_gate.status, "done");
  assert.equal(result.hpl.hpl4_local_harness_emission.status, "done_mock_only");
  assert.equal(result.hpl.hpl5_runtime_apply_prototype.status, "gated_pending_explicit_operator_runtime_action");
  assert.equal(result.current_behavior.registry_diff_available, true);
  assert.equal(result.current_behavior.state_store_pipeline_available, true);
  assert.equal(result.current_behavior.local_mock_emission_available, true);
  assert.equal(result.current_behavior.runtime_apply_allowed_now, false);
  assert.equal(result.current_behavior.runtime_tools_list_mutated, false);
  assert.equal(result.current_behavior.runtime_state_store_written, false);
  assert.equal(result.current_behavior.runtime_transport_send_allowed_now, false);
  assert.equal(result.current_behavior.client_notification_emitted_live, false);
  assert.equal(result.current_behavior.connector_refresh_required_now, false);
  assert.equal(result.current_behavior.runtime_restart_required_now, false);

  assert.equal(result.summaries.registry_diff.change_count, 3);
  assert.equal(result.summaries.registry_diff.would_require_list_changed, true);
  assert.equal(result.summaries.mock_harness.notification_emitted, true);
  assert.equal(result.summaries.mock_harness.transport_send_called, true);
  assert.equal(result.summaries.state_store_pipeline.allow_emit_effective, false);
  assert.equal(result.summaries.state_store_pipeline.allow_fs_write_effective, false);
  assert.equal(result.summaries.apply_gate.future_ready_if_apply_enabled, true);
  assert.equal(result.summaries.apply_gate.apply_allowed_now, false);
  assert.equal(result.summaries.apply_gate.force_apply_honored, false);
  assert.equal(result.summaries.security_first_preflight.verified, true);
  assert.equal(result.summaries.security_first_preflight.list_changed_emit_allowed_now, false);
  assert.equal(result.summaries.security_first_preflight.dynamic_import_allowed_now, false);

  assert.ok(result.blocker_reassessment.stale_blockers_removed.includes("HPL1 registry abstraction not started"));
  assert.ok(result.blocker_reassessment.valid_blockers_remaining.includes("HPL5 runtime apply prototype requires explicit operator runtime action"));

  const serverJs = read("server.js");
  const initializeResponse = read("src/runtime/initialize_response.js");
  assert.equal(serverJs.includes("notifications/tools/list_changed"), false);
  assert.equal(/jsonrpc[\s\S]{0,160}notifications\/tools\/list_changed/.test(initializeResponse), false);

  const policySpec = JSON.parse(read("SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json"));
  assert.equal(policySpec.hotplug_lifecycle_readiness.status, "hpl1_to_hpl4_reconciled_hpl5_gated");
  assert.equal(policySpec.hotplug_lifecycle_readiness.connector_refresh_required_now, false);
  assert.equal(policySpec.hotplug_lifecycle_readiness.runtime_restart_required_now, false);

  console.log("smoke_event_driven_hotplug_lifecycle ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
