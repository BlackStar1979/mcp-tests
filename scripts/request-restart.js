#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { normalizeRestartExitCode } = require("../src/runtime/restart_exit_codes");
function arg(name, fallback = "") {
  const prefix = "--" + name + "=";
  const hit = process.argv.slice(2).find((x) => x.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}
const root = path.resolve(__dirname, "..");
const file = arg("file", process.env.MCP_TEST_RESTART_TRIGGER_FILE || path.join(root, "_control", "restart-request.json"));
const codeCheck = normalizeRestartExitCode(arg("code", "42"));
if (!codeCheck.ok) {
  console.error("Unsupported restart code: " + codeCheck.code + ". Allowed: " + codeCheck.allowed.join(","));
  process.exit(2);
}
const payload = {
  request_id: "manual-" + Date.now(),
  code: codeCheck.code,
  reason: arg("reason", "manual_request"),
  created_at: new Date().toISOString(),
};
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
console.log(JSON.stringify({ ok: true, trigger_file: file, ...payload }, null, 2));
