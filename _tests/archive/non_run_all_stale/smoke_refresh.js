"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38c_controlled_refresh_execution_observed.json", "utf8"));

assert.equal(m.status, "green_with_propagation_gap");
assert.equal(m.operator_reported_restart, true);
assert.equal(m.operator_reported_connector_refresh, true);
assert.equal(m.permanent_no_restart_lifted, true);
assert.equal(m.permanent_no_refresh_lifted, true);
assert.equal(m.bearer_runtime_ok, true);
assert.equal(m.bearer_tool_count, 46);
assert.equal(m.public_sandbox_shims_visible, false);
assert.equal(m.public_sandbox_still_stale, true);
assert.equal(m.connector_visible_surface_change_observed, false);

console.log("smoke_refresh ok");
