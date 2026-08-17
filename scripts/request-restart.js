#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { normalizeRestartExitCode } = require("../src/runtime/restart_exit_codes");
const { CliArgumentError, parseCliArgs } = require("../src/util/cli_args");
const root = path.resolve(__dirname, "..");

function main() {
  const args = parseCliArgs(process.argv.slice(2), { valueOptions: ["file", "code", "reason"] });
  const file = args.value("file", process.env.MCP_TEST_RESTART_TRIGGER_FILE || path.join(root, "_control", "restart-request.json"));
  const codeCheck = normalizeRestartExitCode(args.value("code", "42"));
  if (!codeCheck.ok) {
    console.error("Unsupported restart code: " + codeCheck.code + ". Allowed: " + codeCheck.allowed.join(","));
    process.exit(2);
  }
  const payload = {
    request_id: "manual-" + Date.now(),
    code: codeCheck.code,
    reason: args.value("reason", "manual_request"),
    created_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, trigger_file: file, ...payload }, null, 2));
}

try {
  main();
} catch (error) {
  if (error instanceof CliArgumentError) {
    console.error(JSON.stringify({ ok: false, error_code: error.code, argument: error.argument }, null, 2));
    process.exit(2);
  }
  throw error;
}
