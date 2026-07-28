#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildClientEntryPathDiagnostics } = require("../../src/client_entry_path_diagnostics");
const {
  classifyClientFamily,
  summarizeClientFamilies,
  buildRetirementEvidenceSummary,
  normalizeMaxAgeDays,
  isoThresholdFromMaxAgeDays,
} = require("../../src/client_entry_evidence_summary");

const MARKER = "client_entry_path_report";
const Repo = path.resolve(__dirname, "..", "..");
const AuditLog = process.env.MCP_TEST_AUDIT_LOG || path.join(Repo, "_logs", ".mcp-tests-audit.jsonl");

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function argFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function normalizeEvidenceScope(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  if (normalized === "operational" || normalized === "synthetic" || normalized === "unknown") {
    return normalized;
  }
  return "all";
}

function clientMatchesScope(entry, evidenceScope) {
  const classified = classifyClientFamily(entry.client_name, entry.client_version);
  if (evidenceScope === "operational") return classified.client_class === "operational_known";
  if (evidenceScope === "synthetic") return classified.client_class === "synthetic_validation";
  if (evidenceScope === "unknown") return classified.client_class === "unknown";
  return true;
}

function latestAuditTimestamp(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const ts = String((entries[index] && entries[index].ts) || "").trim();
    if (ts) return ts;
  }
  return "";
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

function latestEntryServerStart(entries, { clientName = "", evidenceScope = "all", sinceTs = "" } = {}) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const event = String((entry && entry.event) || "");
    if (event !== "initialize_received" && event !== "server_discover_received") continue;
    if (clientName && String(entry.client_name || "") !== clientName) continue;
    if (sinceTs && String(entry.ts || "") < sinceTs) continue;
    if (!clientMatchesScope(entry, evidenceScope)) continue;
    const serverStartId = String(entry.server_start_id || "");
    if (!serverStartId) continue;
    return serverStartById(entries, serverStartId);
  }
  return { server_start_id: "", ts: "" };
}

function serverStartById(entries, serverStartId) {
  const wanted = String(serverStartId || "").trim();
  if (!wanted) return { server_start_id: "", ts: "" };
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (String((entry && entry.event) || "") !== "server_start") continue;
    if (String((entry && entry.server_start_id) || "") !== wanted) continue;
    return {
      server_start_id: wanted,
      ts: String(entry.ts || ""),
    };
  }
  return { server_start_id: wanted, ts: "" };
}

function currentWindowEntries(entries, currentServerStart) {
  const serverStartId = String((currentServerStart && currentServerStart.server_start_id) || "").trim();
  if (!serverStartId) {
    if (!currentServerStart.ts) return entries;
    return entries.filter((entry) => String(entry.ts || "") >= currentServerStart.ts);
  }

  const requestServerStartIds = new Map();
  for (const entry of entries) {
    const requestId = String((entry && entry.request_id) || "");
    const explicitServerStartId = String((entry && entry.server_start_id) || "");
    if (requestId && explicitServerStartId) {
      requestServerStartIds.set(requestId, explicitServerStartId);
    }
  }

  const selected = [];
  let activeServerStartId = "";
  for (const entry of entries) {
    const event = String((entry && entry.event) || "");
    const explicitServerStartId = String((entry && entry.server_start_id) || "");
    if (event === "server_start" && explicitServerStartId) {
      activeServerStartId = explicitServerStartId;
    }
    const requestId = String((entry && entry.request_id) || "");
    const requestServerStartId = requestId
      ? String(requestServerStartIds.get(requestId) || "")
      : "";
    const effectiveServerStartId = explicitServerStartId
      || requestServerStartId
      || activeServerStartId;
    if (effectiveServerStartId === serverStartId) selected.push(entry);
  }
  return selected;
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

function filterClientFamiliesByScope(items, evidenceScope) {
  if (evidenceScope === "all") return items;
  if (evidenceScope === "operational") return items.filter((item) => item.client_class === "operational_known");
  if (evidenceScope === "synthetic") return items.filter((item) => item.client_class === "synthetic_validation");
  if (evidenceScope === "unknown") return items.filter((item) => item.client_class === "unknown");
  return items;
}

function main() {
  const auditLogPath = argValue("audit-log", AuditLog);
  const clientName = argValue("client-name", "");
  const requestedServerStartId = argValue("server-start-id", "").trim();
  const useLatestEntryWindow = argFlag("latest-entry-window");
  const evidenceScope = normalizeEvidenceScope(argValue("evidence-scope", "all"));
  const maxAgeDays = normalizeMaxAgeDays(argValue("max-age-days", ""));
  const limit = Math.max(1, Number(argValue("limit", "10")) || 10);
  const { exists, entries, parse_errors } = readAuditEntries(auditLogPath);
  const latestAuditTs = latestAuditTimestamp(entries);
  const retainedEvidenceSinceTs = isoThresholdFromMaxAgeDays(maxAgeDays, latestAuditTs);
  const latestEntryStart = latestEntryServerStart(entries, {
    clientName,
    evidenceScope,
    sinceTs: retainedEvidenceSinceTs,
  });
  const currentServerStart = requestedServerStartId
    ? serverStartById(entries, requestedServerStartId)
    : useLatestEntryWindow && latestEntryStart.server_start_id
      ? latestEntryStart
      : latestServerStart(entries);
  const currentServerStartId = requestedServerStartId
    || currentServerStart.server_start_id
    || latestServerStartId(entries);
  const windowEntries = currentWindowEntries(entries, currentServerStart);
  const matchingClients = filterClientFamiliesByScope(
    summarizeClientFamilies(entries, currentServerStartId, clientName, true),
    evidenceScope
  ).slice(0, limit);
  const latestMatchingClientsAnyWindow = filterClientFamiliesByScope(
    summarizeClientFamilies(entries, currentServerStartId, clientName, false, { since_ts: retainedEvidenceSinceTs }),
    evidenceScope
  ).slice(0, limit);
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
      latest_ts: latestAuditTs || null,
    },
    current_server_start_id: currentServerStartId,
    current_server_start_ts: currentServerStart.ts || null,
    latest_entry_server_start: latestEntryStart.server_start_id
      ? latestEntryStart
      : null,
    current_window_rpc_counts: countMethods(windowEntries),
    diagnostics,
    retirement_evidence_summary: retirementEvidenceSummary,
    matching_clients: matchingClients,
    latest_matching_clients_any_window: latestMatchingClientsAnyWindow,
    filter: {
      client_name: clientName || null,
      server_start_id: requestedServerStartId || null,
      latest_entry_window: useLatestEntryWindow,
      evidence_scope: evidenceScope,
      max_age_days: maxAgeDays,
      retained_evidence_since_ts: retainedEvidenceSinceTs || null,
      limit,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(1, error && error.message ? error.message : String(error));
}
