"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const requiredSchemaFiles = [
  "src/schemas/auth_tools.js",
  "src/schemas/code_sample_js_tool.js",
  "src/schemas/plugin_execution_tools.js",
];

for (const rel of requiredSchemaFiles) {
  assert.equal(fs.statSync(path.join(ROOT, rel)).isFile(), true, `${rel} must exist`);
}

const flatToolDir = path.join(ROOT, "tools");
const inlineSchemaHits = [];
for (const entry of fs.readdirSync(flatToolDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
  const rel = path.join("tools", entry.name);
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (/const\s+(?:INPUT_SCHEMA|OUTPUT_SCHEMA)\s*=/.test(source)) inlineSchemaHits.push(`${rel}: local schema const`);
  if (/\binputSchema\s*:\s*\{/.test(source)) inlineSchemaHits.push(`${rel}: inline inputSchema object`);
  if (/\boutputSchema\s*:\s*\{/.test(source)) inlineSchemaHits.push(`${rel}: inline outputSchema object`);
  if (/\btype\s*:\s*["']object["']/.test(source)) inlineSchemaHits.push(`${rel}: inline object schema literal`);
}
assert.deepEqual(inlineSchemaHits, []);

for (const rel of [
  "tools/auth_legacy_retirement_status.js",
]) {
  const source = fs.readFileSync(path.join(ROOT, rel), "utf8");
  assert.ok(source.includes("../src/schemas/auth_tools"), `${rel} must import auth schemas`);
}

const codeSample = fs.readFileSync(path.join(ROOT, "tools/code_sample_js.js"), "utf8");
assert.ok(codeSample.includes("../src/schemas/code_sample_js_tool"));

const receipt = fs.readFileSync(path.join(ROOT, "tools/plugin_execution_verify_receipt.js"), "utf8");
assert.ok(receipt.includes("PLUGIN_EXECUTION_VERIFY_RECEIPT_INPUT_SCHEMA"));
assert.ok(!receipt.includes("const INPUT_SCHEMA ="));

console.log("smoke_schema_extraction ok");
