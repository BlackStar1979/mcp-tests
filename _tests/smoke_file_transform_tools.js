"use strict";

const assert = require("node:assert/strict");
const { fileInspectTool } = require("../tools/file_inspect");
const { fileTransformTool } = require("../tools/file_transform");

(async () => {
  assert.equal(fileInspectTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(fileInspectTool.descriptor.annotations.destructiveHint, false);
  assert.equal(fileTransformTool.descriptor.annotations.readOnlyHint, false);
  assert.equal(fileTransformTool.descriptor.annotations.destructiveHint, false);
  assert.match(fileTransformTool.descriptor.description, /one file/i);
  assert.match(fileTransformTool.descriptor.description, /file_split/i);

  const inspectCalls = [];
  const inspectContext = {
    structuredFileApi: {
      async inspect(args) {
        inspectCalls.push(args);
        return {
          path: "notes.md",
          bytes: 100,
          file_sha256: "a".repeat(64),
          has_utf8_bom: false,
          dominant_eol: "\n",
          total_lines: 4,
          selector: null,
          context: null,
        };
      },
    },
  };
  const inspected = await fileInspectTool.execute({ path: "notes.md" }, inspectContext);
  assert.equal(inspected.success, true);
  assert.equal(inspectCalls.length, 1);

  const engineCalls = [];
  const transformContext = {
    fileTransformEngine: {
      async prepare(input) {
        engineCalls.push(["preview", input]);
        return {
          status: "preview",
          path: input.path,
          source_sha256: input.expected_file_sha256,
          source_bytes: 10,
          bytes_after: 12,
          delta_bytes: 2,
          operation_count: 1,
          operations: [],
          receipt: "r".repeat(64),
        };
      },
      async commit(input) {
        engineCalls.push(["commit", input]);
        return {
          status: "committed",
          path: input.path,
          source_sha256: input.expected_file_sha256,
          result_sha256: "b".repeat(64),
          bytes_before: 10,
          bytes_after: 12,
          delta_bytes: 2,
          operation_count: 1,
          receipt: input.receipt,
          backup: ".mcp_backups/notes.md",
          warnings: [],
        };
      },
    },
  };
  const args = {
    action: "preview",
    path: "notes.md",
    expected_file_sha256: "a".repeat(64),
    operations: [{ kind: "append", content: { inline: "secret payload" } }],
  };
  const preview = await fileTransformTool.execute(args, transformContext);
  assert.equal(preview.success, true);
  assert.equal(preview.status, "preview");
  const committed = await fileTransformTool.execute({ ...args, action: "commit", receipt: preview.receipt }, transformContext);
  assert.equal(committed.status, "committed");
  assert.deepEqual(engineCalls.map((item) => item[0]), ["preview", "commit"]);

  const summary = fileTransformTool.summarizeArgs(args);
  assert.equal(JSON.stringify(summary).includes("secret payload"), false);
  assert.equal(summary.inline_content_chars, 14);

  const invalid = await fileTransformTool.execute({ action: "invalid", path: "notes.md" }, transformContext);
  assert.equal(invalid.success, false);
  assert.equal(invalid.error.code, "file_transform_action_invalid");

  console.log("smoke_file_transform_tools ok");
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
