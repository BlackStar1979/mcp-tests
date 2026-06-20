const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const server = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const startupReportBuilder = fs.readFileSync(path.join(ROOT, "src", "runtime", "startup_report_builder.js"), "utf8");
const runtimeStatusAssembly = fs.readFileSync(path.join(ROOT, "src", "runtime", "runtime_status_assembly.js"), "utf8");
const serverLifecycle = fs.readFileSync(path.join(ROOT, "src", "runtime", "server_lifecycle.js"), "utf8");
const identity = require("../src/runtime/identity");
const { buildToolLabelsSync } = require("../src/tool_labels");
const { formatStartupReport } = require("../src/startup_report");

assert.equal(identity.SERVER_VERSION, "0.30.0");
assert.equal(identity.CONNECTOR_SHAPE_VERSION, "2025-05-strict-v1");
assert.equal(identity.STARTUP_REPORT_VERSION, "test-mcp-startup-report-v1");
assert.equal(identity.LABELS_VERSION, "test-mcp-labels-v1");
assert.ok(!server.includes("optionalTools="));
assert.ok(serverLifecycle.includes("buildStartupReport"));
assert.ok(serverLifecycle.includes("printStartupReport"));
assert.ok(startupReportBuilder.includes("formatStartupReport"));
assert.ok(runtimeStatusAssembly.includes("buildRuntimeIdentity"));
assert.ok(runtimeStatusAssembly.includes("buildToolLabelsSync"));

const labels = buildToolLabelsSync([
  { name: "search", title: "Search" },
  { name: "fetch", title: "Fetch" },
  { name: "code_sample_js", title: "Code sample" },
  { name: "observability_status", title: "Observability" },
]);
assert.equal(labels.version, "test-mcp-labels-v1");
assert.ok(labels.public.some((tool) => tool.name === "search"));
assert.ok(labels.public.some((tool) => tool.name === "code_sample_js"));
assert.ok(labels.internal.some((tool) => tool.name === "observability_status"));
assert.ok(labels.plugins.some((tool) => tool.plugin_id === "sample.echo_readonly"));
assert.ok(labels.plugins.every((tool) => tool.runtime_enabled === false));
assert.ok(labels.plugins.every((tool) => tool.connector_visible === false));

const report = formatStartupReport({
  serverName: identity.SERVER_NAME,
  serverVersion: identity.SERVER_VERSION,
  connectorShapeVersion: identity.CONNECTOR_SHAPE_VERSION,
  outputMode: "structured",
  startupReportVersion: identity.STARTUP_REPORT_VERSION,
  labelsVersion: identity.LABELS_VERSION,
  host: "127.0.0.1",
  port: 3009,
  publicBaseUrl: "https://mcp-tests.romionologic.dev",
  maxFetchTextChars: 2500,
  auditLogPath: "_logs/.mcp-tests-audit.jsonl",
  tools: [
    { name: "search", title: "Search" },
    { name: "fetch", title: "Fetch" },
    { name: "observability_status", title: "Observability" },
  ],
  useColor: false,
}).join("\n");

assert.ok(report.includes("mcp-tests-response-shape v0.30.0"));
assert.ok(report.includes("startupReportVersion=test-mcp-startup-report-v1"));
assert.ok(report.includes("labelsVersion=test-mcp-labels-v1"));
assert.ok(report.includes("Public MCP tools:"));
assert.ok(report.includes("Authorized MCP tools:"));
assert.ok(report.includes("Plugins:"));
assert.ok(!report.includes("optionalTools="));

console.log("smoke_stage8_52_runtime_identity_labels_startup ok");
