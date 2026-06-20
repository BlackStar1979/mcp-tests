"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { nowIso, safeJsonStringify } = require("./runtime_helpers");

function getMaxAuditBytes() {
  const parsed = Number(process.env.MCP_TEST_AUDIT_MAX_BYTES || 5 * 1024 * 1024);
  if (!Number.isInteger(parsed) || parsed < 64 * 1024 || parsed > 100 * 1024 * 1024) return 5 * 1024 * 1024;
  return parsed;
}

function rotateAuditLogIfNeeded(auditLogPath, maxBytes = getMaxAuditBytes()) {
  try {
    if (!fs.existsSync(auditLogPath)) return { rotated: false };
    const stat = fs.statSync(auditLogPath);
    if (!stat.isFile() || stat.size <= maxBytes) return { rotated: false, size: stat.size };
    const dir = path.dirname(auditLogPath);
    const base = path.basename(auditLogPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = path.join(dir, `${base}.${stamp}.rotated`);
    fs.renameSync(auditLogPath, rotatedPath);
    fs.writeFileSync(auditLogPath, "", "utf8");
    return { rotated: true, size: stat.size, rotatedPath };
  } catch (error) {
    return { rotated: false, error: error?.message || String(error) };
  }
}

function createAuditLogger({
  auditLogPath,
  auditVersion,
  serverName,
  serverVersion,
  connectorShapeVersion,
}) {
  return function auditLog(event, fields = {}) {
    const entry = {
      ts: nowIso(),
      audit_version: auditVersion,
      server: serverName,
      server_version: serverVersion,
      connectorShapeVersion,
      event,
      ...fields,
    };

    try {
      fs.mkdirSync(path.dirname(auditLogPath), { recursive: true });
      rotateAuditLogIfNeeded(auditLogPath);
      fs.appendFileSync(auditLogPath, `${safeJsonStringify(entry)}\n`, "utf8");
    } catch (error) {
      console.warn("AUDIT_LOG_WRITE_FAILED:", error.message || String(error));
    }
  };
}

module.exports = {
  createAuditLogger,
  getMaxAuditBytes,
  rotateAuditLogIfNeeded,
};
