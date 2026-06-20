const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS } = require("../src/stage_metadata");
const { createObservabilityStatusTool } = require("../tools/observability_status");
const { buildObservabilityStatus } = require("../src/observability_status");
const { OBSERVABILITY_STATUS_OUTPUT_SCHEMA } = require("../src/schemas/observability_tools");
const { assertMatchesSchema, validateAgainstSchema } = require("../src/output_schema_guard");

function runtimeStatus() {
  return {
    server_version: "0.30.0",
    stage_status: CURRENT_STAGE_STATUS,
    auth: { mode: "none" },
    profile: { mode: "public" },
    enabled_tools: ["a", "b"],
    tool_surface: { tool_count: 2, tool_names_hash: "abc123abc123" },
    security_boundary: { status: "ok" },
  };
}

(async () => {
  const payload = buildObservabilityStatus({
    args: { window_size: 1, slow_ms: 1000, top_n: 5, connector_tool_count: 2 },
    auditLogPath: "./missing-audit-log-for-observability-schema-test.jsonl",
    runtimeStatusProvider: runtimeStatus,
  });
  assert.doesNotThrow(() => assertMatchesSchema(payload, OBSERVABILITY_STATUS_OUTPUT_SCHEMA, "observability status"));
  assert.equal(payload.success, true);
  assert.equal(payload.connector_map.comparison_mode, "compact_count");

  const fallbackTool = createObservabilityStatusTool({
    runtimeStatusProvider: () => {
      throw new Error("forced runtime status failure");
    },
    auditLogPath: "./missing-audit-log-for-observability-schema-test.jsonl",
  });
  const fallback = await fallbackTool.execute({});
  assert.equal(fallback.success, false);
  assert.match(fallback.error, /forced runtime status failure/);
  assert.doesNotThrow(() => assertMatchesSchema(fallback, OBSERVABILITY_STATUS_OUTPUT_SCHEMA, "observability fallback"));

  const missing = { ...payload };
  delete missing.stage;
  const missingResult = validateAgainstSchema(missing, OBSERVABILITY_STATUS_OUTPUT_SCHEMA);
  assert.equal(missingResult.success, false);
  assert.ok(missingResult.issues.some((issue) => issue.path === "$.stage" && issue.message.includes("required")));

  const extra = { ...payload, unplanned_field: true };
  const extraResult = validateAgainstSchema(extra, OBSERVABILITY_STATUS_OUTPUT_SCHEMA);
  assert.equal(extraResult.success, false);
  assert.ok(extraResult.issues.some((issue) => issue.path === "$.unplanned_field" && issue.message.includes("additional")));

  console.log("smoke_stage8_22_observability_output_schema ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
