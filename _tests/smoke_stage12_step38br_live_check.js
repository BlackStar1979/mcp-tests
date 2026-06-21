"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const m = JSON.parse(fs.readFileSync("_workflow/patch_manifests/stage12_step38br_live_check.json", "utf8"));
const spec = JSON.parse(fs.readFileSync("SERVER_SPEC.json", "utf8"));

assert.equal(m.status, "green");
assert.equal(m.runtime_version, "0.40.0");
assert.equal(m.auth, "bearer");
assert.equal(m.profile, "internal");
assert.equal(m.tool_count, 46);
assert.equal(m.tool_hash, "f47c9460e21079a8");
assert.equal(m.public_stale, true);
assert.equal(m.no_surface_change, true);
assert.equal(m.no_restart_done, true);
assert.equal(m.no_refresh_done, true);
assert.equal(spec.maintenance_rules.closeout_control_review_required, true);
assert.equal(spec.maintenance_rules.closeout_control_review.stale_action, true);
assert.equal(spec.maintenance_rules.closeout_control_review.rec_next, true);

console.log("smoke_stage12_step38br_live_check ok");
