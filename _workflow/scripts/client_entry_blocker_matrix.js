#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  normalizeEvidenceScope,
} = require("../../src/client_entry_evidence_summary");
const {
  latestAuditTimestamp,
  parseBlockerWindows,
  buildClientEntryBlockerMatrix,
} = require("../../src/client_entry_blocker_matrix");

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

function main() {
  const auditLogPath = argValue("audit-log", AuditLog);
  const clientName = argValue("client-name", "");
  const evidenceScope = normalizeEvidenceScope(argValue("evidence-scope", "operational"));
  const windows = parseBlockerWindows(argValue("windows", "1,2,7,30,all"));
  const { exists, entries, parse_errors } = readAuditEntries(auditLogPath);
  const latestAuditTs = latestAuditTimestamp(entries);
  const currentServerStart = latestServerStart(entries);
  const matrixPayload = buildClientEntryBlockerMatrix(entries, {
    currentServerStartId: currentServerStart.server_start_id,
    currentServerStartTs: currentServerStart.ts,
    clientName,
    evidenceScope,
    latestAuditTs,
    windows,
  });

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
    ...matrixPayload,
  }, null, 2));
}

try {
  main();
} catch (error) {
  fail(1, error && error.message ? error.message : String(error));
}
