"use strict";

const assert = require("node:assert/strict");
const { validateToolInput } = require("../src/runtime/tool_input_validator");
const {
  CONTENT_SOURCE_SCHEMA,
  CONTENT_STAGE_INPUT_SCHEMA,
  FILE_INSPECT_INPUT_SCHEMA,
  FILE_MERGE_INPUT_SCHEMA,
  FILE_SELECTOR_SCHEMA,
  FILE_SPLIT_INPUT_SCHEMA,
  FILE_TRANSFORM_INPUT_SCHEMA,
  MARKDOWN_INSPECT_INPUT_SCHEMA,
  MARKDOWN_TRANSFORM_INPUT_SCHEMA,
  STRUCTURED_CONTENT_CHUNK_MAX_CHARS,
} = require("../src/schemas/structured_file_tools");

const INPUT_SCHEMAS = [
  FILE_INSPECT_INPUT_SCHEMA,
  CONTENT_STAGE_INPUT_SCHEMA,
  FILE_TRANSFORM_INPUT_SCHEMA,
  FILE_SPLIT_INPUT_SCHEMA,
  FILE_MERGE_INPUT_SCHEMA,
  MARKDOWN_INSPECT_INPUT_SCHEMA,
  MARKDOWN_TRANSFORM_INPUT_SCHEMA,
];

assert.equal(STRUCTURED_CONTENT_CHUNK_MAX_CHARS, 8192);
assert.equal(FILE_SELECTOR_SCHEMA.oneOf.length, 5);
assert.equal(CONTENT_SOURCE_SCHEMA.oneOf.length, 3);
assert.equal(INPUT_SCHEMAS.length, 7);
for (const schema of INPUT_SCHEMAS) {
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
}

const stageChunk = "x".repeat(STRUCTURED_CONTENT_CHUNK_MAX_CHARS);
assert.equal(validateToolInput("content_stage", {
  action: "append",
  stage_id: "123e4567-e89b-42d3-a456-426614174000",
  sequence: 0,
  chunk: stageChunk,
}, CONTENT_STAGE_INPUT_SCHEMA).ok, true);
assert.equal(validateToolInput("content_stage", {
  action: "append",
  stage_id: "123e4567-e89b-42d3-a456-426614174000",
  sequence: 0,
  chunk: `${stageChunk}x`,
}, CONTENT_STAGE_INPUT_SCHEMA).ok, false);

const anchor = { kind: "anchor", text: "## Current log", occurrence: 1, expected_matches: 1 };
assert.equal(validateToolInput("file_inspect", { path: "notes.md", selector: anchor }, FILE_INSPECT_INPUT_SCHEMA).ok, true);
assert.equal(validateToolInput("file_inspect", { path: "notes.md", selector: { kind: "bytes", start_byte: 0 } }, FILE_INSPECT_INPUT_SCHEMA).ok, false);

assert.equal(validateToolInput("file_transform", {
  action: "preview",
  path: "notes.md",
  expected_file_sha256: "a".repeat(64),
  operations: [{ kind: "replace", selector: anchor, content: { inline: "replacement" } }],
}, FILE_TRANSFORM_INPUT_SCHEMA).ok, true);

assert.equal(validateToolInput("file_split", {
  action: "preview",
  source: "large.md",
  expected_source_sha256: "b".repeat(64),
  parts: [{ destination: "archive.md", selector: { kind: "lines", start_line: 10, end_line: 20 } }],
}, FILE_SPLIT_INPUT_SCHEMA).ok, true);

assert.equal(validateToolInput("file_merge", {
  action: "preview",
  destination: "merged.log",
  sources: [{ path: "one.log", expected_sha256: "c".repeat(64) }],
  separator: "\n",
}, FILE_MERGE_INPUT_SCHEMA).ok, true);

assert.equal(validateToolInput("markdown_inspect", { path: "README.md", max_nodes: 50 }, MARKDOWN_INSPECT_INPUT_SCHEMA).ok, true);
assert.equal(validateToolInput("markdown_transform", {
  action: "preview",
  path: "README.md",
  expected_file_sha256: "d".repeat(64),
  operation: {
    kind: "append_to_section",
    section: { heading_path: ["Usage"], occurrence: 1 },
    content: { inline: "\nMore details.\n" },
  },
}, MARKDOWN_TRANSFORM_INPUT_SCHEMA).ok, true);

assert.equal(validateToolInput("file_inspect", { path: "notes.md", unexpected: true }, FILE_INSPECT_INPUT_SCHEMA).ok, false);

console.log("smoke_structured_file_schemas ok");
