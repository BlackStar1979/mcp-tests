"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  CONTROL_FILE,
  createSessionlessPrototypeRouteHandler,
  controlFileEnabled,
  envEnabled,
} = require("../src/runtime/sessionless_prototype_route_handler");
assert.equal(CONTROL_FILE.replace(/\\/g, "/"), "_control/sessionless-prototype.json");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "s9-sessionless-"));
try {
  assert.equal(envEnabled({}, { rootDir: tmp }), false);
  assert.equal(controlFileEnabled({ rootDir: tmp }), false);
  fs.mkdirSync(path.join(tmp, "_control"), { recursive: true });
  fs.writeFileSync(path.join(tmp, CONTROL_FILE), JSON.stringify({ enabled: true }) + "\n");
  assert.equal(controlFileEnabled({ rootDir: tmp }), true);
  assert.equal(envEnabled({}, { rootDir: tmp }), true);
  assert.equal(envEnabled({ MCP_TEST_ENABLE_SESSIONLESS_PROTOTYPE: "1" }, { rootDir: path.join(tmp, "missing") }), true);
  fs.writeFileSync(path.join(tmp, CONTROL_FILE), "not json\n");
  assert.equal(controlFileEnabled({ rootDir: tmp }), false);
  fs.writeFileSync(path.join(tmp, CONTROL_FILE), JSON.stringify({ enabled: false }) + "\n");
  assert.equal(envEnabled({}, { rootDir: tmp }), false);
  fs.writeFileSync(path.join(tmp, CONTROL_FILE), JSON.stringify({ enabled: true }) + "\n");
  const handler = createSessionlessPrototypeRouteHandler({
    env: {},
    rootDir: tmp,
    authPolicy: { requiresAuth: true, authenticate: () => ({ ok: true }) },
  });
  assert.equal(handler.enabled, true);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
const runtimeSpec = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "SERVER_RUNTIME_CONFIG_SPEC.json"), "utf8"));
assert.equal(runtimeSpec.sessionless_prototype.activation_control_file, CONTROL_FILE.replace(/\\/g, "/"));
console.log("smoke_s9_oauth21_sessionless_activation_trial ok");
