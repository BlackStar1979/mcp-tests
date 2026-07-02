"use strict";

const assert = require("node:assert/strict");
const { dispatchMcpEntry } = require("../src/runtime/mcp_entry_dispatcher");

function req({ accept = "application/json, text/event-stream", body, headers = {} } = {}) {
  return {
    method: "POST",
    headers: {
      accept,
      "content-type": "application/json",
      ...headers,
    },
    on() {},
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from(body, "utf8");
    },
  };
}

function res() {
  return {
    statusCode: null,
    headers: {},
    chunks: [],
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    writeHead(code, headers) {
      this.statusCode = code;
      for (const [name, value] of Object.entries(headers || {})) this.headers[String(name).toLowerCase()] = value;
    },
    write(chunk) { this.chunks.push(String(chunk)); },
    end(chunk) { if (chunk) this.chunks.push(String(chunk)); },
    body() { return this.chunks.join(""); },
  };
}

(async () => {
  const payload = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: {} });
  const response = res();
  const audits = [];

  await dispatchMcpEntry({
    req: req({ body: payload }),
    res: response,
    requestId: "post-json-only",
    authPolicy: { mode: "none", authenticate: () => ({ ok: true }) },
    auditLog: (event, data) => audits.push({ event, data }),
    handleRpcMessage: async () => ({ jsonrpc: "2.0", id: 1, result: { ok: true } }),
    publicBaseUrl: "http://127.0.0.1/mcp",
    sessionStore: null,
  });

  assert.equal(response.statusCode, 200);
  assert.ok(String(response.headers["content-type"] || "").startsWith("application/json"));
  assert.equal(response.body().includes("event: message"), false);
  assert.deepEqual(JSON.parse(response.body()).result, { ok: true });
  assert.equal(audits.some((entry) => entry.event === "streamable_http_preflight" && entry.data.reason === "accept_must_include_json"), false);

  console.log("smoke_keep_mcp_post_accept_json_only_cleanup ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
