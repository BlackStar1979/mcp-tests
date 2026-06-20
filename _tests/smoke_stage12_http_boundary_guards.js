"use strict";

const assert = require("node:assert/strict");
const { corsHeadersForRequest } = require("../src/runtime/cors_policy");
const { handleBatchPayloadIfNeeded, getMaxBatchItems } = require("../src/runtime/batch_payload_dispatcher");

(function corsPublicWildcardOnlyForAuthNone() {
  const pub = corsHeadersForRequest({ headers: { origin: "https://evil.example" } }, { authPolicy: { mode: "none" } });
  assert.equal(pub["access-control-allow-origin"], "*");
  const bearerBlocked = corsHeadersForRequest({ headers: { origin: "https://evil.example" } }, { authPolicy: { mode: "bearer" }, publicBaseUrl: "https://good.example/mcp" });
  assert.equal(bearerBlocked["access-control-allow-origin"], undefined);
  assert.equal(bearerBlocked.vary, "Origin");
  const bearerAllowed = corsHeadersForRequest({ headers: { origin: "https://good.example/mcp" } }, { authPolicy: { mode: "bearer" }, publicBaseUrl: "https://good.example/mcp" });
  assert.equal(bearerAllowed["access-control-allow-origin"], "https://good.example/mcp");
})();

(async function batchTooLargeGuard() {
  const writes = [];
  const res = { writeHead(code, headers) { this.statusCode = code; this.headers = headers; }, end(chunk) { writes.push(String(chunk || "")); } };
  const payload = Array.from({ length: getMaxBatchItems() + 1 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "ping", params: {} }));
  const handled = await handleBatchPayloadIfNeeded({ payload, raw: JSON.stringify(payload), res, auditLog() {}, requestId: "batch-1", httpMethod: "POST", handleRpcMessage: async () => { throw new Error("must not execute oversized batch"); } });
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(writes.join(""));
  assert.equal(body.error.code, -32600);
  assert.equal(body.error.data.reason, "batch_too_large");
  console.log("smoke_stage12_http_boundary_guards ok");
})().catch((error) => { console.error(error?.stack || error); process.exit(1); });
