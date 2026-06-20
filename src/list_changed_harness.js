const { buildListChangedNotificationEnvelope, evaluateListChangedReadiness } = require("./list_changed_notification_bus");

const HARNESS_VERSION = "test-mcp-list-changed-harness-v1";

function createMockTransport() {
  const sent = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return { ok: true };
    },
  };
}

function runListChangedHarness({ diff, capabilities = { tools: { listChanged: false } }, allowEmit = false, reason = "", correlationId = "" } = {}) {
  const transport = createMockTransport();
  const envelope = buildListChangedNotificationEnvelope({ diff, reason, correlationId });
  const readiness = evaluateListChangedReadiness({
    capabilities,
    diff,
    notificationBus: {
      emitter_wired: allowEmit,
      real_tools_list_mutation_enabled: allowEmit,
    },
  });

  const canSend = allowEmit === true && readiness.ready_to_emit_now === true;
  if (canSend) {
    transport.send(envelope.jsonrpc_envelope);
  }

  return {
    success: true,
    mode: "list-changed-local-harness",
    harness_version: HARNESS_VERSION,
    allow_emit: allowEmit === true,
    would_notify: envelope.would_notify,
    ready_to_emit_now: readiness.ready_to_emit_now,
    notification_emitted: canSend,
    transport_send_called: transport.sent.length > 0,
    transport_sent_count: transport.sent.length,
    sent_messages: transport.sent,
    envelope,
    readiness,
    blockers: canSend ? [] : readiness.blockers,
  };
}

module.exports = {
  HARNESS_VERSION,
  createMockTransport,
  runListChangedHarness,
};
