"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflowPath = path.join(root, "_workflow", "STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md");
const workflow = fs.readFileSync(workflowPath, "utf8");
const canon = fs.readFileSync(path.join(root, "_workflow", "WORKFLOW_CANON.md"), "utf8");
const state = JSON.parse(fs.readFileSync(path.join(root, "_workflow", "state.json"), "utf8"));

for (const phase of [
  "Phase A - Streamable HTTP preflight",
  "Phase B - POST SSE response path",
  "Phase C - SessionStore and lifecycle",
  "Phase D - GET SSE stream and outbound queue",
  "Phase E - Pending request correlation",
  "Phase F - Sampling readiness",
  "Phase G - OAuth preflight and implementation",
]) {
  assert.ok(workflow.includes(phase), `${phase} missing`);
}

for (const required of [
  "Do not enable OAuth until Phase A-F are green",
  "MCP-Protocol-Version",
  "text/event-stream",
  "Mcp-Session-Id",
  "outbound queue",
  "pending request correlation",
  "sampling/createMessage",
  "capabilities.sampling",
  "node _tests/run_all_smokes.js --skip-network = ok",
]) {
  assert.ok(workflow.includes(required), `${required} missing`);
}

assert.ok(canon.includes("STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md"));
assert.ok(["stage12_streamable_http_workflow_plan", "phase_a_streamable_http_preflight", "phase_b_post_sse_response_path", "phase_c_session_store_lifecycle", "phase_d_get_sse_outbound_queue", "phase_e_pending_request_correlation", "phase_f_sampling_readiness", "phase_g_oauth_resource_server_preflight", "oauth_production_hardening_plan", "h1_as_metadata_integration", "h2_jwks_rs256_validation", "h3_oauth_introspection_validation", "h4_dcr_policy", "h5_pkce_client_flow_policy", "h6_jwks_key_rotation", "h7_sampling_user_approval_policy", "h8_sse_keepalive_resumability", "h9_live_connector_refresh_readiness", "post_h9_debt_closure", "mcp_tests_audit_remediation", "h10_oauth21_local_authorization_server", "oauth21_runtime_status_response_remediation", "access_bearer_runtime_retirement_stage1_specs", "access_bearer_runtime_retirement_stage2_bootstrap", "access_bearer_runtime_retirement_stage3_run_all_oauth21", "access_bearer_runtime_retirement_stage4_legacy_status_tool", "access_bearer_runtime_retirement_stage5_legacy_tests_reclassified", "post_stage6_root_spec_workflow_review", "post_stage6_operator_decisions_recorded", "p1_batch_sse_explicit_unsupported_guard", "p2_legacy_retired_auth_manifest_triage", "p3_cancellation_path_client_disconnect_plan", "p4_runtime_policy_expansion_scope_plan", "p5_sessionless_explicit_state_handles_spec_review", "p6_event_driven_hotplug_lifecycle_design", "p7_workflow_archive_compaction_index", "stage7_repo_live_convergence_and_sessionless_readiness", "stage7_sessionless_compatibility_inventory", "stage7_c1_cancellation_context_plumbing", "stage7_c2_client_disconnect_write_guard", "stage7_closeout", "stage8_1_static_tool_registry_abstraction", "stage8_2_registry_to_policy_read_model"].includes(state.current_work_package.id));
assert.ok(["ready_streamable_http_workflow_plan", "green_phase_a_streamable_http_preflight", "green_phase_b_post_sse_response_path", "green_phase_c_session_store_lifecycle", "green_phase_d_get_sse_outbound_queue", "green_phase_e_pending_request_correlation", "green_phase_f_sampling_readiness", "green_phase_g_oauth_resource_server_preflight", "ready_oauth_production_hardening_plan", "green_h1_as_metadata_integration", "green_h2_jwks_rs256_validation", "green_h3_oauth_introspection_validation", "green_h4_dcr_policy", "green_h5_pkce_client_flow_policy", "green_h6_jwks_key_rotation", "green_h7_sampling_user_approval_policy", "green_h8_sse_keepalive_resumability", "green_h9_live_connector_refresh_readiness", "green_post_h9_debt_closure", "green_mcp_tests_audit_remediation", "green_h10_oauth21_local_authorization_server", "green_oauth21_runtime_status_response_remediation", "green_stage1_specs_and_workflow_target_frozen", "green_stage2_runtime_bootstrap_retired_access_bearer", "green_stage3_run_all_oauth21_harness", "green_stage4_auth_legacy_retirement_status", "green_stage5_legacy_auth_tests_reclassified", "green_post_stage6_root_spec_workflow_review", "green_operator_decisions_recorded_pending_checkpoint_commit", "green_p1_batch_sse_explicit_unsupported_guard_pending_commit", "green_p1_batch_sse_explicit_unsupported_guard", "green_p2_legacy_retired_auth_manifest_triage_pending_commit", "green_p3_cancellation_path_client_disconnect_plan_pending_commit", "green_p4_runtime_policy_expansion_scope_plan_pending_commit", "green_p5_sessionless_explicit_state_handles_spec_review_pending_commit", "green_p6_event_driven_hotplug_lifecycle_design_pending_commit", "green_p7_workflow_archive_compaction_index_pending_commit", "green_stage7_0_1_repo_live_convergence_pending_commit", "green_stage7_sessionless_inventory_pending_commit", "green_stage7_c1_cancellation_context_plumbing_pending_commit", "green_stage7_c1_cancellation_context_plumbing", "green_stage7_c2_client_disconnect_write_guard_pending_commit", "green_stage7_c2_client_disconnect_write_guard", "green_stage7_closed", "green_stage8_1_static_tool_registry_abstraction_pending_commit", "green_stage8_1_static_tool_registry_abstraction", "green_stage8_2_registry_to_policy_read_model_pending_commit", "green_stage8_2_registry_to_policy_read_model"].includes(state.current_work_package.status));
assert.ok(state.next_allowed_work.includes("Phase A - Streamable HTTP preflight") || state.next_allowed_work.includes("Phase B - POST SSE response path") || state.next_allowed_work.includes("Phase C - SessionStore and lifecycle") || state.next_allowed_work.includes("Phase D - GET SSE stream and outbound queue") || state.next_allowed_work.includes("Phase E - Pending request correlation") || state.next_allowed_work.includes("Phase F - Sampling readiness") || state.next_allowed_work.includes("Phase G - OAuth preflight and implementation") || state.next_allowed_work.includes("live connector refresh after explicit operator approval") || state.next_allowed_work.includes("H1 - AS metadata integration") || state.next_allowed_work.includes("H2 - JWKS/RS256 validation path") || state.next_allowed_work.includes("H3 - Introspection path or explicit decision to defer introspection") || state.next_allowed_work.includes("H4 - DCR policy") || state.next_allowed_work.includes("H5 - PKCE/client-flow policy at AS boundary") || state.next_allowed_work.includes("H6 - Key rotation") || state.next_allowed_work.includes("H7 - Sampling user-approval policy") || state.next_allowed_work.includes("H8 - SSE keepalive/resumability") || state.next_allowed_work.includes("H9 - Live connector refresh readiness after explicit operator approval") || state.next_allowed_work.some((item)=>String(item).includes("Explicit operator approval") || String(item).includes("External tunnel validation")));

console.log("smoke_stage12_streamable_http_workflow_plan ok");
