"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/session.js")), false);
assert.equal(fs.existsSync(path.join(ROOT, "src/runtime/sampling_context.js")), false);

const manager = require("../src/runtime/outbound_request_manager");
assert.deepEqual(Object.keys(manager).sort(), ["isJsonRpcResponse", "rejectClientResponseEnvelope"]);

const managerSource = read("src/runtime/outbound_request_manager.js");
for (const retiredToken of ["encodeSseEvent", "enqueueOutbound", "nextOutboundId", ".pending", "setTimeout("]) {
  assert.equal(managerSource.includes(retiredToken), false, retiredToken);
}

for (const rel of ["src/runtime/single_payload_dispatcher.js", "src/runtime/batch_payload_dispatcher.js"]) {
  const source = read(rel);
  assert.ok(source.includes("rejectClientResponseEnvelope"), rel);
  assert.equal(source.includes("resolvePendingResponse"), false, rel);
  assert.equal(source.includes("pending_response_resolved"), false, rel);
}

console.log("smoke_outbound_queue ok");
