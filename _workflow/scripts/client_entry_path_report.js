#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildClientEntryPathDiagnostics } = require("../../src/client_entry_path_diagnostics");
const { summarizeClientFamilies, buildRetirementEvidenceSummary } = require("../../src/client_entry_evidence_summary");

const MARKER = "client_entry_path_report";
const Repo = path.resolve(__dirname, "..", "..");
const AuditLog = process.env.MCP_TEST_AUDIT_LOG || path.join(Repo, "_logs", ".mcp-tests-audit.jsonl");

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function normalizeEvidenceScope(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  if (normalized === "operational" || normalized === "synthetic" || normalized === "unknown") {
    return normalized;
  }
  return "all";
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
  const evidenceScope = normalizeEvidenceScope(argValue("evidence-scope", "all"));
  const limit = Math.max(1, Number(argValue("limit", "10")) || 10);
  const { exists, entries, parse_errors } = readAuditEntries(auditLogPath);
  const currentServerStart = latestServerStart(entries);
  const currentServerStartId = currentServerStart.server_start_id || latestServerStartId(entries);
  const windowEntries = currentWindowEntries(entries, currentServerStart);
  const matchingClients = filterClientFamiliesByScope(
    summarizeClientFamilies(entries, currentServerStartId, clientName, true),
    evidenceScope
  ).slice(0, limit);
  const latestMatchingClientsAnyWindow = filterClientFamiliesByScope(
    summarizeClientFamilies(entries, currentServerStartId, clientName, false),
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
      evidence_scope: evidenceScope,
      limit,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(1, error && error.message ? error.message : String(error));
}
