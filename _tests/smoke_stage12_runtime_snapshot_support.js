"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SCRIPT = path.join(ROOT, "_workflow", "scripts", "workflow_snapshot.js");
const REQUIRED_RUNTIME_FILES = [
  "server.js",
  "src/stage_metadata.js",
  "src/runtime/identity.js",
  "src/runtime/auth_bootstrap_config_resolver.js",
  "src/runtime/cors_preflight_handler.js",
  "src/runtime/startup_report_builder.js",
  "src/runtime/server_cli_args.js",
  "src/runtime/static_docs.js",
  "src/runtime/server_factory.js",
  "src/runtime/server_lifecycle.js",
  "src/runtime/server_bootstrap_runtime.js",
  "src/runtime/mcp_runtime_handlers.js",
  "src/runtime/runtime_context_assembly.js",
  "src/runtime/runtime_status_assembly.js",
  "src/runtime/optional_tools_assembly.js",
  "src/runtime/runtime_support_assembly.js",
  "src/runtime/code_sample_selftest.js",
  "src/auth/auth_policy.js",
  "src/auth/auth_access.js",
  "src/auth/auth_bearer.js",
  "src/startup_report.js",
];

function runSnapshot(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

function parseManifestFromStdout(stdout) {
  const text = String(stdout || "");
  return JSON.parse(text.slice(text.indexOf("{")));
}

function assertRejected(args, pattern) {
  const result = runSnapshot(args);
  assert.notEqual(result.status, 0, `snapshot command should reject ${args.join(" ")}`);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
}

const label = `stage12-runtime-snapshot-support-${process.pid}-${Date.now()}`;
const result = runSnapshot([
  "--label",
  label,
  ...REQUIRED_RUNTIME_FILES.flatMap((filePath) => ["--file", filePath]),
]);

assert.equal(result.status, 0, `runtime snapshot must succeed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);

const manifest = parseManifestFromStdout(result.stdout);
assert.equal(manifest.snapshot_version, "workflow-snapshot-v1");
assert.equal(manifest.label, label);
assert.ok(manifest.path.startsWith("_workflow/control_plane/snapshots/"));
assert.equal(manifest.entries.length, REQUIRED_RUNTIME_FILES.length);

for (const filePath of REQUIRED_RUNTIME_FILES) {
  const entry = manifest.entries.find((item) => item.path === filePath);
  assert.ok(entry, `manifest must include ${filePath}`);
  assert.equal(entry.copied, true, `${filePath} must be copied`);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.ok(entry.bytes > 0, `${filePath} must be non-empty`);
  assert.ok(fs.existsSync(path.join(ROOT, manifest.path, filePath)), `${filePath} copy must exist`);
}

assert.ok(fs.existsSync(path.join(ROOT, manifest.path, "manifest.json")), "manifest.json must exist");

assertRejected(["--label", `${label}-absolute`, "--file", path.join(ROOT, "server.js")], /absolute path rejected/);
assertRejected(["--label", `${label}-traversal`, "--file", "../mcp/server_tools.js"], /traversal rejected/);
assertRejected(["--label", `${label}-secrets`, "--file", ".secrets/token.txt"], /forbidden snapshot path segment/);
assertRejected(["--label", `${label}-logs`, "--file", "_logs/.mcp-tests-audit.jsonl"], /forbidden snapshot path segment/);
assertRejected(["--label", `${label}-node-modules`, "--file", "node_modules/example.js"], /forbidden snapshot path segment/);
assertRejected(
  ["--label", `${label}-outside-allowlist`, "--file", "src/runtime/not_allowlisted.js"],
  /explicitly allowlisted runtime files/
);

console.log("smoke_stage12_runtime_snapshot_support ok");
