"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SKILL_DIR = path.join(ROOT, ".agents", "skills", "using-codebase-memory");
const SKILL_PATH = path.join(SKILL_DIR, "SKILL.md");
const TOOL_REFERENCE_PATH = path.join(SKILL_DIR, "references", "tools.md");
const SCENARIOS_PATH = path.join(SKILL_DIR, "references", "scenarios.md");

assert.ok(fs.existsSync(SKILL_PATH), "using-codebase-memory/SKILL.md must exist");
assert.ok(fs.existsSync(TOOL_REFERENCE_PATH), "references/tools.md must exist");
assert.ok(fs.existsSync(SCENARIOS_PATH), "references/scenarios.md must exist");

const skill = fs.readFileSync(SKILL_PATH, "utf8");
const tools = fs.readFileSync(TOOL_REFERENCE_PATH, "utf8");
const scenarios = fs.readFileSync(SCENARIOS_PATH, "utf8");

const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
assert.ok(frontmatter, "SKILL.md must start with YAML frontmatter");
assert.match(frontmatter[1], /^name: using-codebase-memory$/m);
const description = frontmatter[1].match(/^description: (.+)$/m)?.[1] || "";
assert.match(description, /^Use when /);
assert.ok(description.length <= 500, "description must be at most 500 characters");
assert.ok(frontmatter[0].length <= 1024, "frontmatter must be at most 1024 characters");

const body = skill.slice(frontmatter[0].length);
const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
assert.ok(wordCount <= 500, `SKILL.md body must stay at or below 500 words; got ${wordCount}`);

for (const heading of [
  "# Using Codebase Memory",
  "## Core Contract",
  "## Default Workflow",
  "## Quick Reference",
  "## Safety Boundaries",
  "## Result Interpretation",
  "## Common Mistakes",
]) {
  assert.ok(skill.includes(heading), `missing heading: ${heading}`);
}

for (const marker of [
  "references/tools.md",
  "references/scenarios.md",
  "Read operations never index implicitly",
  "explicit operator authorization",
  "state_handle",
  "partial_success",
  "queue_wait_ms",
  "bridge_analysis",
  "impact_resolution_reason",
  "runtime_edge_creation",
  "source_bearing_excluded_dirs",
  "Repository truth",
  "Index truth",
  "Runtime truth",
  "Client/UI truth",
]) {
  assert.ok(skill.includes(marker), `missing operational marker: ${marker}`);
}

const toolNames = [
  "cbm_status",
  "cbm_list_projects",
  "cbm_index_repository",
  "cbm_get_architecture",
  "cbm_search_graph",
  "cbm_query_graph",
  "cbm_trace_path",
  "cbm_get_code_snippet",
  "cbm_get_graph_schema",
  "cbm_search_code",
  "cbm_delete_project",
  "cbm_index_status",
  "cbm_detect_changes",
  "cbm_manage_adr",
  "cbm_ingest_traces",
];
for (const tool of toolNames) {
  assert.ok(tools.includes(`\`${tool}\``), `tool reference missing ${tool}`);
}

for (const marker of [
  "Load when:",
  "14 native operations plus bridge-only `cbm_status`",
  "Never starts indexing",
  "Conservatively classified as a mutation",
  "repository source tree is never deleted",
  "200 changed files",
  "200 impacted symbols",
  "labels()",
  "Runtime edge creation from traces not yet implemented",
  "cbm_project_not_found",
  "cbm_native_rejected",
]) {
  assert.ok(tools.includes(marker), `tool reference missing marker: ${marker}`);
}

for (const scenario of [
  "SCENARIO-1",
  "SCENARIO-2",
  "SCENARIO-3",
  "SCENARIO-4",
  "SCENARIO-5",
  "SCENARIO-6",
]) {
  assert.ok(scenarios.includes(scenario), `scenario reference missing ${scenario}`);
}
for (const marker of [
  "Do not index",
  "qualified name",
  "scope",
  "disposable fixture",
  "partial success",
  "fresh external evidence",
]) {
  assert.ok(scenarios.includes(marker), `scenario reference missing marker: ${marker}`);
}

for (const content of [skill, tools, scenarios]) {
  assert.equal(content.includes("confirmation_token"), false, "obsolete confirmation_token must not appear");
  assert.equal(content.includes("v0.8.1"), false, "obsolete v0.8.1 guidance must not appear");
}

console.log("smoke_cbm_agent_skill ok");
