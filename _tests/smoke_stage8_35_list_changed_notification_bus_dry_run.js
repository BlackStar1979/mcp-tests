const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { diffToolLists } = require("../src/tools_list_diff");
const {
  LIST_CHANGED_METHOD,
  NOTIFICATION_BUS_VERSION,
  buildListChangedNotificationEnvelope,
  evaluateListChangedReadiness,
  hasMeaningfulDiff,
} = require("../src/list_changed_notification_bus");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const diff = diffToolLists({ current: ["a", "b"], target: ["b", "c"] });
assert.equal(hasMeaningfulDiff(diff), true);
assert.equal(LIST_CHANGED_METHOD, "notifications/tools/list_changed");
assert.equal(NOTIFICATION_BUS_VERSION, "test-mcp-list-changed-bus-v1");

const envelope = buildListChangedNotificationEnvelope({
  diff,
  reason: "stage 8.35 smoke",
  correlationId: "stage8_35",
});
assert.equal(envelope.success, true);
assert.equal(envelope.mode, "list-changed-notification-dry-run");
assert.deepEqual(envelope.jsonrpc_envelope, {
  jsonrpc: "2.0",
  method: "notifications/tools/list_changed",
});
assert.equal(envelope.would_notify, true);
assert.equal(envelope.notification_emitted, false);
assert.equal(envelope.transport_send_called, false);
assert.equal(envelope.list_changed_enabled_now, false);
assert.equal(envelope.real_client_notification_enabled, false);
assert.ok(envelope.blockers.includes("server capabilities.tools.listChanged is false"));
assert.ok(envelope.blockers.includes("notification transport emitter is not wired"));
assert.ok(envelope.blockers.includes("real tools/list mutation is disabled"));
assert.equal(typeof envelope.jsonrpc_envelope_hash, "string");
assert.equal(typeof envelope.diff_hash, "string");

const noDiff = diffToolLists({ current: ["a", "b"], target: ["b", "a"] });
const noDiffEnvelope = buildListChangedNotificationEnvelope({ diff: noDiff });
assert.equal(noDiffEnvelope.would_notify, false);
assert.equal(noDiffEnvelope.notification_emitted, false);
assert.deepEqual(noDiffEnvelope.blockers, []);

const currentReadiness = evaluateListChangedReadiness({
  capabilities: { tools: { listChanged: false } },
  diff,
  notificationBus: { emitter_wired: false, real_tools_list_mutation_enabled: false },
});
assert.equal(currentReadiness.ready_to_emit_now, false);
assert.equal(currentReadiness.declared_list_changed, false);
assert.equal(currentReadiness.emitter_wired, false);
assert.equal(currentReadiness.real_tools_list_mutation_enabled, false);
assert.equal(currentReadiness.meaningful_diff, true);
assert.equal(currentReadiness.notification_emitted, false);
assert.ok(currentReadiness.blockers.includes("capabilities.tools.listChanged is not true"));
assert.ok(currentReadiness.blockers.includes("notification emitter is not wired"));
assert.ok(currentReadiness.blockers.includes("real tools/list mutation is not enabled"));

const futureReadiness = evaluateListChangedReadiness({
  capabilities: { tools: { listChanged: true } },
  diff,
  notificationBus: { emitter_wired: true, real_tools_list_mutation_enabled: true },
});
assert.equal(futureReadiness.ready_to_emit_now, true);
assert.deepEqual(futureReadiness.blockers, []);
assert.equal(futureReadiness.notification_emitted, false, "even future readiness check must not emit");

const serverJs = read("server.js");
const initializeResponseJs = read("src/runtime/initialize_response.js");
assert.equal(serverJs.includes("notifications/tools/list_changed"), false, "server.js must still not emit list_changed");
assert.equal(initializeResponseJs.includes("notifications/tools/list_changed"), false, "initialize response builder must still not emit raw list_changed notification");

console.log("smoke_stage8_35_list_changed_notification_bus_dry_run ok");
