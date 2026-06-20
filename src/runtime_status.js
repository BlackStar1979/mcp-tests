function compactToolSurface(surface) {
  if (!surface || typeof surface !== "object") return null;
  const { per_tool, tool_names, ...rest } = surface;
  return rest;
}

function compactSchemaCompatibility(audit) {
  if (!audit || typeof audit !== "object") return null;
  const { per_tool, issues, ...rest } = audit;
  return rest;
}

function compactToolLabels(labels) {
  if (!labels || typeof labels !== "object") return null;
  return {
    version: labels.version,
    public_count: Array.isArray(labels.public) ? labels.public.length : 0,
    internal_count: Array.isArray(labels.internal) ? labels.internal.length : 0,
    plugin_count: Array.isArray(labels.plugins) ? labels.plugins.length : 0,
  };
}

function buildRuntimeStatus(context) {
  const {
    serverName,
    serverVersion,
    connectorShapeVersion,
    outputMode,
    publicBaseUrl,
    host,
    port,
    authPolicy,
    auditVersion,
    auditLogPath,
    maxFetchTextChars,
    stageStatus,
    securityBoundary,
    profile,
    profilePolicy,
    toolPolicySummary,
    enabledTools,
    toolSurfaceFingerprint,
    schemaCompatibility,
    runtimeIdentity,
    toolLabels,
    network,
    fs,
    includeTools = true,
  } = context;

  const includeVerboseTools = includeTools !== false;
  const networkEnabled = network.envFlagEnabled("MCP_TEST_ENABLE_NET_TOOLS", true);
  const fsEnabled = fs.envFlagEnabled("MCP_TEST_ENABLE_FS_TOOLS", true);
  const identity = typeof runtimeIdentity === "function" ? runtimeIdentity() : {
    server_name: serverName,
    server_version: serverVersion,
    connector_shape_version: connectorShapeVersion,
    audit_version: auditVersion,
    startup_report_version: "test-mcp-startup-report-v1",
    labels_version: "test-mcp-labels-v1",
    runtime_stage_status: stageStatus,
    runtime_stage_status_semantics: "runtime-compatibility-label-not-repo-progress-label",
    current_working_course: "unknown",
  };
  const labels = typeof toolLabels === "function" ? toolLabels() : {
    version: "test-mcp-labels-v1",
    public: [],
    internal: [],
    plugins: [],
  };

  return {
    server_name: serverName,
    server_version: serverVersion,
    connector_shape_version: connectorShapeVersion,
    output_mode: outputMode,
    public_base_url: publicBaseUrl,
    host,
    port,
    runtime_identity: identity,
    auth: authPolicy.status(),
    profile: {
      mode: profile,
      public_exposure: profile === "public",
      policy_status: profilePolicy().ok ? "ok" : "error",
    },
    audit: {
      enabled: true,
      version: auditVersion,
      path: auditLogPath,
    },
    limits: {
      fetch_text_cap_chars: maxFetchTextChars,
    },
    network: {
      enabled: networkEnabled,
      allowlist: networkEnabled ? network.getAllowedDomains() : [],
      timeout_ms: networkEnabled ? network.getTimeoutMs() : 0,
      max_bytes: networkEnabled ? network.getMaxBytes() : 0,
    },
    fs: {
      enabled: fsEnabled,
      root: fs.getPublicFsRoot(),
      max_file_bytes: fs.getPublicFsMaxFileBytes(),
      max_text_chars: fs.getPublicFsMaxTextChars(),
      max_list_entries: fs.getPublicFsMaxListEntries(),
      profile: "public-fs-sandbox-only",
    },
    enabled_tools: includeVerboseTools ? enabledTools() : [],
    tool_surface: includeVerboseTools
      ? (typeof toolSurfaceFingerprint === "function" ? toolSurfaceFingerprint() : null)
      : compactToolSurface(typeof toolSurfaceFingerprint === "function" ? toolSurfaceFingerprint() : null),
    schema_compatibility: includeVerboseTools
      ? (typeof schemaCompatibility === "function" ? schemaCompatibility() : null)
      : compactSchemaCompatibility(typeof schemaCompatibility === "function" ? schemaCompatibility() : null),
    tool_policy_summary: includeVerboseTools ? toolPolicySummary() : [],
    tool_labels: includeVerboseTools ? labels : compactToolLabels(labels),
    stage_status: stageStatus,
    security_boundary: securityBoundary ? securityBoundary() : null,
  };
}

module.exports = {
  buildRuntimeStatus,
};
