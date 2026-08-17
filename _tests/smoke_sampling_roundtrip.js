"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  isJsonRpcResponse,
  rejectClientResponseEnvelope,
} = require("../src/runtime/outbound_request_manager");

const ROOT = path.resolve(__dirname, "..");

function listJavaScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(absolute);
    return entry.isFile() && entry.name.endsWith(".js") ? [absolute] : [];
  });
}

const activeSources = listJavaScriptFiles(path.join(ROOT, "src"));
for (const absolute of activeSources) {
  const source = fs.readFileSync(absolute, "utf8");
  assert.equal(source.includes("sampling/createMessage"), false, path.relative(ROOT, absolute));
  assert.equal(source.includes('require("./sampling_context")'), false, path.relative(ROOT, absolute));
  assert.equal(source.includes('require("./session")'), false, path.relative(ROOT, absolute));
}

const staleResponse = { jsonrpc: "2.0", id: 17, error: { code: -1, message: "late" } };
assert.equal(isJsonRpcResponse(staleResponse), true);
assert.deepEqual(rejectClientResponseEnvelope(staleResponse), {
  ok: false,
  reason: "server_initiated_requests_not_active",
  id: 17,
});

console.log("smoke_sampling_roundtrip ok");
