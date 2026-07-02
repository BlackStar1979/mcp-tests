const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pluginVisibilityPlanTool } = require("../tools/plugin_visibility_plan");
const { pluginVisibilityStatusTool } = require("../tools/plugin_visibility_status");
const {
  GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA,
  PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA,
  PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA,
} = require("../src/schemas/plugin_visibility_tools");
const { assertMatchesSchema } = require("../src/output_schema_guard");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

assert.equal(PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA.additionalProperties, false);
assert.equal(PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA.additionalProperties, false);
assert.ok(Array.isArray(PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA.required));
assert.ok(Array.isArray(PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA.required));
assert.ok(PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA.required.includes("state_overlay"));
assert.ok(PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA.required.includes("planned_diff"));
assert.ok(PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA.required.includes("candidate_tools"));
assert.ok(PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA.required.includes("candidate_by_state"));

assert.deepEqual(pluginVisibilityPlanTool.descriptor.outputSchema, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA);
assert.deepEqual(pluginVisibilityStatusTool.descriptor.outputSchema, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA);
assert.notDeepEqual(pluginVisibilityPlanTool.descriptor.outputSchema, GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA);
assert.notDeepEqual(pluginVisibilityStatusTool.descriptor.outputSchema, GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA);

const planWrapper = read("tools/plugin_visibility_plan.js");
const statusWrapper = read("tools/plugin_visibility_status.js");
assert.equal(planWrapper.includes("GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA"), false);
assert.equal(statusWrapper.includes("GENERIC_PLUGIN_VISIBILITY_OUTPUT_SCHEMA"), false);
assert.ok(planWrapper.includes("PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA"));
assert.ok(statusWrapper.includes("PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA"));

(async () => {
  const plan = await pluginVisibilityPlanTool.execute({
    tool_name: "plugin_sample_echo_preview",
    target_state: "enabled",
  });
  const status = await pluginVisibilityStatusTool.execute({});

  assert.doesNotThrow(() => assertMatchesSchema(plan, PLUGIN_VISIBILITY_PLAN_OUTPUT_SCHEMA, "plan pair guard"));
  assert.doesNotThrow(() => assertMatchesSchema(status, PLUGIN_VISIBILITY_STATUS_OUTPUT_SCHEMA, "status pair guard"));
  assert.equal(plan.real_mutation_enabled, false);
  assert.equal(plan.execute_allowed_now, false);
  assert.equal(status.tool_surface_mutation_enabled, false);
  assert.equal(status.visible_candidate_tool_count, 0);
  assert.equal(status.executable_candidate_tool_count, 0);

  console.log("smoke_plugin_visibility_schema_pair_descriptor_guard ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
