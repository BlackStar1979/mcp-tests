"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
process.env.MCP_TEST_WORK_ROOT = ROOT;

const {
  appendFile,
  classifyMutationTarget,
  writeFile,
} = require("../src/util/workspace_mutation");

const REL_DIR = "append_policy_fixture";
const ABS_DIR = path.join(ROOT, REL_DIR);

(async () => {
  await fs.rm(ABS_DIR, { recursive: true, force: true });
  await fs.mkdir(ABS_DIR, { recursive: true });

  try {
    assert.equal(classifyMutationTarget(`${REL_DIR}/events.log`).classification, "append_only");
    assert.equal(classifyMutationTarget(`${REL_DIR}/events.jsonl`).classification, "append_only");
    assert.equal(classifyMutationTarget(`${REL_DIR}/events.ndjson`).classification, "append_only");
    assert.equal(classifyMutationTarget(`${REL_DIR}/notes.txt`).classification, "editable_text");
    assert.equal(classifyMutationTarget(`${REL_DIR}/module.js`).classification, "editable_text");
    assert.equal(classifyMutationTarget(`${REL_DIR}/SERVER_FIXTURE_SPEC.json`).classification, "canonical");

    for (const name of ["events.log", "events.jsonl", "events.ndjson"]) {
      const relative = `${REL_DIR}/${name}`;
      await writeFile(relative, "first\n");
      const result = await appendFile(relative, "second\n");
      assert.equal(result.status, "appended");
      assert.equal(await fs.readFile(path.join(ROOT, ...relative.split("/")), "utf8"), "first\nsecond\n");
    }

    for (const name of ["notes.txt", "module.js", "SERVER_FIXTURE_SPEC.json"]) {
      const relative = `${REL_DIR}/${name}`;
      await writeFile(relative, "original\n");
      await assert.rejects(
        () => appendFile(relative, "forbidden\n", { allowProtected: true }),
        /append-only|edit_file_patch|semantic/i
      );
      assert.equal(await fs.readFile(path.join(ROOT, ...relative.split("/")), "utf8"), "original\n");
    }

    console.log("smoke_append_file_policy ok");
  } finally {
    await fs.rm(ABS_DIR, { recursive: true, force: true });
    await fs.rm(path.join(ROOT, ".mcp_backups", REL_DIR), { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
