const EXPECTED_TOOL_NAMES = [
  "search",
  "fetch",
  "code_sample_js",
  "net_http_get_allowlisted",
  "net_fetch_text_allowlisted",
  "net_check_url_head",
  "net_fetch_github_raw",
  "net_check_npm_package",
  "net_check_pypi_package",
  "fs_list_public",
  "fs_get_public_info",
  "fs_read_public_text",
  "fs_read_public_lines",
  "fs_read_public_chunk",
  "test_mcp_runtime_status",
  "dev_code_symbols",
  "dev_code_dependencies",
  "dev_code_audit",
  "dev_code_impact",
  "dev_code_syntax_check",
  "dev_code_locate",
  "plugin_registry_status",
  "plugin_registry_list",
  "plugin_registry_get",
  "plugin_registry_audit",
  "plugin_catalog_search",
  "plugin_catalog_describe",
  "plugin_visibility_status",
  "plugin_visibility_plan",
  "session_toolset_status",
  "session_toolset_plan",
  "plugin_execution_preflight",
  "plugin_execute_readonly",
  "plugin_execution_governance",
  "plugin_execution_verify_receipt",
  "auth_transition_status",
  "auth_bearer_dry_run",
  "auth_bearer_cutover_guard",
  "auth_modular_parity_status",
  "observability_status",
];

const PUBLIC_TOOL_NAMES = EXPECTED_TOOL_NAMES.filter((name) => [
  "search",
  "fetch",
  "net_http_get_allowlisted",
  "net_fetch_text_allowlisted",
  "net_check_url_head",
  "net_fetch_github_raw",
  "net_check_npm_package",
  "net_check_pypi_package",
  "fs_list_public",
  "fs_get_public_info",
  "fs_read_public_text",
  "fs_read_public_lines",
  "fs_read_public_chunk",
].includes(name));

function auditToolDescriptors(tools, options = {}) {
  const errors = [];
  const names = tools.map((tool) => tool.name);
  const sortedNames = [...names].sort();
  const expectedNames = Array.isArray(options.expectedToolNames) ? options.expectedToolNames : EXPECTED_TOOL_NAMES;
  const expected = [...expectedNames].sort();

  if (JSON.stringify(sortedNames) !== JSON.stringify(expected)) {
    errors.push(`tool surface mismatch: got ${sortedNames.join(",")} expected ${expected.join(",")}`);
  }

  const seen = new Set();

  for (const tool of tools) {
    if (!tool || typeof tool !== "object") {
      errors.push("tool descriptor is not an object");
      continue;
    }

    if (!tool.name || typeof tool.name !== "string") {
      errors.push("tool missing string name");
      continue;
    }

    if (seen.has(tool.name)) {
      errors.push(`duplicate tool: ${tool.name}`);
    }
    seen.add(tool.name);

    if (!/^[a-z][a-z0-9_]{1,80}$/.test(tool.name)) {
      errors.push(`${tool.name} invalid tool name format`);
    }

    if (!tool.title) errors.push(`${tool.name} missing title`);
    if (!tool.description) errors.push(`${tool.name} missing description`);
    if (!tool.inputSchema) errors.push(`${tool.name} missing inputSchema`);
    if (!tool.outputSchema) errors.push(`${tool.name} missing outputSchema`);
    if (!tool.annotations) errors.push(`${tool.name} missing annotations`);

    const annotations = tool.annotations || {};
    if (annotations.readOnlyHint !== true) errors.push(`${tool.name} readOnlyHint must be true`);
    if (annotations.destructiveHint !== false) errors.push(`${tool.name} destructiveHint must be false`);
    if (annotations.idempotentHint !== true) errors.push(`${tool.name} idempotentHint must be true`);

    const expectedOpenWorld = tool.name.startsWith("net_");
    if (annotations.openWorldHint !== expectedOpenWorld) {
      errors.push(`${tool.name} openWorldHint must be ${expectedOpenWorld}`);
    }

    if (tool.inputSchema?.type !== "object") {
      errors.push(`${tool.name} inputSchema.type must be object`);
    }

    if (tool.inputSchema?.additionalProperties !== false) {
      errors.push(`${tool.name} inputSchema.additionalProperties must be false`);
    }
  }

  return {
    ok: errors.length === 0,
    count: tools.length,
    expected_count: expectedNames.length,
    tool_names: names,
    errors,
  };
}

function assertToolDescriptors(tools, options = {}) {
  const result = auditToolDescriptors(tools, options);
  if (!result.ok) {
    throw new Error(`descriptor audit failed: ${result.errors.join("; ")}`);
  }
  return result;
}

module.exports = {
  EXPECTED_TOOL_NAMES,
  PUBLIC_TOOL_NAMES,
  assertToolDescriptors,
  auditToolDescriptors,
};
