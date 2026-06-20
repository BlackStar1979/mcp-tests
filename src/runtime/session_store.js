"use strict";

const crypto = require("node:crypto");
const { McpSession } = require("./session");
const { normalizeSessionId } = require("./session_tracker");

const DEFAULT_SESSION_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 1000;

function createSessionId() {
  return `mcp_${crypto.randomBytes(24).toString("base64url")}`;
}

function createSessionStore({ ttlMs = DEFAULT_SESSION_TTL_MS, maxSessions = DEFAULT_MAX_SESSIONS, now = () => Date.now() } = {}) {
  const sessions = new Map();

  function pruneExpired() {
    const current = now();
    for (const [id, session] of sessions.entries()) {
      if (session.isExpired(current)) sessions.delete(id);
    }
    while (sessions.size > maxSessions) {
      const oldest = sessions.keys().next().value;
      if (oldest === undefined) break;
      sessions.delete(oldest);
    }
  }

  function create({ protocolVersion, clientCapabilities } = {}) {
    pruneExpired();
    let id;
    do {
      id = createSessionId();
    } while (sessions.has(id));
    const session = new McpSession({ id, protocolVersion, clientCapabilities, createdAt: now(), ttlMs });
    sessions.set(id, session);
    return session;
  }

  function get(id) {
    const normalized = normalizeSessionId(id);
    if (!normalized) return null;
    const session = sessions.get(normalized);
    if (!session) return null;
    if (session.isExpired(now())) {
      sessions.delete(normalized);
      return null;
    }
    session.touch(now());
    return session;
  }

  function remove(id) {
    const normalized = normalizeSessionId(id);
    if (!normalized) return false;
    return sessions.delete(normalized);
  }

  return {
    create,
    get,
    remove,
    pruneExpired,
    size: () => sessions.size,
    _sessions: sessions,
  };
}

module.exports = {
  DEFAULT_MAX_SESSIONS,
  DEFAULT_SESSION_TTL_MS,
  createSessionId,
  createSessionStore,
};
