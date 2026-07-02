"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const record = read("_workflow/operator_decisions/connector_route_coexistence_boundary.md");
const inventory = readJson("_workflow/sessionless_inventory.json");
const canon = read("_workflow/WORKFLOW_CANON.md");
const index = read("_workflow/ACTIVE_WORKFLOW_INDEX.md");
const manifest = readJson("_tests/run_all_smoke_scripts.json");

assert.ok(record.includes("Status: GREEN / READINESS BOUNDARY PREPARED / NO CONNECTOR MIGRATION"));
assert.ok(record.includes("Historical status note: this record is transition-route evidence only."));
assert.ok(record.includes("It is superseded as active target guidance by `_workflow/operator_decisions/single_route_no_sse_streamable_http_target_plan.md`"));
assert.ok(record.includes("Do not use it as the current next-step plan."));
assert.ok(record.includes("S10B passed the live authenticated sessionless probe"));
assert.ok(record.includes("`/mcp/sessionless` was active and validated as a historical transition route"));
assert.ok(record.includes("Stable `/mcp` remains the legacy-compatible route"));
assert.ok(record.includes("No connector route migration was performed"));
assert.ok(record.includes("No connector refresh was performed"));
assert.ok(record.includes("stable `/mcp` removal is forbidden"));
assert.ok(record.includes("Future connector migration requires a separate explicit operator decision"));
assert.ok(record.includes("Connector refresh remains required only when connector-visible route"));
assert.ok(record.includes("Historical next step at that time: S12 should be a connector migration dry-run plan with no refresh and no live route switch."));
assert.ok(record.includes("This is no longer the active queue; current target authority is the single-route no-SSE plan on surviving `/mcp`."));

assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.status, "prepared_no_migration");
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.connector_refresh_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.runtime_restart_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.public_3009_start_required_now, false);
assert.equal(inventory.target_selection_readiness.s11_connector_migration_readiness.stable_mcp_removal_forbidden_now, true);

assert.ok(canon.includes("S11 connector migration readiness / stable `/mcp` coexistence boundary green"));
assert.ok(canon.includes("Latest known full smoke: `node ./_tests/run_all_smokes.js --skip-network = ok_0_40_0_7_210`"));
assert.ok(canon.includes("Latest validated authenticated smoke count: `210`"));
assert.ok(canon.includes("S12 connector migration dry-run plan / no refresh"));
assert.ok(index.includes("Authenticated smoke count: `210`."));
assert.ok(index.includes("connector_route_coexistence_boundary.md"));
assert.ok(index.includes("Teardown package for `GET /mcp` SSE, `Last-Event-ID`, and stable stream-path replay semantics."));
assert.equal(canon.includes("validated as the new workbench/sessionless target"), false);

assert.ok(manifest.includes("_tests/smoke_connector_route_coexistence_boundary.js"));

console.log("smoke_connector_route_coexistence_boundary ok");
