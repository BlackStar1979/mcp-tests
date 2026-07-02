"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
const manifest = readJson("_tests/legacy_retired_auth_smoke_manifest.json");
const record = fs.readFileSync(path.join(ROOT, "_workflow/operator_decisions/legacy_auth_cleanup_sessionless_ready_review.md"), "utf8");
assert.equal(manifest.status, "legacy_retired_auth_archive_cleanup_completed");
assert.equal(manifest.archive_directory, "_tests/archive/legacy_retired_auth");
assert.equal(manifest.active_negative_control, "_tests/smoke_legacy_retired_auth_negative_controls.js");
assert.equal(manifest.hard_deleted_count, 0);
assert.equal(manifest.archive_cleanup_summary.archived, 17);
assert.equal(manifest.archive_cleanup_summary.rewrite_as_negative_control_consolidated, 9);
assert.equal(manifest.archive_cleanup_summary.archive_only_archived, 6);
assert.equal(manifest.archive_cleanup_summary.delete_after_review_archived_not_deleted, 2);
assert.equal(manifest.archive_cleanup_summary.active_run_all_legacy_files, 0);
for (const item of manifest.tests) {
  assert.equal(exists(item.path), false, item.path);
  assert.ok(item.archived_path, item.path);
  assert.equal(exists(item.archived_path), true, item.archived_path);
  assert.equal(item.cleanup_status, "archived_not_active", item.path);
}
const runAll = readJson("_tests/run_all_smoke_scripts.json");
for (const item of manifest.tests) {
  assert.equal(runAll.includes(item.path), false, item.path);
  assert.equal(runAll.includes(item.archived_path), false, item.archived_path);
}
assert.ok(runAll.includes("_tests/smoke_legacy_retired_auth_negative_controls.js"));
assert.ok(runAll.includes("_tests/smoke_legacy_archive_sessionless_ready_specs.js"));
assert.ok(record.includes("Historical status note: this record is archive/spec-posture evidence only."));
assert.ok(record.includes("`/mcp/sessionless` is historical transition-route evidence only."));
assert.ok(record.includes("the hidden route and env are retired from active runtime truth."));
const specNames = fs.readdirSync(ROOT).filter((name) => name.startsWith("SERVER_") && name.endsWith("_SPEC.json")).sort();
assert.equal(specNames.length, 30);
for (const name of specNames) {
  const spec = readJson(name);
  assert.ok(spec.sessionless_ready_review, name);
  assert.equal(spec.sessionless_ready_review.status, "sessionless_ready_reviewed", name);
  assert.equal(spec.sessionless_ready_review.source_of_truth, "_workflow/sessionless_inventory.json#target_selection_readiness", name);
  assert.equal(spec.sessionless_ready_review.current_stable_route, "/mcp", name);
  assert.equal(spec.sessionless_ready_review.current_stable_route_status, "legacy_compatible_do_not_remove", name);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route, "/mcp/sessionless", name);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route_historical_only, true, name);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_route_retired_from_active_runtime, true, name);
  assert.equal(spec.sessionless_ready_review.single_route_no_sse_target_record, "_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md", name);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_env, "MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE", name);
  assert.equal(spec.sessionless_ready_review.sessionless_transition_env_retired_from_active_runtime, true, name);
  assert.equal(spec.sessionless_ready_review.root_spec_runtime_change, false, name);
  assert.equal(spec.sessionless_ready_review.connector_visible_surface_changed, false, name);
  assert.equal(spec.sessionless_ready_review.connector_refresh_required_now, false, name);
  assert.equal(spec.sessionless_ready_review.runtime_restart_required_now, false, name);
}
console.log("smoke_legacy_archive_sessionless_ready_specs ok");
