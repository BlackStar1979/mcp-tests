const { EXPECTED } = require("./project_truth_audit");

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
    current_working_course: EXPECTED.current_working_course,
    next_primary: EXPECTED.next_primary,
    next_secondary: EXPECTED.next_secondary,
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

module.exports = {
  classifyChange,
  simulateChangeWorkflow,
};
