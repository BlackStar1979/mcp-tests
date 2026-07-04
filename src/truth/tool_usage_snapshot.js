const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_AUDIT_LOG_PATH = path.resolve(__dirname, "..", "..", ".mcp-tests-audit.jsonl");
const WEB_TOOLS = new Set([
  "net_http_get_allowlisted",
  "net_fetch_text_allowlisted",
  "net_check_url_head",
  "net_fetch_github_raw",
  "net_check_npm_package",
  "net_check_pypi_package",
]);
const TRUTH_TOOLS = new Set([
  "project_truth_audit",
  "code_runtime_map",
  "deploy_decision_guard",
  "change_workflow_simulator",
  "tool_usage_snapshot",
]);
const PROCESS_TOOLS = new Set([]);
const REGISTRY_TOOLS = new Set([
  "plugin_registry_status",
  "plugin_registry_list",
  "plugin_registry_get",
  "plugin_registry_audit",
  "plugin_catalog_search",
  "plugin_catalog_describe",
  "plugin_execution_preflight",
  "plugin_execute_readonly",
  "plugin_execution_governance",
  "plugin_execution_verify_receipt",
]);

function buildToolUsageSnapshot(options = {}) {
  const auditLogPath = options.auditLogPath || DEFAULT_AUDIT_LOG_PATH;
  let text = "";
  let logAvailable = true;

  try {
    text = fs.readFileSync(auditLogPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      logAvailable = false;
      text = "";
    } else {
      throw error;
    }
  }

  const lines = text.split(/\r?\n/).filter(Boolean);
  const toolEntries = lines
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((entry) => entry && (entry.event === "tool_call_start" || entry.type === "tool") && typeof (entry.tool || entry.name) === "string");

  const counts = new Map();
  let truthCount = 0;
  let processCount = 0;
  let registryCount = 0;
  let webCount = 0;
  let otherCount = 0;

  for (const entry of toolEntries) {
    const toolName = String(entry.tool || entry.name || "unknown");
    counts.set(toolName, (counts.get(toolName) || 0) + 1);

    if (TRUTH_TOOLS.has(toolName)) truthCount += 1;
    else if (PROCESS_TOOLS.has(toolName)) processCount += 1;
    else if (REGISTRY_TOOLS.has(toolName)) registryCount += 1;
    else if (WEB_TOOLS.has(toolName)) webCount += 1;
    else otherCount += 1;
  }

  const sortedCounts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  const notes = [];
  if (!logAvailable) {
    notes.push("audit log is not present in this environment; returning an empty observed-usage snapshot");
  }
  if (truthCount > 0) {
    notes.push("truth tools appear in recent observed usage");
  }
  if (webCount > 0) {
    notes.push("network usage remains bounded to allowlisted metadata/fetch tools");
  }
  if (!sortedCounts.some((item) => item.name === "download_docs")) {
    notes.push("no evidence of demand for a broader docs-downloading tool appears in the local audit window");
  }

  return {
    status: "ok",
    snapshot_version: "test-mcp-tool-usage-snapshot-v1",
    source_log: path.basename(auditLogPath),
    log_available: logAvailable,
    total_tool_invocations: toolEntries.length,
    unique_tool_count: sortedCounts.length,
    time_window: {
      first_ts: toolEntries.length ? String(toolEntries[0].ts || null) : null,
      last_ts: toolEntries.length ? String(toolEntries[toolEntries.length - 1].ts || null) : null,
    },
    top_tools: sortedCounts.slice(0, 10),
    family_counts: {
      truth_tools: truthCount,
      process_tools: processCount,
      registry_tools: registryCount,
      web_tools: webCount,
      other_tools: otherCount,
    },
    web_tool_counts: sortedCounts.filter((item) => WEB_TOOLS.has(item.name)),
    notes,
  };
}

module.exports = {
  DEFAULT_AUDIT_LOG_PATH,
  buildToolUsageSnapshot,
};
