const { getWorkflowProgressMarkers } = require("./project_truth_audit");

function classifyChange(changedPaths, flags = {}) {
  const paths = Array.isArray(changedPaths) ? changedPaths : [];
  const descriptorChange = Boolean(flags.descriptor_change);
  const schemaChange = Boolean(flags.schema_change);
  const toolSurfaceChange = Boolean(flags.tool_surface_change);
  const compatibilityMetadataChange = paths.some((item) => item === "src/stage_metadata.js" || item.endsWith("/src/stage_metadata.js"));
  const runtimeChange = paths.some((item) => item === "server.js" || item.startsWith("src/runtime/") || item.endsWith("/server.js") || item.includes("/src/runtime/"));
  const docsOnly = paths.length > 0 && paths.every((item) => item.startsWith("_workflow/") || item.startsWith("_docs/") || item.endsWith(".md"));
  const testsOnly = paths.length > 0 && paths.every((item) => item.startsWith("_tests/"));

  if (descriptorChange || schemaChange || toolSurfaceChange) return "runtime_with_connector_refresh";
  if (runtimeChange) return "runtime_restart_required";
  if (compatibilityMetadataChange) return "runtime_status_restart_required";
  if (docsOnly || testsOnly) return "repo_only";
  return "repo_or_internal_source";
}

function simulateChangeWorkflow(changedPaths, flags = {}) {
  const workflowProgressMarkers = getWorkflowProgressMarkers();
  const classification = classifyChange(changedPaths, flags);
  const workflow = ["read PREFLIGHT", "inspect current repo/runtime truth", "make bounded changes", "run targeted validation", "run full smoke"];

  if (classification === "runtime_status_restart_required") {
    workflow.push("restart TEST MCP for live compatibility-label truth");
    workflow.push("validate current_working_course and fingerprints");
  }
  if (classification === "runtime_restart_required") {
    workflow.push("restart TEST MCP");
    workflow.push("validate live runtime, tool surface, schemas, descriptors, and fingerprints");
  }
  if (classification === "runtime_with_connector_refresh") {
    workflow.push("stop for explicit operator approval");
    workflow.push("restart TEST MCP");
    workflow.push("manual connector refresh/review required");
  }

  return {
    version: "test-mcp-internal-change-workflow-simulator-v1",
    read_only: true,
    connector_visible: false,
    current_working_course: workflowProgressMarkers.current_working_course,
    next_primary: workflowProgressMarkers.next_primary,
    next_secondary: workflowProgressMarkers.next_secondary,
    changed_paths: changedPaths,
    flags: {
      descriptor_change: Boolean(flags.descriptor_change),
      schema_change: Boolean(flags.schema_change),
      tool_surface_change: Boolean(flags.tool_surface_change),
    },
    classification,
    workflow,
  };
}

function buildDeployDecisionGuard(changedPaths, flags = {}) {
  const workflowProgressMarkers = getWorkflowProgressMarkers();
  const classification = classifyChange(changedPaths, flags);
  const normalizedPaths = Array.isArray(changedPaths) ? changedPaths.map((item) => String(item || "")) : [];
  const descriptorChange = Boolean(flags.descriptor_change);
  const schemaChange = Boolean(flags.schema_change);
  const toolSurfaceChange = Boolean(flags.tool_surface_change);
  const reasons = [];

  if (descriptorChange) reasons.push("descriptor metadata changed");
  if (schemaChange) reasons.push("schema contract changed");
  if (toolSurfaceChange) reasons.push("connector-visible tool surface changed");
  if (normalizedPaths.some((item) => item === "server.js" || item.startsWith("src/runtime/"))) reasons.push("runtime-imported code changed");
  if (normalizedPaths.every((item) => item.startsWith("_workflow/") || item.startsWith("_docs/") || item.endsWith(".md"))) reasons.push("workflow/docs only change");
  if (normalizedPaths.every((item) => item.startsWith("_tests/"))) reasons.push("tests-only change");
  if (!reasons.length) reasons.push("internal or mixed repo source change");

  const workflow = ["read PREFLIGHT", "inspect current repo/runtime truth", "make bounded changes", "run targeted validation", "run full smoke"];
  const requiresRestart = classification === "runtime_status_restart_required" || classification === "runtime_restart_required" || classification === "runtime_with_connector_refresh";
  const requiresRefresh = classification === "runtime_with_connector_refresh";
  const requiresOperatorApproval = classification === "runtime_with_connector_refresh";

  if (classification === "runtime_status_restart_required") {
    workflow.push("restart TEST MCP for live compatibility-label truth");
    workflow.push("validate current_working_course and fingerprints");
  }
  if (classification === "runtime_restart_required") {
    workflow.push("restart TEST MCP");
    workflow.push("validate live runtime, tool surface, schemas, descriptors, and fingerprints");
  }
  if (classification === "runtime_with_connector_refresh") {
    workflow.push("stop for explicit operator approval");
    workflow.push("restart TEST MCP");
    workflow.push("manual connector refresh/review required");
  }

  return {
    status: "ok",
    guard_version: "test-mcp-deploy-decision-guard-v1",
    current_working_course: workflowProgressMarkers.current_working_course,
    next_primary: workflowProgressMarkers.next_primary,
    next_secondary: workflowProgressMarkers.next_secondary,
    changed_paths: normalizedPaths,
    flags: {
      descriptor_change: descriptorChange,
      schema_change: schemaChange,
      tool_surface_change: toolSurfaceChange,
    },
    classification,
    requires_restart_mcp: requiresRestart,
    requires_connector_refresh: requiresRefresh,
    requires_operator_approval: requiresOperatorApproval,
    workflow,
    reasons,
  };
}

module.exports = {
  buildDeployDecisionGuard,
  classifyChange,
  simulateChangeWorkflow,
};
