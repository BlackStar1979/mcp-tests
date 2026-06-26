const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const oldKeys = [
  "current_" + "work_" + "package",
  "completed_" + "work_" + "packages",
  "previous_" + "work_" + "package",
  "SERVER_" + "STAGE12.json",
];
const activeFiles = [];
for (const name of fs.readdirSync(ROOT)) {
  if (/^SERVER.*\.json$/.test(name)) activeFiles.push(path.join(ROOT, name));
}
for (const rel of ["_workflow/state.json", "_workflow/sessionless_inventory.json", "_workflow/README.md"]) {
  activeFiles.push(path.join(ROOT, rel));
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    const rel = path.relative(ROOT, p).replace(/\\/g, "/");
    if (rel.startsWith("_workflow/historical/")) continue;
    if (entry.isDirectory()) walk(p);
    else if (/\.(js|py|json|md)$/.test(entry.name)) activeFiles.push(p);
  }
}
walk(path.join(ROOT, "_tests"));
walk(path.join(ROOT, "_workflow", "scripts"));
for (const file of activeFiles) {
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  for (const key of oldKeys) {
    assert.equal(text.includes(key), false, `${rel} contains retired active token ${key}`);
  }
}
console.log("smoke_no_progress_state_active_artifacts ok");
