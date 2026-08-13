"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  inspectTextFile,
  readSelectorContext,
  resolveSelector,
} = require("../src/util/file_selectors");

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-file-selectors-"));
  try {
    const file = path.join(root, "sample.md");
    const text = "\uFEFFalpha\r\nβeta\r\nanchor-middle\r\nlast";
    const bytes = Buffer.from(text, "utf8");
    fs.writeFileSync(file, bytes);

    const info = await inspectTextFile(file, { chunkSize: 7 });
    assert.equal(info.bytes, bytes.length);
    assert.equal(info.fileSha256, hash(bytes));
    assert.equal(info.hasUtf8Bom, true);
    assert.equal(info.dominantEol, "\r\n");

    const lines = await resolveSelector(file, {
      kind: "lines",
      start_line: 2,
      end_line: 3,
    }, { chunkSize: 5 });
    assert.equal(bytes.subarray(lines.startByte, lines.endByte).toString("utf8"), "βeta\r\nanchor-middle\r\n");
    assert.equal(lines.rangeSha256, hash(Buffer.from("βeta\r\nanchor-middle\r\n")));
    assert.equal(lines.lineStart, 2);
    assert.equal(lines.lineEnd, 3);
    await assert.rejects(
      () => resolveSelector(file, { kind: "lines", start_line: 2, end_line: 99 }),
      (error) => error.code === "file_selector_range_invalid"
    );

    const anchor = await resolveSelector(file, {
      kind: "anchor",
      text: "anchor-middle",
      occurrence: 1,
      expected_matches: 1,
    }, { chunkSize: 4 });
    assert.equal(bytes.subarray(anchor.startByte, anchor.endByte).toString("utf8"), "anchor-middle");
    assert.equal(anchor.matches, 1);

    const context = await readSelectorContext(file, anchor, { beforeChars: 4, afterChars: 4 });
    assert.equal(context.selected, "anchor-middle");
    assert.ok(context.before.length <= 4);
    assert.ok(context.after.length <= 4);
    assert.equal(context.truncated, true);

    const wide = path.join(root, "wide.txt");
    fs.writeFileSync(wide, "w".repeat(20000), "utf8");
    const wideRange = await resolveSelector(wide, { kind: "bytes", start_byte: 0, end_byte: 20000 });
    const wideContext = await readSelectorContext(wide, wideRange, { selectedMaxChars: 8192 });
    assert.equal(wideContext.selected.length, 8192);
    assert.equal(wideContext.truncated, true);

    const duplicates = path.join(root, "duplicates.txt");
    fs.writeFileSync(duplicates, "one needle two needle three", "utf8");
    await assert.rejects(
      () => resolveSelector(duplicates, { kind: "anchor", text: "needle", expected_matches: 1 }),
      (error) => error.code === "file_selector_match_count"
    );
    const second = await resolveSelector(duplicates, {
      kind: "anchor",
      text: "needle",
      occurrence: 2,
      expected_matches: 2,
    }, { chunkSize: 3 });
    assert.equal(second.matches, 2);
    assert.equal(second.startByte, Buffer.byteLength("one needle two "));

    const emoji = path.join(root, "emoji.txt");
    const emojiBytes = Buffer.from("A😀B", "utf8");
    fs.writeFileSync(emoji, emojiBytes);
    await assert.rejects(
      () => resolveSelector(emoji, { kind: "bytes", start_byte: 2, end_byte: 5 }),
      (error) => error.code === "file_selector_utf8_boundary"
    );
    const exactEmoji = await resolveSelector(emoji, { kind: "bytes", start_byte: 1, end_byte: 5 });
    assert.equal(emojiBytes.subarray(exactEmoji.startByte, exactEmoji.endByte).toString("utf8"), "😀");

    const eof = await resolveSelector(emoji, { kind: "eof" });
    assert.equal(eof.startByte, emojiBytes.length);
    assert.equal(eof.endByte, emojiBytes.length);

    const markdown = await resolveSelector(file, {
      kind: "markdown_section",
      heading_path: ["Example"],
    }, {
      markdownResolver: async () => ({ startByte: 3, endByte: 8, lineStart: 1, lineEnd: 1, matches: 1 }),
    });
    assert.equal(markdown.startByte, 3);
    assert.equal(markdown.endByte, 8);

    const malformed = path.join(root, "malformed.txt");
    fs.writeFileSync(malformed, Buffer.from([0xC3, 0x28]));
    await assert.rejects(
      () => inspectTextFile(malformed),
      (error) => error.code === "structured_file_invalid_utf8"
    );

    console.log("smoke_file_selectors ok");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
