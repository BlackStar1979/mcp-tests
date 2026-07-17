"use strict";

const { buildClientEntryPathDiagnostics } = require("./client_entry_path_diagnostics");
const {
  summarizeClientFamilies,
  buildRetirementEvidenceSummary,
  normalizeEvidenceScope,
  normalizeMaxAgeDays,
  isoThresholdFromMaxAgeDays,
  filterClientFamiliesByScope,
} = require("./client_entry_evidence_summary");

function latestAuditTimestamp(entries) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const ts = String((entries[index] && entries[index].ts) || "").trim();
    if (ts) return ts;
  }
  return "";
}

function parseBlockerWindows(value, fallback = "1,2,7,30,all") {
  const raw = String(value || fallback).trim();
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

function buildCurrentDiagnostics(entries, currentServerStartId, requestContract = {}) {
  return buildClientEntryPathDiagnostics(entries, {
    server_start_id: currentServerStartId,
    request_contract: {
      route: "/mcp",
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: true,
      ...requestContract,
    },
  });
}

function buildRetainedBlockerMatrix({
  entries,
  currentServerStartId = "",
  clientName = "",
  evidenceScope = "operational",
  latestAuditTs = "",
  windows = [{ label: "all", max_age_days: null }],
}) {
  return windows.map((windowSpec) => {
    const retainedEvidenceSinceTs = windowSpec.max_age_days === null
      ? ""
      : isoThresholdFromMaxAgeDays(windowSpec.max_age_days, latestAuditTs);
    const retainedClients = filterClientFamiliesByScope(
      summarizeClientFamilies(entries, currentServerStartId, clientName, false, { since_ts: retainedEvidenceSinceTs }),
      evidenceScope
    );
    return {
      label: windowSpec.label,
      max_age_days: windowSpec.max_age_days,
      retained_evidence_since_ts: retainedEvidenceSinceTs || null,
      retained_client_count: retainedClients.length,
      retirement_evidence_summary: buildRetirementEvidenceSummary({}, retainedClients),
      sample_client_families: retainedClients.slice(0, 10),
    };
  });
}

function buildClientEntryBlockerMatrix(entries, options = {}) {
  const currentServerStartId = String(options.currentServerStartId || "");
  const currentServerStartTs = String(options.currentServerStartTs || "");
  const clientName = String(options.clientName || "");
  const evidenceScope = normalizeEvidenceScope(options.evidenceScope || "operational");
  const latestAuditTs = options.latestAuditTs || latestAuditTimestamp(entries);
  const windows = Array.isArray(options.windows) && options.windows.length
    ? options.windows
    : parseBlockerWindows(options.blockerWindows || "1,2,7,30,all");

  return {
    current_window: {
      server_start_id: currentServerStartId || null,
      server_start_ts: currentServerStartTs || null,
      diagnostics: buildCurrentDiagnostics(entries, currentServerStartId, options.requestContract || {}),
    },
    retained_blocker_matrix: buildRetainedBlockerMatrix({
      entries,
      currentServerStartId,
      clientName,
      evidenceScope,
      latestAuditTs,
      windows,
    }),
    filter: {
      client_name: clientName || null,
      evidence_scope: evidenceScope,
      windows,
    },
  };
}

module.exports = {
  latestAuditTimestamp,
  parseBlockerWindows,
  buildRetainedBlockerMatrix,
  buildClientEntryBlockerMatrix,
};
