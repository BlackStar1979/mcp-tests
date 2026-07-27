"use strict";

const fs = require("node:fs");
const path = require("node:path");

const EXPECTED_NATIVE_TOOLS = Object.freeze([
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
]);

const MINIMUM_SUPPORTED_VERSION = "0.9.0";
const CONTRACT_DIR = path.join(__dirname, "contracts");

function parseVersion(value) {
  const match = String(value || "").trim().match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`Invalid CBM semantic version: ${value}`);
  return match.slice(1, 4).map(Number);
}

function compareCbmVersion(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] > b[index]) return 1;
    if (a[index] < b[index]) return -1;
  }
  return 0;
}

function contractPath(version) {
  return path.join(CONTRACT_DIR, `v${version}.json`);
}

function loadCbmContract(version) {
  const file = contractPath(version);
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (parsed.cbm_version !== version) {
    throw new Error(`CBM contract version mismatch in ${file}`);
  }
  return parsed;
}

function sameOrderedStrings(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function evaluateCbmCompatibility({ version, nativeTools, executableSha256 } = {}) {
  let comparison;
  try {
    comparison = compareCbmVersion(version, MINIMUM_SUPPORTED_VERSION);
  } catch {
    return { status: "probe_failed", accepted: false, manifest_version: "", reason: "invalid_version" };
  }

  const contract = loadCbmContract(version);
  if (!contract) {
    return {
      status: comparison > 0 ? "unknown_newer_version" : "unsupported_older_version",
      accepted: false,
      manifest_version: "",
      reason: "manifest_missing",
    };
  }

  if (!sameOrderedStrings(nativeTools, contract.native_tools)) {
    return {
      status: "contract_mismatch",
      accepted: false,
      manifest_version: contract.cbm_version,
      reason: "native_tool_list_mismatch",
    };
  }

  const exactBinary = String(executableSha256 || "").toLowerCase()
    === String(contract.captured_executable_sha256 || "").toLowerCase();
  return {
    status: exactBinary ? "compatible" : "compatible_binary_variant",
    accepted: true,
    manifest_version: contract.cbm_version,
    reason: exactBinary ? "exact_manifest_match" : "version_and_tools_match",
  };
}

module.exports = {
  CONTRACT_DIR,
  EXPECTED_NATIVE_TOOLS,
  MINIMUM_SUPPORTED_VERSION,
  compareCbmVersion,
  evaluateCbmCompatibility,
  loadCbmContract,
};
