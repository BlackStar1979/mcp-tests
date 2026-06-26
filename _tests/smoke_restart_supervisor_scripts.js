const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");

for (const rel of ["scripts/server.sh", "scripts/server.ps1", "scripts/request-restart.js"]) {
  assert.ok(fs.existsSync(path.join(__dirname, "..", rel)), "missing " + rel);
}
const sh = fs.readFileSync(path.join(__dirname, "..", "scripts/server.sh"), "utf8");
assert.ok(sh.includes("MCP_SUPERVISOR_PROFILE"));
assert.ok(sh.includes("MCP_SUPERVISOR_AUTH"));
assert.ok(sh.includes("MCP_SUPERVISOR_OAUTH_SECRET_FILE"));
assert.ok(sh.includes("--profile"));
assert.ok(sh.includes("--auth"));
assert.ok(sh.includes("--oauth-secret-file"));
assert.ok(sh.includes("--restart-trigger"));
assert.ok(sh.includes("--trigger-file"));
assert.ok(sh.includes("MCP_TEST_RESTART_TRIGGER_FILE"));
assert.ok(sh.includes("42 43 44"));
if (process.platform !== "win32") {
  const syntax = cp.spawnSync("bash", ["-n", path.join(__dirname, "..", "scripts/server.sh")], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
}
const ps = fs.readFileSync(path.join(__dirname, "..", "scripts/server.ps1"), "utf8");
assert.ok(ps.includes("MCP_SUPERVISOR_PROFILE"));
assert.ok(ps.includes("MCP_SUPERVISOR_AUTH"));
assert.ok(ps.includes("MCP_TEST_RESTART_TRIGGER_FILE"));
assert.ok(ps.includes("--profile"));
assert.ok(ps.includes("--auth"));
assert.ok(ps.includes("oauth-secret-file"));
assert.ok(ps.includes("restart-trigger"));
assert.ok(ps.includes("trigger-file"));
assert.ok(ps.includes("$RestartCodes"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-trigger-"));
const file = path.join(tmp, "request.json");
const req = cp.spawnSync(process.execPath, [path.join(__dirname, "..", "scripts/request-restart.js"), "--code=44", "--reason=smoke", "--file=" + file], { encoding: "utf8" });
assert.equal(req.status, 0, req.stderr);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(payload.code, 44);
assert.equal(payload.reason, "smoke");
console.log("smoke_restart_supervisor_scripts ok");
