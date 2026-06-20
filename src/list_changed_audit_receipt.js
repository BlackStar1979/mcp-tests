const crypto = require("node:crypto");

const LIST_CHANGED_RECEIPT_VERSION = "test-mcp-list-changed-receipt-v1";

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildListChangedAuditReceipt({ harnessResult = {}, stage = "", operation = "dry_run", operator = "", reason = "" } = {}) {
  const envelope = harnessResult.envelope || {};
  const readiness = harnessResult.readiness || {};
  const sentMessages = Array.isArray(harnessResult.sent_messages) ? harnessResult.sent_messages : [];
  const sentHashes = sentMessages.map((message) => hashJson(message));
  const blockers = Array.isArray(harnessResult.blockers) ? harnessResult.blockers : [];

  const receipt = {
    version: LIST_CHANGED_RECEIPT_VERSION,
    stage: normalizeText(stage),
    operation: normalizeText(operation || "dry_run"),
    operator_recorded: Boolean(normalizeText(operator)),
    reason_recorded: Boolean(normalizeText(reason)),
    method: envelope.method || "notifications/tools/list_changed",
    would_notify: Boolean(harnessResult.would_notify),
    ready_to_emit_now: Boolean(harnessResult.ready_to_emit_now),
    notification_emitted: Boolean(harnessResult.notification_emitted),
    transport_send_called: Boolean(harnessResult.transport_send_called),
    transport_sent_count: Number(harnessResult.transport_sent_count || 0),
    allow_emit: Boolean(harnessResult.allow_emit),
    envelope_hash: envelope.jsonrpc_envelope_hash || hashJson(envelope.jsonrpc_envelope || {}),
    diff_hash: envelope.diff_hash || "",
    readiness_hash: hashJson({
      declared_list_changed: readiness.declared_list_changed === true,
      emitter_wired: readiness.emitter_wired === true,
      real_tools_list_mutation_enabled: readiness.real_tools_list_mutation_enabled === true,
      meaningful_diff: readiness.meaningful_diff === true,
      ready_to_emit_now: readiness.ready_to_emit_now === true,
    }),
    sent_message_hashes: sentHashes,
    blocker_count: blockers.length,
    blockers_hash: hashJson(blockers),
    raw_messages_redacted: true,
    raw_tool_lists_redacted: true,
    success: true,
  };

  return {
    ...receipt,
    receipt_hash: hashJson(receipt),
  };
}

function verifyListChangedAuditReceipt(receipt = {}) {
  const errors = [];
  if (receipt.version !== LIST_CHANGED_RECEIPT_VERSION) errors.push("unsupported receipt version");
  if (receipt.method !== "notifications/tools/list_changed") errors.push("unexpected method");
  if (receipt.raw_messages_redacted !== true) errors.push("raw messages must be redacted");
  if (receipt.raw_tool_lists_redacted !== true) errors.push("raw tool lists must be redacted");
  if (receipt.notification_emitted === true && receipt.transport_send_called !== true) errors.push("emitted receipt must have transport_send_called=true");
  if (receipt.transport_sent_count > 0 && receipt.notification_emitted !== true) errors.push("sent count requires notification_emitted=true");
  if (!Array.isArray(receipt.sent_message_hashes)) errors.push("sent_message_hashes must be an array");
  if (!receipt.receipt_hash || typeof receipt.receipt_hash !== "string") errors.push("receipt_hash is required");

  const copy = { ...receipt };
  delete copy.receipt_hash;
  if (receipt.receipt_hash && receipt.receipt_hash !== hashJson(copy)) errors.push("receipt_hash mismatch");

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    version: LIST_CHANGED_RECEIPT_VERSION,
    errors,
  };
}

module.exports = {
  LIST_CHANGED_RECEIPT_VERSION,
  buildListChangedAuditReceipt,
  verifyListChangedAuditReceipt,
};
