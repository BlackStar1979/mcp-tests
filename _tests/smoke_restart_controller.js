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
  console.log("smoke_restart_controller ok");
})();
