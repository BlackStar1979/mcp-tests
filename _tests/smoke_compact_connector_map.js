const assert = require("node:assert/strict");
const { buildObservabilityStatus } = require("../src/observability_status");
const { buildToolSurfaceFingerprint } = require("../src/schema_compat");

const tools = [
  { name: "alpha", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "beta", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
];
const enabledTools = tools.map((tool) => tool.name);
const toolSurface = buildToolSurfaceFingerprint(tools);

function statusWith(args) {
  return buildObservabilityStatus({
    args: { window_size: 1, slow_ms: 1000, top_n: 5, ...args },
    auditLogPath: "./missing-audit-log-for-compact-map-test.jsonl",
    runtimeStatusProvider: () => ({
      server_version: "0.40.0",
      stage_status: "stage8_18a-compact-connector-map",
      auth: { mode: "none" },
      profile: { mode: "public" },
      enabled_tools: enabledTools,
      tool_surface: toolSurface,
      security_boundary: { status: "ok" },
    }),
  });
}

const inSync = statusWith({
  connector_tool_count: 2,
  connector_tool_names_hash: toolSurface.tool_names_hash,
});
assert.equal(inSync.connector_map.status, "in_sync");
assert.equal(inSync.connector_map.comparison_available, true);
assert.equal(inSync.connector_map.comparison_mode, "compact_hash");
assert.equal(inSync.connector_map.runtime_tool_count, 2);
assert.equal(inSync.connector_map.connector_tool_count, 2);
assert.equal(inSync.connector_map.tool_count_matches, true);
assert.equal(inSync.connector_map.tool_names_hash_matches, true);
assert.equal(inSync.connector_map.refresh_recommended, false);

const driftByCount = statusWith({
  connector_tool_count: 1,
  connector_tool_names_hash: toolSurface.tool_names_hash,
});
assert.equal(driftByCount.connector_map.status, "drift_detected");
assert.equal(driftByCount.connector_map.tool_count_matches, false);
assert.equal(driftByCount.connector_map.tool_names_hash_matches, true);
assert.equal(driftByCount.connector_map.refresh_recommended, true);

const driftByHash = statusWith({
  connector_tool_count: 2,
  connector_tool_names_hash: "0000000000000000",
});
assert.equal(driftByHash.connector_map.status, "drift_detected");
assert.equal(driftByHash.connector_map.tool_count_matches, true);
assert.equal(driftByHash.connector_map.tool_names_hash_matches, false);
assert.equal(driftByHash.connector_map.refresh_recommended, true);

const noExternal = statusWith({});
assert.equal(noExternal.connector_map.status, "external_connector_tool_map_not_provided");
assert.equal(noExternal.connector_map.comparison_mode, "none");
assert.match(noExternal.connector_map.note, /connector_tool_count/);

console.log("smoke_compact_connector_map ok");
