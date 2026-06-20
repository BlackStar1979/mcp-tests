const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const SCRIPTS = [
  "_workflow/scripts/test_mcp_deploy.ps1",
  "_workflow/scripts/test_mcp_rollback.ps1",
  "_workflow/scripts/test_mcp_backup.ps1",
  "_workflow/scripts/test_mcp_restart.ps1",
];

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertEnvAwareAuditLog(relPath) {
  const source = read(relPath);

  assert.match(source, /MCP_TEST_AUDIT_LOG/, `${relPath} must reference MCP_TEST_AUDIT_LOG`);
  assert.match(source, /\$AuditLog\s*=\s*if\s*\(\s*\$env:MCP_TEST_AUDIT_LOG\s*\)/s, `${relPath} must select $AuditLog from env when set`);
  assert.match(source, /\$env:MCP_TEST_AUDIT_LOG/s, `${relPath} must use the env audit path`);
  assert.match(source, /Join-Path\s+\$Repo\s+["']_logs\\.mcp-tests-audit\.jsonl["']/s, `${relPath} must keep the default repo audit fallback`);

  const hardCodedOnly = /^\s*\$AuditLog\s*=\s*Join-Path\s+\$Repo\s+["']_logs\\.mcp-tests-audit\.jsonl["']\s*$/m.test(source)
    && !/\$AuditLog\s*=\s*if\s*\(\s*\$env:MCP_TEST_AUDIT_LOG\s*\)/s.test(source);
  assert.equal(hardCodedOnly, false, `${relPath} must not use only a hard-coded audit path`);
}

for (const relPath of SCRIPTS) {
  assertEnvAwareAuditLog(relPath);
}

console.log("smoke_stage10_control_plane_audit_env_awareness ok");
