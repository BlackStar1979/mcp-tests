"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { resolveRuntimeOutputConfig } = require("../src/runtime/runtime_output_config");

const REPO_ROOT = path.join(__dirname, "..");
const SERVER_PATH = path.join(REPO_ROOT, "server.js");

assert.deepEqual(resolveRuntimeOutputConfig({}), {
  outputMode: "structured",
  maxFetchTextChars: 2500,
});
assert.deepEqual(resolveRuntimeOutputConfig({
  MCP_TEST_OUTPUT_MODE: " Content-Only ",
  MCP_TEST_FETCH_CAP_CHARS: "4096",
}), {
  outputMode: "content-only",
  maxFetchTextChars: 4096,
});

for (const [env, marker] of [
  [{ MCP_TEST_OUTPUT_MODE: "invalid-mode" }, /Invalid MCP_TEST_OUTPUT_MODE: invalid-mode/],
  [{ MCP_TEST_FETCH_CAP_CHARS: "99" }, /Invalid MCP_TEST_FETCH_CAP_CHARS: 99/],
  [{ MCP_TEST_FETCH_CAP_CHARS: "100.5" }, /Invalid MCP_TEST_FETCH_CAP_CHARS: 100\.5/],
]) {
  assert.throws(
    () => resolveRuntimeOutputConfig(env),
    (error) => {
      assert.equal(error.code, "invalid_runtime_output_config");
      assert.equal(error.exitCode, 2);
      assert.match(error.message, marker);
      return true;
    }
  );
}

function runInvalidBootstrapCase(name, overrides, expectedMarker) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `mcp-output-config-${name}-`));
  const stateFile = path.join(tempRoot, "tool-surface.json");
  const auditFile = path.join(tempRoot, "logs", "audit.jsonl");
  const restartFile = path.join(tempRoot, "restart", "request.json");
  const rateStateFile = path.join(tempRoot, "rate", "state.json");
  try {
    const result = spawnSync(process.execPath, [
      SERVER_PATH,
      "--profile",
      "public",
      "--auth",
      "none",
    ], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        MCP_TEST_OUTPUT_MODE: "structured",
        MCP_TEST_FETCH_CAP_CHARS: "2500",
        MCP_TEST_TOOL_SURFACE_STATE_FILE: stateFile,
        MCP_TEST_AUDIT_LOG: auditFile,
        MCP_TEST_LOG_DIR: path.dirname(auditFile),
        MCP_TEST_ENABLE_RESTART_TRIGGER: "1",
        MCP_TEST_RESTART_TRIGGER_FILE: restartFile,
        MCP_TEST_RATE_LIMIT_ENABLED: "1",
        MCP_TEST_RATE_LIMIT_STATE_FILE: rateStateFile,
        ...overrides,
      },
    });

    assert.equal(result.status, 2, `${name}: expected exit 2\n${result.stdout || ""}\n${result.stderr || ""}`);
    assert.match(`${result.stdout || ""}${result.stderr || ""}`, expectedMarker, `${name}: expected validation marker`);
    for (const artifact of [stateFile, auditFile, rateStateFile, restartFile, path.dirname(restartFile)]) {
      assert.equal(fs.existsSync(artifact), false, `${name}: fail-fast must not create ${artifact}`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

runInvalidBootstrapCase(
  "mode",
  { MCP_TEST_OUTPUT_MODE: "invalid-mode" },
  /Invalid MCP_TEST_OUTPUT_MODE: invalid-mode/
);
runInvalidBootstrapCase(
  "fetch-cap",
  { MCP_TEST_FETCH_CAP_CHARS: "99" },
  /Invalid MCP_TEST_FETCH_CAP_CHARS: 99/
);

console.log("smoke_runtime_output_config_fail_fast ok");
