const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { diffToolLists } = require("../src/tools_list_diff");
const { HARNESS_VERSION, createMockTransport, runListChangedHarness } = require("../src/list_changed_harness");

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");
}

const transport = createMockTransport();
assert.deepEqual(transport.sent, []);
assert.equal(typeof transport.send, "function");
transport.send({ jsonrpc: "2.0", method: "test/mock" });
assert.equal(transport.sent.length, 1);
assert.deepEqual(transport.sent[0], { jsonrpc: "2.0", method: "test/mock" });

const diff = diffToolLists({ current: ["a", "b"], target: ["b", "c"] });
const dryRun = runListChangedHarness({ diff, reason: "stage8_36", correlationId: "dry" });
assert.equal(dryRun.success, true);
assert.equal(dryRun.mode, "list-changed-local-harness");
assert.equal(dryRun.harness_version, HARNESS_VERSION);
assert.equal(dryRun.allow_emit, false);
assert.equal(dryRun.would_notify, true);
assert.equal(dryRun.ready_to_emit_now, false);
assert.equal(dryRun.notification_emitted, false);
assert.equal(dryRun.transport_send_called, false);
assert.equal(dryRun.transport_sent_count, 0);
assert.deepEqual(dryRun.sent_messages, []);
assert.ok(dryRun.blockers.includes("capabilities.tools.listChanged is not true"));
assert.ok(dryRun.blockers.includes("notification emitter is not wired"));
assert.ok(dryRun.blockers.includes("real tools/list mutation is not enabled"));
assert.deepEqual(dryRun.envelope.jsonrpc_envelope, {
  jsonrpc: "2.0",
  method: "notifications/tools/list_changed",
});

const noDiff = runListChangedHarness({
  diff: diffToolLists({ current: ["a", "b"], target: ["b", "a"] }),
  capabilities: { tools: { listChanged: true } },
  allowEmit: true,
});
assert.equal(noDiff.would_notify, false);
assert.equal(noDiff.ready_to_emit_now, false);
assert.equal(noDiff.notification_emitted, false);
assert.equal(noDiff.transport_send_called, false);
assert.ok(noDiff.blockers.includes("tools/list diff is empty"));

const future = runListChangedHarness({
  diff,
  capabilities: { tools: { listChanged: true } },
  allowEmit: true,
  reason: "future harness only",
  correlationId: "future",
});
assert.equal(future.ready_to_emit_now, true);
assert.equal(future.notification_emitted, true);
assert.equal(future.transport_send_called, true);
assert.equal(future.transport_sent_count, 1);
assert.deepEqual(future.sent_messages[0], {
  jsonrpc: "2.0",
  method: "notifications/tools/list_changed",
});
assert.deepEqual(future.blockers, []);
assert.equal(future.envelope.notification_emitted, false, "bus envelope remains dry-run even when harness mock sends");

const serverJs = read("server.js");
const initializeResponseJs = read("src/runtime/initialize_response.js");
assert.match(initializeResponseJs, /listChanged:\s*false/);
assert.equal(serverJs.includes("notifications/tools/list_changed"), false, "server.js must still not emit list_changed");
assert.equal(initializeResponseJs.includes("notifications/tools/list_changed"), false, "initialize response builder must still not emit list_changed");

console.log("smoke_stage8_36_list_changed_local_harness ok");
