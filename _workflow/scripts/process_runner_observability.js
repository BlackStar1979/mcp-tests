#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_LOG = path.join("mcp", ".mcp_audit.log");
const DEFAULT_WINDOW = 1000;
const MAX_WINDOW = 20000;
const DEFAULT_SLOW_MS = 1000;

function parseArgs(argv) {
  const out = {
    log: DEFAULT_LOG,
    window: DEFAULT_WINDOW,
    slowMs: DEFAULT_SLOW_MS,
    json: false,
    ignoreTraceIds: [],
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--log") {
      out.log = argv[++i];
    } else if (arg === "--window") {
      out.window = clampInt(argv[++i], DEFAULT_WINDOW, 1, MAX_WINDOW);
    } else if (arg === "--slow-ms") {
      out.slowMs = clampInt(argv[++i], DEFAULT_SLOW_MS, 1, 600000);
    } else if (arg === "--json") {
      out.json = true;
    } else if (arg === "--ignore-trace-id") {
      const value = argv[++i];
      if (value) out.ignoreTraceIds.push(String(value));
    } else if (arg === "--help" || arg === "-h") {
      out.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return out;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function stats(values) {
  if (!values.length) {
    return { count: 0, min_ms: null, p50_ms: null, p90_ms: null, p99_ms: null, max_ms: null };
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

function inc(map, key, amount = 1) {
  const k = String(key || "unknown");
  map[k] = (map[k] || 0) + amount;
}

function markerText(entry) {
  return [entry.error, entry.stderr, entry.message]
    .filter((value) => typeof value === "string")
    .join("\n");
}

function detectMarkers(entry) {
  const text = markerText(entry);
  const markers = [];

  if (/UV_HANDLE_CLOSING/i.test(text) || /handle->flags\s*&\s*UV_HANDLE_CLOSING/i.test(text)) {
    markers.push("windows_node_uv_handle_closing_assertion");
  }
  if (/Assertion failed:/i.test(text)) {
    markers.push("assertion_failed");
  }
  if (/node:internal/i.test(text)) {
    markers.push("node_internal_stack");
  }
  if (/EADDRINUSE/i.test(text)) {
    markers.push("port_in_use");
  }

  return markers;
}

function readRecentLines(logPath, windowSize) {
  if (!fs.existsSync(logPath)) {
    return { exists: false, totalLines: 0, lines: [], error: "" };
  }

  try {
    const text = fs.readFileSync(logPath, "utf8");
    const lines = text.trim() ? text.trim().split(/\r?\n/) : [];
    return { exists: true, totalLines: lines.length, lines: lines.slice(-windowSize), error: "" };
  } catch (error) {
    return { exists: true, totalLines: 0, lines: [], error: error?.message || String(error) };
  }
}

function compactEvent(entry, extra = {}) {
  return {
    ts: entry.ts || "",
    trace_id: entry.trace_id || null,
    command: entry.command || "unknown",
    cwd: entry.cwd || "",
    status: entry.status || null,
    exit_code: typeof entry.exit_code === "number" ? entry.exit_code : null,
    signal: entry.signal || null,
    timed_out: Boolean(entry.timed_out),
    duration_ms: typeof entry.duration_ms === "number" ? entry.duration_ms : null,
    stdout_truncated: Boolean(entry.stdout_truncated),
    stderr_truncated: Boolean(entry.stderr_truncated),
    ...extra,
  };
}

function analyzeProcessRunnerLog(options = {}) {
  const logPath = options.log || DEFAULT_LOG;
  const windowSize = clampInt(options.window, DEFAULT_WINDOW, 1, MAX_WINDOW);
  const slowMs = clampInt(options.slowMs, DEFAULT_SLOW_MS, 1, 600000);
  const ignoredTraceIds = new Set((options.ignoreTraceIds || []).map((value) => String(value)).filter(Boolean));
  const recent = readRecentLines(logPath, windowSize);

  const counts = {
    process_start: 0,
    process_finish: 0,
    parse_errors: 0,
    nonzero_exit: 0,
    timeout: 0,
    spawn_error: 0,
    signal_exit: 0,
    slow_process: 0,
    stdout_truncated: 0,
    stderr_truncated: 0,
    marker_events: 0,
  };

  const byCommand = {};
  const byStatus = {};
  const byMarker = {};
  const durationsByCommand = {};
  const starts = new Map();
  const finishes = new Map();
  const anomalies = [];
  let firstTs = "";
  let lastTs = "";

  for (const [index, line] of recent.lines.entries()) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (error) {
      counts.parse_errors += 1;
      if (anomalies.length < 50) {
        anomalies.push({ kind: "parse_error", line_index: index, message: error?.message || String(error) });
      }
      continue;
    }

    if (!firstTs && entry.ts) firstTs = entry.ts;
    if (entry.ts) lastTs = entry.ts;

    if (ignoredTraceIds.has(String(entry.trace_id || ""))) {
      continue;
    }

    if (entry.source !== "process_runner" && entry.event !== "process_start" && entry.event !== "process_finish") {
      continue;
    }

    const key = `${entry.trace_id || ""}\u0000${entry.command || ""}\u0000${entry.cwd || ""}`;

    if (entry.event === "process_start") {
      counts.process_start += 1;
      starts.set(key, (starts.get(key) || 0) + 1);
      inc(byCommand, entry.command || "unknown");
      continue;
    }

    if (entry.event !== "process_finish") continue;

    counts.process_finish += 1;
    finishes.set(key, (finishes.get(key) || 0) + 1);
    inc(byCommand, entry.command || "unknown");
    inc(byStatus, entry.status || "unknown");

    const duration = Number(entry.duration_ms);
    if (Number.isFinite(duration)) {
      if (!durationsByCommand[entry.command || "unknown"]) durationsByCommand[entry.command || "unknown"] = [];
      durationsByCommand[entry.command || "unknown"].push(duration);
      if (duration >= slowMs) {
        counts.slow_process += 1;
        if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "slow_process" }));
      }
    }

    if (entry.status === "nonzero_exit") {
      counts.nonzero_exit += 1;
      if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "nonzero_exit" }));
    }
    if (entry.status === "timeout" || entry.timed_out === true) {
      counts.timeout += 1;
      if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "timeout" }));
    }
    if (entry.status === "spawn_error") {
      counts.spawn_error += 1;
      if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "spawn_error" }));
    }
    if (entry.signal) {
      counts.signal_exit += 1;
      if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "signal_exit" }));
    }
    if (entry.stdout_truncated) counts.stdout_truncated += 1;
    if (entry.stderr_truncated) counts.stderr_truncated += 1;

    const markers = detectMarkers(entry);
    if (markers.length) {
      counts.marker_events += 1;
      for (const marker of markers) inc(byMarker, marker);
      if (anomalies.length < 50) anomalies.push(compactEvent(entry, { kind: "marker", markers }));
    }
  }

  const orphanStarts = [];
  for (const [key, startCount] of starts.entries()) {
    const finishCount = finishes.get(key) || 0;
    if (startCount > finishCount) {
      const [traceId, command, cwd] = key.split("\u0000");
      orphanStarts.push({ trace_id: traceId || null, command: command || "unknown", cwd, starts: startCount, finishes: finishCount });
    }
  }

  const perCommand = Object.fromEntries(
    Object.entries(durationsByCommand)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([command, values]) => [command, stats(values)])
  );

  return {
    success: recent.error === "",
    error: recent.error,
    analyzer_version: "process-runner-observability-v1",
    mode: "repo-local-script",
    log: {
      exists: recent.exists,
      path: logPath,
      total_lines: recent.totalLines,
      window_checked: recent.lines.length,
      first_ts: firstTs,
      last_ts: lastTs,
    },
    thresholds: {
      slow_ms: slowMs,
    },
    ignored_trace_ids: [...ignoredTraceIds],
    counts,
    by_command: byCommand,
    by_status: byStatus,
    by_marker: byMarker,
    latency_by_command: perCommand,
    orphan_starts: orphanStarts.slice(0, 50),
    anomalies,
    raw_args_included: false,
    raw_stdout_included: false,
    raw_stderr_included: false,
  };
}

function printHelp() {
  console.log(`Usage: node mcp-tests/_workflow/scripts/process_runner_observability.js [--log <path>] [--window <n>] [--slow-ms <n>] [--ignore-trace-id <id>] [--json]\n\nReads GPT MCP .mcp_audit.log and prints bounded process-runner anomaly diagnostics without raw args/stdout/stderr.`);
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = analyzeProcessRunnerLog({ log: args.log, window: args.window, slowMs: args.slowMs, ignoreTraceIds: args.ignoreTraceIds });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  analyzeProcessRunnerLog,
  detectMarkers,
  parseArgs,
};
