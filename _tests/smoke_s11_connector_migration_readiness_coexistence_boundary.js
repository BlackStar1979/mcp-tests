"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/s11_connector_migration_readiness_coexistence_boundary.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");

assert.ok(record.includes("Status: GREEN / READINESS BOUNDARY PREPARED / NO CONNECTOR MIGRATION"));
assert.ok(record.includes("S10B passed the live authenticated sessionless probe"));
assert.ok(record.includes("`/mcp/sessionless` is active and validated"));
assert.ok(record.includes("Stable `/mcp` remains the legacy-compatible route"));
assert.ok(record.includes("No connector route migration was performed"));
assert.ok(record.includes("No connector refresh was performed"));
assert.ok(record.includes("stable `/mcp` removal is forbidden"));
assert.ok(record.includes("Future connector migration requires a separate explicit operator decision"));
assert.ok(record.includes("Connector refresh remains required only when connector-visible route"));
assert.ok(record.includes("S12 should be a connector migration dry-run plan with no refresh"));

assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.status, "prepared_no_migration");
assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.guard, "_tests/smoke_s11_connector_migration_readiness_coexistence_boundary.js");
assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.connector_refresh_required_now, false);
assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.runtime_restart_required_now, false);
assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.public_3009_start_required_now, false);
assert.equal(state.sessionless_target_selection.s11_connector_migration_readiness.stable_mcp_removal_forbidden_now, true);

assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.status, "prepared_no_migration");
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.stable_mcp_removal_forbidden_now, true);

assert.ok(canon.includes("S11 connector migration readiness / stable `/mcp` coexistence boundary green"));
assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_6_201`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `201`"));
assert.ok(canon.includes("S12 connector migration dry-run plan / no refresh"));
assert.ok(index.includes("Authenticated smoke count: `201`."));
assert.ok(index.includes("s11_connector_migration_readiness_coexistence_boundary.md"));
assert.ok(index.includes("S14 connector refresh approval package / no execution."));

assert.ok(manifest.includes("_tests/smoke_s11_connector_migration_readiness_coexistence_boundary.js"));

console.log("smoke_s11_connector_migration_readiness_coexistence_boundary ok");
