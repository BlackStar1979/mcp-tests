const assert = require("node:assert/strict");
const { CURRENT_STAGE_STATUS, CURRENT_COMPATIBILITY_LABEL } = require("../src/stage_metadata");
const path = require("node:path");
const { buildObservabilityStatus } = require("../src/observability_status");

const auditLogPath = path.join(__dirname, "fixtures", "observability_self_observation_fixture.jsonl");

const runtimeStatus = {
  server_version: "0.40.0",
  compatibility_label: CURRENT_COMPATIBILITY_LABEL,
  stage_status: CURRENT_STAGE_STATUS,
  auth: { mode: "none" },
  profile: { mode: "public" },
  enabled_tools: ["dev_code_symbols", "observability_status"],
  security_boundary: { status: "ok" },
};

const status = buildObservabilityStatus({
  args: {
    window_size: 10,
    slow_ms: 1000,
    top_n: 5,
    connector_visible_tools: ["dev_code_symbols", "observability_status"],
  },
  runtimeStatusProvider: () => runtimeStatus,
  auditLogPath,
});

assert.equal(status.success, true);
assert.equal(status.tool_call_balance.starts, 2);
assert.equal(status.tool_call_balance.ends, 0);
assert.equal(status.tool_call_balance.orphan_start_count, 1);
assert.equal(status.tool_call_balance.orphan_start_samples[0].tool, "dev_code_symbols");
assert.equal(status.tool_call_balance.self_observation_inflight_count, 1);
assert.equal(status.tool_call_balance.self_observation_inflight_samples[0].tool, "observability_status");
assert.equal(status.tool_call_balance.self_observation_inflight_samples[0].classification, "self_observation_inflight");
assert.equal(status.stream_break_diagnostics.indicators.orphan_tool_call_starts, 1);
assert.equal(status.stream_break_diagnostics.indicators.self_observation_inflight, 1);
assert.ok(status.recommended_actions.some((item) => item.includes("orphan tool_call_start")));

console.log("smoke_observability_self_observation ok");
