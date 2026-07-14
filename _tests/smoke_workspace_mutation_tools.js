"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const { appendFileTool } = require("../tools/append_file");
const { copyPathTool } = require("../tools/copy_path");
const { deletePathTool } = require("../tools/delete_path");
const { editFilePatchTool } = require("../tools/edit_file_patch");
const { movePathTool } = require("../tools/move_path");
const { restorePathTool } = require("../tools/restore_path");
const { writeFileTool } = require("../tools/write_file");
const { safeWorkspacePath } = require("../src/util/workspace_roots");
const { restorePath } = require("../src/util/workspace_mutation");

const WORK_ROOT = safeWorkspacePath(".").absolutePath;
const TMP_ROOT = path.join(WORK_ROOT, "_control", "smoke_workspace_mutation_tools");

(async () => {
  await fs.rm(TMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(TMP_ROOT, { recursive: true });

  const file = "_control/smoke_workspace_mutation_tools/source.txt";
  const copy = "_control/smoke_workspace_mutation_tools/copy.txt";
  const moved = "_control/smoke_workspace_mutation_tools/moved.txt";

  try {
    const writeResult = await writeFileTool.execute({ path: file, content: "alpha\nbeta\n" });
    assert.equal(writeResult.status, "written");

    const appendResult = await appendFileTool.execute({ path: file, content: "gamma\n" });
    assert.equal(appendResult.status, "appended");

    const dryRun = await editFilePatchTool.execute({
      path: file,
      anchor: "beta\n",
      content: "beta\nPATCHED\n",
      mode: "replace",
      dry_run: true,
    });
    assert.equal(dryRun.status, "dry_run");
    assert.equal(dryRun.anchor_matches, 1);

    const patchResult = await editFilePatchTool.execute({
      path: file,
      anchor: "beta\n",
      content: "beta\nPATCHED\n",
      mode: "replace",
      dry_run: false,
      require_markers: ["PATCHED"],
    });
    assert.equal(patchResult.status, "patched");
    assert.ok(patchResult.backup, "patched write should create backup");

    const copyResult = await copyPathTool.execute({ from: file, to: copy });
    assert.equal(copyResult.status, "copied");

    const moveResult = await movePathTool.execute({ from: copy, to: moved });
    assert.equal(moveResult.status, "moved");

    const deleteResult = await deletePathTool.execute({ path: moved });
    assert.equal(deleteResult.status, "moved_to_trash");
    assert.match(deleteResult.to, /\.mcp_trash\//);

    const restoreResult = await restorePathTool.execute({ trash_path: deleteResult.to });
    assert.equal(restoreResult.status, "restored");
    assert.equal(restoreResult.to, moved);
    assert.deepEqual(restoreResult.warnings, []);

    const warningFile = "_control/smoke_workspace_mutation_tools/warning.txt";
    const warningMoved = "_control/smoke_workspace_mutation_tools/warning-restored.txt";
    await writeFileTool.execute({ path: warningFile, content: "warning\n" });
    const warningDeleteResult = await deletePathTool.execute({ path: warningFile });
    const warningMetadataAbsolute = path.join(WORK_ROOT, `${warningDeleteResult.to}.json`);
    const warningRestoreResult = await restorePath(
      warningDeleteResult.to,
      { destination: warningMoved },
      {
        fsImpl: {
          ...fs,
          async rm(targetPath, options) {
            if (targetPath === warningMetadataAbsolute) {
              throw new Error("metadata delete blocked");
            }
            return fs.rm(targetPath, options);
          },
        },
      }
    );
    assert.equal(warningRestoreResult.status, "restored");
    assert.equal(warningRestoreResult.to, warningMoved);
    assert.deepEqual(warningRestoreResult.warnings, ["restore metadata cleanup failed: metadata delete blocked"]);
    await fs.access(path.join(WORK_ROOT, warningMoved));
    await fs.access(warningMetadataAbsolute);

    const finalText = await fs.readFile(path.join(WORK_ROOT, moved), "utf8");
    assert.match(finalText, /PATCHED/);
    console.log("smoke_workspace_mutation_tools ok");
  } finally {
    await fs.rm(TMP_ROOT, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
