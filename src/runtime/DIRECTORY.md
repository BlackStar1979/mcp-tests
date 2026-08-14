# DIRECTORY

Status: source runtime directory map
Updated: 2026-08-14

- `server_bootstrap_runtime.js`, `server_factory.js`, `server_lifecycle.js`, `server_cli_args.js`, `startup_report_builder.js`
  Runtime bootstrap, lifecycle, and startup reporting modules.
- `create_server_route_dispatcher.js`, `mcp_entry_dispatcher.js`, `mcp_runtime_handlers.js`, `docs_route_handler.js`, `health_route_handler.js`, `not_found_route_handler.js`, `method_not_allowed_handler.js`
  HTTP route and top-level request dispatch handlers.
- `rpc_message_dispatcher.js`, `rpc_message_prelude.js`, `rpc_protocol_validator.js`, `rpc_responses.js`, `rpc_response_audit.js`, `rpc_handler_exception_handler.js`, `rpc_no_response.js`
  RPC parsing, validation, response shaping, and audit helpers.
- `initialize_message_handler.js`, `server_discover_message_handler.js`, `tools_list_message_handler.js`, `tools_call_handler.js`, `mcp_tasks_extension.js`, `resources_list_message_handler.js`, `resources_read_message_handler.js`, `resource_templates_list_message_handler.js`, `prompts_list_message_handler.js`, `ping_message_handler.js`
  MCP method handlers, the negotiated MCP Tasks extension adapter, and owner-bound process artifact resource reads for the active runtime surface.
- `trace_context.js`, `request_metadata_policy.js`, `modern_protocol_adapter.js`, `process_artifact_resource.js`
  MCP 2026-07-28 request metadata handling, bounded W3C Trace Context parsing, modern response adaptation, and opaque immutable process-artifact URI/resource-link helpers. Raw baggage is never persisted by the trace context layer.
- `core_tool_call_handlers.js`, `tool_input_validator.js`, `tool_result.js`, `tool_result_assertion.js`, `tool_result_freshness.js`, `tool_call_exception_handler.js`, `unknown_tool_call_handler.js`
  Tool-call execution and result-validation helpers.
- `audit_log.js`, `rpc_audit_summary.js`, `tool_audit_helpers.js`, `request_id.js`, `response_write_guard.js`
  Audit, correlation, and response-safety helpers.
- `auth_bootstrap_config_resolver.js`, `auth_rejection_handler.js`, `oauth_metadata.js`, `oauth21_secret_config.js`, `health_auth_status.js`
  Runtime auth wiring and auth-status support.
- `decision_runtime_context_builder.js`, `decision_runtime_policy.js`, `decision_runtime_receipt.js`, `policy_enforcement_gate.js`
  Runtime policy and decision-enforcement helpers.
- `runtime_context_assembly.js`, `runtime_support_assembly.js`, `runtime_status_assembly.js`, `runtime_status_provider.js`, `runtime_registry_summary.js`, `registry_context_assembly.js`
  Runtime assembly and status-composition helpers.
- `README.md`
  Orientation for the runtime module area.

This map is intentionally grouped because `src/runtime` is dense and changes frequently.
