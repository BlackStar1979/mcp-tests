const { getWorkflowProgressMarkers } = require("./project_truth_audit");

function normalizeChangedPaths(changedPaths) {
  if (!Array.isArray(changedPaths)) return [];
  return changedPaths.map((item) => String(item || "").trim().replace(/\\/g, "/").replace(/^\.\/+/, ""));
}

function isRepoPath(pathValue, repoPath) {
  return pathValue === repoPath || pathValue.endsWith(`/${repoPath}`);
}

function isRepoDescendant(pathValue, directory) {
  return pathValue === directory || pathValue.endsWith(`/${directory}`) || pathValue.startsWith(`${directory}/`) || pathValue.includes(`/${directory}/`);
}

function isCompatibilityMetadataPath(pathValue) {
  return isRepoPath(pathValue, "src/stage_metadata.js");
}

function isRuntimeImportedPath(pathValue) {
  if (pathValue.endsWith(".md")) return false;
  if (isRepoPath(pathValue, "server.js")) return true;
  if (["src", "tools", "profiles", "plugins"].some((directory) => isRepoDescendant(pathValue, directory))) return true;
  const basename = pathValue.slice(pathValue.lastIndexOf("/") + 1);
  return /^SERVER_[A-Z0-9_]+_SPEC\.json$/.test(basename) || basename === "package.json" || basename === "package-lock.json";
}

function isDocumentationPath(pathValue) {
  return pathValue.endsWith(".md") || isRepoDescendant(pathValue, "_workflow") || isRepoDescendant(pathValue, "_docs") || isRepoDescendant(pathValue, "docs");
}

function isTestPath(pathValue) {
  return isRepoDescendant(pathValue, "_tests");
}

function classifyChange(changedPaths, flags = {}) {
  const paths = normalizeChangedPaths(changedPaths);
  const descriptorChange = Boolean(flags.descriptor_change);
  const schemaChange = Boolean(flags.schema_change);
  const toolSurfaceChange = Boolean(flags.tool_surface_change);
  const compatibilityMetadataChange = paths.some(isCompatibilityMetadataPath);
  const runtimeChange = paths.some(isRuntimeImportedPath);
  const docsOnly = paths.length > 0 && paths.every(isDocumentationPath);
  const testsOnly = paths.length > 0 && paths.every(isTestPath);

  if (descriptorChange || schemaChange || toolSurfaceChange) return "runtime_with_connector_refresh";
  if (compatibilityMetadataChange) return "runtime_status_restart_required";
  if (runtimeChange) return "runtime_restart_required";
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
    version: "test-mcp-internal-change-workflow-simulator-v2",
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
  const normalizedPaths = normalizeChangedPaths(changedPaths);
  const descriptorChange = Boolean(flags.descriptor_change);
  const schemaChange = Boolean(flags.schema_change);
  const toolSurfaceChange = Boolean(flags.tool_surface_change);
  const reasons = [];

  if (descriptorChange) reasons.push("descriptor metadata changed");
  if (schemaChange) reasons.push("schema contract changed");
  if (toolSurfaceChange) reasons.push("connector-visible tool surface changed");
  if (normalizedPaths.some(isRuntimeImportedPath)) reasons.push("runtime-imported code changed");
  if (normalizedPaths.length > 0 && normalizedPaths.every(isDocumentationPath)) reasons.push("workflow/docs only change");
  if (normalizedPaths.length > 0 && normalizedPaths.every(isTestPath)) reasons.push("tests-only change");
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
    guard_version: "test-mcp-deploy-decision-guard-v2",
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
