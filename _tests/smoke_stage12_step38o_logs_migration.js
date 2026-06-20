"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

assert.equal(fs.existsSync(path.join(ROOT, "logs")), false, "legacy root logs/ must not exist");
assert.equal(fs.statSync(path.join(ROOT, "_logs")).isDirectory(), true, "_logs/ must exist");
assert.equal(fs.statSync(path.join(ROOT, "_logs", "README.md")).isFile(), true, "_logs/README.md must exist");
assert.equal(fs.statSync(path.join(ROOT, "_logs", ".mcp-tests-audit.jsonl")).isFile(), true, "audit log must be in _logs/");

const server = read("server.js");
const bootstrap = read("src/runtime/server_bootstrap_runtime.js");
assert.ok(bootstrap.includes('path.join(rootDir, "_logs")'), "server bootstrap runtime default audit dir must be _logs");
assert.ok(server.includes("C:\\Work\\mcp-tests\\_logs\\.mcp-tests-audit.jsonl"), "server header must document _logs audit path");
assert.equal(server.includes('path.join(__dirname, "logs")'), false, "server must not default to logs/");
assert.equal(bootstrap.includes('path.join(rootDir, "logs")'), false, "server bootstrap runtime must not default to logs/");

const memoryStore = read("src/memory/memory_store.js");
assert.ok(memoryStore.includes("Storage layout (all files in _logs/)"));
assert.ok(memoryStore.includes('path.join(__dirname, "../../_logs")'));
assert.equal(memoryStore.includes("../../logs"), false);

const rootSpec = JSON.parse(read("SERVER_SPEC.json"));
assert.deepEqual(rootSpec.repository_layout_contract.root_policy.runtime_output_dirs, ["_logs"]);
assert.equal(rootSpec.repository_layout_contract.logs.status, "active_runtime_log_dir");
assert.equal(rootSpec.repository_layout_contract.logs.path, "_logs/");
assert.equal(rootSpec.repository_layout_contract.logs.migration_required, false);
assert.ok(rootSpec.maintenance_rules.index_usage_protocol.non_authoritative_paths_for_current_truth.includes("_logs/"));
assert.equal(rootSpec.maintenance_rules.index_usage_protocol.non_authoritative_paths_for_current_truth.includes("logs/"), false);

for (const rel of ["SERVER_MEMORY_POLICY_SPEC.json", "SERVER_DATABASE_POLICY_SPEC.json"]) {
  const text = read(rel);
  assert.ok(text.includes("_logs/"), `${rel} must point to _logs/`);
  assert.equal(text.includes("file_based__logs_store"), false, `${rel} must not contain accidental double underscore backend name`);
}

console.log("smoke_stage12_step38o_logs_migration ok");
