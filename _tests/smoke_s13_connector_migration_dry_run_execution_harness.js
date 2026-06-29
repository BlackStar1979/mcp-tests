"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/s13_connector_migration_dry_run_execution_harness.md");
const state = readJson("_workflow/state.json");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");
const scriptPath = path.join(ROOT, "_workflow", "scripts", "s13_connector_migration_dry_run_harness.js");

assert.ok(record.includes("Status: GREEN / DRY-RUN HARNESS EXECUTED / NO CONNECTOR REFRESH"));
assert.ok(record.includes("S10B live authenticated sessionless probe passed"));
assert.ok(record.includes("S11 readiness/coexistence boundary passed"));
assert.ok(record.includes("S12 dry-run plan prepared"));
assert.ok(record.includes("S13 dry-run harness executed"));
assert.ok(record.includes("`/mcp/sessionless` remains candidate future connector target"));
assert.ok(record.includes("`/mcp` remains stable-compatible legacy route"));
assert.ok(record.includes("no connector route migration was performed"));
assert.ok(record.includes("no connector refresh was performed"));
assert.ok(record.includes("no public 3009 start was performed"));
assert.ok(record.includes("no OAuth21 3008 restart was performed"));
assert.ok(record.includes("no stable `/mcp` removal was performed"));
assert.ok(record.includes("no stable session code removal was performed"));
assert.ok(record.includes("future connector migration requires a separate explicit operator decision"));
assert.ok(record.includes("future connector refresh requires a separate explicit operator action"));
assert.ok(record.includes("dry-run harness output was sanitized"));

assert.ok(fs.existsSync(scriptPath));
const script = read("_workflow/scripts/s13_connector_migration_dry_run_harness.js");
assert.ok(script.includes("s13_connector_migration_dry_run_harness"));
assert.equal(script.includes("fetch("), false);
assert.equal(script.includes("issueBearer"), false);

const run = spawnSync(process.execPath, [scriptPath], { cwd: ROOT, encoding: "utf8" });
assert.equal(run.status, 0, run.stderr || run.stdout);
const output = JSON.parse(run.stdout);
assert.equal(output.ok, true);
assert.equal(output.marker, "s13_connector_migration_dry_run_harness");
assert.equal(output.current_route, "/mcp");
assert.equal(output.candidate_route, "/mcp/sessionless");
assert.equal(output.connector_refresh_performed, false);
assert.equal(output.connector_route_migration_performed, false);
assert.equal(output.runtime_restart_performed, false);
assert.equal(output.public_3009_start_performed, false);
assert.equal(output.stable_mcp_removal_performed, false);
assert.equal(output.stable_session_code_removal_performed, false);
assert.equal(output.connector_visible_surface_change, false);
assert.equal(output.future_operator_decision_required, true);
assert.equal(output.future_connector_refresh_action_required, true);
assert.equal(output.rollback_preserves_mcp, true);
assert.equal(output.sanitized, true);

assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.status, "executed_no_refresh");
assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.guard, "_tests/smoke_s13_connector_migration_dry_run_execution_harness.js");
assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.connector_refresh_required_now, false);
assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.runtime_restart_required_now, false);
assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.public_3009_start_required_now, false);
assert.equal(state.sessionless_target_selection.s13_connector_migration_dry_run_execution_harness.connector_migration_performed_now, false);

assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.status, "executed_no_refresh");
assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.connector_migration_performed_now, false);
assert.equal(inventory.target_selection_readiness.s13_connector_migration_dry_run_execution_harness.next_recommended_step, "S14 connector refresh approval package / no execution");

assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_6_201`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `201`"));
assert.ok(canon.includes("S13 connector migration dry-run execution harness / still no refresh green"));
assert.ok(canon.includes("S14 connector refresh approval package / no execution"));
assert.ok(index.includes("Latest full smoke after S13 connector-migration-dry-run-harness guard: `ok_0_40_0_6_201`."));
assert.ok(index.includes("Authenticated smoke count: `201`."));
assert.ok(index.includes("s13_connector_migration_dry_run_execution_harness.md"));
assert.ok(index.includes("S14 connector refresh approval package / no execution."));

assert.ok(manifest.includes("_tests/smoke_s13_connector_migration_dry_run_execution_harness.js"));

console.log("smoke_s13_connector_migration_dry_run_execution_harness ok");
