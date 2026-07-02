const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");
const { createTestMcpRuntimeStatusTool } = require("../tools/test_mcp_runtime_status");
const { RUNTIME_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/runtime_status");
const { buildRuntimeStatus } = require("../src/runtime_status");
const { assertMatchesSchema, validateAgainstSchema } = require("../src/output_schema_guard");

function runtimeStatusFromBuilder(includeTools = true) {
  return buildRuntimeStatus({
    serverName: "mcp-tests-response-shape",
    serverVersion: "0.40.0",
    connectorShapeVersion: "2025-05-strict-v1",
    outputMode: "structured",
    publicBaseUrl: "https://example.test/mcp",
    host: "127.0.0.1",
    port: 3009,
    authPolicy: { status: () => ({ mode: "none", enabled: false, requires_auth: false, token_file_configured: false, token_loaded: false, token_length: 0, token_sha256_prefix: "" }) },
    auditVersion: "audit-v1",
    auditLogPath: "redacted",
    maxFetchTextChars: 2500,
    stageStatus: CURRENT_STAGE_STATUS,
    securityBoundary: () => ({ status: "ok" }),
    profile: "public",
    profilePolicy: () => ({ ok: true }),
    toolPolicySummary: () => [{ tool: "a", profile_allowed: ["public"], read_only: true, open_world: false, uses_network: false, uses_fs: false, fs_scope: "none", auth_required: false, public_safe: true }],
    enabledTools: () => ["a", "b"],
    toolSurfaceFingerprint: () => ({ tool_count: 2, tool_names: ["a", "b"], tool_names_hash: "abc123abc123", per_tool: [{ tool: "a" }, { tool: "b" }] }),
    schemaCompatibility: () => ({ success: true, status: "ok", tool_count: 2, error_count: 0, warning_count: 0, schema_fingerprint: "def456def456", per_tool: [{ tool: "a" }, { tool: "b" }], issues: [] }),
    network: { envFlagEnabled: () => true, getAllowedDomains: () => ["example.test"], getTimeoutMs: () => 1000, getMaxBytes: () => 10000 },
    fs: { envFlagEnabled: () => true, getPublicFsRoot: () => "redacted", getPublicFsMaxFileBytes: () => 1000, getPublicFsMaxTextChars: () => 2000, getPublicFsMaxListEntries: () => 20 },
    includeTools,
  });
}

function baseRuntimeStatus() {
  return {
    server_name: "mcp-tests-response-shape",
    server_version: "0.40.0",
    connector_shape_version: "2025-05-strict-v1",
    output_mode: "structured",
    public_base_url: "https://example.test/mcp",
    host: "127.0.0.1",
    port: 3009,
    runtime_identity: {
      server_name: "mcp-tests-response-shape",
      server_version: "0.40.0",
      connector_shape_version: "2025-05-strict-v1",
      audit_version: "audit-v1",
      startup_report_version: "test-mcp-startup-report-v1",
      labels_version: "test-mcp-labels-v1",
      runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL,
      runtime_compatibility_label_semantics: "runtime-compatibility-label-not-repo-progress-label",
      runtime_stage_status: CURRENT_STAGE_STATUS,
      runtime_stage_status_semantics: "runtime-compatibility-label-not-repo-progress-label",
      current_working_course: "stage8_52-runtime-identity-labels-startup-spec-cleanup-complete",
    },
    auth: {
      mode: "none",
      enabled: false,
      requires_auth: false,
      token_file_configured: false,
      token_loaded: false,
      token_length: 0,
      token_sha256_prefix: "",
    },
    profile: {
      mode: "public",
      public_exposure: true,
      policy_status: "ok",
    },
    audit: {
      enabled: true,
      version: "audit-v1",
      path: "redacted",
    },
    limits: {
      fetch_text_cap_chars: 2500,
    },
    network: {
      enabled: true,
      allowlist: ["example.test"],
      timeout_ms: 1000,
      max_bytes: 10000,
    },
    fs: {
      enabled: true,
      root: "redacted",
    },
    enabled_tools: ["a", "b"],
    tool_surface: {
      tool_count: 2,
      tool_names: ["a", "b"],
      tool_names_hash: "abc123abc123",
      per_tool: [{ tool: "a" }, { tool: "b" }],
    },
    schema_compatibility: {
      success: true,
      status: "ok",
      tool_count: 2,
      error_count: 0,
      warning_count: 0,
      schema_fingerprint: "def456def456",
      per_tool: [{ tool: "a" }, { tool: "b" }],
      issues: [],
    },
    tool_policy_summary: [
      {
        tool: "a",
        profile_allowed: ["public"],
        read_only: true,
        open_world: false,
        uses_network: false,
        uses_fs: false,
        fs_scope: "none",
        auth_required: false,
        public_safe: true,
      },
    ],
    tool_labels: {
      version: "test-mcp-labels-v1",
      public: [],
      internal: [],
      plugins: [],
    },
    compatibility_label: CURRENT_COMPATIBILITY_LABEL,
    stage_status: CURRENT_STAGE_STATUS,
    security_boundary: { status: "ok" },
  };
}

(async () => {
  const tool = createTestMcpRuntimeStatusTool(() => baseRuntimeStatus());
  const full = await tool.execute({ include_tools: true });
  assert.doesNotThrow(() => assertMatchesSchema(full, RUNTIME_STATUS_OUTPUT_SCHEMA, "full runtime status"));

  const compact = await tool.execute({ include_tools: false });
  assert.doesNotThrow(() => assertMatchesSchema(compact, RUNTIME_STATUS_OUTPUT_SCHEMA, "compact runtime status"));
  assert.deepEqual(compact.enabled_tools, []);
  assert.deepEqual(compact.tool_policy_summary, []);

  const builtFull = runtimeStatusFromBuilder(true);
  assert.doesNotThrow(() => assertMatchesSchema(builtFull, RUNTIME_STATUS_OUTPUT_SCHEMA, "built full runtime status"));
  const builtCompact = runtimeStatusFromBuilder(false);
  assert.doesNotThrow(() => assertMatchesSchema(builtCompact, RUNTIME_STATUS_OUTPUT_SCHEMA, "built compact runtime status"));
  assert.deepEqual(builtCompact.enabled_tools, []);
  assert.deepEqual(builtCompact.tool_policy_summary, []);
  assert.equal(Object.prototype.hasOwnProperty.call(builtCompact.tool_surface, "per_tool"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(builtCompact.schema_compatibility, "issues"), false);

  const missingCompatibility = baseRuntimeStatus();
  delete missingCompatibility.compatibility_label;
  const missingCompatResult = validateAgainstSchema(missingCompatibility, RUNTIME_STATUS_OUTPUT_SCHEMA);
  assert.equal(missingCompatResult.success, false);
  assert.ok(missingCompatResult.issues.some((issue) => issue.path === "$.compatibility_label" && issue.message.includes("required")));

  const missingStage = baseRuntimeStatus();
  delete missingStage.stage_status;
  const missingStageResult = validateAgainstSchema(missingStage, RUNTIME_STATUS_OUTPUT_SCHEMA);
  assert.equal(missingStageResult.success, false);
  assert.ok(missingStageResult.issues.some((issue) => issue.path === "$.stage_status" && issue.message.includes("required")));

  const extra = baseRuntimeStatus();
  extra.unplanned_field = true;
  const extraResult = validateAgainstSchema(extra, RUNTIME_STATUS_OUTPUT_SCHEMA);
  assert.equal(extraResult.success, false);
  assert.ok(extraResult.issues.some((issue) => issue.path === "$.unplanned_field" && issue.message.includes("additional")));

  console.log("smoke_output_schema_guard ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
