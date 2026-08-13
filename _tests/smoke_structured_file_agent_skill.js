"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_PATH = path.join(ROOT, ".agents", "skills", "using-structured-file-tools", "SKILL.md");
const DIRECTORY_PATH = path.join(ROOT, ".agents", "skills", "using-structured-file-tools", "DIRECTORY.md");
const SKILLS_DIRECTORY_PATH = path.join(ROOT, ".agents", "skills", "DIRECTORY.md");

for (const filePath of [SKILL_PATH, DIRECTORY_PATH, SKILLS_DIRECTORY_PATH]) {
  assert.ok(fs.existsSync(filePath), `${path.relative(ROOT, filePath)} must exist`);
}

const skill = fs.readFileSync(SKILL_PATH, "utf8");
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
assert.ok(frontmatter, "SKILL.md must start with YAML frontmatter");
assert.match(frontmatter[1], /^name: using-structured-file-tools$/m);
assert.match(frontmatter[1], /^description: Use when /m);
assert.ok(frontmatter[0].length <= 1024);

const wordCount = skill.slice(frontmatter[0].length).trim().split(/\s+/).filter(Boolean).length;
assert.ok(wordCount <= 500, `skill body must stay at or below 500 words; got ${wordCount}`);

for (const heading of [
  "# Using Structured File Tools",
  "## Selection Rules",
  "## Safe Workflow",
  "## Failure Recovery",
]) {
  assert.ok(skill.includes(heading), `missing heading: ${heading}`);
}

for (const tool of [
  "file_inspect",
  "content_stage",
  "file_transform",
  "file_split",
  "file_merge",
  "markdown_inspect",
  "markdown_transform",
]) {
  assert.ok(skill.includes(`\`${tool}\``), `skill must route ${tool}`);
}

for (const marker of [
  "Do not read the entire file",
  "one physical file",
  "several physical files",
  "sources are preserved",
  "preview",
  "receipt",
  "expected_source_sha256",
  "stale receipt",
  "heading_path",
  "occurrence",
  "8,192",
  "source content",
]) {
  assert.ok(skill.includes(marker), `skill missing operational marker: ${marker}`);
}

console.log("smoke_structured_file_agent_skill ok");
