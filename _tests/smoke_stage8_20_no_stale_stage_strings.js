const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const OLD_STAGE = "stage8_11-observability-stream-connector-diagnostics";
const CURRENT_STAGE = "stage8_20-runtime-status-compact-mode";
const OLD_STAGE_ALLOWED = new Set([
  path.normalize("_tests/smoke_stage8_20_stage_status_current.js"),
  path.normalize("_tests/smoke_stage8_20_no_stale_stage_strings.js"),
]);
const CURRENT_STAGE_ALLOWED = new Set([
  path.normalize("src/stage_metadata.js"),
  path.normalize("_tests/smoke_stage8_20_stage_status_current.js"),
  path.normalize("_tests/smoke_stage8_20_no_stale_stage_strings.js"),
  path.normalize("_tests/smoke_stage8_39_course_correction_ledger.js"),
]);

function walk(dir, hits = [], currentHits = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits, currentHits);
      continue;
    }
    if (!/\.(js|md)$/.test(entry.name)) continue;
    const relative = path.relative(path.resolve(__dirname, ".."), full);
    const normalized = path.normalize(relative);
    const text = fs.readFileSync(full, "utf8");
    if (!OLD_STAGE_ALLOWED.has(normalized) && text.includes(OLD_STAGE)) hits.push(relative);
    if (!CURRENT_STAGE_ALLOWED.has(normalized) && text.includes(CURRENT_STAGE)) currentHits.push(relative);
  }
  return { hits, currentHits };
}

const root = path.resolve(__dirname, "..");
const result = { hits: [], currentHits: [] };
for (const subdir of ["src", "tools", "src/schemas", "_tests"]) {
  const partial = walk(path.join(root, subdir), result.hits, result.currentHits);
  result.hits = partial.hits;
  result.currentHits = partial.currentHits;
}

assert.deepEqual(result.hits.sort(), []);
assert.deepEqual(result.currentHits.sort(), []);
console.log("smoke_stage8_20_no_stale_stage_strings ok");
