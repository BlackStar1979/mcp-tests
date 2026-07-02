"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const backupRoot = path.join(root, ".mcp_backups", "public_sandbox_sync");
const files = [
  "src/runtime/decision_runtime_context_builder.js",
  "src/runtime/decision_runtime_policy.js",
  "src/runtime/decision_runtime_receipt.js",
  "src/runtime/tools_call_handler.js",
  "src/runtime/tool_audit_helpers.js",
  "src/runtime/rpc_message_dispatcher.js",
  "src/runtime/unknown_tool_call_handler.js",
];

fs.mkdirSync(backupRoot, { recursive: true });

const result = [];
for (const rel of files) {
  const source = path.join(root, rel);
  const target = path.join(root, "_public_sandbox", "mcp-tests", rel);
  if (!fs.existsSync(source)) {
    throw new Error(`missing source: ${rel}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const existed = fs.existsSync(target);
  if (existed) {
    const backup = path.join(backupRoot, rel.replaceAll(/[\\/]/g, "__"));
    fs.copyFileSync(target, backup);
  }
  fs.copyFileSync(source, target);
  result.push({ rel, existed, size: fs.statSync(target).size });
}

console.log(JSON.stringify({ ok: true, copied: result }, null, 2));
