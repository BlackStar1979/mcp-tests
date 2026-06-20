"use strict";

// Stage 9 / Step 5 - Harness no-pollution guard.
//
// Proves that a full isolated run of run_all_smokes (--skip-network with
// MCP_TEST_AUDIT_LOG set) leaves the production audit log
// _logs/.mcp-tests-audit.jsonl byte/hash/line-identical. It spawns run_all_smokes
// as a child with a recursion-guard env flag so the inner run skips THIS guard
// (preventing infinite recursion). The inner run's shared server uses a
// dynamically-acquired free port so it cannot collide with an outer run that
// already holds the default port 3095. No runtime/MCP/audit-semantics change; no
// port 3009 bind by this test; no production C:\Work\mcp touch.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.join(__dirname, "..");
const PROD_AUDIT_LOG = path.join(REPO_ROOT, "_logs", ".mcp-tests-audit.jsonl");
const ISO_AUDIT_LOG = path.join(
  os.tmpdir(),
  `mcp-tests-nopollution-${process.pid}-${Date.now()}.jsonl`
);

function expectedInnerResultCount() {
  const scriptsPath = path.join(__dirname, "run_all_smoke_scripts.json");
  const scripts = JSON.parse(fs.readFileSync(scriptsPath, "utf8"));
  const noPollutionSkipped = scripts.includes("_tests/smoke_stage9_harness_no_pollution_guard.js") ? 1 : 0;
  const networkSkipped = scripts.includes("_tests/smoke_stage1_network.js") ? 1 : 0;
  return scripts.length - noPollutionSkipped - networkSkipped;
}

// Ask the OS for a currently-free TCP port (avoids hard-coding a port that could
// itself be busy). Small TOCTOU window only; acceptable for a local test harness.
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function snapshot(file) {
  if (!fs.existsSync(file)) {
    return { exists: false, size: 0, sha256: "", lines: 0 };
  }
  const buf = fs.readFileSync(file);
  const lines =
    buf.length === 0
      ? 0
      : buf.toString("utf8").split("\n").filter((line) => line.length > 0).length;
  return {
    exists: true,
    size: buf.length,
    sha256: crypto.createHash("sha256").update(buf).digest("hex"),
    lines,
  };
}

(async () => {
  // Distinct shared-server port for the inner run (free port, or an explicit
  // override for deterministic local runs).
  const innerPort = process.env.MCP_TEST_NO_POLLUTION_INNER_PORT
    ? Number(process.env.MCP_TEST_NO_POLLUTION_INNER_PORT)
    : await getFreePort();

  // Snapshot production audit log immediately before the isolated child run.
  const before = snapshot(PROD_AUDIT_LOG);

  const child = spawnSync(
    process.execPath,
    ["_tests/run_all_smokes.js", "--skip-network"],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        // Isolate the inner full run's audit to a temp file.
        MCP_TEST_AUDIT_LOG: ISO_AUDIT_LOG,
        // Recursion guard: tell run_all_smokes to skip ONLY this no-pollution guard.
        MCP_TEST_NO_POLLUTION_GUARD_INNER: "1",
        // Free shared-server port so the inner run cannot collide with an outer
        // run that already holds the default port 3095.
        MCP_TEST_SMOKE_PORT: String(innerPort),
      },
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );

  try {
    assert.equal(
      child.status,
      0,
      `inner run_all_smokes must exit 0\nSTDOUT:\n${child.stdout}\nSTDERR:\n${child.stderr}`
    );

    // run_all_smokes prints a single JSON summary object on stdout.
    const out = String(child.stdout || "");
    const summary = JSON.parse(out.slice(out.indexOf("{")));
    assert.equal(summary.ok, true, "inner run_all_smokes ok must be true");
    assert.equal(
      summary.results.length,
      expectedInnerResultCount(),
      `inner result count must match run_all_smokes minus this guard; got ${summary.results.length}`
    );

    // The isolated audit log must have received the inner run's audit records.
    assert.ok(fs.existsSync(ISO_AUDIT_LOG), "isolated audit log must exist");
    assert.ok(fs.statSync(ISO_AUDIT_LOG).size > 0, "isolated audit log must be non-empty");

    // Production audit log must be byte/hash/line-identical after the isolated run.
    const after = snapshot(PROD_AUDIT_LOG);
    assert.equal(after.exists, before.exists, "prod audit log existence unchanged");
    assert.equal(after.size, before.size, "prod audit log size unchanged");
    assert.equal(after.sha256, before.sha256, "prod audit log sha256 unchanged");
    assert.equal(after.lines, before.lines, "prod audit log line count unchanged");

    console.log("smoke_stage9_harness_no_pollution_guard ok");
  } finally {
    try {
      fs.rmSync(ISO_AUDIT_LOG, { force: true });
    } catch {}
  }
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
