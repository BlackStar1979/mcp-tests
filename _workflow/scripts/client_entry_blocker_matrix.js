#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildClientEntryPathDiagnostics } = require("../../src/client_entry_path_diagnostics");
const {
  summarizeClientFamilies,
  buildRetirementEvidenceSummary,
  normalizeEvidenceScope,
  normalizeMaxAgeDays,
  isoThresholdFromMaxAgeDays,
  filterClientFamiliesByScope,
} = require("../../src/client_entry_evidence_summary");

const MARKER = "client_entry_blocker_matrix";
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

function latestAuditTimestamp(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const ts = String((entries[index] && entries[index].ts) || "").trim();
    if (ts) return ts;
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

function parseWindows(value) {
  const raw = String(value || "1,2,7,30,all").trim();
  const items = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (!items.length) return [{ label: "all", max_age_days: null }];
  const result = [];
  const seen = new Set();
  for (const item of items) {
    const lower = item.toLowerCase();
    if (lower === "all") {
      if (!seen.has("all")) {
        seen.add("all");
        result.push({ label: "all", max_age_days: null });
      }
      continue;
    }
    const normalized = normalizeMaxAgeDays(item);
    if (normalized === null) continue;
    const label = `${normalized}d`;
    if (seen.has(label)) continue;
    seen.add(label);
    result.push({ label, max_age_days: normalized });
  }
  return result.length ? result : [{ label: "all", max_age_days: null }];
}

function buildWindowSummary({ entries, currentServerStartId, clientName, evidenceScope, latestAuditTs, windowSpec }) {
  const retainedEvidenceSinceTs = windowSpec.max_age_days === null
    ? ""
    : isoThresholdFromMaxAgeDays(windowSpec.max_age_days, latestAuditTs);
  const retainedClients = filterClientFamiliesByScope(
    summarizeClientFamilies(entries, currentServerStartId, clientName, false, { since_ts: retainedEvidenceSinceTs }),
    evidenceScope
  );
  const retirementEvidenceSummary = buildRetirementEvidenceSummary({}, retainedClients);
  return {
    label: windowSpec.label,
    max_age_days: windowSpec.max_age_days,
    retained_evidence_since_ts: retainedEvidenceSinceTs || null,
    retained_client_count: retainedClients.length,
    retirement_evidence_summary: retirementEvidenceSummary,
    sample_client_families: retainedClients.slice(0, 10),
  };
}

function buildCurrentDiagnostics(entries, currentServerStartId) {
  return buildClientEntryPathDiagnostics(entries, {
    server_start_id: currentServerStartId,
    request_contract: {
      route: "/mcp",
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: true,
    },
  });
}

function main() {
  const auditLogPath = argValue("audit-log", AuditLog);
  const clientName = argValue("client-name", "");
  const evidenceScope = normalizeEvidenceScope(argValue("evidence-scope", "operational"));
  const windows = parseWindows(argValue("windows", "1,2,7,30,all"));
  const { exists, entries, parse_errors } = readAuditEntries(auditLogPath);
  const latestAuditTs = latestAuditTimestamp(entries);
  const currentServerStart = latestServerStart(entries);
  const currentDiagnostics = buildCurrentDiagnostics(entries, currentServerStart.server_start_id);
  const matrix = windows.map((windowSpec) => buildWindowSummary({
    entries,
    currentServerStartId: currentServerStart.server_start_id,
    clientName,
    evidenceScope,
    latestAuditTs,
    windowSpec,
  }));

  console.log(JSON.stringify({
    success: true,
    marker: MARKER,
    mode: "client-entry-blocker-matrix",
    audit_log: {
      path: auditLogPath,
      exists,
      parse_errors,
      entry_count: entries.length,
      latest_ts: latestAuditTs || null,
    },
    filter: {
      client_name: clientName || null,
      evidence_scope: evidenceScope,
      windows,
    },
    current_window: {
      server_start_id: currentServerStart.server_start_id || null,
      server_start_ts: currentServerStart.ts || null,
      diagnostics: currentDiagnostics,
    },
    retained_blocker_matrix: matrix,
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(1, error && error.message ? error.message : String(error));
}
