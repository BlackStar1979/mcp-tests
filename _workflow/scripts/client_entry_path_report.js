#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildClientEntryPathDiagnostics } = require("../../src/client_entry_path_diagnostics");

const MARKER = "client_entry_path_report";
const Repo = path.resolve(__dirname, "..", "..");
const AuditLog = process.env.MCP_TEST_AUDIT_LOG || path.join(Repo, "_logs", ".mcp-tests-audit.jsonl");

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function fail(code, error, extra = {}) {
  console.error(JSON.stringify({ success: false, marker: MARKER, error, ...extra }, null, 2));
  process.exit(code);
}

function readAuditEntries(auditLogPath) {
  if (!fs.existsSync(auditLogPath)) {
    return { exists: false, entries: [], parse_errors: 0 };
  }
  const text = fs.readFileSync(auditLogPath, "utf8");
  const entries = [];
  let parseErrors = 0;
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      entries.push(JSON.parse(line));
    } catch {
      parseErrors += 1;
    }
  }
  return { exists: true, entries, parse_errors: parseErrors };
}

function latestServerStartId(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const value = String((entries[index] && entries[index].server_start_id) || "").trim();
    if (value) return value;
  }
  return "";
}

function latestServerStart(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (String((entry && entry.event) || "") !== "server_start") continue;
    return {
      server_start_id: String(entry.server_start_id || ""),
      ts: String(entry.ts || ""),
    };
  }
  return { server_start_id: "", ts: "" };
}

function classifyClientFamily(clientName, clientVersion) {
  const name = String(clientName || "");
  const version = String(clientVersion || "");
  const lower = name.toLowerCase();

  if (
    lower === "codex-mcp-client"
    || lower === "openai-mcp"
    || lower === "anthropic/claudeai"
    || lower === "anthropic/toolbox"
  ) {
    return {
      client_class: "operational_known",
      evidence_weight: "high",
      rationale: "Known operational client family.",
    };
  }

  if (
    lower.includes("smoke")
    || lower.includes("probe")
    || lower.includes("test")
    || /^step\d+/i.test(name)
    || lower === "claude"
  ) {
    return {
      client_class: "synthetic_validation",
      evidence_weight: "low",
      rationale: "Synthetic, probe, smoke, or validation client family.",
    };
  }

  return {
    client_class: "unknown",
    evidence_weight: "medium",
    rationale: version ? "Unclassified client family." : "Unclassified client family with missing version context.",
  };
}

function summarizeClients(entries, currentServerStartId, clientNameFilter = "", currentOnly = true) {
  const grouped = new Map();
  for (const entry of entries) {
    const event = String((entry && entry.event) || "");
    if (event !== "initialize_received" && event !== "server_discover_received") continue;
    const serverStartId = String(entry.server_start_id || "");
    if (currentOnly && currentServerStartId && serverStartId !== currentServerStartId) continue;
    const clientName = String(entry.client_name || "");
    const clientVersion = String(entry.client_version || "");
    if (clientNameFilter && clientName !== clientNameFilter) continue;
    const key = `${clientName}\u0000${clientVersion}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        client_name: clientName,
        client_version: clientVersion,
        initialize_received: 0,
        server_discover_received: 0,
        latest_initialize_ts: "",
        latest_server_discover_ts: "",
        protocol_versions: new Set(),
      });
    }
    const item = grouped.get(key);
    if (entry.protocol_version) item.protocol_versions.add(String(entry.protocol_version));
    if (event === "initialize_received") {
      item.initialize_received += 1;
      item.latest_initialize_ts = String(entry.ts || item.latest_initialize_ts || "");
    } else {
      item.server_discover_received += 1;
      item.latest_server_discover_ts = String(entry.ts || item.latest_server_discover_ts || "");
    }
  }
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      protocol_versions: [...item.protocol_versions].sort(),
      ...classifyClientFamily(item.client_name, item.client_version),
      status:
        item.initialize_received > 0 && item.server_discover_received > 0
          ? "mixed"
          : item.initialize_received > 0
            ? "initialize_only"
            : "server_discover_only",
    }))
    .sort((a, b) => {
      const aTs = a.latest_server_discover_ts || a.latest_initialize_ts || "";
      const bTs = b.latest_server_discover_ts || b.latest_initialize_ts || "";
      return bTs.localeCompare(aTs) || a.client_name.localeCompare(b.client_name) || a.client_version.localeCompare(b.client_version);
    });
}

function buildRetirementEvidenceSummary(diagnostics, latestMatchingClientsAnyWindow = []) {
  const operationalClients = latestMatchingClientsAnyWindow.filter((item) => item.client_class === "operational_known");
  const syntheticClients = latestMatchingClientsAnyWindow.filter((item) => item.client_class === "synthetic_validation");
  const operationalInitializeOnly = operationalClients.filter((item) => item.status === "initialize_only");
  const operationalServerDiscoverOnly = operationalClients.filter((item) => item.status === "server_discover_only");
  const operationalMixed = operationalClients.filter((item) => item.status === "mixed");
  const syntheticServerDiscoverOnly = syntheticClients.filter((item) => item.status === "server_discover_only");

  let status = "insufficient_evidence";
  let blocker = "Need clearer evidence separation between operational clients and validation traffic.";
  let nextAction = "Capture a fresh reconnect for the operational client family you actually care about and re-run this report.";

  if (diagnostics?.initialize_retirement_readiness?.status === "stale_entry_window") {
    status = "hold_stale_current_window";
    blocker = "The current runtime slice is stale for entry-path purposes.";
    nextAction = diagnostics.initialize_retirement_readiness.next_action;
  } else if (operationalInitializeOnly.length > 0 || operationalMixed.length > 0) {
    status = "blocked_by_operational_initialize_clients";
    blocker = "At least one known operational client family still uses legacy initialize in retained evidence.";
    nextAction = "Do not reopen initialize retirement. Preserve compatibility and gather fresh server/discover evidence for the same operational family.";
  } else if (operationalServerDiscoverOnly.length > 0) {
    status = "operational_server_discover_candidate";
    blocker = "Operational evidence is compatible with retirement review, but explicit authorization is still required.";
    nextAction = "Preserve the operational server/discover-only evidence, confirm useful no-handshake flow on the same runtime, and prepare an authorization-backed retirement package.";
  } else if (syntheticServerDiscoverOnly.length > 0) {
    status = "synthetic_server_discover_only";
    blocker = "Observed server/discover-only evidence comes only from synthetic validation clients.";
    nextAction = "Do not treat synthetic server/discover traffic as retirement evidence; capture a fresh reconnect from an operational client family.";
  }

  return {
    status,
    blocker,
    next_action: nextAction,
    operational_known_clients_seen: operationalClients.length,
    synthetic_validation_clients_seen: syntheticClients.length,
    operational_initialize_only_clients: operationalInitializeOnly.map((item) => `${item.client_name} ${item.client_version}`),
    operational_server_discover_only_clients: operationalServerDiscoverOnly.map((item) => `${item.client_name} ${item.client_version}`),
    operational_mixed_clients: operationalMixed.map((item) => `${item.client_name} ${item.client_version}`),
    synthetic_server_discover_only_clients: syntheticServerDiscoverOnly.map((item) => `${item.client_name} ${item.client_version}`),
  };
}

function currentWindowEntries(entries, currentServerStart) {
  if (!currentServerStart.ts) return entries;
  return entries.filter((entry) => String(entry.ts || "") >= currentServerStart.ts);
}

function countMethods(entries) {
  const counts = {
    initialize: 0,
    server_discover: 0,
    notifications_initialized: 0,
    tools_list: 0,
    tools_call: 0,
  };
  for (const entry of entries) {
    if (String(entry.event || "") !== "rpc_received") continue;
    const method = String(entry.method || "");
    if (method === "initialize") counts.initialize += 1;
    else if (method === "server/discover") counts.server_discover += 1;
    else if (method === "notifications/initialized") counts.notifications_initialized += 1;
    else if (method === "tools/list") counts.tools_list += 1;
    else if (method === "tools/call") counts.tools_call += 1;
  }
  return counts;
}

function main() {
  const auditLogPath = argValue("audit-log", AuditLog);
  const clientName = argValue("client-name", "");
  const limit = Math.max(1, Number(argValue("limit", "10")) || 10);
  const { exists, entries, parse_errors } = readAuditEntries(auditLogPath);
  const currentServerStart = latestServerStart(entries);
  const currentServerStartId = currentServerStart.server_start_id || latestServerStartId(entries);
  const windowEntries = currentWindowEntries(entries, currentServerStart);
  const matchingClients = summarizeClients(entries, currentServerStartId, clientName, true).slice(0, limit);
  const latestMatchingClientsAnyWindow = summarizeClients(entries, currentServerStartId, clientName, false).slice(0, limit);
  const diagnostics = buildClientEntryPathDiagnostics(entries, {
    server_start_id: currentServerStartId,
    request_contract: {
      route: "/mcp",
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: true,
    },
  });
  const retirementEvidenceSummary = buildRetirementEvidenceSummary(diagnostics, latestMatchingClientsAnyWindow);

  console.log(JSON.stringify({
    success: true,
    marker: MARKER,
    mode: "client-entry-path-report",
    audit_log: {
      path: auditLogPath,
      exists,
      parse_errors,
      entry_count: entries.length,
    },
    current_server_start_id: currentServerStartId,
    current_server_start_ts: currentServerStart.ts || null,
    current_window_rpc_counts: countMethods(windowEntries),
    diagnostics,
    retirement_evidence_summary: retirementEvidenceSummary,
    matching_clients: matchingClients,
    latest_matching_clients_any_window: latestMatchingClientsAnyWindow,
    filter: {
      client_name: clientName || null,
      limit,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(1, error && error.message ? error.message : String(error));
}
