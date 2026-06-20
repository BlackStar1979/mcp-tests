#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const specPath = path.join(root, "SERVER_SPEC.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const rules = spec.maintenance_rules || {};
const protocol = rules.index_usage_protocol || {};

function normalizePath(input) {
  return String(input || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

const nonAuthoritativePrefixes = (protocol.non_authoritative_paths_for_current_truth || []).map(normalizePath);

function isNonAuthoritativeForCurrentTruth(inputPath) {
  const normalized = normalizePath(inputPath);
  return nonAuthoritativePrefixes.some((prefix) => normalized === prefix.replace(/\/$/, "") || normalized.startsWith(prefix));
}

function classifyPath(inputPath) {
  const normalized = normalizePath(inputPath);
  if (isNonAuthoritativeForCurrentTruth(normalized)) {
    return {
      path: normalized,
      authority: "non_authoritative_for_current_truth",
      may_use_for: ["historical_context", "public_sandbox_context", "candidate_pointer_only"],
      must_confirm_with_root_or_validation: true,
    };
  }
  if (normalized === "_workflow/state.json") {
    return { path: normalized, authority: "authoritative_current_workflow_state", rank: 1 };
  }
  if (/^SERVER_.*\.json$/.test(normalized) || normalized === "SERVER_SPEC.json") {
    return { path: normalized, authority: "authoritative_root_spec", rank: 2 };
  }
  if (normalized.startsWith("_tests/") || normalized.startsWith("_workflow/longterm/")) {
    return { path: normalized, authority: "authoritative_repo_workflow_or_validation_file", rank: 3 };
  }
  if (normalized.startsWith("src/") || normalized.startsWith("tools/")) {
    return { path: normalized, authority: "authoritative_repo_code", rank: 4 };
  }
  return {
    path: normalized,
    authority: "unknown_or_contextual",
    must_confirm_with_root_or_validation: true,
  };
}

function validateRules() {
  const errors = [];
  const requiredNonAuthoritative = [
    "_public_sandbox/",
    "_public_sandbox/mcp-tests/",
    "_repos_with_code_samples/",
    "_backups/",
    "_stages/",
    "archive/",
    "_logs/",
    ".mcp_trash/",
    ".mcp_backups/",
  ];
  if (rules.index_rebuild_required_before_work !== true) errors.push("index_rebuild_required_before_work must be true");
  if (rules.index_rebuild_tool !== "GPT_MCP.build_index") errors.push("index_rebuild_tool must be GPT_MCP.build_index");
  if (rules.index_status_check_required !== true) errors.push("index_status_check_required must be true");
  if (protocol.index_role !== "discovery_only_not_source_of_truth") errors.push("index_role must be discovery_only_not_source_of_truth");
  for (const p of requiredNonAuthoritative) {
    if (!nonAuthoritativePrefixes.includes(p)) errors.push(`missing non-authoritative path ${p}`);
  }
  if (!String(protocol.verification_rule || "").includes("direct read")) errors.push("verification_rule must require direct read");
  if (!String(protocol.sandbox_copy_rule || "").includes("must never outrank")) errors.push("sandbox_copy_rule must state sandbox copies never outrank root truth");
  return errors;
}

const samplePaths = process.argv.slice(2);
const samples = samplePaths.length ? samplePaths : [
  "_workflow/state.json",
  "SERVER_SPEC.json",
  "_tests/run_all_smoke_scripts.json",
  "_workflow/longterm/stage12_step37_policy_runtime_negative_controls_validator_hardening.md",
  "_public_sandbox/mcp-tests/_workflow/state.json",
  "_backups/manual/old_state.json",
  "_repos_with_code_samples/useable/example.js",
];

const errors = validateRules();
const classifications = samples.map(classifyPath);
const badCurrentTruth = classifications.filter((item) => item.path.includes("_public_sandbox/mcp-tests/_workflow/state.json") && item.authority !== "non_authoritative_for_current_truth");
if (badCurrentTruth.length) errors.push("sandbox state.json classified as authoritative");

const report = {
  ok: errors.length === 0,
  spec: "SERVER_SPEC.json#maintenance_rules.index_usage_protocol",
  index_role: protocol.index_role,
  non_authoritative_path_count: nonAuthoritativePrefixes.length,
  classifications,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
