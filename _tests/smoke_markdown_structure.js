"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { assertMatchesSchema } = require("../src/output_schema_guard");
const {
  commitMarkdownTransform,
  inspectMarkdown,
  prepareMarkdownTransform,
  resolveMarkdownSection,
} = require("../src/util/markdown_structure");
const { markdownInspectTool } = require("../tools/markdown_inspect");
const { markdownTransformTool } = require("../tools/markdown_transform");
const { fileInspectTool } = require("../tools/file_inspect");

const ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(ROOT, "..");
const FIXTURE_REL = "mcp-tests/_control/smoke_markdown_structure";
const FIXTURE = path.join(WORKSPACE_ROOT, ...FIXTURE_REL.split("/"));

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function workspacePath(name) {
  return `${FIXTURE_REL}/${name}`;
}

const EOL = "\r\n";
const ORIGINAL = [
  "---",
  "title: Structure fixture",
  "---",
  "# Root",
  "Intro with zażółć and <span>inline HTML</span>.",
  "## Repeat",
  "First body.",
  "### Child",
  "- [x] completed",
  "## Repeat",
  "Second body.",
  "| Name | Value |",
  "| --- | ---: |",
  "| one | 1 |",
  "```js",
  "# fenced-not-a-heading",
  "```",
  "<div>block HTML</div>",
].join(EOL);

(async () => {
  await fs.rm(FIXTURE, { recursive: true, force: true });
  await fs.mkdir(FIXTURE, { recursive: true });
  const target = path.join(FIXTURE, "document.md");
  await fs.writeFile(target, ORIGINAL, "utf8");
  try {
    assert.equal(markdownInspectTool.name, "markdown_inspect");
    assert.equal(markdownTransformTool.name, "markdown_transform");
    const inspected = await inspectMarkdown(workspacePath("document.md"), { maxNodes: 100 });
    assert.equal(inspected.file_sha256, sha256(ORIGINAL));
    assert.equal(inspected.has_final_newline, false);
    assert.deepEqual(inspected.headings.map((item) => ({ path: item.heading_path, occurrence: item.occurrence })), [
      { path: ["Root"], occurrence: 1 },
      { path: ["Root", "Repeat"], occurrence: 1 },
      { path: ["Root", "Repeat", "Child"], occurrence: 1 },
      { path: ["Root", "Repeat"], occurrence: 2 },
    ]);
    assert.equal(inspected.headings.some((item) => item.title.includes("fenced")), false);
    assert.equal(inspected.headings[1].line_end, 9);
    assert.deepEqual(inspected.features, {
      frontmatter: true,
      gfm_table: true,
      task_list: true,
      code_block: true,
      html: true,
    });
    for (const heading of inspected.headings) {
      const section = Buffer.from(ORIGINAL, "utf8").subarray(heading.start_byte, heading.end_byte);
      assert.equal(sha256(section), heading.section_sha256);
    }
    const duplicate = await resolveMarkdownSection(target, {
      heading_path: ["Root", "Repeat"],
      occurrence: 2,
    });
    assert.equal(duplicate.matches, 2);
    assert.equal(duplicate.rangeSha256, inspected.headings[3].section_sha256);
    const genericInspection = await fileInspectTool.execute({
      path: workspacePath("document.md"),
      selector: {
        kind: "markdown_section",
        heading_path: ["Root", "Repeat"],
        occurrence: 2,
        expected_sha256: inspected.headings[3].section_sha256,
      },
      context_before_chars: 8,
      context_after_chars: 8,
    });
    assert.equal(genericInspection.success, true);
    assert.equal(genericInspection.selector.range_sha256, inspected.headings[3].section_sha256);

    const bounded = await inspectMarkdown(workspacePath("document.md"), { maxNodes: 2 });
    assert.equal(bounded.headings.length, 2);
    assert.equal(bounded.truncated, true);
    assert.equal((await inspectMarkdown(workspacePath("document.md"), { includeDocumentFeatures: false })).features, null);
    const toolOutput = await markdownInspectTool.execute({ path: workspacePath("document.md"), max_nodes: 100 });
    assert.doesNotThrow(() => assertMatchesSchema(toolOutput, markdownInspectTool.descriptor.outputSchema, "markdown_inspect"));

    const secondRepeat = inspected.headings[3];
    const replacement = "Replacement body.\n\n- [ ] pending";
    const transformInput = {
      path: workspacePath("document.md"),
      expected_file_sha256: inspected.file_sha256,
      operation: {
        kind: "replace_section_body",
        section: {
          heading_path: ["Root", "Repeat"],
          occurrence: 2,
          expected_section_sha256: secondRepeat.section_sha256,
        },
        content: { inline: replacement },
      },
    };
    const preview = await prepareMarkdownTransform(transformInput);
    assert.equal(preview.status, "preview");
    const transformToolPreview = await markdownTransformTool.execute({ ...transformInput, action: "preview" });
    assert.doesNotThrow(() => assertMatchesSchema(transformToolPreview, markdownTransformTool.descriptor.outputSchema, "markdown_transform"));
    const before = Buffer.from(ORIGINAL, "utf8").subarray(0, secondRepeat.body_start_byte);
    const committed = await commitMarkdownTransform({ ...transformInput, receipt: preview.receipt });
    assert.equal(committed.status, "committed");
    const changed = await fs.readFile(target);
    assert.deepEqual(changed.subarray(0, before.length), before, "untouched prefix must remain byte-identical");
    assert.equal(changed.subarray(before.length).toString("utf8"), replacement.replaceAll("\n", EOL));
    assert.equal(changed.includes(Buffer.from("| --- | ---: |", "utf8")), false, "selected body must be replaced, not reformatted");

    await fs.writeFile(target, ORIGINAL, "utf8");
    const appendInput = {
      ...transformInput,
      operation: {
        kind: "append_to_section",
        section: transformInput.operation.section,
        content: { inline: `${EOL}APPENDED` },
      },
    };
    const appendPreview = await prepareMarkdownTransform(appendInput);
    await commitMarkdownTransform({ ...appendInput, receipt: appendPreview.receipt });
    assert.equal(await fs.readFile(target, "utf8"), `${ORIGINAL}${EOL}APPENDED`);

    const firstRepeat = inspected.headings[1];
    const structuralCases = [
      {
        kind: "insert_section_before",
        section: secondRepeat,
        content: "## Inserted before\nBefore body.\n",
        start: secondRepeat.start_byte,
        end: secondRepeat.start_byte,
      },
      {
        kind: "insert_section_after",
        section: firstRepeat,
        content: "## Inserted after\nAfter body.\n",
        start: firstRepeat.end_byte,
        end: firstRepeat.end_byte,
      },
      {
        kind: "replace_section",
        section: secondRepeat,
        content: "## Replacement section\nReplacement.\n",
        start: secondRepeat.start_byte,
        end: secondRepeat.end_byte,
      },
    ];
    for (const item of structuralCases) {
      await fs.writeFile(target, ORIGINAL, "utf8");
      const input = {
        path: workspacePath("document.md"),
        expected_file_sha256: sha256(ORIGINAL),
        operation: {
          kind: item.kind,
          section: {
            heading_path: item.section.heading_path,
            occurrence: item.section.occurrence,
            expected_section_sha256: item.section.section_sha256,
          },
          content: { inline: item.content },
        },
      };
      const itemPreview = await prepareMarkdownTransform(input);
      await commitMarkdownTransform({ ...input, receipt: itemPreview.receipt });
      const originalBytes = Buffer.from(ORIGINAL, "utf8");
      const inserted = Buffer.from(item.content.replaceAll("\n", EOL), "utf8");
      const expected = Buffer.concat([
        originalBytes.subarray(0, item.start),
        inserted,
        originalBytes.subarray(item.end),
      ]);
      assert.deepEqual(await fs.readFile(target), expected, `${item.kind} must preserve every untouched byte`);
    }

    await fs.writeFile(target, ORIGINAL, "utf8");
    await assert.rejects(
      () => prepareMarkdownTransform({
        ...transformInput,
        operation: {
          ...transformInput.operation,
          section: { ...transformInput.operation.section, expected_section_sha256: "0".repeat(64) },
        },
      }),
      (error) => error?.code === "markdown_section_hash_mismatch"
    );
    assert.equal(await fs.readFile(target, "utf8"), ORIGINAL);

    const oversizedBefore = await fs.readFile(target, "utf8");
    await assert.rejects(
      () => inspectMarkdown(workspacePath("document.md"), { maxMarkdownBytes: 100 }),
      (error) => error?.code === "markdown_document_too_large"
    );
    assert.equal(await fs.readFile(target, "utf8"), oversizedBefore);

    await fs.writeFile(path.join(FIXTURE, "invalid.md"), Buffer.from([0x23, 0x20, 0xC3, 0x28]));
    await assert.rejects(
      () => inspectMarkdown(workspacePath("invalid.md")),
      (error) => error?.code === "structured_file_invalid_utf8"
    );

    const bomText = "# BOM\r\nBody";
    const bomBuffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(bomText, "utf8")]);
    await fs.writeFile(path.join(FIXTURE, "bom.md"), bomBuffer);
    const bomInspection = await inspectMarkdown(workspacePath("bom.md"));
    const bomInput = {
      path: workspacePath("bom.md"),
      expected_file_sha256: sha256(bomBuffer),
      operation: {
        kind: "replace_section_body",
        section: {
          heading_path: ["BOM"],
          occurrence: 1,
          expected_section_sha256: bomInspection.headings[0].section_sha256,
        },
        content: { inline: "Changed" },
      },
    };
    const bomPreview = await prepareMarkdownTransform(bomInput);
    await commitMarkdownTransform({ ...bomInput, receipt: bomPreview.receipt });
    assert.deepEqual((await fs.readFile(path.join(FIXTURE, "bom.md"))).subarray(0, 3), Buffer.from([0xEF, 0xBB, 0xBF]));

    console.log("smoke_markdown_structure ok");
  } finally {
    await fs.rm(FIXTURE, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
