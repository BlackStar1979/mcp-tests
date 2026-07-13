"use strict";

const crypto = require("node:crypto");

const OAUTH21_PRUNE_PREVIEW_VERSION = "test-mcp-oauth21-prune-preview-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function hashPreview(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);
}

function collectReferencedClientIds({ accessTokens, refreshTokens, usedRefreshTokens, pending, codes } = {}) {
  const referencedClientIds = new Set();
  for (const item of accessTokens?.values?.() || []) if (item?.clientId) referencedClientIds.add(String(item.clientId));
  for (const item of refreshTokens?.values?.() || []) if (item?.clientId) referencedClientIds.add(String(item.clientId));
  for (const item of usedRefreshTokens?.values?.() || []) if (item?.clientId) referencedClientIds.add(String(item.clientId));
  for (const item of pending?.values?.() || []) if (item?.clientId) referencedClientIds.add(String(item.clientId));
  for (const item of codes?.values?.() || []) if (item?.clientId) referencedClientIds.add(String(item.clientId));
  return referencedClientIds;
}

function buildOAuth21PruneCandidates({
  clients,
  accessTokens,
  refreshTokens,
  usedRefreshTokens,
  pending,
  codes,
  nowMs,
  deadClientMinAgeMs,
} = {}) {
  const referencedClientIds = collectReferencedClientIds({ accessTokens, refreshTokens, usedRefreshTokens, pending, codes });

  const eligibleDeadClients = [];
  const deferredDeadClients = [];
  for (const client of clients?.values?.() || []) {
    const clientId = String(client?.client_id || "");
    if (!clientId || referencedClientIds.has(clientId)) continue;
    const issuedAtMs = Number(client?.client_id_issued_at || 0) * 1000;
    const ageMs = issuedAtMs > 0 ? Math.max(0, nowMs - issuedAtMs) : 0;
    const item = {
      client_id_hash: hashPreview(clientId),
      age_ms: ageMs,
      reason_code: ageMs >= deadClientMinAgeMs ? "dead_client_retention_elapsed" : "dead_client_retention_pending",
    };
    if (ageMs >= deadClientMinAgeMs) eligibleDeadClients.push(item);
    else deferredDeadClients.push(item);
  }

  const orphanAccessTokens = [];
  const orphanRefreshTokens = [];
  const orphanUsedRefreshTokens = [];
  for (const item of accessTokens?.values?.() || []) {
    if (!clients?.has?.(String(item?.clientId || ""))) {
      orphanAccessTokens.push({
        token_hash: hashPreview(item?.token || ""),
        client_id_hash: hashPreview(item?.clientId || ""),
        grant_id_hash: hashPreview(item?.grantId || ""),
        reason_code: "orphan_access_token_missing_client",
      });
    }
  }
  for (const item of refreshTokens?.values?.() || []) {
    if (!clients?.has?.(String(item?.clientId || ""))) {
      orphanRefreshTokens.push({
        token_hash: hashPreview(item?.token || ""),
        client_id_hash: hashPreview(item?.clientId || ""),
        grant_id_hash: hashPreview(item?.grantId || ""),
        reason_code: "orphan_refresh_token_missing_client",
      });
    }
  }
  for (const item of usedRefreshTokens?.values?.() || []) {
    if (!clients?.has?.(String(item?.clientId || ""))) {
      orphanUsedRefreshTokens.push({
        token_hash: hashPreview(item?.token || ""),
        client_id_hash: hashPreview(item?.clientId || ""),
        grant_id_hash: hashPreview(item?.grantId || ""),
        reason_code: "orphan_used_refresh_token_missing_client",
      });
    }
  }

  return {
    referenced_client_ids: referencedClientIds.size,
    dead_clients_eligible: eligibleDeadClients,
    dead_clients_deferred: deferredDeadClients,
    orphan_access_tokens: orphanAccessTokens,
    orphan_refresh_tokens: orphanRefreshTokens,
    orphan_used_refresh_tokens: orphanUsedRefreshTokens,
  };
}

function buildOAuth21PrunePreview({
  clients,
  accessTokens,
  refreshTokens,
  usedRefreshTokens,
  pending,
  codes,
  nowMs,
  deadClientMinAgeMs,
  oauthStatePath = "",
  clientsPath = "",
  maxItems = 10,
} = {}) {
  const candidates = buildOAuth21PruneCandidates({
    clients,
    accessTokens,
    refreshTokens,
    usedRefreshTokens,
    pending,
    codes,
    nowMs,
    deadClientMinAgeMs,
  });

  const totalCandidates = candidates.dead_clients_eligible.length
    + candidates.orphan_access_tokens.length
    + candidates.orphan_refresh_tokens.length
    + candidates.orphan_used_refresh_tokens.length;

  const previewCore = {
    version: OAUTH21_PRUNE_PREVIEW_VERSION,
    success: true,
    mode: "oauth21-prune-preview-read-only",
    retention_policy: {
      dead_client_min_age_ms: deadClientMinAgeMs,
      orphan_token_prune_requires_missing_client: true,
    },
    execute_allowed_now: false,
    fs_write_enabled_now: false,
    raw_identifiers_redacted: true,
    candidate_counts: {
      dead_clients_eligible: candidates.dead_clients_eligible.length,
      dead_clients_deferred: candidates.dead_clients_deferred.length,
      orphan_access_tokens: candidates.orphan_access_tokens.length,
      orphan_refresh_tokens: candidates.orphan_refresh_tokens.length,
      orphan_used_refresh_tokens: candidates.orphan_used_refresh_tokens.length,
      total_candidates: totalCandidates,
    },
    sample_candidates: {
      dead_clients_eligible: candidates.dead_clients_eligible.slice(0, maxItems),
      dead_clients_deferred: candidates.dead_clients_deferred.slice(0, maxItems),
      orphan_access_tokens: candidates.orphan_access_tokens.slice(0, maxItems),
      orphan_refresh_tokens: candidates.orphan_refresh_tokens.slice(0, maxItems),
      orphan_used_refresh_tokens: candidates.orphan_used_refresh_tokens.slice(0, maxItems),
    },
    backup_plan: {
      required: totalCandidates > 0,
      mode: "control-plane-only",
      oauth_state_file_recorded: Boolean(String(oauthStatePath || "").trim()),
      oauth_state_file_hash: String(oauthStatePath || "").trim() ? hashPreview(oauthStatePath) : "",
      oauth_clients_file_recorded: Boolean(String(clientsPath || "").trim()),
      oauth_clients_file_hash: String(clientsPath || "").trim() ? hashPreview(clientsPath) : "",
      raw_paths_redacted: true,
    },
    rollback_metadata: {
      required: totalCandidates > 0,
      raw_identifiers_redacted: true,
    },
    required_apply_sequence: totalCandidates > 0
      ? [
        "capture fresh backup of oauth state and clients files",
        "review redacted prune preview against live runtime status",
        "record prune receipt and rollback metadata",
        "execute explicit apply path in a separate controlled operation",
        "re-run oauth21 runtime status after apply",
      ]
      : [],
  };

  return {
    ...previewCore,
    preview_hash: hashJson(previewCore),
  };
}

module.exports = {
  OAUTH21_PRUNE_PREVIEW_VERSION,
  buildOAuth21PruneCandidates,
  buildOAuth21PrunePreview,
  collectReferencedClientIds,
  hashPreview,
};
