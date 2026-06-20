const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const requiredDirs = [
  "src/auth",
  "src/schemas",
  "src/util",
  "_docs",
  "_workflow",
  "_workflow/longterm",
  "_workflow/scripts",
  "_public_sandbox",
  "_logs",
];

for (const dir of requiredDirs) {
  assert.equal(fs.statSync(path.join(ROOT, dir)).isDirectory(), true, `${dir} must exist`);
}

for (const forbiddenRoot of ["auth", "schemas", "util", "fixtures", "scripts", "sources"]) {
  assert.equal(fs.existsSync(path.join(ROOT, forbiddenRoot)), false, `root ${forbiddenRoot}/ must not exist`);
}

const oldDigest = ["_workflow", "assistant" + "_message" + "_digest"].join("/");
const oldNotes = ["_workflow", "longterm", "operational" + "_notes"].join("/");
for (const forbiddenWorkflow of [oldDigest, oldNotes]) {
  assert.equal(fs.existsSync(path.join(ROOT, forbiddenWorkflow)), false, `${forbiddenWorkflow} must not exist`);
}

for (const forbiddenRootFile of ["SERVER_SPEC.md", "WORKING_COURSE.md"]) {
  assert.equal(fs.existsSync(path.join(ROOT, forbiddenRootFile)), false, `root ${forbiddenRootFile} must not exist`);
}

for (const rel of [
  "README.md",
  "src/README.md",
  "src/auth/README.md",
  "src/schemas/README.md",
  "src/util/README.md",
  "tools/README.md",
  "tools/public/README.md",
  "tools/authorized/README.md",
  "tools/internal/README.md",
  "_docs/README.md",
  "_workflow/README.md",
  "_workflow/INDEX.md",
  "_workflow/NEXT_CHAT_HANDOFF.md",
  "_workflow/longterm/README.md",
  "_workflow/scripts/README.md",
  "_public_sandbox/README.md",
  "_logs/README.md",
]) {
  assert.equal(fs.statSync(path.join(ROOT, rel)).isFile(), true, `${rel} must exist`);
}

const serverSource = fs.readFileSync(path.join(ROOT, "server.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(ROOT, "src", "runtime", "server_bootstrap_runtime.js"), "utf8");
const runtimeStatusAssembly = fs.readFileSync(path.join(ROOT, "src", "runtime", "runtime_status_assembly.js"), "utf8");
assert.ok(bootstrapSource.includes("../auth/auth_policy"));
assert.ok(runtimeStatusAssembly.includes("../util/network_policy"));
assert.ok(runtimeStatusAssembly.includes("../util/path_policy"));
assert.equal(serverSource.includes("./auth/"), false);
assert.equal(serverSource.includes("./util/"), false);
assert.equal(serverSource.includes("./schemas/"), false);
assert.equal(bootstrapSource.includes("../../auth/"), false);
assert.equal(bootstrapSource.includes("../../util/"), false);
assert.equal(bootstrapSource.includes("../../schemas/"), false);

const codeWorkspace = fs.readFileSync(path.join(ROOT, "src", "util", "code_workspace.js"), "utf8");
assert.ok(codeWorkspace.includes('path.resolve(__dirname, "..", "..")'), "code workspace root must resolve to repository root after src/util move");

const pathPolicy = fs.readFileSync(path.join(ROOT, "src", "util", "path_policy.js"), "utf8");
assert.ok(pathPolicy.includes('"_public_sandbox"'), "path policy must use _public_sandbox public sandbox");
assert.equal(pathPolicy.includes('"fixtures"'), false, "path policy must not use root fixtures directory");

const coursePath = path.join(ROOT, "_workflow", "WORKING_COURSE.md");
const specPath = path.join(ROOT, "_workflow", "SERVER_SPEC.md");
assert.equal(fs.statSync(coursePath).isFile(), true, "WORKING_COURSE must live in _workflow");
assert.equal(fs.statSync(specPath).isFile(), true, "SERVER_SPEC must live in _workflow");

console.log("smoke_stage8_50_repository_topology_relocation ok");
