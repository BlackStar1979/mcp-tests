const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const spec = JSON.parse(fs.readFileSync(path.join(ROOT, "SERVER_TOOLS_SPEC.json"), "utf8"));
const rootTools = fs.readdirSync(path.join(ROOT, "tools")).filter((x) => x.endsWith(".js")).sort();
const publicTools = fs.readdirSync(path.join(ROOT, "tools", "public")).filter((x) => x.endsWith(".js")).sort();
const authorizedTools = fs.readdirSync(path.join(ROOT, "tools", "authorized")).filter((x) => x.endsWith(".js")).sort();
const rootOnly = rootTools.filter((x) => !publicTools.includes(x) && !authorizedTools.includes(x)).sort();
assert.deepEqual(rootOnly, spec.source_layout.root_only_legacy_auth_files.slice().sort());
assert.deepEqual(spec.source_layout.mcp_surface_dirs, ["tools/public", "tools/authorized"]);
assert.equal(spec.source_layout.non_surface_flat_tools_dir, "tools");
for (const name of spec.surface_classes.public_mcp_tools.tools) {
  if (["search", "fetch"].includes(name)) continue;
  assert.ok(publicTools.includes(name + ".js"), `public tool facade missing ${name}`);
}
for (const name of spec.surface_classes.authorized_mcp_tools.tools) {
  assert.ok(authorizedTools.includes(name + ".js"), `authorized tool facade missing ${name}`);
}
console.log("smoke_tool_source_layout_spec ok");
