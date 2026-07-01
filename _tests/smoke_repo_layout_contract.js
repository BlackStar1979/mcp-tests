"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const spec = JSON.parse(read("SERVER_SPEC.json"));
const canon = read("_workflow/WORKFLOW_CANON.md");

assert.equal(spec.repository_layout_contract.version, "repo-layout-contract-v2");
assert.equal(spec.repository_layout_contract.status, "canonical_layout_contract_not_progress_log");
assert.ok(spec.repository_layout_contract.root_policy.active_root_dirs.includes("src"));
assert.ok(spec.repository_layout_contract.root_policy.active_root_files.includes("SERVER_SPEC.json"));
const backupEntry = spec.repository_layout_contract.root_policy.tolerated_legacy_root_items.find((entry) => entry.path === "server.js.bak-*");
assert.equal(backupEntry.target, "_workflow/control_plane/retired_root_backups/");
for (const rel of ["_workflow", "_tests", "_workflow/control_plane", "_workflow/control_plane/snapshots", "_workflow/control_plane/file_backups", "_logs"]) {
  assert.ok(exists(rel), `${rel} must exist`);
}
assert.equal(exists("_backups"), false);
assert.ok(canon.includes("Root `_backups/**` is retired and must not be recreated."));
console.log("smoke_repo_layout_contract ok");
