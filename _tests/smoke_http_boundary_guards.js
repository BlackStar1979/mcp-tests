"use strict";

const assert = require("node:assert/strict");
const { handleAuthRejection } = require("../src/runtime/auth_rejection_handler");
const { handleCorsPreflight } = require("../src/runtime/cors_preflight_handler");
const { corsHeadersForRequest } = require("../src/runtime/cors_policy");
const { handleBatchPayloadIfNeeded, getMaxBatchItems } = require("../src/runtime/batch_payload_dispatcher");
const { handleMethodNotAllowed } = require("../src/runtime/method_not_allowed_handler");
const { handleRpcHandlerException } = require("../src/runtime/rpc_handler_exception_handler");

function makeRes() {
  return {
    statusCode: undefined,
    headers: {},
    body: "",
    writeHead(code, headers = {}) {
      this.statusCode = code;
      this.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]));
    },
    end(chunk = "") {
      this.body += String(chunk);
    },
  };
}

function corsPublicWildcardOnlyForAuthNone() {
  const pub = corsHeadersForRequest({ headers: { origin: "https://evil.example" } }, { authPolicy: { mode: "none" } });
  assert.equal(pub["access-control-allow-origin"], "*");
  const bearerBlocked = corsHeadersForRequest({ headers: { origin: "https://evil.example" } }, { authPolicy: { mode: "bearer" }, publicBaseUrl: "https://good.example/mcp" });
  assert.equal(bearerBlocked["access-control-allow-origin"], undefined);
  assert.equal(bearerBlocked.vary, "Origin");
  const bearerAllowed = corsHeadersForRequest({ headers: { origin: "https://good.example/mcp" } }, { authPolicy: { mode: "bearer" }, publicBaseUrl: "https://good.example/mcp" });
  assert.equal(bearerAllowed["access-control-allow-origin"], "https://good.example/mcp");
}

async function batchTooLargeGuard() {
  const writes = [];
  const res = { writeHead(code, headers) { this.statusCode = code; this.headers = headers; }, end(chunk) { writes.push(String(chunk || "")); } };
  const payload = Array.from({ length: getMaxBatchItems() + 1 }, (_, i) => ({ jsonrpc: "2.0", id: i + 1, method: "ping", params: {} }));
  const audits = [];
  const handled = await handleBatchPayloadIfNeeded({
    payload,
    raw: JSON.stringify(payload),
    res,
    auditLog(event, data) { audits.push({ event, data }); },
    requestId: "batch-1",
    httpMethod: "POST",
    handleRpcMessage: async () => { throw new Error("must not execute oversized batch"); },
  });
  assert.equal(handled, true);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(writes.join(""));
  assert.equal(body.error.code, -32600);
  assert.equal(body.error.data.reason, "batch_too_large");
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.phase === "batch_too_large" &&
    item.data.status_code === 200 &&
    item.data.batch === true &&
    item.data.response_mode === "json"
  ));
}

function methodNotAllowedAndCorsAndAuthAndExceptionAreAudited() {
  const audits = [];
  const auditLog = (event, data) => audits.push({ event, data });

  const methodRes = makeRes();
  handleMethodNotAllowed({
    res: methodRes,
    auditLog,
    requestId: "method-1",
    httpMethod: "GET",
  });
  assert.equal(methodRes.statusCode, 405);
  assert.equal(JSON.parse(methodRes.body).error.code, -32000);
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.phase === "method_not_allowed" &&
    item.data.status_code === 405 &&
    item.data.has_error === true &&
    item.data.error_code === -32000
  ));

  const corsRes = makeRes();
  handleCorsPreflight({
    req: { headers: { origin: "https://good.example/mcp" } },
    res: corsRes,
    auditLog,
    requestId: "cors-1",
    httpMethod: "OPTIONS",
    authPolicy: { mode: "none" },
    publicBaseUrl: "https://good.example/mcp",
  });
  assert.equal(corsRes.statusCode, 204);
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.phase === "cors_preflight" &&
    item.data.status_code === 204 &&
    item.data.response_mode === "empty"
  ));

  const authRes = makeRes();
  handleAuthRejection({
    res: authRes,
    auditLog,
    requestId: "auth-1",
    httpMethod: "POST",
    authResult: { status: 401, mode: "oauth21", error: "missing_token" },
    authPolicy: { mode: "oauth21" },
  });
  assert.equal(authRes.statusCode, 401);
  assert.equal(JSON.parse(authRes.body).error.code, -32001);
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.phase === "auth_rejected" &&
    item.data.status_code === 401 &&
    item.data.has_error === true &&
    item.data.error_code === -32001
  ));

  const exceptionRes = makeRes();
  handleRpcHandlerException({
    res: exceptionRes,
    auditLog,
    requestId: "exception-1",
    payload: { id: 7 },
    error: new Error("boom"),
    abortSignal: null,
  });
  assert.equal(exceptionRes.statusCode, 500);
  assert.equal(JSON.parse(exceptionRes.body).error.code, -32603);
  assert.ok(audits.some((item) =>
    item.event === "rpc_response_sent" &&
    item.data.phase === "rpc_handler_exception" &&
    item.data.status_code === 500 &&
    item.data.has_error === true &&
    item.data.error_code === -32603
  ));

  console.log("smoke_http_boundary_guards ok");
}

(async () => {
  corsPublicWildcardOnlyForAuthNone();
  await batchTooLargeGuard();
  methodNotAllowedAndCorsAndAuthAndExceptionAreAudited();
})().catch((error) => { console.error(error?.stack || error); process.exit(1); });
