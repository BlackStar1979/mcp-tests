"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { buildWorkRoots, safeWorkspacePath } = require("../src/util/workspace_roots");

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-workspace-root-boundary-"));
const workspace = path.join(temp, "work");
const outside = path.join(temp, "outside");
fs.mkdirSync(workspace, { recursive: true });
fs.mkdirSync(outside, { recursive: true });
fs.writeFileSync(path.join(outside, "outside.txt"), "outside-boundary", "utf8");
fs.mkdirSync(path.join(workspace, "inside"), { recursive: true });

try {
  const escapeLink = path.join(workspace, "escape");
  fs.symlinkSync(outside, escapeLink, process.platform === "win32" ? "junction" : "dir");
  const roots = buildWorkRoots({ primaryPath: workspace, extraRootsEnv: "" });

  assert.throws(
    () => safeWorkspacePath("escape/outside.txt", { roots }),
    /workspace root|symlink|access denied/i,
    "workspace path resolution must reject a symlink or junction that escapes the configured root"
  );

  const normal = safeWorkspacePath("inside/new.txt", { roots });
  assert.equal(normal.absolutePath, path.resolve(workspace, "inside", "new.txt"));
  console.log("smoke_workspace_root_symlink_boundary ok");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
