"use strict";

const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function check(rel) { const result = childProcess.spawnSync(process.execPath, ["--check", rel], { cwd: ROOT, encoding: "utf8" }); assert.equal(result.status, 0, rel + " syntax check failed"); }

check("server.js");
check("src/runtime/server_factory.js");
check("src/runtime/server_lifecycle.js");
check("src/runtime/runtime_context_assembly.js");

const server = read("server.js");
const lifecycle = read("src/runtime/server_lifecycle.js");
const assembly = read("src/runtime/runtime_context_assembly.js");
const factorySource = read("src/runtime/server_factory.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(server.includes("./src/runtime/server_bootstrap_runtime"), "server.js must import server_bootstrap_runtime");
assert.ok(bootstrap.includes("./runtime_context_assembly"), "server bootstrap runtime must import runtime_context_assembly");
assert.equal(server.includes("./src/runtime/server_lifecycle"), false, "server.js must not import server_lifecycle directly after runtime context extraction");
assert.equal(server.includes("./src/runtime/server_factory"), false, "server.js must not import server_factory directly after lifecycle extraction");
assert.ok(assembly.includes("./server_lifecycle"), "runtime_context_assembly must import server_lifecycle");
assert.ok(lifecycle.includes("./server_factory"), "server_lifecycle must import server_factory");
assert.equal(server.includes("const http = require(\"node:http\")"), false, "server.js must not import node:http directly");
assert.equal(server.includes("const { URL } = require(\"node:url\")"), false, "server.js must not import URL directly");
assert.equal(server.includes("function createServer()"), false, "server.js must not keep inline createServer implementation");
assert.equal(server.includes("const server = createServer({"), false, "server.js must not create server directly after lifecycle extraction");
assert.ok(factorySource.includes("const http = require(\"node:http\")"));
assert.ok(factorySource.includes("const { URL } = require(\"node:url\")"));
assert.ok(factorySource.includes("function createServer({"));
assert.ok(factorySource.includes("dispatchCreateServerRoute({"));
const { createServer } = require("../src/runtime/server_factory");
let dispatchCount = 0;
const httpServer = createServer({ host: "127.0.0.1", port: 3009, dispatchCreateServerRoute(args) { dispatchCount += 1; assert.equal(typeof args.url.href, "string"); assert.equal(args.serverName, "test-server"); args.res.end("ok"); }, handleMcp() {}, handleHealthRoute() {}, handleDocsRoute() {}, handleNotFoundRoute() {}, jsonResponse() {}, textResponse() {}, fetchDoc() {}, documentRuntimeContext: {}, serverName: "test-server", serverVersion: "0.0.0", connectorShapeVersion: "shape", outputMode: "structured", maxFetchTextChars: 2500, auditVersion: "audit", authPolicy: { mode: "none" }, runtimeProfile: "public", stageStatus: {}, securityBoundary: {}, publicBaseUrl: "http://example.invalid", toolsList: () => [] });
assert.equal(typeof httpServer.listen, "function");
httpServer.emit("request", { url: "/healthz", headers: { host: "example.invalid" } }, { setHeader() {}, end() {} });
const blockedOriginRes = {
  headersSent: false,
  statusCode: undefined,
  body: "",
  setHeader() {},
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(chunk = "") { this.body += String(chunk); },
  destroy(error) { throw error; },
};
httpServer.emit("request", { url: "/mcp", headers: { host: "example.invalid", origin: "https://evil.example" } }, blockedOriginRes);
const oauthOriginRes = {
  headersSent: false,
  statusCode: undefined,
  body: "",
  setHeader() {},
  writeHead(code) { this.statusCode = code; this.headersSent = true; },
  end(chunk = "") { this.body += String(chunk); },
  destroy(error) { throw error; },
};
httpServer.emit("request", { url: "/oauth/operator-login", method: "POST", headers: { host: "example.invalid", origin: "null" } }, oauthOriginRes);
setImmediate(() => {
  assert.equal(blockedOriginRes.statusCode, 403, "invalid Origin on the MCP transport must return HTTP 403");
  assert.equal(dispatchCount, 2, "OAuth authorization-server routes must not be rejected by the MCP transport Origin gate");
  assert.notEqual(oauthOriginRes.statusCode, 403, "OAuth operator login must reach the authorization-server route even with an opaque browser Origin");
  console.log("smoke_server_factory_extraction ok");
});