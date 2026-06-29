"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/s12_connector_migration_dry_run_plan.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");

assert.ok(record.includes("Status: GREEN / DRY-RUN PLAN PREPARED / NO CONNECTOR REFRESH"));
assert.ok(record.includes("S12 does not migrate any connector route"));
assert.ok(record.includes("S12 does not refresh the connector"));
assert.ok(record.includes("S12 does not restart OAuth21 3008"));
assert.ok(record.includes("S12 does not start public 3009"));
assert.ok(record.includes("S12 does not remove stable `/mcp`"));
assert.ok(record.includes("Stable `/mcp` remains the legacy-compatible route"));
assert.ok(record.includes("Connector migration remains a separate explicit future action"));
assert.ok(record.includes("The dry-run package must not be misreported as a live migration"));
assert.ok(record.includes("Preferred S13: connector migration dry-run execution harness / still no refresh."));
assert.ok(record.includes("Alternative S13: connector refresh approval package / no execution."));

assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.status, "prepared_no_refresh");
assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.guard, "_tests/smoke_s12_connector_migration_dry_run_plan.js");
assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.connector_refresh_required_now, false);
assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.runtime_restart_required_now, false);
assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.public_3009_start_required_now, false);
assert.equal(state.sessionless_target_selection.s12_connector_migration_dry_run_plan.connector_migration_performed_now, false);

assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.status, "prepared_no_refresh");
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.connector_migration_performed_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.next_recommended_step, "S13 connector migration dry-run execution harness / still no refresh");

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_6_200`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `200`"));
assert.ok(canon.includes("S12 connector migration dry-run plan / no refresh green"));
assert.ok(canon.includes("S13 connector migration dry-run execution harness / still no refresh"));
assert.ok(index.includes("Latest full smoke after S12 connector-migration-dry-run-plan guard: `ok_0_40_0_6_200`."));
assert.ok(index.includes("Authenticated smoke count: `200`."));
assert.ok(index.includes("s12_connector_migration_dry_run_plan.md"));
assert.ok(index.includes("S13 connector migration dry-run execution harness / still no refresh."));

assert.ok(manifest.includes("_tests/smoke_s12_connector_migration_dry_run_plan.js"));

console.log("smoke_s12_connector_migration_dry_run_plan ok");
