"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
  const root = path.resolve(__dirname, "..");
  const fixtureRelative = "_control/smoke_code_apply_patch_source_binding";
  const workspaceFixtureRelative = `mcp-tests/${fixtureRelative}`;
  const fixture = path.join(root, ...fixtureRelative.split("/"));
  try {
    fs.rmSync(fixture, { recursive: true, force: true });
    const targetRelative = `${workspaceFixtureRelative}/sample.js`;
    const target = path.join(fixture, "sample.js");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const original = "const value = 1;\nconsole.log(value);\n";
    fs.writeFileSync(target, original, "utf8");
    const { executeCodeApplyPatch } = require("../src/util/code_mutation_tools");
    const args = {
      path: fixtureRelative,
      target: `${fixtureRelative}/sample.js`,
      intent: "refactor",
      objective: "change value",
      anchor: "const value = 1;",
      content: "const value = 2;",
      mode: "replace",
      dry_run: true,
    };

    const options = { auditLogPath: `${workspaceFixtureRelative}/actions.jsonl` };
    const preview = await executeCodeApplyPatch(args, options);
    assert.equal(preview.status, "ready_to_apply");
    assert.equal(preview.source_sha256.length, 64);

    const concurrent = `// concurrent edit\n${original}`;
    fs.writeFileSync(target, concurrent, "utf8");
    const rejected = await executeCodeApplyPatch({
      ...args,
      dry_run: false,
      confirm: true,
      commit_ref: preview.operation_id,
    }, options);
    assert.equal(rejected.status, "commit_integrity_violation");
    assert.equal(fs.readFileSync(target, "utf8"), concurrent);

    fs.writeFileSync(target, original, "utf8");
    const lateRacePreview = await executeCodeApplyPatch(args, options);
    const lateRace = `// late race\n${original}`;
    const lateRaceRejected = await executeCodeApplyPatch({
      ...args,
      dry_run: false,
      confirm: true,
      commit_ref: lateRacePreview.operation_id,
    }, {
      ...options,
      beforeCommit: async () => fs.writeFileSync(target, lateRace, "utf8"),
    });
    assert.equal(lateRaceRejected.status, "commit_integrity_violation");
    assert.equal(fs.readFileSync(target, "utf8"), lateRace);

    fs.writeFileSync(target, original, "utf8");
    const fresh = await executeCodeApplyPatch(args, options);
    const committed = await executeCodeApplyPatch({
      ...args,
      dry_run: false,
      confirm: true,
      commit_ref: fresh.operation_id,
    }, options);
    assert.equal(committed.status, "committed_after_validation");
    assert.match(fs.readFileSync(target, "utf8"), /const value = 2;/);

    console.log("smoke_code_apply_patch_source_binding ok");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
