const crypto = require("node:crypto");

const LIST_CHANGED_METHOD = "notifications/tools/list_changed";
const NOTIFICATION_BUS_VERSION = "test-mcp-list-changed-bus-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function hasMeaningfulDiff(diff = {}) {
  return Boolean(diff?.would_change_tools_list || Number(diff?.change_count || 0) > 0);
}

function buildListChangedNotificationEnvelope({ diff, reason = "", correlationId = "" } = {}) {
  const wouldNotify = hasMeaningfulDiff(diff);
  const envelope = {
    jsonrpc: "2.0",
    method: LIST_CHANGED_METHOD,
  };

  return {
    success: true,
    mode: "list-changed-notification-dry-run",
    notification_bus_version: NOTIFICATION_BUS_VERSION,
    method: LIST_CHANGED_METHOD,
    jsonrpc_envelope: envelope,
    jsonrpc_envelope_hash: hashJson(envelope),
    diff_hash: hashJson({
      current_tools_hash: diff?.current_tools_hash || "",
      target_tools_hash: diff?.target_tools_hash || "",
      add: diff?.add || [],
      remove: diff?.remove || [],
    }),
    would_notify: wouldNotify,
    notification_emitted: false,
    transport_send_called: false,
    list_changed_enabled_now: false,
    real_client_notification_enabled: false,
    reason: String(reason || ""),
    correlation_id: String(correlationId || ""),
    blockers: wouldNotify
      ? [
          "server capabilities.tools.listChanged is false",
          "notification transport emitter is not wired",
          "real tools/list mutation is disabled",
        ]
      : [],
    warnings: wouldNotify ? ["dry-run only; do not send this envelope to a client in Stage 8 / Step 35"] : [],
  };
}

function evaluateListChangedReadiness({ capabilities = {}, diff = {}, notificationBus = {} } = {}) {
  const toolsCapabilities = capabilities.tools || {};
  const declaredListChanged = toolsCapabilities.listChanged === true;
  const meaningfulDiff = hasMeaningfulDiff(diff);
  const emitterWired = notificationBus.emitter_wired === true;
  const mutationEnabled = notificationBus.real_tools_list_mutation_enabled === true;

  const blockers = [];
  if (!declaredListChanged) blockers.push("capabilities.tools.listChanged is not true");
  if (!emitterWired) blockers.push("notification emitter is not wired");
  if (!mutationEnabled) blockers.push("real tools/list mutation is not enabled");
  if (!meaningfulDiff) blockers.push("tools/list diff is empty");

  return {
    success: true,
    mode: "list-changed-readiness-preview-only",
    notification_bus_version: NOTIFICATION_BUS_VERSION,
    method: LIST_CHANGED_METHOD,
    declared_list_changed: declaredListChanged,
    emitter_wired: emitterWired,
    real_tools_list_mutation_enabled: mutationEnabled,
    meaningful_diff: meaningfulDiff,
    ready_to_emit_now: declaredListChanged && emitterWired && mutationEnabled && meaningfulDiff,
    notification_emitted: false,
    blockers,
    required_before_emit: [
      "set capabilities.tools.listChanged=true only after emitter exists",
      "wire notification emitter in a transport-specific layer",
      "apply tools/list diff transactionally or keep dry-run",
      "audit proposed and applied tool-surface hashes",
      "verify connector refresh/list_changed behavior in a local harness",
    ],
  };
}

module.exports = {
  LIST_CHANGED_METHOD,
  NOTIFICATION_BUS_VERSION,
  buildListChangedNotificationEnvelope,
  evaluateListChangedReadiness,
  hasMeaningfulDiff,
};
