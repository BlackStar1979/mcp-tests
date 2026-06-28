"use strict";

const { encodeSseEvent } = require("./sse_response");

const LIST_CHANGED_METHOD = "notifications/tools/list_changed";

function createToolsListChangedNotifier({ state = {}, serverStartId = "" } = {}) {
  const notifiedSessions = new Set();
  const enabled = true;
  const pending = Boolean(state.surface_changed_since_last_start);
  const current = state.current_surface || {};
  const previous = state.previous_surface || null;

  function summary() {
    return {
      enabled,
      pending,
      server_start_id: String(serverStartId || state.server_start_id || ""),
      current_fingerprint: current.combined_fingerprint || "",
      previous_fingerprint: previous?.combined_fingerprint || "",
      notified_session_count: notifiedSessions.size,
    };
  }

  function emitToSession({ session, auditLog, requestId = "" } = {}) {
    if (!session || !session.id) return { emitted: false, reason: "missing_session" };
    if (!enabled) return { emitted: false, reason: "disabled" };
    if (!pending) return { emitted: false, reason: "no_surface_change" };
    if (notifiedSessions.has(session.id)) return { emitted: false, reason: "session_already_notified" };

    const message = { jsonrpc: "2.0", method: LIST_CHANGED_METHOD };
    const event = encodeSseEvent({ event: "message", data: message });
    session.enqueueOutbound(event);
    notifiedSessions.add(session.id);

    const receipt = {
      emitted: true,
      method: LIST_CHANGED_METHOD,
      session_id: session.id,
      request_id: requestId || "",
      server_start_id: String(serverStartId || state.server_start_id || ""),
      previous_fingerprint: previous?.combined_fingerprint || "",
      current_fingerprint: current.combined_fingerprint || "",
    };
    if (typeof auditLog === "function") auditLog("tools_list_changed_emitted", receipt);
    return receipt;
  }

  return { enabled, pending, summary, emitToSession };
}

module.exports = { LIST_CHANGED_METHOD, createToolsListChangedNotifier };
