"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { projectTruthAuditTool } = require("../tools/project_truth_audit");
const { codeRuntimeMapTool } = require("../tools/code_runtime_map");
const { deployDecisionGuardTool } = require("../tools/deploy_decision_guard");
const { changeWorkflowSimulatorTool } = require("../tools/change_workflow_simulator");
const { toolUsageSnapshotTool } = require("../tools/tool_usage_snapshot");
const { buildToolUsageSnapshot } = require("../src/truth/tool_usage_snapshot");

const ROOT = path.resolve(__dirname, "..");
const state = JSON.parse(fs.readFileSync(path.join(ROOT, "_workflow", "state.json"), "utf8"));
const workflowMarkers = state.workflow_progress_markers;

(async () => {
  const truthAudit = await projectTruthAuditTool.execute({});
  assert.equal(projectTruthAuditTool.name, "project_truth_audit");
  assert.equal(projectTruthAuditTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(truthAudit.current.current_working_course, workflowMarkers.current_working_course);
  assert.equal(truthAudit.current.next_primary, workflowMarkers.next_primary);
  assert.equal(truthAudit.current.next_secondary, workflowMarkers.next_secondary);
  assert.equal(Array.isArray(truthAudit.findings), true);
  assert.deepEqual(truthAudit.findings, []);

  const runtimeMap = await codeRuntimeMapTool.execute({});
  assert.equal(runtimeMap.stage_plan.current, workflowMarkers.current_working_course);
  assert.equal(runtimeMap.stage_plan.next_primary, workflowMarkers.next_primary);
  assert.equal(runtimeMap.stage_plan.next_secondary, workflowMarkers.next_secondary);
  assert.ok(runtimeMap.planned_truth_modules.includes("src/truth/project_truth_audit.js"));
  assert.equal(runtimeMap.runtime_entrypoints[0].planned_stage, "8.53c");
  assert.ok(runtimeMap.invariant.includes("Stage 8 / Step 53c"));

  const simulation = await changeWorkflowSimulatorTool.execute({
    changed_paths: ["_workflow/WORKFLOW_CANON.md"],
  });
  assert.equal(simulation.current_working_course, workflowMarkers.current_working_course);
  assert.equal(simulation.next_primary, workflowMarkers.next_primary);
  assert.equal(simulation.next_secondary, workflowMarkers.next_secondary);
  assert.equal(simulation.classification, "repo_only");
  assert.ok(simulation.workflow.includes("run full smoke"));

  const decision = await deployDecisionGuardTool.execute({
    changed_paths: ["tools/project_truth_audit.js"],
    tool_surface_change: true,
  });
  assert.equal(decision.current_working_course, workflowMarkers.current_working_course);
  assert.equal(decision.next_primary, workflowMarkers.next_primary);
  assert.equal(decision.next_secondary, workflowMarkers.next_secondary);
  assert.equal(decision.classification, "runtime_with_connector_refresh");
  assert.equal(decision.requires_restart_mcp, true);
  assert.equal(decision.requires_connector_refresh, true);
  assert.equal(decision.requires_operator_approval, true);

  const missing = buildToolUsageSnapshot({ auditLogPath: path.join(os.tmpdir(), "missing-test-mcp-audit.jsonl") });
  assert.equal(missing.log_available, false);
  assert.equal(missing.total_tool_invocations, 0);

  const tempLog = path.join(os.tmpdir(), `mcp-tests-truth-tools-${process.pid}.jsonl`);
  try {
    fs.writeFileSync(tempLog, [
      JSON.stringify({ ts: "2026-07-04T10:00:00Z", event: "tool_call_start", tool: "project_truth_audit" }),
      JSON.stringify({ ts: "2026-07-04T10:00:01Z", event: "tool_call_start", tool: "net_check_npm_package" }),
      JSON.stringify({ ts: "2026-07-04T10:00:02Z", event: "tool_call_start", tool: "plugin_registry_status" }),
    ].join("\n"));
    const snapshot = buildToolUsageSnapshot({ auditLogPath: tempLog });
    assert.equal(snapshot.log_available, true);
    assert.equal(snapshot.total_tool_invocations, 3);
    assert.equal(snapshot.family_counts.truth_tools, 1);
    assert.equal(snapshot.family_counts.web_tools, 1);
    assert.equal(snapshot.family_counts.registry_tools, 1);
  } finally {
    try {
      fs.unlinkSync(tempLog);
    } catch (_) {}
  }

  assert.equal(toolUsageSnapshotTool.descriptor.annotations.readOnlyHint, true);
  console.log("smoke_truth_tools ok");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
