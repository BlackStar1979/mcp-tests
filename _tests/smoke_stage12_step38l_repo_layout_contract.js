"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_SPEC.json"), "utf8"));
const contract = spec.repository_layout_contract;

function file(rel) { return fs.statSync(path.join(ROOT, rel)).isFile(); }
function dir(rel) { return fs.statSync(path.join(ROOT, rel)).isDirectory(); }

assert.equal(contract.version, "repo-layout-contract-v2");
assert.equal(contract.status, "canonical_layout_contract_not_progress_log");
assert.equal(spec.spec_refs.development_structure, "_workflow/REPO_DEVELOPMENT_STRUCTURE.md");
assert.equal(spec.spec_refs.layout_status, "_workflow/REPO_LAYOUT_STATUS.md");
assert.equal(file(spec.spec_refs.development_structure), true);
assert.equal(file(spec.spec_refs.layout_status), true);

for (const rel of contract.root_policy.active_root_dirs) assert.equal(dir(rel), true, rel);
for (const rel of contract.root_policy.active_root_files) assert.equal(file(rel), true, rel);
for (const rel of contract.root_policy.reserved_root_dirs) assert.equal(dir(rel), true, rel);

assert.deepEqual(spec.tools.surface_classes, ["public_mcp_tools", "authorized_mcp_tools", "internal_hidden_tools"]);
assert.ok(spec.tools.deprecated_surface_classes.non_public_mcp_tools);
assert.ok(spec.tools.current_migration_note.includes("tools/authorized"));

assert.equal(dir("tools/public"), true);
assert.equal(dir("tools/authorized"), true);
assert.equal(dir("tools/internal"), true);
assert.equal(file("tools/authorized/README.md"), true);
assert.equal(dir("_logs"), true);
assert.equal(file("_logs/README.md"), true);
assert.equal(contract.logs.path || contract.logs.target, "_logs/");
assert.equal(contract.logs.migration_required, false);

const dev = fs.readFileSync(path.join(ROOT, spec.spec_refs.development_structure), "utf8");
const layoutStatus = fs.readFileSync(path.join(ROOT, spec.spec_refs.layout_status), "utf8");
for (const required of ["_workflow/", "_tests/", "_backups/", "_logs/"]) assert.ok(dev.includes(required), required);
for (const required of ["public_surface_freeze", "flat_tools_legacy_implementation", "logs_root_to__logs"]) assert.ok(layoutStatus.includes(required), required);

console.log("smoke_stage12_step38l_repo_layout_contract ok");
