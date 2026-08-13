"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const { createContentStageManager } = require("../src/util/content_stage_manager");
const {
  commitFileTransform,
  prepareFileTransform,
} = require("../src/util/file_transform_engine");

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-file-transform-"));
  const previousRoot = process.env.MCP_TEST_WORK_ROOT;
  process.env.MCP_TEST_WORK_ROOT = root;
  try {
    const target = path.join(root, "notes.md");
    const original = Buffer.from("\uFEFFHeader\r\nold value\r\nTail\r\n", "utf8");
    fs.writeFileSync(target, original, { mode: 0o640 });
    const input = {
      path: "notes.md",
      expected_file_sha256: hash(original),
      operations: [{
        kind: "replace",
        selector: { kind: "anchor", text: "old value", expected_matches: 1 },
        content: { inline: "new\nline" },
      }],
    };

    const preview = await prepareFileTransform(input);
    const repeatedPreview = await prepareFileTransform(input);
    assert.equal(preview.status, "preview");
    assert.equal(preview.receipt, repeatedPreview.receipt);
    assert.equal(preview.source_sha256, hash(original));
    assert.equal(Object.hasOwn(preview, "content"), false);

    fs.writeFileSync(target, "changed concurrently", "utf8");
    await assert.rejects(
      () => commitFileTransform({ ...input, receipt: preview.receipt }),
      (error) => error.code === "file_transform_source_changed"
    );
    assert.equal(fs.readFileSync(target, "utf8"), "changed concurrently");

    fs.writeFileSync(target, original);
    const freshPreview = await prepareFileTransform(input);
    const committed = await commitFileTransform({ ...input, receipt: freshPreview.receipt });
    const expected = Buffer.from("\uFEFFHeader\r\nnew\r\nline\r\nTail\r\n", "utf8");
    assert.deepEqual(fs.readFileSync(target), expected);
    assert.equal(committed.status, "committed");
    assert.equal(committed.result_sha256, hash(expected));
    assert.equal(committed.bytes_after, expected.length);
    assert.ok(committed.backup);

    const stageManager = createContentStageManager({ storageFile: path.join(root, "stages.sqlite") });
    const stage = stageManager.create("client-a");
    stageManager.append("client-a", stage.stage_id, 0, "staged\n");
    stageManager.append("client-a", stage.stage_id, 1, "content");
    stageManager.seal("client-a", stage.stage_id, { expected_chars: 14 });
    const stagedInput = {
      path: "notes.md",
      expected_file_sha256: committed.result_sha256,
      operations: [{ kind: "append", content: { stage_id: stage.stage_id } }],
    };
    const stagedPreview = await prepareFileTransform(stagedInput, {
      authResult: { clientId: "client-a" },
      contentStageManager: stageManager,
    });
    await commitFileTransform({ ...stagedInput, receipt: stagedPreview.receipt }, {
      authResult: { clientId: "client-a" },
      contentStageManager: stageManager,
    });
    assert.ok(fs.readFileSync(target, "utf8").endsWith("staged\r\ncontent"));
    stageManager.close();

    const source = path.join(root, "source.txt");
    fs.writeFileSync(source, "zero ONE two", "utf8");
    const beforeFileSource = fs.readFileSync(target);
    const fileSourceInput = {
      path: "notes.md",
      expected_file_sha256: hash(beforeFileSource),
      operations: [{
        kind: "append",
        content: {
          file: {
            path: "source.txt",
            expected_file_sha256: hash(fs.readFileSync(source)),
            selector: { kind: "anchor", text: "ONE", expected_matches: 1 },
          },
        },
      }],
    };
    const fileSourcePreview = await prepareFileTransform(fileSourceInput);
    await commitFileTransform({ ...fileSourceInput, receipt: fileSourcePreview.receipt });
    assert.ok(fs.readFileSync(target, "utf8").endsWith("contentONE"));

    const overlapInput = {
      path: "source.txt",
      expected_file_sha256: hash(fs.readFileSync(source)),
      operations: [
        { kind: "replace", selector: { kind: "bytes", start_byte: 0, end_byte: 5 }, content: { inline: "a" } },
        { kind: "delete", selector: { kind: "bytes", start_byte: 4, end_byte: 8 } },
      ],
    };
    await assert.rejects(
      () => prepareFileTransform(overlapInput),
      (error) => error.code === "file_transform_overlap"
    );

    const failureTarget = path.join(root, "failure.txt");
    fs.writeFileSync(failureTarget, "before", "utf8");
    const failureInput = {
      path: "failure.txt",
      expected_file_sha256: hash(fs.readFileSync(failureTarget)),
      operations: [{ kind: "replace", selector: { kind: "bytes", start_byte: 0, end_byte: 6 }, content: { inline: "after" } }],
    };
    const failurePreview = await prepareFileTransform(failureInput);
    await assert.rejects(
      () => commitFileTransform({ ...failureInput, receipt: failurePreview.receipt }, {
        fileTransactionDependencies: {
          rename: async () => {
            const error = new Error("injected rename failure");
            error.code = "EACCES";
            throw error;
          },
        },
      }),
      /injected rename failure/
    );
    assert.equal(fs.readFileSync(failureTarget, "utf8"), "before");
    assert.deepEqual(fs.readdirSync(root).filter((name) => name.includes(".mcp-tmp-")), []);

    const largeTarget = path.join(root, "large.txt");
    const large = Buffer.from(`start\n${"x".repeat(6 * 1024 * 1024)}\nend`, "utf8");
    fs.writeFileSync(largeTarget, large);
    const largeInput = {
      path: "large.txt",
      expected_file_sha256: hash(large),
      operations: [{ kind: "replace", selector: { kind: "anchor", text: "start", expected_matches: 1 }, content: { inline: "begin" } }],
    };
    const largePreview = await prepareFileTransform(largeInput);
    const largeResult = await commitFileTransform({ ...largeInput, receipt: largePreview.receipt });
    assert.ok(largeResult.bytes_after > 5 * 1024 * 1024);
    assert.ok(fs.readFileSync(largeTarget, "utf8").startsWith("begin\n"));

    const stat = await fsp.stat(target);
    if (process.platform !== "win32") assert.equal(stat.mode & 0o777, 0o640);

    console.log("smoke_file_transform_engine ok");
  } finally {
    if (previousRoot === undefined) delete process.env.MCP_TEST_WORK_ROOT;
    else process.env.MCP_TEST_WORK_ROOT = previousRoot;
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
