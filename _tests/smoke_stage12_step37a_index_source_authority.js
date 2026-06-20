"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(root, "SERVER_SPEC.json"), "utf8"));
const rules = spec.maintenance_rules || {};
const protocol = rules.index_usage_protocol || {};

assert.equal(rules.index_rebuild_required_before_work, true);
assert.equal(rules.index_rebuild_tool, "GPT_MCP.build_index");
assert.equal(rules.index_status_check_required, true);
assert.equal(protocol.index_role, "discovery_only_not_source_of_truth");
assert.ok(String(protocol.verification_rule || "").includes("direct read"));
assert.ok(String(protocol.sandbox_copy_rule || "").includes("must never outrank"));
assert.ok(String(protocol.query_rule || "").includes("filter result paths by authority"));

const requiredNonAuthority = ["_public_sandbox/", "_public_sandbox/mcp-tests/", "_backups/", "_stages/", "_logs/"];
for (const item of requiredNonAuthority) {
  assert.ok((protocol.non_authoritative_paths_for_current_truth || []).includes(item), `${item} must be non-authoritative`);
}

const script = path.join(root, "_workflow", "scripts", "index_authority_report.js");
const result = spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
if (result.status !== 0) {
  process.stdout.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
}
assert.equal(result.status, 0);
const report = JSON.parse(result.stdout);
assert.equal(report.ok, true);
assert.ok(report.classifications.some((item) => item.authority === "non_authoritative_for_current_truth"));

console.log("smoke_stage12_step37a_index_source_authority ok");
