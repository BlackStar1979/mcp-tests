const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const rel = (...parts) => path.join(ROOT, ...parts);
const exists = (...parts) => fs.existsSync(rel(...parts));
const read = (...parts) => fs.readFileSync(rel(...parts), "utf8");

function assertExists(label, ...parts) {
  assert.ok(exists(...parts), `${label} must exist: ${path.join(...parts)}`);
}

function assertMissing(label, ...parts) {
  assert.ok(!exists(...parts), `${label} must not exist: ${path.join(...parts)}`);
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".mcp_trash", "_logs", "_repos_with_code_samples"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

assertExists("workflow index", "_workflow", "INDEX.md");
assertExists("workflow handoff", "_workflow", "NEXT_CHAT_HANDOFF.md");
assertMissing("old assistant digest directory", "_workflow", "assistant_message_digest");
assertMissing("old nested operational notes directory", "_workflow", "longterm", "operational_notes");
assertMissing("root devcontainer", ".devcontainer");
assertMissing("root fixtures", "fixtures");
assertMissing("plugin template in runtime plugins", "plugins", "_template");
assertExists("plugin template test fixture", "_tests", "fixtures", "plugins", "template", "plugin.manifest.json");
assertExists("sample plugin manifest", "plugins", "sample_echo_readonly", "plugin.manifest.json");

const manifest = JSON.parse(read("plugins", "sample_echo_readonly", "plugin.manifest.json"));
assert.equal(manifest.plugin_id, "sample.echo_readonly");
assert.equal(manifest.status, "candidate");
assert.equal(manifest.tools?.[0]?.name, "plugin_sample_echo_preview");
assert.equal(manifest.tools?.[0]?.execution?.handler_type, "builtin.echo.readonly.v1");
assert.equal(manifest.tools?.[0]?.execution?.dynamic_import, false);

const registry = read("src", "plugin_registry.js");
assert.ok(registry.includes('path.resolve(__dirname, "..", "plugins")'), "plugin registry must discover only runtime plugins root");
assert.ok(registry.includes('entry.name.startsWith("_")'), "plugin registry must skip underscore-prefixed non-plugin folders if present");

const publicFacade = read("tools", "public", "code_sample_js.js");
assert.ok(publicFacade.includes("../code_sample_js"), "public code_sample_js facade must point to legacy implementation until migration");
assertExists("legacy code_sample_js implementation", "tools", "code_sample_js.js");

const activeReadmeRoots = [
  "README.md",
  "src/README.md",
  "src/auth/README.md",
  "src/schemas/README.md",
  "src/util/README.md",
  "tools/README.md",
  "tools/public/README.md",
  "tools/authorized/README.md",
  "tools/internal/README.md",
  "plugins/README.md",
  "plugins/sample_echo_readonly/README.md",
  "_tests/README.md",
  "_tests/fixtures/README.md",
  "_tests/fixtures/plugins/README.md",
  "_tests/fixtures/plugins/template/README.md",
  "_workflow/README.md",
  "_workflow/longterm/README.md",
  "_workflow/scripts/README.md",
  "_docs/README.md",
  "_public_sandbox/README.md",
  "docker/README.md",
  "docker/.devcontainer/README.md",
];
for (const readmeRel of activeReadmeRoots) {
  assertExists("active README", ...readmeRel.split("/"));
  const text = read(...readmeRel.split("/"));
  assert.ok(!text.includes("file in this directory"), `${readmeRel} contains mechanical file placeholder`);
  assert.ok(!text.includes("subdirectory of this area"), `${readmeRel} contains mechanical dir placeholder`);
  assert.ok(text.includes("## Purpose"), `${readmeRel} must include Purpose section`);
  assert.ok(text.includes("## Files"), `${readmeRel} must include Files section`);
  assert.ok(text.includes("## Subdirectories"), `${readmeRel} must include Subdirectories section`);
}

const activeFiles = walk(ROOT).filter((file) => {
  const r = path.relative(ROOT, file).replace(/\\/g, "/");
  return !r.startsWith("_backups/") && !r.startsWith("_archive/") && !r.startsWith("_stages/");
});
for (const file of activeFiles) {
  if (!/\.(js|md|json)$/.test(file)) continue;
  const r = path.relative(ROOT, file).replace(/\\/g, "/");
  const text = fs.readFileSync(file, "utf8");
  const oldDigestSlash = ["_workflow", "assistant_message_digest"].join("/");
  const oldDigestBackslash = ["_workflow", "assistant_message_digest"].join("\\\\");
  const oldNotesSlash = ["_workflow", "longterm", "operational_notes"].join("/");
  const oldNotesBackslash = ["_workflow", "longterm", "operational_notes"].join("\\\\");
  assert.ok(!text.includes(oldDigestSlash), `${r} references old assistant digest path`);
  assert.ok(!text.includes(oldDigestBackslash), `${r} references old assistant digest path`);
  assert.ok(!text.includes(oldNotesSlash), `${r} references old operational notes path`);
  assert.ok(!text.includes(oldNotesBackslash), `${r} references old operational notes path`);
}

console.log("smoke_topology_cleanup_guard ok");
