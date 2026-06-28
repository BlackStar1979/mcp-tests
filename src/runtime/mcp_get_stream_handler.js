"use strict";

const { jsonResponse } = require("./http_responses");
const { rpcError } = require("./rpc_responses");
const { writeSseComment, writeSseEvent, writeSseHead } = require("./sse_response");

const DEFAULT_SSE_KEEPALIVE_INTERVAL_MS = 25000;

function getLastEventId(req = {}) {
  const headers = req.headers || {};
  return headers["last-event-id"] || headers["Last-Event-ID"] || undefined;
}

function startKeepalive(res, intervalMs = DEFAULT_SSE_KEEPALIVE_INTERVAL_MS) {
  if (!intervalMs || intervalMs <= 0) return null;
  const timer = setInterval(() => {
    if (typeof res?.write === "function") {
      writeSseComment(res, "keepalive");
    }
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

function handleMcpGetStream({ req, res, requestId, sessionId, sessionStore, auditLog, keepaliveIntervalMs = DEFAULT_SSE_KEEPALIVE_INTERVAL_MS, listChangedNotifier } = {}) {
  if (sessionId === undefined) {
    jsonResponse(res, 400, rpcError(null, -32000, "Missing session", { reason: "missing_session" }));
    return;
  }

  const session = sessionStore ? sessionStore.get(sessionId) : null;
  if (!session) {
    jsonResponse(res, 404, rpcError(null, -32000, "Unknown session", { reason: "unknown_session" }));
    return;
  }

  const lastEventId = getLastEventId(req);
  const replayValidation = session.validateReplayRequest(lastEventId);
  if (!replayValidation.ok) {
    auditLog("sse_replay_rejected", { request_id: requestId, session_id: session.id, reason: replayValidation.reason, last_event_id: lastEventId || "" });
    jsonResponse(res, replayValidation.status || 409, rpcError(null, -32000, "Replay unavailable", { reason: replayValidation.reason }));
    return;
  }
  writeSseHead(res, 200);
  session.attachStream(res, { lastEventId });
  auditLog("sse_stream_opened", { request_id: requestId, last_event_id: lastEventId || "", session: session.toAuditSummary() });

  writeSseEvent(res, {
    event: "ready",
    data: {
      jsonrpc: "2.0",
      method: "notifications/stream/ready",
      params: { sessionId: session.id },
    },
  });

  if (listChangedNotifier && typeof listChangedNotifier.emitToSession === "function") {
    listChangedNotifier.emitToSession({ session, auditLog, requestId });
  }

  const keepaliveTimer = startKeepalive(res, keepaliveIntervalMs);
  const detach = () => {
    if (keepaliveTimer) clearInterval(keepaliveTimer);
    session.detachStream(res);
    auditLog("sse_stream_closed", { request_id: requestId, session_id: session.id });
  };

  if (typeof req?.on === "function") {
    req.on("close", detach);
    req.on("aborted", detach);
  }
}

module.exports = {
  DEFAULT_SSE_KEEPALIVE_INTERVAL_MS,
  getLastEventId,
  handleMcpGetStream,
  startKeepalive,
};
