"use strict";

// FS-HARDEN Task 2 (ported 2026-10-16 from archive/feature/filesystem-hardening-20260802, 550d58d):
// a symlink or junction inside the workspace must not let reads or mutations escape the workspace
// root, and mutation must not go through any reparse-point component even when it stays inside.

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { readFile } = require("../src/util/workspace_fs");
const { copyPath, deletePath, movePath, writeFile } = require("../src/util/workspace_mutation");
const { safeWorkspacePath } = require("../src/util/workspace_roots");

const WORK_ROOT = safeWorkspacePath(".").absolutePath;
const REL_BASE = "LocalNodeMCP/_control/smoke_workspace_realpath_boundary";
const ABS_BASE = path.join(WORK_ROOT, ...REL_BASE.split("/"));
const BOUNDARY_ERROR = /workspace root|real path|symlink|junction|reparse/i;

async function makeDirectoryLink(target, linkPath) {
  await fs.symlink(target, linkPath, process.platform === "win32" ? "junction" : "dir");
}

(async () => {
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-tests-boundary-"));
  await fs.rm(ABS_BASE, { recursive: true, force: true });
  await fs.mkdir(ABS_BASE, { recursive: true });
  await fs.writeFile(path.join(outside, "outside.txt"), "outside\n", "utf8");

  try {
    const outsideLink = path.join(ABS_BASE, "outside-link");
    await makeDirectoryLink(outside, outsideLink);

    await assert.rejects(() => readFile(`${REL_BASE}/outside-link/outside.txt`), BOUNDARY_ERROR,
      "read through a junction to outside the workspace");

    await assert.rejects(() => writeFile(`${REL_BASE}/outside-link/new.txt`, "blocked\n"), BOUNDARY_ERROR,
      "write through a junction to outside the workspace");
    await assert.rejects(() => fs.access(path.join(outside, "new.txt")));

    const source = `${REL_BASE}/source.txt`;
    await writeFile(source, "source\n");
    await assert.rejects(() => copyPath(source, `${REL_BASE}/outside-link/copied.txt`), BOUNDARY_ERROR,
      "copy through a junction to outside the workspace");
    await assert.rejects(() => fs.access(path.join(outside, "copied.txt")));

    await assert.rejects(() => movePath(source, `${REL_BASE}/outside-link/moved.txt`), BOUNDARY_ERROR,
      "move through a junction to outside the workspace");
    await assert.rejects(() => fs.access(path.join(outside, "moved.txt")));

    await assert.rejects(() => deletePath(`${REL_BASE}/outside-link/outside.txt`), BOUNDARY_ERROR,
      "delete through a junction to outside the workspace");
    assert.equal(await fs.readFile(path.join(outside, "outside.txt"), "utf8"), "outside\n");

    const insideTarget = path.join(ABS_BASE, "inside-target");
    const insideLink = path.join(ABS_BASE, "inside-link");
    await fs.mkdir(insideTarget, { recursive: true });
    await fs.writeFile(path.join(insideTarget, "inside.txt"), "inside\n", "utf8");
    await makeDirectoryLink(insideTarget, insideLink);

    const insideRead = await readFile(`${REL_BASE}/inside-link/inside.txt`);
    assert.equal(insideRead.text, "inside\n");

    await assert.rejects(() => writeFile(`${REL_BASE}/inside-link/mutation.txt`, "blocked\n"), /symlink|junction|reparse/i,
      "mutation through an in-workspace junction");
    await assert.rejects(() => fs.access(path.join(insideTarget, "mutation.txt")));

    console.log("smoke_workspace_realpath_boundary ok");
  } finally {
    await fs.rm(ABS_BASE, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
