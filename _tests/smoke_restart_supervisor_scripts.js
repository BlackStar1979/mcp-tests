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
assert.ok(sh.includes("MCP_SUPERVISOR_MEMORY_EMBEDDING_TOKEN_FILE"));
assert.ok(sh.includes("--memory-embedding-token-file"));
assert.ok(sh.includes("Memory embedding token file conflicts"));
assert.ok(sh.includes("/healthz"));
assert.ok(sh.includes("Wykonuję takeover zamiast uruchamiać duplikat"));
assert.ok(sh.includes("detect_supervisor_parent"));
assert.ok(sh.includes("wait_port_released"));
assert.ok(sh.includes("42 43 44"));
if (process.platform !== "win32") {
  const syntax = cp.spawnSync("bash", ["-n", path.join(__dirname, "..", "scripts/server.sh")], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
}
const ps = fs.readFileSync(path.join(__dirname, "..", "scripts/server.ps1"), "utf8");
assert.ok(ps.includes("MCP_SUPERVISOR_PROFILE"));
assert.ok(ps.includes("MCP_SUPERVISOR_AUTH"));
assert.ok(ps.includes("MCP_TEST_RESTART_TRIGGER_FILE"));
assert.ok(ps.includes("MCP_SUPERVISOR_MEMORY_EMBEDDING_TOKEN_FILE"));
assert.ok(ps.includes("memory-embedding-token-file"));
assert.ok(ps.includes("Memory embedding token file conflicts"));
assert.ok(ps.includes("--profile"));
assert.ok(ps.includes("--auth"));
assert.ok(ps.includes("oauth-secret-file"));
assert.ok(ps.includes("restart-trigger"));
assert.ok(ps.includes("trigger-file"));
assert.ok(ps.includes("$RestartCodes"));
assert.ok(ps.includes("Get-ExistingMcpServerStatus"));
assert.ok(ps.includes("Test-SupervisorManagedRunningServer"));
assert.ok(ps.includes("Stop-ExistingMcpServerForTakeover"));
assert.ok(ps.includes("Wait-PortReleased"));
assert.ok(ps.includes("/healthz"));
assert.ok(ps.includes("Wykonuję takeover zamiast uruchamiać duplikat"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-trigger-"));
const file = path.join(tmp, "request.json");
const requestRestartPath = path.join(__dirname, "..", "scripts/request-restart.js");
const req = cp.spawnSync(process.execPath, [requestRestartPath, "--code", "44", "--reason", "smoke", "--file", file], {
  encoding: "utf8",
  env: { ...process.env, MCP_TEST_RESTART_TRIGGER_FILE: file },
});
assert.equal(req.status, 0, req.stderr);
const payload = JSON.parse(fs.readFileSync(file, "utf8"));
assert.equal(payload.code, 44);
assert.equal(payload.reason, "smoke");

const rejectedFile = path.join(tmp, "must-not-exist.json");
const rejected = cp.spawnSync(process.execPath, [requestRestartPath, "--file", rejectedFile, "--surprise"], {
  encoding: "utf8",
  env: { ...process.env, MCP_TEST_RESTART_TRIGGER_FILE: rejectedFile },
});
assert.equal(rejected.status, 2, rejected.stderr || rejected.stdout);
assert.equal(fs.existsSync(rejectedFile), false);
const rejectedJson = JSON.parse(rejected.stderr);
assert.equal(rejectedJson.error_code, "cli_argument_unknown");
assert.equal(rejectedJson.argument, "surprise");
console.log("smoke_restart_supervisor_scripts ok");
