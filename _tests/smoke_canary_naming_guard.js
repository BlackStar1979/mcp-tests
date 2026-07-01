const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const requiredCanaryId = "test-mcp-health-canary";
const forbiddenCanaryNames = [
  ["s", "t", "c", "-", "s", "a", "f", "e", "-", "h", "e", "a", "l", "t", "h"].join(""),
  ["s", "t", "c", " ", "s", "a", "f", "e", " ", "h", "e", "a", "l", "t", "h"].join(""),
  ["S", "T", "C", "-", "S", "A", "F", "E", " ", "H", "e", "a", "l", "t", "h"].join(""),
];

const activeFiles = [
  "server.js",
  "src/runtime/static_docs.js",
  "src/runtime/search_fetch_docs.js",
  "_workflow/ACTIVE_WORKFLOW_INDEX.md",
  "_workflow/WORKFLOW_CANON.md",
  "SERVER_SPEC.json",
];

const docsText = fs.readFileSync(path.join(repoRoot, "src/runtime/static_docs.js"), "utf8");
const searchRuntimeText = fs.readFileSync(path.join(repoRoot, "src/runtime/search_fetch_docs.js"), "utf8");

assert.ok(docsText.includes(requiredCanaryId), "static_docs.js must use the TEST MCP health canary ID");
assert.ok(
  searchRuntimeText.includes(requiredCanaryId),
  "search_fetch_docs.js sorter must prioritize the TEST MCP health canary ID"
);

const violations = [];

for (const relativePath of activeFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const text = fs.readFileSync(absolutePath, "utf8");

  for (const forbiddenName of forbiddenCanaryNames) {
    if (text.includes(forbiddenName)) {
      violations.push(`${relativePath}: contains forbidden TEST MCP canary short-name ${JSON.stringify(forbiddenName)}`);
    }
  }
}

assert.deepEqual(violations, []);

console.log("smoke_canary_naming_guard ok");
