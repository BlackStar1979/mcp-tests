const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const mdSpec = fs.readFileSync(path.join(ROOT, "_workflow", "SERVER_SPEC.md"), "utf8");
const mdHead = mdSpec.slice(0, 15000);
const rootSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_SPEC.json"), "utf8"));
const toolsSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_TOOLS_SPEC.json"), "utf8"));
const startupReport = fs.readFileSync(path.join(ROOT, "src", "startup_report.js"), "utf8");

for (const required of [
  "SERVER_VERSION: 0.30.0",
  "STARTUP_REPORT_VERSION: test-mcp-startup-report-v1",
  "LABELS_VERSION: test-mcp-labels-v1",
  "_logs/.mcp-tests-audit.jsonl",
  "_public_sandbox",
  "sample.echo_readonly",
  "_workflow/NEXT_CHAT_HANDOFF.md",
]) {
  assert.ok(mdHead.includes(required), `SERVER_SPEC.md head must contain ${required}`);
}

assert.equal(rootSpec.server.default_tool_surface, "public_mcp_tools");
assert.equal(rootSpec.server.default_tool_count, 13);
assert.equal(rootSpec.server.full_tests_authenticated_tool_count, 46);
assert.equal(rootSpec.spec_refs.tools, "SERVER_TOOLS_SPEC.json");
assert.equal(toolsSpec.surface_classes.public_mcp_tools.tool_count, 13);
assert.equal(toolsSpec.surface_classes.authorized_mcp_tools.tool_count, 32);
assert.ok(startupReport.includes("Public MCP tools"));
assert.ok(startupReport.includes("Authorized MCP tools"));

for (const stale of [
  "SERVER_VERSION: 0.3.1",
  "Current exposed connector tools observed through active ChatGPT connector resource discovery",
  "sources/                 # source mirrors",
  ".mcp-tests-audit.jsonl   # active audit log used by server.js",
  "Do not move `.mcp-tests-audit.jsonl`",
]) {
  assert.ok(!mdHead.includes(stale), `SERVER_SPEC.md head must not contain stale text: ${stale}`);
}

console.log("smoke_stage8_52_server_spec_current_truth ok");
