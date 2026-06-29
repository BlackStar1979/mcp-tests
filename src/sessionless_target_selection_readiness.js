"use strict";

const SESSIONLESS_TARGET_SELECTION_READINESS_VERSION = "test-mcp-sessionless-target-selection-readiness-v1";

function buildSessionlessTargetSelectionReadiness() {
  const currentDependencies = {
    initialize_handshake: { present: true, files: ["src/runtime/initialize_message_handler.js", "src/runtime/initialize_response.js"] },
    mcp_session_id_header: { present: true, files: ["src/runtime/session_tracker.js", "src/runtime/mcp_entry_dispatcher.js"] },
    session_store: { present: true, files: ["src/runtime/session.js"] },
    get_sse_stream: { present: true, files: ["src/runtime/mcp_get_stream_handler.js"] },
    pending_request_correlation: { present: true, files: ["src/runtime/outbound_request_manager.js"] },
    sampling_roundtrip: { present: true, files: ["src/runtime/sampling_context.js"] },
    replay_last_event_id: { present: true, files: ["src/runtime/session.js", "src/runtime/mcp_get_stream_handler.js"] },
    cooperative_cancellation: { present: true, files: ["src/runtime/request_cancellation.js", "src/runtime/cooperative_tool_cancellation.js"] },
    list_result_ttl_cache_scope: { present: true, files: ["src/runtime/tools_list_response.js"] },
    hotplug_readiness: { present: true, files: ["src/hotplug_lifecycle_readiness.js"] },
  };

  const options = {
    keep_stable_connector_current: {
      status: "recommended_for_live_oauth21_connector",
      reason: "current OAuth21 connector and run_all harness depend on stable-compatible initialize/session/GET-SSE behavior",
      removes_session_code: false,
      connector_refresh_required: false,
      runtime_restart_required: false,
    },
    parallel_draft_sessionless_prototype: {
      status: "recommended_next_implementation_target_after_operator_selection",
      reason: "matches Final SEP-2575/SEP-2567 direction while preserving current connector continuity",
      removes_session_code: false,
      connector_refresh_required_before_prototype: false,
      runtime_restart_required_when_runtime_code_is_added: true,
    },
    full_switch_now: {
      status: "not_recommended",
      reason: "would break current stable-compatible connector assumptions before client/connector support and prototype evidence exist",
      removes_session_code: true,
      connector_refresh_required: true,
      runtime_restart_required: true,
    },
  };

  const explicitStateHandleRules = {
    handles_are_tool_design_pattern_not_protocol_feature: true,
    handles_are_ordinary_tool_arguments_and_structured_content_fields: true,
    opaque_ids_required: true,
    possession_is_not_authorization: true,
    auth_context_must_be_checked_on_every_handle_use: true,
    expiry_and_destroy_semantics_required: true,
    useful_expired_handle_errors_required: true,
    list_or_recover_tools_recommended: true,
    raw_handles_in_audit_must_be_redacted_or_hashed: true,
  };

  const blockerReassessment = {
    stale_blockers_removed: [
      "C1 cancellation context plumbing not implemented",
      "C2 response write guard not implemented",
      "C3 cooperative cancellation not implemented",
      "event-driven hotplug lifecycle not mapped",
      "OAuth21 3008 restart authority missing",
    ],
    valid_blockers_remaining: [
      "final operator target selection is still required before prototype",
      "current live OAuth21 connector should remain stable-compatible",
      "parallel draft/sessionless prototype requires separate runtime-code stage",
      "full switch requires connector/client support evidence and refresh plan",
      "explicit handle policy must be guarded before handle-bearing tools are added",
    ],
  };

  const decision = {
    prepared_recommendation: "keep_stable_connector_current_and_prepare_parallel_draft_sessionless_prototype",
    target_selection_status: "prepared_pending_operator_selection",
    do_not_remove_current_session_code: true,
    do_not_change_live_connector_route: true,
    do_not_enable_post_only_draft_mode_now: true,
    next_runtime_stage_if_approved: "S4 parallel draft/sessionless prototype behind non-default route or mode",
    next_policy_stage_if_not_runtime: "S3 explicit state handle design rules",
  };

  return {
    success: true,
    mode: "sessionless-explicit-state-handles-target-selection-readiness",
    readiness_version: SESSIONLESS_TARGET_SELECTION_READINESS_VERSION,
    source_verification: {
      verified_at: "2026-06-29",
      sources: [
        "https://modelcontextprotocol.io/seps/2567-sessionless-mcp",
        "https://modelcontextprotocol.io/seps/2575-stateless-mcp",
        "https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http",
        "https://modelcontextprotocol.io/specification/2025-11-25/basic/transports"
      ],
      stable_2025_11_25_sessions_still_documented: true,
      final_sep_2575_stateless_direction: true,
      final_sep_2567_sessionless_explicit_handles_direction: true,
      draft_streamable_http_post_only_direction: true,
    },
    current_dependencies: currentDependencies,
    options,
    explicit_state_handle_rules: explicitStateHandleRules,
    blocker_reassessment: blockerReassessment,
    decision,
    current_behavior_change: false,
    runtime_restart_required_now: false,
    connector_refresh_required_now: false,
    schema_change_required_now: false,
    public_3009_start_required_now: false,
  };
}

module.exports = {
  SESSIONLESS_TARGET_SELECTION_READINESS_VERSION,
  buildSessionlessTargetSelectionReadiness,
};
