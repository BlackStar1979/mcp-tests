const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");
const { createTestMcpRuntimeStatusTool } = require("../tools/test_mcp_runtime_status");
const { RUNTIME_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/runtime_status");
const { buildRuntimeStatus } = require("../src/runtime_status");
const { assertMatchesSchema, validateAgainstSchema } = require("../src/output_schema_guard");
const { tryHandleOptionalToolCall } = require("../src/runtime/optional_tool_call_handler");
const { applyOutputTrustMetadata } = require("../src/runtime/tool_result");
const { handleCoreFetchToolCall } = require("../src/runtime/core_tool_call_handlers");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadOptionalTools } = require("../src/tool_loader");

assert.equal(validateAgainstSchema({ ok: true }, {
  oneOf: [
    { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean", enum: [true] } } },
    { type: "object", additionalProperties: false, required: ["error"], properties: { error: { type: "string" } } },
  ],
}).success, true);
assert.equal(validateAgainstSchema({ error: "controlled" }, {
  oneOf: [
    { type: "object", additionalProperties: false, required: ["ok"], properties: { ok: { type: "boolean", enum: [true] } } },
    { type: "object", additionalProperties: false, required: ["error"], properties: { error: { type: "string" } } },
  ],
}).success, true);

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
    requestContract: () => ({
      route: "/mcp",
      post_only: true,
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: true,
      transport_mode: "streamable_http_stateless_legacy_initialize_compat",
    }),
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
    request_contract: {
      route: "/mcp",
      post_only: true,
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: true,
      transport_mode: "streamable_http_stateless_legacy_initialize_compat",
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
    oauth21_runtime: null,
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

  const dlpSchema = {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } },
  };
  const invalidOptionalTool = {
    name: "dlp_schema_probe",
    descriptor: { outputSchema: dlpSchema },
    async execute() {
      return { ok: true, unexpected: "TOP_SECRET_SHOULD_NEVER_REACH_MODEL" };
    },
  };
  const dlpAudit = [];
  const rejectedOutput = await tryHandleOptionalToolCall({
    id: 99,
    name: invalidOptionalTool.name,
    args: {},
    context: { requestId: "dlp-schema-red" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: (name) => (name === invalidOptionalTool.name ? invalidOptionalTool : null),
    auditLog: (event, details) => dlpAudit.push({ event, details }),
  });
  assert.equal(rejectedOutput.result?.isError, true, "output that violates outputSchema must be blocked before model exposure");
  assert.equal(JSON.stringify(rejectedOutput).includes("TOP_SECRET_SHOULD_NEVER_REACH_MODEL"), false);
  assert.ok(dlpAudit.some((entry) => entry.event === "tool_output_policy_denied"));

  const patternTool = {
    name: "dlp_pattern_probe",
    descriptor: {
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["status"],
        properties: { status: { type: "string", pattern: "^safe$" } },
      },
    },
    async execute() {
      return { status: "unsafe" };
    },
  };
  const patternRejected = await tryHandleOptionalToolCall({
    id: 100,
    name: patternTool.name,
    args: {},
    context: { requestId: "dlp-pattern-red" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: (name) => (name === patternTool.name ? patternTool : null),
    auditLog: () => {},
  });
  assert.equal(patternRejected.result?.isError, true, "full outputSchema semantics must be enforced, including pattern");

  const optionalUndefinedTool = {
    name: "dlp_optional_undefined_probe",
    descriptor: {
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["ok"],
        properties: {
          ok: { type: "boolean" },
          hint: { type: "string" },
        },
      },
    },
    async execute() {
      return { ok: true, hint: undefined };
    },
  };
  const optionalUndefinedResult = await tryHandleOptionalToolCall({
    id: 1001,
    name: optionalUndefinedTool.name,
    args: {},
    context: { requestId: "dlp-optional-undefined-red" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: (name) => (name === optionalUndefinedTool.name ? optionalUndefinedTool : null),
    auditLog: () => {},
  });
  assert.equal(optionalUndefinedResult.result?.isError, undefined, "undefined optional object properties must follow JSON serialization semantics and be omitted");
  assert.equal(Object.hasOwn(optionalUndefinedResult.result?.structuredContent || {}, "hint"), false);

  const secretTool = {
    name: "dlp_secret_probe",
    descriptor: {
      outputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["ok", "access_token", "message"],
        properties: {
          ok: { type: "boolean" },
          access_token: { type: "string" },
          message: { type: "string" },
        },
      },
    },
    async execute() {
      return {
        ok: true,
        access_token: "raw-access-token-value",
        message: "Authorization: Bearer bearer-secret-value-1234567890",
      };
    },
  };
  const secretAudit = [];
  const secretResult = await tryHandleOptionalToolCall({
    id: 101,
    name: secretTool.name,
    args: {},
    context: { requestId: "dlp-secret-red" },
    startedAt: Date.now(),
    outputMode: "structured",
    getOptionalTool: (name) => (name === secretTool.name ? secretTool : null),
    auditLog: (event, details) => secretAudit.push({ event, details }),
  });
  const serializedSecretResult = JSON.stringify(secretResult);
  assert.equal(secretResult.result?.isError, undefined, "redactable schema-valid output should remain a successful tool result");
  assert.equal(serializedSecretResult.includes("raw-access-token-value"), false);
  assert.equal(serializedSecretResult.includes("bearer-secret-value-1234567890"), false);
  assert.equal(secretResult.result?.structuredContent?.access_token, "[REDACTED_SECRET]");
  assert.equal(secretResult.result?._meta?.["mcp-tests/outputTrust"], "untrusted_tool_output");
  assert.equal(secretResult.result?.content?.[0]?._meta?.["mcp-tests/outputTrust"], "untrusted_tool_output");
  const redactionAudit = secretAudit.find((entry) => entry.event === "tool_output_redacted");
  assert.ok(redactionAudit, "redaction must emit bounded audit counts");
  assert.equal(redactionAudit.details.redacted_secret_count, 2);
  assert.equal(JSON.stringify(secretAudit).includes("raw-access-token-value"), false);
  assert.equal(JSON.stringify(secretAudit).includes("bearer-secret-value-1234567890"), false);

  assert.throws(() => applyOutputTrustMetadata({
    content: [{
      type: "resource_link",
      uri: "https://evil.example/untrusted",
      name: "evil",
    }],
  }), /output_resource_link_denied/);

  const embeddedSecret = "embedded-bearer-secret-1234567890";
  const embeddedTextResult = applyOutputTrustMetadata({
    content: [{
      type: "resource",
      resource: {
        uri: "file:///untrusted.txt",
        mimeType: "text/plain",
        text: `Authorization: Bearer ${embeddedSecret}`,
      },
    }],
  });
  assert.equal(JSON.stringify(embeddedTextResult).includes(embeddedSecret), false);
  assert.equal(embeddedTextResult.content[0]._meta["mcp-tests/outputTrust"], "untrusted_tool_output");
  assert.throws(() => applyOutputTrustMetadata({
    content: [{
      type: "resource",
      resource: { uri: "file:///opaque.bin", mimeType: "application/octet-stream", blob: "QUJDRA==" },
    }],
  }), /output_embedded_resource_blob_denied/);

  const coreSecret = "core-fetch-secret-1234567890";
  const coreFetchResult = handleCoreFetchToolCall({
    id: 102,
    context: { requestId: "dlp-core-fetch-red" },
    args: { id: "secret-doc" },
    startedAt: Date.now(),
    outputMode: "structured",
    documentRuntimeContext: () => ({
      docs: [{ id: "secret-doc", title: "Secret doc", text: `Authorization: Bearer ${coreSecret}`, metadata: {} }],
      publicBaseUrl: "https://example.test",
      maxFetchTextChars: 2500,
      connectorShapeVersion: "2025-05-strict-v1",
    }),
    auditLog: () => {},
    getOptionalTool: () => null,
  });
  assert.equal(JSON.stringify(coreFetchResult).includes(coreSecret), false, "core fetch structuredContent must pass through DLP redaction");

  const coreDlpAudit = [];
  const coreSchemaRejected = handleCoreFetchToolCall({
    id: 103,
    context: { requestId: "dlp-core-schema-red" },
    args: { id: "secret-doc" },
    startedAt: Date.now(),
    outputMode: "structured",
    outputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { const: "different-doc" } },
    },
    documentRuntimeContext: () => ({
      docs: [{ id: "secret-doc", title: "Secret doc", text: "safe text", metadata: {} }],
      publicBaseUrl: "https://example.test",
      maxFetchTextChars: 2500,
      connectorShapeVersion: "2025-05-strict-v1",
    }),
    auditLog: (event, details) => coreDlpAudit.push({ event, details }),
    getOptionalTool: () => null,
  });
  assert.equal(coreSchemaRejected.result?.isError, true, "core outputSchema mismatch must be rejected as a tool error");
  assert.ok(coreDlpAudit.some((entry) => entry.event === "tool_output_policy_denied"));

  const activeDescriptors = [
    ...buildCoreToolDescriptors({
      connectorShapeVersion: "2025-05-strict-v1",
      outputMode: "structured",
      maxFetchTextChars: 2500,
    }),
    ...loadOptionalTools({
      profile: "internal",
      authMode: "oauth21",
      authPolicy: { requiresAuth: true },
      memoryToolsEnabled: true,
    }).map((tool) => tool.descriptor),
  ];
  const placeholderOutputSchemas = activeDescriptors
    .filter((descriptor) => {
      const schema = descriptor?.outputSchema;
      return schema?.type === "object"
        && schema.additionalProperties === false
        && Array.isArray(schema.required)
        && schema.required.length === 0
        && schema.properties
        && Object.keys(schema.properties).length === 0;
    })
    .map((descriptor) => descriptor.name);
  assert.deepEqual(placeholderOutputSchemas, [], "active output schemas must not advertise an impossible empty closed-object placeholder");

  console.log("smoke_output_schema_guard ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
