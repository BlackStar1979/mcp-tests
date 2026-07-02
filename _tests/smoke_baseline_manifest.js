"use strict";

// Frozen baseline manifest consistency smoke.
//
// Loads the committed FROZEN baseline manifest and asserts that the CURRENT
// computed runtime identity + tool-surface fingerprint match it EXACTLY.
// Fail-closed: any mismatch throws and prints the diff. This test never mutates
// or regenerates the manifest (the manifest is the source of truth), and never
// starts a listener on port 3009 - it imports descriptor builders only, the same
// way _tests/smoke_initialize_server_info_contract.js does.
//
// If this test fails, treat it as drift: the runtime/tool surface diverged from
// the frozen baseline. Do NOT silently update the manifest values; a manifest
// change is only legitimate in a future explicit connector-surface revision.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  SERVER_NAME,
  SERVER_VERSION,
  CONNECTOR_SHAPE_VERSION,
} = require("../src/runtime/identity");
const { buildCoreToolDescriptors } = require("../src/runtime/core_tool_descriptors");
const { loadOptionalTools } = require("../src/tool_loader");
const { createTestMcpRuntimeStatusTool } = require("../tools/authorized/test_mcp_runtime_status");
const { createObservabilityStatusTool } = require("../tools/authorized/observability_status");
const { buildToolSurfaceFingerprint } = require("../src/schema_compat");
const { createAuthPolicy } = require("../src/auth/auth_policy");
const { getRuntimeProfile } = require("../src/tool_policy");

const MANIFEST_PATH = path.join(
  __dirname,
  "..",
  "_workflow",
  "baselines",
  "stage8_frozen_runtime_baseline.json"
);

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));

// Establish current values exactly as server.js does, without starting the
// HTTP listener.
const outputMode = String(process.env.MCP_TEST_OUTPUT_MODE || "structured")
  .trim()
  .toLowerCase();
const maxFetchTextChars = Number(process.env.MCP_TEST_FETCH_CAP_CHARS || 2500);
const authMode = createAuthPolicy().mode;
const profile = getRuntimeProfile();

const tools = [
  ...buildCoreToolDescriptors({
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode,
    maxFetchTextChars,
  }),
  ...loadOptionalTools({
    profile,
    serverProfileConfig: profile === "public" ? { surface: { optional_tool_groups: ["public"], include_memory_tools: false } } : null,
    createRuntimeStatusTool: () => createTestMcpRuntimeStatusTool(() => ({ status: "ok" })),
    createObservabilityStatusTool: () =>
      createObservabilityStatusTool({ auditLogPath: "_logs/.mcp-tests-audit.jsonl" }),
  }).map((tool) => tool.descriptor),
];

const surface = buildToolSurfaceFingerprint(tools);

const computed = {
  server_name: SERVER_NAME,
  server_version: SERVER_VERSION,
  connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
  outputMode,
  authMode,
  profile,
  tool_count: surface.tool_count,
  tool_names_hash: surface.tool_names_hash,
  input_schema_fingerprint: surface.input_schema_fingerprint,
  output_schema_fingerprint: surface.output_schema_fingerprint,
  descriptor_fingerprint: surface.descriptor_fingerprint,
  combined_fingerprint: surface.combined_fingerprint,
};

const mismatches = [];
for (const field of Object.keys(computed)) {
  if (computed[field] !== manifest[field]) {
    mismatches.push({ field, expected: manifest[field], computed: computed[field] });
  }
}

// Memory tools must remain absent from the default public surface.
const memoryToolPresent = surface.tool_names.some((name) => /memory/i.test(name));
if (manifest.memory_tools_expected === false && memoryToolPresent) {
  mismatches.push({ field: "memory_tools_expected", expected: false, computed: true });
}

if (mismatches.length > 0) {
  console.error(
    "BASELINE DRIFT DETECTED. The frozen manifest is the source of truth; do NOT auto-update it."
  );
  for (const m of mismatches) {
    console.error(
      `  ${m.field}: expected ${JSON.stringify(m.expected)} computed ${JSON.stringify(m.computed)}`
    );
  }
  throw new Error(`baseline manifest drift: ${mismatches.length} field(s) diverged`);
}

// Defensive: confirm the comparison actually ran over the full field set.
assert.equal(surface.tool_count, manifest.tool_count, "tool_count must match manifest");

console.log("smoke_baseline_manifest ok");
