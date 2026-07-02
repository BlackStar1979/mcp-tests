"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/connector_migration_dry_run_plan.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");

assert.ok(record.includes("Status: GREEN / DRY-RUN PLAN PREPARED / NO CONNECTOR REFRESH"));
assert.ok(record.includes("Historical status note: this record is transition-route evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("S12 does not migrate any connector route"));
assert.ok(record.includes("S12 does not refresh the connector"));
assert.ok(record.includes("S12 does not restart OAuth21 3008"));
assert.ok(record.includes("S12 does not start public 3009"));
assert.ok(record.includes("S12 does not remove stable `/mcp`"));
assert.ok(record.includes("Stable `/mcp` remains the legacy-compatible route"));
assert.ok(record.includes("Connector migration remains a separate explicit future action"));
assert.ok(record.includes("The dry-run package must not be misreported as a live migration"));
assert.ok(record.includes("Historical next step at that time:"));
assert.ok(record.includes("Preferred S13: connector migration dry-run execution harness / still no refresh."));
assert.ok(record.includes("Alternative S13: connector refresh approval package / no execution."));
assert.ok(record.includes("This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`."));

assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.status, "prepared_no_refresh");
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.connector_migration_performed_now, false);
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.historical_next_recommended_step, "S13 connector migration dry-run execution harness / still no refresh");
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.next_recommended_step, "single-route no-SSE streamable-HTTP target contract and migration plan");
assert.equal(inventory.target_selection_readiness.s12_connector_migration_dry_run_plan.superseded_by_current_active_queue, true);

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_210`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `210`"));
assert.ok(canon.includes("S12 connector migration dry-run plan / no refresh green"));
assert.ok(canon.includes("S13 connector migration dry-run execution harness / still no refresh"));
assert.ok(index.includes("Latest full smoke after historical-next-step quarantine guard: `ok_0_40_0_7_210`."));
assert.ok(index.includes("Authenticated smoke count: `210`."));
assert.ok(index.includes("connector_migration_dry_run_plan.md"));
assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));

assert.ok(manifest.includes("_tests/smoke_connector_migration_dry_run_plan.js"));

console.log("smoke_connector_migration_dry_run_plan ok");
