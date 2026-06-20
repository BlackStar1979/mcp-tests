"use strict";

const assert = require("node:assert/strict");
const { Readable } = require("node:stream");

const { parseRpcRequestBodyOrHandleError } = require("../src/runtime/request_body_parse_handler");

function makeReq(body) {
  const req = Readable.from([Buffer.from(body, "utf8")]);
  req.headers = {};
  return req;
}

function makeRes() {
  return {
    statusCode: undefined,
    headers: {},
    body: "",
    writeHead(statusCode, headers = {}) {
      this.statusCode = statusCode;
      this.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
    },
    end(chunk = "") {
      this.body += String(chunk);
    },
  };
}

(async () => {
  const auditEvents = [];
  const res = makeRes();
  const result = await parseRpcRequestBodyOrHandleError({
    req: makeReq('{"jsonrpc":"2.0",'),
    res,
    requestId: "malformed-json-redaction-test",
    httpMethod: "POST",
    auditLog(event, payload) {
      auditEvents.push({ event, payload });
    },
  });

  assert.equal(result.ok, false);
  assert.equal(res.statusCode, 400);

  const payload = JSON.parse(res.body);
  assert.equal(payload.error.code, -32700);
  assert.equal(payload.error.message, "Parse error");
  assert.doesNotMatch(payload.error.message, /Unexpected|position|JSON/i);

  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].event, "rpc_received");
  assert.equal(auditEvents[0].payload.kind, "parse_error");
  assert.match(auditEvents[0].payload.error_message, /Unexpected|JSON|position/i);

  console.log("smoke_stage12_malformed_json_parse_error_redaction ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
