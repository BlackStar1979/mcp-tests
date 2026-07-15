const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRestartController } = require("../src/runtime/restart_controller");

(async () => {
  const events = [];
  const exits = [];
  const controller = createRestartController({
    env: { MCP_TEST_RESTART_EXIT_DELAY_MS: "50" },
    auditLog: (event, data) => events.push({ event, data }),
    exit: (code) => exits.push(code),
  });
  const bad = controller.requestRestart({ code: 2, reason: "bad", source: "smoke" });
  assert.equal(bad.ok, false);
  const ok = controller.requestRestart({ code: 42, reason: "smoke", source: "smoke" });
  assert.equal(ok.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.deepEqual(exits, [42]);
  assert.ok(events.some((x) => x.event === "runtime_restart_requested"));
  assert.ok(events.some((x) => x.event === "runtime_restart_exit_scheduled"));

  const auditFailureWarnings = [];
  const auditFailureExits = [];
  const auditFailureController = createRestartController({
    env: { MCP_TEST_RESTART_EXIT_DELAY_MS: "50" },
    auditLog: () => {
      throw new Error("audit sink offline");
    },
    warnLogger: (...parts) => auditFailureWarnings.push(parts.join(" ")),
    exit: (code) => auditFailureExits.push(code),
  });
  const auditFailureResult = auditFailureController.requestRestart({ code: 42, reason: "audit_failure_smoke", source: "smoke" });
  assert.equal(auditFailureResult.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 90));
  assert.deepEqual(auditFailureExits, [42]);
  assert.ok(auditFailureWarnings.some((line) => line.includes("RESTART_AUDIT_LOG_FAILED:") && line.includes("audit sink offline")));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-restart-"));
  const triggerFile = path.join(tmp, "restart.json");
  const fileExits = [];
  const fileController = createRestartController({
    env: { MCP_TEST_ENABLE_RESTART_TRIGGER: "1", MCP_TEST_RESTART_TRIGGER_FILE: triggerFile, MCP_TEST_RESTART_EXIT_DELAY_MS: "50" },
    auditLog: () => {},
    exit: (code) => fileExits.push(code),
    logger: () => {},
  });
  const started = fileController.start();
  assert.equal(started.started, true);
  fs.writeFileSync(triggerFile, JSON.stringify({ code: 43, reason: "file_smoke", request_id: "smoke" }));
  await new Promise((resolve) => setTimeout(resolve, 700));
  fileController.stop();
  assert.deepEqual(fileExits, [43]);
  assert.equal(fs.existsSync(triggerFile), false);

  const deleteFailEvents = [];
  const originalUnlinkSync = fs.unlinkSync;
  try {
    fs.unlinkSync = (targetPath) => {
      if (targetPath === triggerFile) {
        const error = new Error("locked");
        error.code = "EPERM";
        throw error;
      }
      return originalUnlinkSync(targetPath);
    };
    fs.writeFileSync(triggerFile, JSON.stringify({ code: 44, reason: "delete_fail_smoke", request_id: "delete-fail" }));
    const deleteFailExits = [];
    const deleteFailController = createRestartController({
      env: { MCP_TEST_ENABLE_RESTART_TRIGGER: "1", MCP_TEST_RESTART_TRIGGER_FILE: triggerFile, MCP_TEST_RESTART_EXIT_DELAY_MS: "50" },
      auditLog: (event, data) => deleteFailEvents.push({ event, data }),
      exit: (code) => deleteFailExits.push(code),
      logger: () => {},
    });
    deleteFailController.start();
    await new Promise((resolve) => setTimeout(resolve, 700));
    deleteFailController.stop();
    assert.deepEqual(deleteFailExits, [44]);
    assert.ok(deleteFailEvents.some((x) => x.event === "runtime_restart_trigger_file_delete_failed"));
  } finally {
    fs.unlinkSync = originalUnlinkSync;
    try { fs.rmSync(triggerFile, { force: true }); } catch {}
  }
  console.log("smoke_restart_controller ok");
})();
