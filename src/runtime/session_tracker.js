"use strict";

const SESSION_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const DEFAULT_MAX_SESSION_IDS = 1000;
const DEFAULT_MAX_REQUEST_IDS_PER_SESSION = 1000;

function normalizeSessionId(value) {
  if (Array.isArray(value)) value = value[0];
  if (value === undefined || value === null || value === "") return undefined;
  const sessionId = String(value).trim();
  if (!SESSION_ID_RE.test(sessionId)) return null;
  return sessionId;
}

function getRequestSessionId(req = {}) {
  return normalizeSessionId(req.headers?.["mcp-session-id"]);
}

function createSessionReplayTracker({ maxSessions = DEFAULT_MAX_SESSION_IDS, maxIdsPerSession = DEFAULT_MAX_REQUEST_IDS_PER_SESSION } = {}) {
  const sessions = new Map();
  function pruneSessionsIfNeeded() {
    while (sessions.size > maxSessions) {
      const oldest = sessions.keys().next().value;
      if (oldest === undefined) break;
      sessions.delete(oldest);
    }
  }
  function getSession(sessionId) {
    let session = sessions.get(sessionId);
    if (!session) {
      session = { ids: new Set(), order: [] };
      sessions.set(sessionId, session);
      pruneSessionsIfNeeded();
    }
    return session;
  }
  function remember({ sessionId, rpcId }) {
    if (rpcId === undefined) return { ok: true, notification: true };
    const sid = normalizeSessionId(sessionId);
    if (sid === undefined) return { ok: true, no_session: true };
    if (!sid) return { ok: false, reason: "invalid_session_id" };
    const key = `${typeof rpcId}:${String(rpcId)}`;
    const session = getSession(sid);
    // Real MCP clients (ChatGPT, Claude) legitimately reuse rpc id values across
    // sequential calls within a session — id uniqueness is only required for
    // matching in-flight responses, not for the session lifetime. Rejecting a
    // reused id broke every tools/call (-32600 request_id_reused). Track for
    // observability but never reject.
    if (session.ids.has(key)) return { ok: true, reused: true };
    session.ids.add(key);
    session.order.push(key);
    while (session.order.length > maxIdsPerSession) {
      const old = session.order.shift();
      session.ids.delete(old);
    }
    return { ok: true };
  }
  return { remember, session_count: () => sessions.size };
}

module.exports = { DEFAULT_MAX_REQUEST_IDS_PER_SESSION, DEFAULT_MAX_SESSION_IDS, SESSION_ID_RE, createSessionReplayTracker, getRequestSessionId, normalizeSessionId };
