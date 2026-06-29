"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const record = read("_workflow/operator_decisions/s10b_live_authenticated_sessionless_probe.md");
assert.ok(record.includes("Status: GREEN / LIVE AUTHENTICATED SESSIONLESS PROBE PASSED / CONNECTOR UNCHANGED"));
assert.ok(record.includes("server_change: false"));
assert.ok(record.includes("workflow_change: true"));
assert.ok(record.includes("schema_change: false"));
assert.ok(record.includes("runtime_restart_required: false"));
assert.ok(record.includes("connector_refresh_required: false"));
assert.ok(record.includes("public_3009_start_required: false"));
assert.ok(record.includes("fresh client/token"));
assert.ok(record.includes("does not read durable OAuth state"));
assert.ok(record.includes("node _workflow/scripts/s10b_live_authenticated_sessionless_probe.js"));

const scriptPath = path.join(ROOT, "_workflow", "scripts", "s10b_live_authenticated_sessionless_probe.js");
assert.ok(fs.existsSync(scriptPath));
const script = read("_workflow/scripts/s10b_live_authenticated_sessionless_probe.js");
assert.ok(script.includes("s10b_live_authenticated_sessionless_probe"));
assert.ok(script.includes("reads_durable_oauth_state: false"));
assert.ok(script.includes("discoverOAuth21SecretFile"));
assert.ok(script.includes("issueBearer"));

const self = spawnSync(process.execPath, [scriptPath, "--self-test"], { cwd: ROOT, encoding: "utf8" });
assert.equal(self.status, 0, self.stderr || self.stdout);
const selfJson = JSON.parse(self.stdout);
assert.equal(selfJson.ok, true);
assert.equal(selfJson.network, false);
assert.equal(selfJson.reads_durable_oauth_state, false);
assert.equal(selfJson.uses_fresh_oauth_flow, true);

const manifest = JSON.parse(read("_tests/run_all_smoke_scripts.json"));
assert.ok(manifest.includes("_tests/smoke_s10b_live_authenticated_sessionless_probe.js"));
console.log("smoke_s10b_live_authenticated_sessionless_probe ok");
