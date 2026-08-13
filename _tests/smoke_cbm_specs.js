"use strict";

const assert = require("node:assert/strict");

const toolsSpec = require("../SERVER_TOOLS_SPEC.json");
const resourceSpec = require("../SERVER_RESOURCE_POLICY_SPEC.json");
const dlpSpec = require("../SERVER_OUTPUT_DLP_POLICY_SPEC.json");
const profilesSpec = require("../SERVER_PROFILES_SPEC.json");
const connectorSpec = require("../SERVER_CONNECTOR_SURFACE_SPEC.json");
const serverSpec = require("../SERVER_SPEC.json");
const runtimeConfigSpec = require("../SERVER_RUNTIME_CONFIG_SPEC.json");
const testsProfile = require("../profiles/tests.json");
const {
  AUTHORIZED_MCP_TOOL_NAMES,
  PUBLIC_TOOL_NAMES,
  getToolPolicy,
} = require("../src/tool_policy");

const CBM_NAMES = [
  "cbm_status",
  "cbm_list_projects",
  "cbm_index_repository",
  "cbm_get_architecture",
  "cbm_search_graph",
  "cbm_query_graph",
  "cbm_trace_path",
  "cbm_get_code_snippet",
  "cbm_get_graph_schema",
  "cbm_search_code",
  "cbm_delete_project",
  "cbm_index_status",
  "cbm_detect_changes",
  "cbm_manage_adr",
  "cbm_ingest_traces",
];

const READ_ONLY_NAMES = [
  "cbm_status",
  "cbm_list_projects",
  "cbm_get_architecture",
  "cbm_search_graph",
  "cbm_query_graph",
  "cbm_trace_path",
  "cbm_get_code_snippet",
  "cbm_get_graph_schema",
  "cbm_search_code",
  "cbm_index_status",
  "cbm_detect_changes",
];

const MUTATION_NAMES = ["cbm_index_repository", "cbm_manage_adr", "cbm_ingest_traces"];

assert.equal(PUBLIC_TOOL_NAMES.length, 13);
assert.equal(AUTHORIZED_MCP_TOOL_NAMES.length, 85);
for (const name of CBM_NAMES) {
  assert.equal(AUTHORIZED_MCP_TOOL_NAMES.includes(name), true, `${name} missing from authorized policy surface`);
  assert.equal(PUBLIC_TOOL_NAMES.includes(name), false, `${name} leaked to public policy surface`);
  const policy = getToolPolicy(name);
  assert.deepEqual(policy.profile_allowed, ["internal"]);
  assert.equal(policy.auth_required, true);
  assert.equal(policy.public_safe, false);
  assert.equal(policy.open_world, false);
}
for (const name of READ_ONLY_NAMES) {
  assert.equal(getToolPolicy(name).read_only, true, name);
  assert.equal(getToolPolicy(name).destructive, false, name);
  assert.equal(getToolPolicy(name).fs_scope, "codebase-memory-readonly", name);
}
assert.equal(getToolPolicy("cbm_index_repository").read_only, false);
assert.equal(getToolPolicy("cbm_index_repository").destructive, false);
assert.equal(getToolPolicy("cbm_index_repository").fs_scope, "codebase-memory-index-mutation");
for (const name of ["cbm_manage_adr", "cbm_ingest_traces"]) {
  assert.equal(getToolPolicy(name).read_only, false, name);
  assert.equal(getToolPolicy(name).destructive, false, name);
  assert.equal(getToolPolicy(name).fs_scope, "codebase-memory-mutation", name);
}
assert.equal(getToolPolicy("cbm_delete_project").read_only, false);
assert.equal(getToolPolicy("cbm_delete_project").destructive, true);
assert.equal(getToolPolicy("cbm_delete_project").fs_scope, "codebase-memory-destructive");

assert.equal(toolsSpec.surface_classes.public_mcp_tools.tool_count, 13);
assert.equal(toolsSpec.surface_classes.authorized_mcp_tools.tool_count, 85);
assert.equal(toolsSpec.total_mcp_callable_tool_count, 98);
for (const name of CBM_NAMES) {
  assert.equal(toolsSpec.surface_classes.authorized_mcp_tools.tools.includes(name), true);
  const catalog = toolsSpec.tool_catalog[name];
  assert.equal(catalog.name, name);
  assert.equal(catalog.surface_class, "authorized_mcp_tools");
  assert.equal(catalog.tool_category, "codebase_memory");
  assert.equal(catalog.auth_required, true);
  assert.equal(catalog.public_safe, false);
  assert.equal(catalog.audit_required, true);
  assert.equal(Object.hasOwn(catalog, "feature_flag"), false);
  assert.equal(Object.hasOwn(catalog, "enabled_by_default"), false);
}
for (const name of MUTATION_NAMES) {
  assert.equal(toolsSpec.tool_catalog[name].resource_class, "codebase_memory_mutation", name);
  assert.equal(toolsSpec.tool_catalog[name].operation_class, "write", name);
}
assert.equal(toolsSpec.tool_catalog.cbm_delete_project.resource_class, "codebase_memory_destructive");
assert.equal(toolsSpec.tool_catalog.cbm_delete_project.operation_class, "delete");
for (const name of READ_ONLY_NAMES) {
  assert.equal(toolsSpec.tool_catalog[name].resource_class, "codebase_memory_readonly", name);
  assert.equal(["read", "list", "search"].includes(toolsSpec.tool_catalog[name].operation_class), true, name);
}

assert.deepEqual(resourceSpec.resource_classes.codebase_memory_readonly.allowed_operations, ["read", "list", "search"]);
assert.equal(resourceSpec.resource_classes.codebase_memory_readonly.public_surface_allowed, false);
assert.deepEqual(resourceSpec.resource_classes.codebase_memory_mutation.allowed_operations, ["write"]);
assert.equal(resourceSpec.resource_classes.codebase_memory_mutation.public_surface_allowed, false);
assert.deepEqual(resourceSpec.resource_classes.codebase_memory_destructive.allowed_operations, ["delete"]);
assert.equal(resourceSpec.resource_classes.codebase_memory_destructive.public_surface_allowed, false);
assert.equal(resourceSpec.resource_classes.codebase_memory_destructive.destructive, true);

const authenticatedResources = testsProfile.surfaces.authenticated.allowed_resource_policy_refs;
for (const ref of ["codebase_memory_readonly", "codebase_memory_mutation", "codebase_memory_destructive"]) {
  assert.equal(authenticatedResources.includes(ref), true, ref);
  assert.equal(testsProfile.surfaces.public.allowed_resource_policy_refs.includes(ref), false, ref);
}

const cbmProfile = profilesSpec.server_profiles.codebase_memory_bridge;
assert.equal(cbmProfile.status, "profile_managed_authenticated_surface");
assert.equal(cbmProfile.profile, "tests");
assert.equal(cbmProfile.surface, "authenticated");
assert.equal(cbmProfile.exposure_control, "profile_only");
assert.equal(cbmProfile.authenticated_tool_count, 15);
assert.equal(cbmProfile.tool_count_when_dependency_unavailable, 15);
assert.equal(cbmProfile.public_tool_count_change, 0);
assert.equal(Object.hasOwn(cbmProfile, "feature_flag"), false);
assert.equal(Object.hasOwn(cbmProfile, "enabled_by_default"), false);

assert.equal(connectorSpec.public_connector.expected_tool_count, 13);
for (const name of CBM_NAMES) {
  assert.equal(connectorSpec.public_connector.expected_tools.includes(name), false);
  assert.equal(connectorSpec.public_connector.forbidden_tool_names.includes(name), true);
  assert.equal(connectorSpec.authenticated_connector.expected_authorized_tools.includes(name), true);
}
assert.equal(connectorSpec.authenticated_connector.expected_public_plus_authorized_count, 98);
assert.equal(connectorSpec.authenticated_connector.repo_current_expected_tool_count, 98);
assert.equal(connectorSpec.target_connector_topology.active_connectors.authorized.repo_current_expected_tool_count, 98);

assert.equal(serverSpec.server.default_tool_count, 13);
assert.equal(serverSpec.server.public_tool_count, 13);
assert.equal(serverSpec.server.full_tests_authenticated_tool_count, 98);
assert.equal(serverSpec.server.authenticated_tool_count, 98);
assert.equal(serverSpec.runtime_config_spec.env_var_count, 103);
assert.equal(runtimeConfigSpec.env_vars.includes("MCP_TEST_ENABLE_CBM_TOOLS"), false);
assert.equal(runtimeConfigSpec.env_vars.includes("CBM_EXE_PATH"), true);
assert.equal(runtimeConfigSpec.env_vars.includes("CBM_ALLOWED_ROOT"), true);
assert.equal(runtimeConfigSpec.env_vars.includes("CBM_CACHE_DIR"), true);
assert.equal(runtimeConfigSpec.env_vars.includes("CBM_CONFIG_DIR"), true);
assert.deepEqual(runtimeConfigSpec.codebase_memory_cli_contract.supported_versions, ["0.9.0"]);
assert.equal(runtimeConfigSpec.codebase_memory_cli_contract.native_tool_count, 14);
assert.equal(runtimeConfigSpec.codebase_memory_cli_contract.connector_tool_count, 15);
assert.equal(runtimeConfigSpec.codebase_memory_cli_contract.contract_manifest, "src/integrations/codebase_memory/contracts/v0.9.0.json");
assert.deepEqual(runtimeConfigSpec.codebase_memory_cli_contract.identity_cache_invalidation, ["path", "size", "mtime_ms"]);
assert.equal(runtimeConfigSpec.codebase_memory_cli_contract.heavy_read_concurrency, 2);
assert.equal(runtimeConfigSpec.codebase_memory_cli_contract.native_containment_env, "CBM_ALLOWED_ROOT");
assert.equal(toolsSpec.codebase_memory_bridge_contract.native_version, "0.9.0");
assert.equal(toolsSpec.codebase_memory_bridge_contract.native_tool_count, 14);
assert.equal(toolsSpec.codebase_memory_bridge_contract.connector_tool_count, 15);
assert.equal(toolsSpec.codebase_memory_bridge_contract.partial_success_envelope, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.detect_changes_native_output_limit_chars, 1048576);
assert.equal(toolsSpec.codebase_memory_bridge_contract.detect_changes_returned_item_limit, 200);
assert.equal(toolsSpec.codebase_memory_bridge_contract.detect_changes_scope_enforced_by_bridge, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.detect_changes_exact_count_metadata, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.detect_changes_bridge_analysis_metadata, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.strict_trace_input_schema, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.trace_runtime_edge_creation_status, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.adr_snapshot_verify_restore, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.project_not_found_error_code, "cbm_project_not_found");
assert.equal(toolsSpec.codebase_memory_bridge_contract.labels_aggregation_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.cypher_unsupported_shape_warnings, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.resident_set_discovery_caveat, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.semantic_only_search_graph_structural_suppression, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.source_bearing_excluded_dir_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.windows_non_ascii_search_code_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.windows_non_ascii_index_path_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.windows_non_ascii_project_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.path_with_space_index_path_warning, true);
assert.equal(toolsSpec.codebase_memory_bridge_contract.project_with_space_warning, true);
assert.equal(toolsSpec.tool_catalog.cbm_list_projects.resident_set_not_absence_proof, true);
assert.equal(toolsSpec.tool_catalog.cbm_index_status.resident_set_not_absence_proof, true);
assert.equal(toolsSpec.tool_catalog.cbm_delete_project.confirmation_required, true);
assert.equal(toolsSpec.tool_catalog.cbm_delete_project.confirmation_kind, "cbm_delete_project_confirmation");
assert.equal(toolsSpec.tool_catalog.cbm_delete_project.confirmation_ttl_ms, 120000);
assert.equal(resourceSpec.resource_classes.codebase_memory_destructive.confirmation_required, true);
assert.equal(resourceSpec.resource_classes.codebase_memory_destructive.source_repository_deletion, false);

assert.deepEqual(dlpSpec.policy.codebase_memory_output_handling, {
  connector_visible: true,
  bounded_output_required: true,
  structured_schema_validation_required: true,
  audit_payload_content_forbidden: true,
  partial_success_explicit: true,
  warnings_bounded: true,
  binary_identity_metadata_allowed: true,
  state_handle_audit_forbidden: true,
  detect_changes_arrays_bounded: true,
  detect_changes_item_limit: 200,
  native_totals_preserved: true,
  returned_and_omitted_totals_preserved: true,
  bridge_analysis_metadata_explicit: true,
  scope_filter_metadata_explicit: true,
  unresolved_impact_explicit: true,
  unresolved_impact_reason_explicit: true,
  trace_placeholder_partial_success: true,
  trace_runtime_edge_creation_status_explicit: true,
  cypher_aggregation_warning: true,
  cypher_unsupported_shape_warnings: true,
  resident_set_discovery_caveat: true,
  semantic_only_structural_results_suppressed: true,
  source_bearing_excluded_dir_warning: true,
  windows_non_ascii_search_code_warning: true,
  windows_non_ascii_index_path_warning: true,
  windows_non_ascii_project_warning: true,
  path_with_space_index_path_warning: true,
  project_with_space_warning: true,
});

console.log("smoke_cbm_specs ok");
