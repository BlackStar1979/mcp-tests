"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const record = read("_workflow/operator_decisions/sessionless_live_authenticated_probe.md");
assert.ok(record.includes("Status: GREEN / LIVE AUTHENTICATED SESSIONLESS PROBE PASSED / CONNECTOR UNCHANGED"));
assert.ok(record.includes("Historical status note: this record is hidden-route transition evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("server_change: false"));
assert.ok(record.includes("workflow_change: true"));
assert.ok(record.includes("schema_change: false"));
assert.ok(record.includes("runtime_restart_required: false"));
assert.ok(record.includes("connector_refresh_required: false"));
assert.ok(record.includes("public_3009_start_required: false"));
assert.ok(record.includes("fresh client/token"));
assert.ok(record.includes("does not read durable OAuth state"));
assert.ok(record.includes("node _workflow/scripts/sessionless_live_authenticated_probe.js"));

const scriptPath = path.join(ROOT, "_workflow", "scripts", "sessionless_live_authenticated_probe.js");
assert.ok(fs.existsSync(scriptPath));
const script = read("_workflow/scripts/sessionless_live_authenticated_probe.js");
assert.ok(script.includes("sessionless_live_authenticated_probe"));
assert.ok(script.includes("reads_durable_oauth_state: false"));
assert.ok(script.includes("discoverOAuth21SecretFile"));
assert.ok(script.includes("issueBearer"));
assert.ok(script.includes('require("./cli_args")'));
assert.equal(script.includes("function argValue("), false);
assert.equal(script.includes("function hasFlag("), false);

const self = spawnSync(process.execPath, [
  scriptPath,
  "--self-test",
  "--base-url",
  "http://127.0.0.1:65535",
  "--audit-log",
  path.join(ROOT, "_logs", "unused-sessionless-self-test.jsonl"),
], { cwd: ROOT, encoding: "utf8" });
assert.equal(self.status, 0, self.stderr || self.stdout);
const selfJson = JSON.parse(self.stdout);
assert.equal(selfJson.ok, true);
assert.equal(selfJson.network, false);
assert.equal(selfJson.reads_durable_oauth_state, false);
assert.equal(selfJson.uses_fresh_oauth_flow, true);

const missingValue = spawnSync(process.execPath, [scriptPath, "--self-test", "--base-url"], {
  cwd: ROOT,
  encoding: "utf8",
});
assert.equal(missingValue.status, 2, missingValue.stderr || missingValue.stdout);
const missingValueJson = JSON.parse(missingValue.stderr);
assert.equal(missingValueJson.error_code, "cli_argument_value_missing");
assert.equal(missingValueJson.argument, "base-url");

const unknownOption = spawnSync(process.execPath, [scriptPath, "--self-test", "--surprise"], {
  cwd: ROOT,
  encoding: "utf8",
});
assert.equal(unknownOption.status, 2, unknownOption.stderr || unknownOption.stdout);
const unknownOptionJson = JSON.parse(unknownOption.stderr);
assert.equal(unknownOptionJson.error_code, "cli_argument_unknown");
assert.equal(unknownOptionJson.argument, "surprise");

const sharedProbeHelpers = require("../_workflow/scripts/sessionless_live_authenticated_probe");
assert.equal(typeof sharedProbeHelpers.jsonFetch, "function");
assert.equal(typeof sharedProbeHelpers.resolveOAuth21SecretFile, "function");
assert.equal(typeof sharedProbeHelpers.issueBearer, "function");

const consentProbePath = path.join(ROOT, "_workflow", "scripts", "pol_1a_consent_live_probe.js");
assert.ok(fs.existsSync(consentProbePath));
const consentProbe = read("_workflow/scripts/pol_1a_consent_live_probe.js");
assert.ok(consentProbe.includes('PROTOCOL_VERSION = "2026-07-28"'));
assert.ok(consentProbe.includes('"mcp-method": method'));
assert.ok(consentProbe.includes('"mcp-name": String(params.name)'));
assert.ok(consentProbe.includes("form_elicitation_capable: true"));
assert.ok(consentProbe.includes("missing_form_capability_minus_32021_without_execution"));
assert.ok(consentProbe.includes("exact_accept_executes_once"));
assert.ok(consentProbe.includes("replay_rejected"));
assert.ok(consentProbe.includes("audit_has_no_raw_state_responses_arguments_or_private_binding_digests"));
assert.equal(consentProbe.includes("MCP_TEST_OAUTH_OPERATOR_SECRET"), false);

const consentSelfResult = path.join(ROOT, "_control", "pol-1a-consent-live-probe-smoke-selftest.json");
try {
  const consentSelf = spawnSync(process.execPath, [
    consentProbePath,
    "--self-test",
    `--result-file=${consentSelfResult}`,
  ], { cwd: ROOT, encoding: "utf8" });
  assert.equal(consentSelf.status, 0, consentSelf.stderr || consentSelf.stdout);
  const consentSelfJson = JSON.parse(consentSelf.stdout);
  assert.equal(consentSelfJson.ok, true);
  assert.equal(consentSelfJson.network, false);
  assert.equal(consentSelfJson.protocol_version, "2026-07-28");
  assert.equal(consentSelfJson.form_elicitation_capable, true);
  assert.equal(consentSelfJson.fresh_oauth_client, true);
  assert.equal(consentSelfJson.reads_durable_oauth_state, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(consentSelfResult, "utf8")), consentSelfJson);
} finally {
  fs.rmSync(consentSelfResult, { force: true });
}

const manifest = JSON.parse(read("_tests/run_all_smoke_scripts.json"));
assert.ok(manifest.includes("_tests/smoke_sessionless_live_authenticated_probe.js"));
console.log("smoke_sessionless_live_authenticated_probe ok");
