"use strict";

const crypto = require("node:crypto");

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const HANDLE_PREFIX = "esh_";

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function randomHandle() {
  return HANDLE_PREFIX + crypto.randomBytes(32).toString("base64url");
}

function normalizeScopes(scopes) {
  if (Array.isArray(scopes)) return [...new Set(scopes.map(String).filter(Boolean))].sort();
  return String(scopes || "").split(/\s+/).filter(Boolean).sort();
}

function extractAuthContext(authResult = {}, fallback = {}) {
  return {
    subject: String(authResult.subject || fallback.subject || "anonymous"),
    clientId: String(authResult.clientId || authResult.client_id || fallback.clientId || "unknown_client"),
    audience: String(fallback.audience || ""),
    profile: String(fallback.profile || ""),
    scopes: normalizeScopes(authResult.scopes || fallback.scopes || []),
  };
}

function redactStateHandle(handle) {
  return {
    present: Boolean(handle),
    hash: hashValue(handle),
    prefix: HANDLE_PREFIX,
  };
}

function scopesCover(recordScopes = [], currentScopes = []) {
  const current = new Set(normalizeScopes(currentScopes));
  return normalizeScopes(recordScopes).every((scope) => current.has(scope));
}

function summarizeRecord(record, now = Date.now()) {
  if (!record) return null;
  const ageMs = Math.max(0, now - record.issued_at);
  return {
    handle_id_hash: record.handle_id_hash,
    kind: record.kind,
    status: record.status,
    profile: record.profile,
    scope_count: record.scopes.length,
    issued_at: record.issued_at,
    expires_at: record.expires_at,
    age_bucket_ms: ageMs < 60000 ? "lt_1m" : ageMs < 3600000 ? "lt_1h" : "gte_1h",
  };
}

function createStateHandleStore({ now = () => Date.now(), maxRecords = 1000 } = {}) {
  const records = new Map();

  function create({ kind = "tool_workflow_state", payload = {}, authContext = {}, ttlMs = DEFAULT_TTL_MS } = {}) {
    const issuedAt = now();
    const boundedTtl = Math.max(1, Math.min(Number(ttlMs) || DEFAULT_TTL_MS, MAX_TTL_MS));
    const handle = randomHandle();
    const handleHash = hashValue(handle);
    if (records.size >= maxRecords) {
      const oldest = records.keys().next().value;
      if (oldest) records.delete(oldest);
    }
    const record = {
      handle_id_hash: handleHash,
      kind: String(kind || "tool_workflow_state"),
      owner_subject_hash: hashValue(authContext.subject || ""),
      client_id_hash: hashValue(authContext.clientId || ""),
      audience: String(authContext.audience || ""),
      profile: String(authContext.profile || ""),
      scopes: normalizeScopes(authContext.scopes),
      issued_at: issuedAt,
      expires_at: issuedAt + boundedTtl,
      status: "active",
      state_version: 1,
      state_payload_ref: hashValue(JSON.stringify(payload || {})),
      payload: payload || {},
    };
    records.set(handleHash, record);
    return { handle, record };
  }

  function read({ handle, authContext = {}, kind } = {}) {
    const handleHash = hashValue(handle);
    const record = records.get(handleHash);
    const t = now();
    if (!record) return { ok: false, reason: "state_handle_not_found", redacted: redactStateHandle(handle) };
    if (record.status !== "active") return { ok: false, reason: "state_handle_revoked", record: summarizeRecord(record, t) };
    if (record.expires_at <= t) {
      record.status = "expired";
      return { ok: false, reason: "state_handle_expired", record: summarizeRecord(record, t) };
    }
    if (kind && record.kind !== String(kind)) return { ok: false, reason: "state_handle_kind_mismatch", record: summarizeRecord(record, t) };
    if (record.owner_subject_hash !== hashValue(authContext.subject || "")) return { ok: false, reason: "state_handle_unauthorized", record: summarizeRecord(record, t) };
    if (record.client_id_hash !== hashValue(authContext.clientId || "")) return { ok: false, reason: "state_handle_unauthorized", record: summarizeRecord(record, t) };
    if (record.audience !== String(authContext.audience || "")) return { ok: false, reason: "state_handle_unauthorized", record: summarizeRecord(record, t) };
    if (record.profile !== String(authContext.profile || "")) return { ok: false, reason: "state_handle_unauthorized", record: summarizeRecord(record, t) };
    if (!scopesCover(record.scopes, authContext.scopes)) return { ok: false, reason: "state_handle_scope_denied", record: summarizeRecord(record, t) };
    return { ok: true, record, payload: record.payload, summary: summarizeRecord(record, t) };
  }

  function destroy({ handle, authContext = {}, kind } = {}) {
    const result = read({ handle, authContext, kind });
    if (!result.ok) return result;
    result.record.status = "revoked";
    return { ok: true, record: result.record, summary: summarizeRecord(result.record, now()) };
  }

  return { create, read, destroy, size: () => records.size };
}

module.exports = {
  DEFAULT_TTL_MS,
  HANDLE_PREFIX,
  MAX_TTL_MS,
  createStateHandleStore,
  extractAuthContext,
  hashValue,
  normalizeScopes,
  redactStateHandle,
  summarizeRecord,
};
