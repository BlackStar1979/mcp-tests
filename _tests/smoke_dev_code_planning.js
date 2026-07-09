const assert = require("node:assert/strict");
const { buildDependencyGraph, patchPlan, scenarioPlan } = require("../src/util/code_workspace");
const { codePatchPlanTool } = require("../tools/code_patch_plan");
const { codeScenarioTool } = require("../tools/code_scenario");

(async () => {
  const graph = await buildDependencyGraph("src", { recursive: true, maxFiles: 200 });

  const scenario = scenarioPlan(graph, "src/tool_loader.js", "internal_refactor", "both", 5);
  assert.equal(scenario.found, true);
  assert.equal(scenario.target, "src/tool_loader.js");
  assert.ok(["low", "medium", "high"].includes(scenario.risk.level));
  assert.ok(Array.isArray(scenario.context_files));
  assert.ok(Array.isArray(scenario.recommended_checks));

  const plan = patchPlan(graph, "src/tool_loader.js", "refactor", "Add bounded read-only planning tools.", "both", 5);
  assert.equal(plan.scenario.found, true);
  assert.equal(plan.decision.status, "patch_plan_only");
  assert.ok(plan.plan.length >= 2);
  assert.ok(plan.read_plan.length >= 1);
  assert.ok(plan.patch_constraints.includes("anchor must match exactly once"));

  const scenarioToolResult = await codeScenarioTool.execute({
    path: "src",
    target: "src/tool_loader.js",
    change_type: "internal_refactor",
    recursive: true,
    max_files: 200,
    max_depth: 5,
    direction: "both",
  });
  assert.equal(scenarioToolResult.success, true);
  assert.equal(scenarioToolResult.target, "src/tool_loader.js");
  assert.ok(Array.isArray(scenarioToolResult.context_files));

  const patchToolResult = await codePatchPlanTool.execute({
    path: "src",
    target: "src/tool_loader.js",
    intent: "refactor",
    objective: "Extend dev planning surface.",
    recursive: true,
    max_files: 200,
    max_depth: 5,
    direction: "both",
  });
  assert.equal(patchToolResult.success, true);
  assert.equal(patchToolResult.scenario.target, "src/tool_loader.js");
  assert.equal(patchToolResult.decision.status, "patch_plan_only");

  const badScenario = await codeScenarioTool.execute({ path: "src", target: "missing_file.js" });
  assert.equal(badScenario.success, true);
  assert.equal(badScenario.found, false);
  assert.equal(badScenario.risk.level, "unknown");

  const badPlan = await codePatchPlanTool.execute({ path: "src", target: "missing_file.js" });
  assert.equal(badPlan.success, true);
  assert.equal(badPlan.decision.status, "blocked");

  assert.equal(codeScenarioTool.descriptor.name, "code_scenario");
  assert.equal(codePatchPlanTool.descriptor.name, "code_patch_plan");

  console.log("smoke_dev_code_planning ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
