const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { CURRENT_STAGE_STATUS } = require("./stage_metadata");
const { assessAuditExportSafety } = require("./audit_export_safety");

const OBSERVABILITY_VERSION = "test-mcp-observability-v1";
const DEFAULT_WINDOW_SIZE = 800;
const MAX_WINDOW_SIZE = 5000;
const DEFAULT_SLOW_MS = 1000;
const DEFAULT_TOP_N = 20;

const ABSOLUTE_PATH_RE = /(?:[a-zA-Z]:[\\/][^\s"'<>|]+|\\\\[^\s"'<>|]+[\\/][^\s"'<>|]+|\/(?:home|mnt|var|tmp|etc|usr|opt|work|workspace)\/[^\s"'<>|]+)/;
const RELATIVE_PATH_RE = /(?:^|[\s"'=:])(?:\.\.?[\\/]|[A-Za-z0-9_.-]+[\\/])[A-Za-z0-9_.@+\-\\/]+\.[A-Za-z0-9]{1,12}(?:$|[\s"',;])/;
const SENSITIVE_PATH_HINT_RE = /(?:private|credential|passwd|password|secret|token|\.pem|\.pfx|\.p12|\.key|\.secrets)/i;

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function durationStats(values) {
  if (!values.length) {
    return {
      count: 0,
      min_ms: null,
      p50_ms: null,
      p90_ms: null,
      p99_ms: null,
      max_ms: null,
    };
  }

  return {
    count: values.length,
    min_ms: Math.min(...values),
    p50_ms: percentile(values, 50),
    p90_ms: percentile(values, 90),
    p99_ms: percentile(values, 99),
    max_ms: Math.max(...values),
  };
}

function increment(map, key, amount = 1) {
  const normalized = String(key || "unknown");
  map[normalized] = (map[normalized] || 0) + amount;
}

function safeReadRecentLines(filePath, windowSize) {
  if (!filePath || !fs.existsSync(filePath)) {
    return { exists: false, total_lines: 0, lines: [], read_error: "" };
  }

  try {
    const text = fs.readFileSync(filePath, "utf8");
    const lines = text.trim() ? text.trim().split(/\r?\n/) : [];
    return {
      exists: true,
      total_lines: lines.length,
      lines: lines.slice(-windowSize),
      read_error: "",
    };
  } catch (error) {
    return {
      exists: true,
      total_lines: 0,
      lines: [],
      read_error: error?.message || String(error),
    };
  }
}

function normalizeToolList(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .sort();
}

function isHashLike(value) {
  return typeof value === "string" && /^[a-f0-9]{12,64}$/i.test(value.trim());
}

function compareToolLists(runtimeTools, connectorTools, compact = {}, runtimeToolSurface = {}) {
  const runtime = normalizeToolList(runtimeTools);
  const connector = normalizeToolList(connectorTools);
  const runtimeToolNamesHash = runtimeToolSurface && typeof runtimeToolSurface.tool_names_hash === "string" ? runtimeToolSurface.tool_names_hash : "";
  const compactToolCount = Number(compact.connector_tool_count);
  const compactToolNamesHash = String(compact.connector_tool_names_hash || "").trim();
  const hasCompactCount = Number.isInteger(compactToolCount) && compactToolCount >= 0;
  const hasCompactHash = isHashLike(compactToolNamesHash);
  const hasCompactComparison = hasCompactCount && hasCompactHash;

  if (!connector.length && hasCompactComparison) {
    const countMatches = runtime.length === compactToolCount;
    const hashMatches = Boolean(runtimeToolNamesHash) && runtimeToolNamesHash === compactToolNamesHash;
    return {
      comparison_available: Boolean(runtimeToolNamesHash),
      comparison_mode: "compact_hash",
      status: countMatches && hashMatches ? "in_sync" : "drift_detected",
      runtime_tool_count: runtime.length,
      connector_tool_count: compactToolCount,
      runtime_tool_names_hash: runtimeToolNamesHash,
      connector_tool_names_hash: compactToolNamesHash,
      tool_count_matches: countMatches,
      tool_names_hash_matches: hashMatches,
      missing_in_connector: [],
      extra_in_connector: [],
      refresh_recommended: !(countMatches && hashMatches),
      note: "Compact connector map comparison uses connector_tool_count and connector_tool_names_hash to avoid sending the full connector-visible tool list.",
    };
  }

  if (!connector.length && hasCompactCount) {
    const countMatches = runtime.length === compactToolCount;
    return {
      comparison_available: true,
      comparison_mode: "compact_count",
      status: countMatches ? "count_in_sync_hash_not_provided" : "drift_detected",
      runtime_tool_count: runtime.length,
      connector_tool_count: compactToolCount,
      runtime_tool_names_hash: runtimeToolNamesHash,
      connector_tool_names_hash: "",
      tool_count_matches: countMatches,
      tool_names_hash_matches: null,
      missing_in_connector: [],
      extra_in_connector: [],
      refresh_recommended: !countMatches,
      note: "Compact count-only comparison avoids sending full connector-visible tool lists or hash-like arguments. It detects tool-count drift only; use connector_tool_names_hash when tool-gateway permits stronger comparison.",
    };
  }

  if (!connector.length) {
    return {
      comparison_available: false,
      comparison_mode: "none",
      status: "external_connector_tool_map_not_provided",
      runtime_tool_count: runtime.length,
      connector_tool_count: 0,
      runtime_tool_names_hash: runtimeToolNamesHash,
      connector_tool_names_hash: "",
      missing_in_connector: [],
      extra_in_connector: [],
      refresh_recommended: false,
      note: "Pass connector_visible_tools, compact connector_tool_count, or connector_tool_count + connector_tool_names_hash to compare the active runtime tool surface with an externally observed connector map.",
    };
  }

  const connectorSet = new Set(connector);
  const runtimeSet = new Set(runtime);
  const missingInConnector = runtime.filter((tool) => !connectorSet.has(tool));
  const extraInConnector = connector.filter((tool) => !runtimeSet.has(tool));

  return {
    comparison_available: true,
    comparison_mode: "full_list",
    status: missingInConnector.length || extraInConnector.length ? "drift_detected" : "in_sync",
    runtime_tool_count: runtime.length,
    connector_tool_count: connector.length,
    runtime_tool_names_hash: runtimeToolNamesHash,
    connector_tool_names_hash: "",
    missing_in_connector: missingInConnector,
    extra_in_connector: extraInConnector,
    refresh_recommended: Boolean(missingInConnector.length || extraInConnector.length),
  };
}

function hashPrefix(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

function compactToolSample(entry, extra = {}) {
  return {
    ts: entry.ts || "",
    request_id: entry.request_id || entry.rpc_id || entry.id || null,
    tool: entry.tool || entry.name || "unknown",
    event: entry.event || "unknown",
    ...extra,
  };
}

function toolCallKey(entry) {
  const id = entry.request_id || entry.rpc_id || entry.id || entry.call_id || entry.execution_id || "";
  const tool = entry.tool || entry.name || "unknown";
  if (id) return `${id}\u0000${tool}`;
  return `no-id\u0000${tool}\u0000${entry.ts || ""}`;
}

function collectStringSignals(value, sink, depth = 0) {
  if (value === null || value === undefined || depth > 6) return;

  if (typeof value === "string") {
    const text = value;
    const looksAbsolute = ABSOLUTE_PATH_RE.test(text);
    const looksRelative = RELATIVE_PATH_RE.test(text);
    const sensitive = SENSITIVE_PATH_HINT_RE.test(text);

    if (looksAbsolute || looksRelative || sensitive) {
      sink.raw_path_like_value_count += looksAbsolute || looksRelative ? 1 : 0;
      sink.absolute_path_hint_count += looksAbsolute ? 1 : 0;
      sink.sensitive_path_hint_count += sensitive ? 1 : 0;
      if (sink.samples.length < 10) {
        sink.samples.push({
          value_sha256_prefix: hashPrefix(text),
          path_is_absolute: looksAbsolute,
          path_like: looksAbsolute || looksRelative,
          sensitive_path_hint: sensitive,
          raw_path_redacted: true,
        });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) collectStringSignals(item, sink, depth + 1);
    return;
  }

  if (typeof value === "object") {
    for (const key of Object.keys(value).slice(0, 100)) {
      collectStringSignals(key, sink, depth + 1);
      collectStringSignals(value[key], sink, depth + 1);
    }
  }
}

function buildRecommendedActions({ connectorComparison, parseErrors, toolCallErrorCount, delayedResponseCount, authRejections, unknownToolCount, portConflictCount, orphanStartCount, argSummaryFailureCount, pathRisk }) {
  const actions = [];

  if (connectorComparison.refresh_recommended) {
    actions.push("Restart TEST MCP if needed, then manually refresh the connector and re-run observability_status with connector_visible_tools.");
  }
  if (unknownToolCount > 0) {
    actions.push("Treat unknown_tool events as possible stale connector-map symptoms; verify runtime enabled_tools against connector-visible tools.");
  }
  if (portConflictCount > 0) {
    actions.push("Do not start a second long-running TEST MCP on port 3009; ask the operator to restart the existing PowerShell process when needed.");
  }
  if (orphanStartCount > 0) {
    actions.push("Investigate orphan tool_call_start entries; correlate request_id/tool with stream interruptions and connector cache transitions.");
  }
  if (argSummaryFailureCount > 0) {
    actions.push("Treat arg_summary_status=failed as audit metadata failure, not tool execution failure; monitor volume and inspect summarizeArgs redaction paths if the count grows unexpectedly.");
  }
  if (pathRisk.raw_path_like_value_count > 0 || pathRisk.sensitive_path_hint_count > 0) {
    actions.push("Avoid exporting raw audit logs; add path redaction fields before sharing logs outside the local machine.");
  }
  if (parseErrors > 0) {
    actions.push("Fix JSONL writer or truncate/rotate the damaged audit log section; parse_errors must be zero before cutover.");
  }
  if (toolCallErrorCount > 0) {
    actions.push("Inspect tool_call_error by kind before auth cutover or plugin expansion.");
  }
  if (delayedResponseCount > 0) {
    actions.push("Review slow_tool_summary and reduce output sizes or split long operations.");
  }
  if (authRejections > 20) {
    actions.push("Check for an auth rejection storm or misconfigured connector credentials.");
  }

  if (!actions.length) {
    actions.push("No immediate server-side action required; continue monitoring before auth cutover or plugin expansion.");
  }

  return actions;
}

function buildObservabilityStatus(options = {}) {
  const args = options.args || {};
  const runtimeStatusProvider = options.runtimeStatusProvider;
  const auditLogPath = options.auditLogPath || path.join(__dirname, "..", ".mcp-tests-audit.jsonl");
  const windowSize = clampInteger(args.window_size, DEFAULT_WINDOW_SIZE, 1, MAX_WINDOW_SIZE);
  const slowMs = clampInteger(args.slow_ms, DEFAULT_SLOW_MS, 1, 600000);
  const topN = clampInteger(args.top_n, DEFAULT_TOP_N, 1, 50);

  const runtimeStatus = typeof runtimeStatusProvider === "function" ? runtimeStatusProvider() : {};
  const runtimeTools = Array.isArray(runtimeStatus.enabled_tools) ? runtimeStatus.enabled_tools : [];
  const runtimeToolSurface = runtimeStatus.tool_surface || {};
  const recent = safeReadRecentLines(auditLogPath, windowSize);
  const connectorComparison = compareToolLists(
    runtimeTools,
    args.connector_visible_tools,
    {
      connector_tool_count: args.connector_tool_count,
      connector_tool_names_hash: args.connector_tool_names_hash,
    },
    runtimeToolSurface
  );

  const eventCounts = {};
  const rpcKinds = {};
  const toolDurations = {};
  const toolErrors = {};
  const toolSlowCounts = {};
  const toolResultChars = {};
  const toolResultCounts = {};
  const toolCallErrorsByKind = {};
  const startsByKey = new Map();
  const endsByKey = new Map();
  const startMetadataByKey = new Map();
  let latestToolCallStartKey = "";
  const pathRisk = { raw_path_like_value_count: 0, sensitive_path_hint_count: 0, absolute_path_hint_count: 0, samples: [] };

  let parseErrors = 0;
  let isErrorTrue = 0;
  let successFalseMarkers = 0;
  let authRejections = 0;
  let delayedResponseCount = 0;
  let firstTs = "";
  let lastTs = "";
  let toolCallStartCount = 0;
  let toolCallEndCount = 0;
  let toolCallErrorCount = 0;
  let rpcReceivedCount = 0;
  let argSummaryFailureCount = 0;
  let argSummaryStatusFailedCount = 0;
  let legacyArgSummarySuccessFalseCount = 0;
  let executionErrorCount = 0;
  let unknownToolCount = 0;
  let portConflictCount = 0;
  let methodNotAllowedCount = 0;
  let serverErrorCount = 0;
  const unknownToolSamples = [];
  const portConflictSamples = [];
  const parsedAuditEntries = [];

  for (const line of recent.lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (_error) {
      parseErrors += 1;
      continue;
    }

    parsedAuditEntries.push(entry);

    if (!firstTs && entry.ts) firstTs = entry.ts;
    if (entry.ts) lastTs = entry.ts;

    const event = String(entry.event || "unknown");
    increment(eventCounts, event);
    collectStringSignals(entry, pathRisk);

    if (line.includes('"isError":true') || entry.is_error === true) {
      isErrorTrue += 1;
    }

    if (line.includes('"success":false')) {
      successFalseMarkers += 1;
    }

    if (/EADDRINUSE|address already in use/i.test(line)) {
      portConflictCount += 1;
      if (portConflictSamples.length < 10) portConflictSamples.push({ ts: entry.ts || "", event, raw_error_redacted: true });
    }

    if (/unknown_tool/i.test(line) || entry.error_kind === "unknown_tool") {
      unknownToolCount += 1;
      if (unknownToolSamples.length < 10) unknownToolSamples.push(compactToolSample(entry, { error_kind: entry.error_kind || "unknown_tool" }));
    }

    if (event === "rpc_received") {
      rpcReceivedCount += 1;
      increment(rpcKinds, entry.kind || "unknown");
      if (entry.kind === "auth_rejected" || entry.auth_error) authRejections += 1;
      if (entry.kind === "method_not_allowed") methodNotAllowedCount += 1;
    }

    if (event === "server_error") {
      serverErrorCount += 1;
    }

    if (event === "tool_call_start") {
      toolCallStartCount += 1;
      const key = toolCallKey(entry);
      startsByKey.set(key, (startsByKey.get(key) || 0) + 1);
      latestToolCallStartKey = key;
      startMetadataByKey.set(key, compactToolSample(entry));
      const argSummaryStatusFailed = entry.arg_summary_status === "failed";
      const legacyArgSummarySuccessFalse =
        entry.success === false &&
        (entry.error === "arg_summary" || entry.error_kind === "arg_summary" || line.includes("arg_summary"));
      if (argSummaryStatusFailed || legacyArgSummarySuccessFalse) {
        argSummaryFailureCount += 1;
      }
      if (argSummaryStatusFailed) argSummaryStatusFailedCount += 1;
      if (legacyArgSummarySuccessFalse) legacyArgSummarySuccessFalseCount += 1;
    }

    if (event === "tool_call_error") {
      toolCallErrorCount += 1;
      increment(toolCallErrorsByKind, entry.error_kind || "unknown");
      increment(toolErrors, entry.tool || "unknown");
      if (entry.error_kind === "unknown_tool") unknownToolCount += 1;
    }

    if (event === "tool_call_end") {
      toolCallEndCount += 1;
      const key = toolCallKey(entry);
      endsByKey.set(key, (endsByKey.get(key) || 0) + 1);
      const tool = String(entry.tool || "unknown");
      const duration = Number(entry.duration_ms);
      if (Number.isFinite(duration)) {
        if (!toolDurations[tool]) toolDurations[tool] = [];
        toolDurations[tool].push(duration);
        if (duration >= slowMs) {
          delayedResponseCount += 1;
          increment(toolSlowCounts, tool);
        }
      }
      const toolExecutionFailed = entry.is_error === true || entry.success === false;
      if (toolExecutionFailed) {
        increment(toolErrors, tool);
        executionErrorCount += 1;
      }
      if (typeof entry.result_chars === "number") {
        if (!toolResultChars[tool]) toolResultChars[tool] = [];
        toolResultChars[tool].push(entry.result_chars);
      }
      if (typeof entry.result_count === "number") {
        if (!toolResultCounts[tool]) toolResultCounts[tool] = [];
        toolResultCounts[tool].push(entry.result_count);
      }
    }
  }

  const orphanStarts = [];
  const selfObservationInflight = [];
  for (const [key, starts] of startsByKey.entries()) {
    const ends = endsByKey.get(key) || 0;
    if (starts > ends) {
      const parts = key.split("\u0000");
      const sample = {
        request_id: parts[0] && parts[0] !== "no-id" ? parts[0] : null,
        tool: parts[1] || "unknown",
        starts,
        ends,
      };
      const metadata = startMetadataByKey.get(key) || {};
      if (key === latestToolCallStartKey && sample.tool === "observability_status") {
        selfObservationInflight.push({ ...sample, ts: metadata.ts || "", classification: "self_observation_inflight" });
      } else {
        orphanStarts.push(sample);
      }
    }
  }

  const allDurations = Object.values(toolDurations).flat();
  const perTool = Object.keys(toolDurations)
    .sort((a, b) => toolDurations[b].length - toolDurations[a].length || a.localeCompare(b))
    .slice(0, topN)
    .map((tool) => ({
      tool,
      ...durationStats(toolDurations[tool]),
      slow_count: toolSlowCounts[tool] || 0,
      error_count: toolErrors[tool] || 0,
      result_chars_max: toolResultChars[tool]?.length ? Math.max(...toolResultChars[tool]) : null,
      result_count_max: toolResultCounts[tool]?.length ? Math.max(...toolResultCounts[tool]) : null,
    }));

  const slowToolSummary = Object.keys(toolDurations)
    .map((tool) => ({
      tool,
      slow_count: toolSlowCounts[tool] || 0,
      ...durationStats(toolDurations[tool]),
    }))
    .filter((item) => item.slow_count > 0)
    .sort((a, b) => b.slow_count - a.slow_count || (b.max_ms || 0) - (a.max_ms || 0) || a.tool.localeCompare(b.tool))
    .slice(0, topN);

  const logStatus = recent.read_error
    ? "read_error"
    : recent.exists
      ? "ok"
      : "missing";

  const auditExportSafety = assessAuditExportSafety(parsedAuditEntries, { maxSamples: 10 });

  const recommendedActions = buildRecommendedActions({
    connectorComparison,
    parseErrors,
    toolCallErrorCount,
    delayedResponseCount,
    authRejections,
    unknownToolCount,
    portConflictCount,
    orphanStartCount: orphanStarts.length,
    argSummaryFailureCount,
    pathRisk,
  });

  return {
    success: !recent.read_error,
    error: recent.read_error,
    mode: "observability-status",
    observability_version: OBSERVABILITY_VERSION,
    stage: CURRENT_STAGE_STATUS,
    read_only: true,
    mutates_auth: false,
    mutates_tools_list: false,
    dynamic_import_enabled: false,
    list_changed_enabled: false,
    audit_log: {
      status: logStatus,
      path_disclosed: false,
      total_lines: recent.total_lines,
      window_checked: recent.lines.length,
      first_ts: firstTs,
      last_ts: lastTs,
      parse_errors: parseErrors,
    },
    audit_jsonl_health: {
      status: logStatus,
      total_lines: recent.total_lines,
      window_checked: recent.lines.length,
      parse_errors: parseErrors,
      first_ts: firstTs,
      last_ts: lastTs,
    },
    runtime: {
      server_version: runtimeStatus.server_version || "",
      stage_status: runtimeStatus.stage_status || "",
      auth_mode: runtimeStatus.auth?.mode || "unknown",
      profile: runtimeStatus.profile?.mode || "unknown",
      enabled_tool_count: runtimeTools.length,
      security_boundary_status: runtimeStatus.security_boundary?.status || "unknown",
    },
    connector_map: connectorComparison,
    connector_map_health: {
      status: connectorComparison.status,
      comparison_available: connectorComparison.comparison_available,
      runtime_tool_count: connectorComparison.runtime_tool_count,
      connector_tool_count: connectorComparison.connector_tool_count,
      missing_in_connector: connectorComparison.missing_in_connector,
      extra_in_connector: connectorComparison.extra_in_connector,
      refresh_recommended: connectorComparison.refresh_recommended,
    },
    events: {
      counts: eventCounts,
      rpc_received_count: rpcReceivedCount,
      rpc_kinds: rpcKinds,
      auth_rejections: authRejections,
      tool_call_start_count: toolCallStartCount,
      tool_call_end_count: toolCallEndCount,
      tool_call_error_count: toolCallErrorCount,
      tool_call_errors_by_kind: toolCallErrorsByKind,
      is_error_true_markers: isErrorTrue,
      success_false_markers: successFalseMarkers,
    },
    tool_call_balance: {
      starts: toolCallStartCount,
      ends: toolCallEndCount,
      error_events: toolCallErrorCount,
      orphan_start_count: orphanStarts.length,
      orphan_start_samples: orphanStarts.slice(0, 10),
      self_observation_inflight_count: selfObservationInflight.length,
      self_observation_inflight_samples: selfObservationInflight.slice(0, 10),
    },
    audit_semantics: {
      success_false_markers: successFalseMarkers,
      arg_summary_failure_count: argSummaryFailureCount,
      arg_summary_status_failed_count: argSummaryStatusFailedCount,
      legacy_arg_summary_success_false_count: legacyArgSummarySuccessFalseCount,
      execution_success_on_start: "unknown",
      execution_error_count: executionErrorCount,
      note: "arg_summary_status=failed in tool_call_start is treated as audit metadata failure, not tool execution failure. Legacy tool_call_start success:false arg_summary entries are counted separately for backward compatibility. Tool execution failures are counted from tool_call_end is_error/success false and tool_call_error events.",
    },
    transport_runtime_signals: {
      auth_rejection_count: authRejections,
      unknown_tool_count: unknownToolCount,
      unknown_tool_samples: unknownToolSamples,
      port_conflict_count: portConflictCount,
      port_conflict_samples: portConflictSamples,
      method_not_allowed_count: methodNotAllowedCount,
      server_error_count: serverErrorCount,
    },
    path_redaction_risk: {
      raw_path_like_value_count: pathRisk.raw_path_like_value_count,
      sensitive_path_hint_count: pathRisk.sensitive_path_hint_count,
      absolute_path_hint_count: pathRisk.absolute_path_hint_count,
      samples: pathRisk.samples,
      audit_export_safety: auditExportSafety,
      recommendation: pathRisk.raw_path_like_value_count || pathRisk.sensitive_path_hint_count
        ? "Do not export raw audit logs outside the local machine; use hashed/redacted path metadata before sharing."
        : "No path-like audit values detected in the inspected window.",
    },
    latency: {
      slow_ms: slowMs,
      delayed_response_count: delayedResponseCount,
      overall: durationStats(allDurations),
      per_tool: perTool,
    },
    slow_tool_summary: {
      slow_ms: slowMs,
      delayed_response_count: delayedResponseCount,
      top_tools: slowToolSummary,
    },
    stream_break_diagnostics: {
      direct_ui_stream_break_detection: false,
      status: "server_side_indicators_only",
      indicators: {
        parse_errors: parseErrors,
        tool_call_errors: toolCallErrorCount,
        orphan_tool_call_starts: orphanStarts.length,
        self_observation_inflight: selfObservationInflight.length,
        delayed_responses: delayedResponseCount,
        auth_rejections: authRejections,
        unknown_tools: unknownToolCount,
        port_conflicts: portConflictCount,
      },
      note: "ChatGPT UI/proxy stream breaks are not directly visible inside TEST MCP audit logs; this tool reports server-side correlation signals only.",
    },
    child_process_anomalies: {
      instrumented_in_test_mcp_runtime: false,
      status: "not_applicable_to_current_public_test_runtime",
      note: "Current TEST MCP public runtime does not expose process execution. GPT MCP process-runner anomalies must be audited separately from its own perf/process logs.",
    },
    recommended_actions: recommendedActions,
    next_recommended_checks: recommendedActions,
  };
}

module.exports = {
  OBSERVABILITY_VERSION,
  buildObservabilityStatus,
};
