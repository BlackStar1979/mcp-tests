"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
process.env.MCP_TEST_WORK_ROOT = ROOT;

const {
  listDirectory,
  readFile,
  readFileChunk,
  readFileLines,
  scanTextChunk,
  scanTextFile,
  scanTextLines,
} = require("../src/util/workspace_fs");

const REL_DIR = "workspace_fs_bounded_fixture";
const ABS_DIR = path.join(ROOT, REL_DIR);

function guardedStream(chunks, maxReads) {
  let reads = 0;
  return {
    get reads() {
      return reads;
    },
    streamFactory() {
      return {
        async *[Symbol.asyncIterator]() {
          for (const chunk of chunks) {
            reads += 1;
            if (reads > maxReads) throw new Error("stream consumed beyond requested bound");
            yield chunk;
          }
        },
      };
    },
  };
}

(async () => {
  await fs.rm(ABS_DIR, { recursive: true, force: true });
  await fs.mkdir(ABS_DIR, { recursive: true });

  try {
    for (let index = 0; index < 65; index += 1) {
      await fs.writeFile(path.join(ABS_DIR, `file-${String(index).padStart(3, "0")}.txt`), `${index}\n`, "utf8");
    }
    await fs.writeFile(path.join(ABS_DIR, "large.txt"), "x".repeat(1000), "utf8");
    await fs.writeFile(
      path.join(ABS_DIR, "lines.txt"),
      Array.from({ length: 100 }, (_, index) => `line-${index + 1}`).join("\n"),
      "utf8"
    );

    const names = [];
    let cursor = null;
    do {
      const page = await listDirectory(REL_DIR, { limit: 17, cursor });
      assert.equal(page.count, 67);
      assert.equal(page.returned_count, page.entries.length);
      assert.ok(page.entries.length <= 17);
      names.push(...page.entries.map((entry) => path.posix.basename(entry.path.replaceAll("\\", "/"))));
      cursor = page.next_cursor;
      assert.equal(page.has_more, Boolean(cursor));
    } while (cursor);
    assert.equal(names.length, 67);
    assert.equal(new Set(names).size, 67);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));

    const boundedFile = await readFile(`${REL_DIR}/large.txt`, { maxChars: 10 });
    assert.equal(boundedFile.text, "x".repeat(10));
    assert.equal(boundedFile.returned_chars, 10);
    assert.equal(boundedFile.chars, null);
    assert.equal(boundedFile.total_lines, null);
    assert.equal(boundedFile.complete, false);
    assert.equal(boundedFile.has_more, true);
    assert.ok(boundedFile.scanned_chars <= 11);

    const boundedLines = await readFileLines(`${REL_DIR}/lines.txt`, {
      startLine: 2,
      endLine: 3,
      includeLineNumbers: false,
      maxChars: 1000,
    });
    assert.deepEqual(boundedLines.lines.map((line) => line.text), ["line-2", "line-3"]);
    assert.equal(boundedLines.total_lines, null);
    assert.equal(boundedLines.complete, false);
    assert.equal(boundedLines.has_more, true);
    assert.ok(boundedLines.scanned_lines <= 4);

    const boundedChunk = await readFileChunk(`${REL_DIR}/large.txt`, { offset: 5, length: 4 });
    assert.equal(boundedChunk.text, "xxxx");
    assert.equal(boundedChunk.chars, null);
    assert.equal(boundedChunk.complete, false);
    assert.equal(boundedChunk.has_more, true);
    assert.ok(boundedChunk.scanned_chars <= 10);

    const fileStream = guardedStream(["abc", "def", "forbidden"], 2);
    const fileScan = await scanTextFile("ignored", 5, { createReadStream: fileStream.streamFactory });
    assert.equal(fileScan.text, "abcde");
    assert.equal(fileScan.complete, false);
    assert.equal(fileStream.reads, 2);

    const lineStream = guardedStream(["one\n", "two\n", "three\n", "forbidden\n"], 3);
    const lineScan = await scanTextLines("ignored", {
      startLine: 1,
      endLine: 2,
      includeLineNumbers: false,
      maxChars: 1000,
    }, { createReadStream: lineStream.streamFactory });
    assert.deepEqual(lineScan.selected, ["one", "two"]);
    assert.equal(lineScan.complete, false);
    assert.equal(lineStream.reads, 3);

    const chunkStream = guardedStream(["abc", "def", "forbidden"], 2);
    const chunkScan = await scanTextChunk("ignored", { offset: 0, length: 5 }, { createReadStream: chunkStream.streamFactory });
    assert.equal(chunkScan.returnedText, "abcde");
    assert.equal(chunkScan.complete, false);
    assert.equal(chunkStream.reads, 2);

    console.log("smoke_workspace_fs_bounded ok");
  } finally {
    await fs.rm(ABS_DIR, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
