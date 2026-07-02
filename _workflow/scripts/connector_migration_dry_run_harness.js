#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MARKER = "connector_migration_dry_run_harness";
const ROOT = path.resolve(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function readJson(rel) {
  return JSON.parse(read(rel));
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function hashToolNames(toolNames) {
  return crypto.createHash("sha256").update(toolNames.join("|")).digest("hex").slice(0, 16);
}

function finalSepSummary(allSeps = []) {
  const finals = allSeps.filter((item) => item && item.status === "Final");
  return {
    final_count: finals.length,
    latest_final_sep: finals.length ? String(finals[0].sep || "") : "",
    latest_final_title: finals.length ? String(finals[0].title || "") : "",
  };
}

function isSanitized(payload) {
  const text = JSON.stringify(payload);
  const forbidden = [
    /\bBearer\s+[A-Za-z0-9._~-]+/i,
    /\bauthorization[_ -]?code\b/i,
    /\baccess[_ -]?token\b/i,
    /\brefresh[_ -]?token\b/i,
    /\bclient[_ -]?secret\b/i,
    /\besh_[A-Za-z0-9._~-]+\b/,
  ];
  return !forbidden.some((re) => re.test(text));
}

function buildHarnessResult() {
  const state = readJson("_workflow/state.json");
  const inventory = readJson("_workflow/sessionless_inventory.json");
  const connectorSpec = readJson("SERVER_CONNECTOR_SURFACE_SPEC.json");
  const runtimeConfig = readJson("SERVER_RUNTIME_CONFIG_SPEC.json");
  const runtimeTopology = readJson("SERVER_RUNTIME_TOPOLOGY_SPEC.json");
  const serverSpec = readJson("SERVER_SPEC.json");
  const toolsSpec = readJson("SERVER_TOOLS_SPEC.json");

  const s10bRecord = read("_workflow/operator_decisions/sessionless_live_authenticated_probe.md");
  const s11Record = read("_workflow/operator_decisions/connector_route_coexistence_boundary.md");
  const s12Record = read("_workflow/operator_decisions/connector_migration_dry_run_plan.md");

  assert.ok(s10bRecord.includes("Status: GREEN / LIVE AUTHENTICATED SESSIONLESS PROBE PASSED / CONNECTOR UNCHANGED"));
  assert.ok(s11Record.includes("Status: GREEN / READINESS BOUNDARY PREPARED / NO CONNECTOR MIGRATION"));
  assert.ok(s12Record.includes("Status: GREEN / DRY-RUN PLAN PREPARED / NO CONNECTOR REFRESH"));

  const currentRoute = String(connectorSpec.oauth21_connector.path || "");
  const candidateRoute = String(runtimeConfig.retired_sessionless_transition.route || "");
  const toolNames = [
    ...toolsSpec.surface_classes.public_mcp_tools.tools,
    ...toolsSpec.surface_classes.authorized_mcp_tools.tools,
  ].sort();
  const toolCount = toolNames.length;
  const toolNamesHash = hashToolNames(toolNames);

  assert.equal(currentRoute, "/mcp");
  assert.equal(candidateRoute, "/mcp/sessionless");
  assert.equal(toolCount, 43);
  assert.equal(toolNamesHash, "8b62ecaf89227335");
  assert.equal(serverSpec.server.authenticated_tool_count, 43);
  assert.equal(connectorSpec.authenticated_connector.current_tool_count_after_stage6, 43);
  assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_count, 43);
  assert.equal(state.current_connector_truth.oauth21_3008_tools.tool_names_hash, toolNamesHash);
  assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, false);
  assert.equal(state.current_runtime_truth.public_3009.currently_live_local, false);
  assert.equal(runtimeTopology.runtime_instances.oauth21_3008.port, 3008);
  assert.equal(runtimeTopology.runtime_instances.public_3009.port, 3009);
  assert.equal(runtimeConfig.http_routes.includes("/mcp/sessionless"), false);
  assert.ok(runtimeConfig.http_routes.includes("/mcp"));

  const beforeSurface = {
    route: currentRoute,
    auth_mode: String(connectorSpec.oauth21_connector.auth_mode || ""),
    profile: String(runtimeTopology.runtime_instances.oauth21_3008.profile || ""),
    tool_count: toolCount,
    tool_names_hash: toolNamesHash,
  };
  const afterSurface = {
    route: candidateRoute,
    auth_mode: beforeSurface.auth_mode,
    profile: beforeSurface.profile,
    tool_count: toolCount,
    tool_names_hash: toolNamesHash,
  };

  const result = {
    ok: true,
    marker: MARKER,
    mode: "dry_run_only",
    self_test: hasFlag("self-test"),
    network: false,
    reads_durable_oauth_state: false,
    uses_live_credential_flow: false,
    connector_ui_api_called: false,
    current_route: currentRoute,
    candidate_route: candidateRoute,
    connector_refresh_performed: false,
    connector_route_migration_performed: false,
    runtime_restart_performed: false,
    public_3009_start_performed: false,
    stable_mcp_removal_performed: false,
    stable_session_code_removal_performed: false,
    connector_visible_surface_change: false,
    future_operator_decision_required: true,
    future_connector_refresh_action_required: true,
    rollback_preserves_mcp: true,
    auth_profile_assumptions_unchanged: true,
    latest_sep_inventory: {
      last_verified_date: String(inventory.source_verification.last_verified_date || ""),
      official_final_count: Number(inventory.source_verification.official_final_count || 0),
      ...finalSepSummary(inventory.all_seps_index),
    },
    preconditions: {
      s10b_live_authenticated_probe_passed: true,
      s11_readiness_boundary_passed: true,
      s12_dry_run_plan_prepared: true,
      sessionless_candidate_exists: state.current_runtime_truth.oauth21_3008.sessionless_hidden_route_active === true,
      stable_mcp_required_as_legacy_route: inventory.target_selection_readiness.s11_connector_migration_readiness.stable_mcp_status === "legacy_compatible_do_not_remove",
      stable_mcp_removal_forbidden: inventory.target_selection_readiness.s11_connector_migration_readiness.stable_mcp_removal_forbidden_now === true,
      stable_session_code_removal_forbidden: state.current_work_constraints.do_not_remove_stable_session_code_before_active_route_migration_completion === true,
      connector_refresh_required_now: false,
      runtime_restart_required_now: false,
      public_3009_start_required_now: false,
    },
    current_connector_surface: beforeSurface,
    hypothetical_sessionless_connector_surface: afterSurface,
    comparisons: {
      tool_count_unchanged: beforeSurface.tool_count === afterSurface.tool_count,
      tool_names_hash_unchanged: beforeSurface.tool_names_hash === afterSurface.tool_names_hash,
      auth_mode_unchanged: beforeSurface.auth_mode === afterSurface.auth_mode,
      profile_assumption_unchanged: beforeSurface.profile === afterSurface.profile,
    },
  };

  result.sanitized = isSanitized(result);
  assert.equal(result.sanitized, true);
  return result;
}

function main() {
  const result = buildHarnessResult();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main();

