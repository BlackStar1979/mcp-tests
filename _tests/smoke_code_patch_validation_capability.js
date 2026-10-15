"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
process.env.MCP_TEST_WORK_ROOT = ROOT;

const { executeCodeApplyPatch } = require("../src/util/code_mutation_tools");

const REL_DIR = "validation_fixture_ts";
const REL_FILE = `${REL_DIR}/fixture.ts`;
const ABS_DIR = path.join(ROOT, REL_DIR);
const ABS_FILE = path.join(ROOT, ...REL_FILE.split("/"));
const AUDIT_DIR = path.join(ROOT, ".mcp_audit");
const BACKUP_DIR = path.join(ROOT, ".mcp_backups", REL_DIR);

(async () => {
  await fs.rm(ABS_DIR, { recursive: true, force: true });
  await fs.rm(AUDIT_DIR, { recursive: true, force: true });
  await fs.rm(BACKUP_DIR, { recursive: true, force: true });
  await fs.mkdir(ABS_DIR, { recursive: true });
  const original = "const value: number = 1;\n";
  await fs.writeFile(ABS_FILE, original, "utf8");

  const args = {
    path: REL_DIR,
    target: REL_FILE,
    anchor: "1",
    content: "2",
    mode: "replace",
    intent: "change_behavior",
    objective: "validation capability smoke",
    recursive: true,
    max_files: 20,
    max_depth: 2,
  };

  try {
    const dryRun = await executeCodeApplyPatch({ ...args, dry_run: true });
    assert.equal(dryRun.status, "ready_to_apply");
    assert.equal(dryRun.applied, false);
    assert.equal(dryRun.validation_capability.available, false);
    assert.equal(dryRun.validation_capability.language, "javascript");

    const apply = await executeCodeApplyPatch({
      ...args,
      dry_run: false,
      confirm: true,
      commit_ref: dryRun.operation_id,
    });
    assert.equal(apply.success, false);
    assert.equal(apply.status, "validation_unavailable");
    assert.equal(apply.applied, false);
    assert.equal(apply.validation_capability.available, false);
    assert.equal(await fs.readFile(ABS_FILE, "utf8"), original);
    await assert.rejects(() => fs.access(BACKUP_DIR));

    console.log("smoke_code_patch_validation_capability ok");
  } finally {
    await fs.rm(ABS_DIR, { recursive: true, force: true });
    await fs.rm(AUDIT_DIR, { recursive: true, force: true });
    await fs.rm(BACKUP_DIR, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
