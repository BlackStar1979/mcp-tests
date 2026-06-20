const assert = require("node:assert/strict");
const { auditToolSchemas, buildToolSurfaceFingerprint } = require("../src/schema_compat");
const { buildRuntimeStatus } = require("../src/runtime_status");

const tools = [
  {
    name: "beta",
    title: "Beta",
    description: "Beta tool.",
    inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"], additionalProperties: false },
    outputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "alpha",
    title: "Alpha",
    description: "Alpha tool.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    outputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
];

const reversed = tools.slice().reverse();
const fp = buildToolSurfaceFingerprint(tools);
const fpReversed = buildToolSurfaceFingerprint(reversed);
assert.deepEqual(fp, fpReversed);
assert.equal(fp.tool_count, 2);
assert.deepEqual(fp.tool_names, ["alpha", "beta"]);
assert.equal(typeof fp.tool_names_hash, "string");
assert.equal(typeof fp.input_schema_fingerprint, "string");
assert.equal(typeof fp.output_schema_fingerprint, "string");
assert.equal(typeof fp.descriptor_fingerprint, "string");
assert.equal(typeof fp.combined_fingerprint, "string");
assert.equal(fp.per_tool.length, 2);
assert.ok(fp.per_tool.every((item) => typeof item.input_schema_hash === "string"));
assert.ok(fp.per_tool.every((item) => typeof item.output_schema_hash === "string"));
assert.ok(fp.per_tool.every((item) => typeof item.descriptor_hash === "string"));

const schemaAudit = auditToolSchemas(tools);
assert.equal(schemaAudit.success, true);
assert.equal(typeof schemaAudit.schema_fingerprint, "string");

const status = buildRuntimeStatus({
  serverName: "test",
  serverVersion: "0.0.0",
  connectorShapeVersion: "shape",
  outputMode: "structured",
  publicBaseUrl: "https://example.test",
  host: "127.0.0.1",
  port: 1,
  authPolicy: { status: () => ({ mode: "none" }) },
  auditVersion: "audit",
  auditLogPath: "redacted",
  maxFetchTextChars: 100,
  stageStatus: "stage-test",
  securityBoundary: () => ({ status: "ok" }),
  profile: "public",
  profilePolicy: () => ({ ok: true }),
  toolPolicySummary: () => [],
  enabledTools: () => tools.map((tool) => tool.name),
  toolSurfaceFingerprint: () => fp,
  schemaCompatibility: () => schemaAudit,
  network: { envFlagEnabled: () => false, getAllowedDomains: () => [], getTimeoutMs: () => 0, getMaxBytes: () => 0 },
  fs: { envFlagEnabled: () => false, getPublicFsRoot: () => "", getPublicFsMaxFileBytes: () => 0, getPublicFsMaxTextChars: () => 0, getPublicFsMaxListEntries: () => 0 },
});

assert.deepEqual(status.tool_surface, fp);
assert.deepEqual(status.schema_compatibility, schemaAudit);

console.log("smoke_stage8_18_tool_surface_fingerprints ok");
