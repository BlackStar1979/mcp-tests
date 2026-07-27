"use strict";

const assert = require("node:assert/strict");
const {
  EXPECTED_NATIVE_TOOLS,
  compareCbmVersion,
  evaluateCbmCompatibility,
  loadCbmContract,
} = require("../src/integrations/codebase_memory/cbm_contract_registry");

const EXPECTED = [
  "index_repository",
  "search_graph",
  "query_graph",
  "trace_path",
  "get_code_snippet",
  "get_graph_schema",
  "get_architecture",
  "search_code",
  "list_projects",
  "delete_project",
  "index_status",
  "detect_changes",
  "manage_adr",
  "ingest_traces",
];

const contract = loadCbmContract("0.9.0");
assert.equal(contract.contract_version, "cbm-cli-contract-v1");
assert.equal(contract.cbm_version, "0.9.0");
assert.equal(contract.captured_executable_sha256, "9a205fa5ae759fbc866bfe1554f0c05a303be9ae6e0a00f94d875dc0c25e0680");
assert.deepEqual(contract.native_tools, EXPECTED);
assert.deepEqual(EXPECTED_NATIVE_TOOLS, EXPECTED);
assert.equal(Object.keys(contract.tools).length, 14);
assert.deepEqual(contract.tools.index_repository.required_flags, ["repo_path"]);
assert.deepEqual(contract.tools.query_graph.required_flags, ["query", "project"]);
assert.deepEqual(contract.tools.get_architecture.optional_flags, ["path", "aspects"]);
assert.equal(contract.tools.detect_changes.flags.since.type, "string");
assert.equal(contract.tools.ingest_traces.flags.traces.required, true);
assert.equal(typeof contract.help_sha256, "string");
assert.equal(contract.help_sha256.length, 64);

assert.equal(compareCbmVersion("0.9.0", "0.9.0"), 0);
assert.equal(compareCbmVersion("0.9.1", "0.9.0"), 1);
assert.equal(compareCbmVersion("0.8.1", "0.9.0"), -1);

const compatible = evaluateCbmCompatibility({
  version: "0.9.0",
  nativeTools: EXPECTED,
  executableSha256: contract.captured_executable_sha256,
});
assert.equal(compatible.status, "compatible");
assert.equal(compatible.accepted, true);

const binaryVariant = evaluateCbmCompatibility({
  version: "0.9.0",
  nativeTools: EXPECTED,
  executableSha256: "f".repeat(64),
});
assert.equal(binaryVariant.status, "compatible_binary_variant");
assert.equal(binaryVariant.accepted, true);

const mismatch = evaluateCbmCompatibility({
  version: "0.9.0",
  nativeTools: EXPECTED.slice(0, -1),
  executableSha256: contract.captured_executable_sha256,
});
assert.equal(mismatch.status, "contract_mismatch");
assert.equal(mismatch.accepted, false);

const newer = evaluateCbmCompatibility({
  version: "0.10.0",
  nativeTools: EXPECTED,
  executableSha256: "a".repeat(64),
});
assert.equal(newer.status, "unknown_newer_version");
assert.equal(newer.accepted, false);

const older = evaluateCbmCompatibility({
  version: "0.8.1",
  nativeTools: EXPECTED,
  executableSha256: "b".repeat(64),
});
assert.equal(older.status, "unsupported_older_version");
assert.equal(older.accepted, false);

console.log("smoke_cbm_contract_manifest ok");
