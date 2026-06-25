"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const REF = "SERVER_POLICY_RUNTIME_SPEC.json";
const files = {
  root: "SERVER_SPEC.json",
  runtime: REF,
  authz: "SERVER_AUTHZ_DECISION_SPEC.json",
  resource: "SERVER_RESOURCE_POLICY_SPEC.json",
  profiles: "SERVER_PROFILES_SPEC.json",
  tools: "SERVER_TOOLS_SPEC.json",
  memory: "SERVER_MEMORY_POLICY_SPEC.json",
  network: "SERVER_NETWORK_POLICY_SPEC.json",
  database: "SERVER_DATABASE_POLICY_SPEC.json",
  plugin: "SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json",
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadBundle() {
  return Object.fromEntries(Object.entries(files).map(([key, file]) => [key, readJson(file)]));
}

function add(errors, code, detail) {
  errors.push({ code, detail });
}

function validate(bundle) {
  const errors = [];
  const runtime = bundle.runtime || {};
  const root = bundle.root || {};
  const authz = bundle.authz || {};
  const resource = bundle.resource || {};
  const profiles = bundle.profiles || {};
  const tools = bundle.tools || {};
  const memory = bundle.memory || {};
  const network = bundle.network || {};
  const database = bundle.database || {};
  const plugin = bundle.plugin || {};

  if (runtime.runtime_enforced !== true) add(errors, "runtime_enforced_must_be_true", runtime.runtime_enforced);
  if (runtime.connector_visible !== false) add(errors, "connector_visible_must_stay_false", runtime.connector_visible);
  if (runtime.no_cli_extension !== true) add(errors, "no_cli_extension_must_stay_true", runtime.no_cli_extension);

  if ((root.spec_refs || {}).policy_runtime !== REF) add(errors, "root_policy_runtime_ref_missing", (root.spec_refs || {}).policy_runtime);
  if (authz.policy_runtime_ref !== REF) add(errors, "authz_policy_runtime_ref_missing", authz.policy_runtime_ref);
  if ((profiles.server_profiles || {}).policy_runtime_ref !== REF) add(errors, "profiles_policy_runtime_ref_missing", (profiles.server_profiles || {}).policy_runtime_ref);
  if (tools.policy_runtime_ref !== REF) add(errors, "tools_policy_runtime_ref_missing", tools.policy_runtime_ref);
  if (resource.policy_runtime_ref !== REF) add(errors, "resource_policy_runtime_ref_missing", resource.policy_runtime_ref);
  if (memory.policy_runtime_ref !== REF) add(errors, "memory_policy_runtime_ref_missing", memory.policy_runtime_ref);
  if (network.policy_runtime_ref !== REF) add(errors, "network_policy_runtime_ref_missing", network.policy_runtime_ref);
  if (database.policy_runtime_ref !== REF) add(errors, "database_policy_runtime_ref_missing", database.policy_runtime_ref);
  if (plugin.policy_runtime_ref !== REF) add(errors, "plugin_policy_runtime_ref_missing", plugin.policy_runtime_ref);

  const flags = ((root.cli || {}).parameters) || {};
  for (const flag of ["--policy-runtime", "--runtime-policy", "--policy-runtime-enforce"]) {
    if (Object.prototype.hasOwnProperty.call(flags, flag)) add(errors, "cli_extension_forbidden", flag);
  }

  const requiredOutput = ["allowed", "decision", "reason_codes", "tool_name", "profile", "auth_mode", "surface_class", "resource_class", "operation_class", "policy_refs", "audit_receipt"];
  const outputFields = new Set(((runtime.output_contract || {}).required_fields) || []);
  for (const field of requiredOutput) {
    if (!outputFields.has(field)) add(errors, "output_contract_field_missing", field);
  }
  if ((runtime.output_contract || {}).default_decision !== "deny") add(errors, "default_decision_must_be_deny", (runtime.output_contract || {}).default_decision);

  const failClosed = [
    "unknown_tool_denied",
    "missing_tool_catalog_entry_denied",
    "missing_resource_policy_denied",
    "unknown_resource_class_denied",
    "unknown_operation_class_denied",
    "missing_specific_policy_when_required_denied",
    "public_surface_non_public_policy_denied",
    "runtime_surface_drift_denied",
    "audit_receipt_build_failure_denied",
  ];
  for (const rule of failClosed) {
    if ((runtime.fail_closed_rules || {})[rule] !== true) add(errors, "fail_closed_rule_missing", rule);
  }

  if (((runtime.integration_policy || {}).runtime_enforcement_implemented_now) !== true) add(errors, "runtime_enforcement_claim_required", (runtime.integration_policy || {}).runtime_enforcement_implemented_now);
  if (((runtime.integration_policy || {}).cli_extension_allowed) !== false) add(errors, "cli_extension_claim_forbidden", (runtime.integration_policy || {}).cli_extension_allowed);

  const publicTools = (((tools.surface_classes || {}).public_mcp_tools || {}).tools) || [];
  const authorizedTools = (((tools.surface_classes || {}).authorized_mcp_tools || {}).tools) || [];
  const surfaceNames = [...publicTools, ...authorizedTools];
  const catalog = tools.tool_catalog || {};

  for (const name of surfaceNames) {
    const item = catalog[name];
    if (!item) {
      add(errors, "missing_tool_catalog_entry_denied", name);
      continue;
    }
    const expectedSurface = publicTools.includes(name) ? "public_mcp_tools" : "authorized_mcp_tools";
    if (item.surface_class !== expectedSurface) add(errors, "surface_class_mismatch_denied", { name, expectedSurface, actual: item.surface_class });
    if (publicTools.includes(name) && item.surface_class !== "public_mcp_tools") add(errors, "public_surface_non_public_policy_denied", name);
    if (!((resource.resource_classes || {})[item.resource_class])) add(errors, "unknown_resource_class_denied", { name, resource_class: item.resource_class });
    if (!((resource.operation_classes || {})[item.operation_class])) add(errors, "unknown_operation_class_denied", { name, operation_class: item.operation_class });
    if (!Array.isArray(item.resource_policy_refs) || !item.resource_policy_refs.includes("SERVER_RESOURCE_POLICY_SPEC.json")) add(errors, "missing_resource_policy_denied", name);
    if (item.tool_category === "memory" && item.memory_policy_ref !== "SERVER_MEMORY_POLICY_SPEC.json") add(errors, "specific_policy_ref_missing", { name, ref: "memory_policy_ref" });
    if (item.tool_category === "network" && item.network_policy_ref !== "SERVER_NETWORK_POLICY_SPEC.json") add(errors, "specific_policy_ref_missing", { name, ref: "network_policy_ref" });
    const pluginScoped = name.startsWith("plugin_") || item.tool_category === "hotplug";
    if (pluginScoped && item.plugin_visibility_policy_ref !== "SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json") add(errors, "specific_policy_ref_missing", { name, ref: "plugin_visibility_policy_ref" });
  }

  return errors;
}

function assertValid(bundle) {
  assert.deepEqual(validate(bundle), []);
}

function assertInvalid(base, name, mutate, expectedCode) {
  const fixture = clone(base);
  mutate(fixture);
  const codes = validate(fixture).map((error) => error.code);
  assert.ok(codes.includes(expectedCode), `${name} expected ${expectedCode}, got ${codes.join(",")}`);
}

const base = loadBundle();
assertValid(base);

assertInvalid(base, "runtime enforcement flag", (s) => { s.runtime.runtime_enforced = false; }, "runtime_enforced_must_be_true");
assertInvalid(base, "connector visible flag", (s) => { s.runtime.connector_visible = true; }, "connector_visible_must_stay_false");
assertInvalid(base, "cli extension flag", (s) => { s.runtime.no_cli_extension = false; }, "no_cli_extension_must_stay_true");
assertInvalid(base, "root ref", (s) => { delete s.root.spec_refs.policy_runtime; }, "root_policy_runtime_ref_missing");
assertInvalid(base, "authz ref", (s) => { delete s.authz.policy_runtime_ref; }, "authz_policy_runtime_ref_missing");
assertInvalid(base, "missing catalog entry", (s) => { delete s.tools.tool_catalog.fetch; }, "missing_tool_catalog_entry_denied");
assertInvalid(base, "unknown resource class", (s) => { s.tools.tool_catalog.fetch.resource_class = "unknown_resource_class"; }, "unknown_resource_class_denied");
assertInvalid(base, "unknown operation class", (s) => { s.tools.tool_catalog.fetch.operation_class = "unknown_operation_class"; }, "unknown_operation_class_denied");
assertInvalid(base, "missing resource policy ref", (s) => { s.tools.tool_catalog.fetch.resource_policy_refs = []; }, "missing_resource_policy_denied");
assertInvalid(base, "memory ref", (s) => { delete s.tools.tool_catalog.memory_save.memory_policy_ref; }, "specific_policy_ref_missing");
assertInvalid(base, "network ref", (s) => { delete s.tools.tool_catalog.net_http_get_allowlisted.network_policy_ref; }, "specific_policy_ref_missing");
assertInvalid(base, "plugin ref", (s) => { delete s.tools.tool_catalog.plugin_registry_get.plugin_visibility_policy_ref; }, "specific_policy_ref_missing");
assertInvalid(base, "removed legacy auth tool injected into public surface", (s) => { s.tools.surface_classes.public_mcp_tools.tools.push("auth_transition_status"); }, "missing_tool_catalog_entry_denied");
assertInvalid(base, "output field", (s) => { s.runtime.output_contract.required_fields = s.runtime.output_contract.required_fields.filter((field) => field !== "audit_receipt"); }, "output_contract_field_missing");
assertInvalid(base, "fail closed", (s) => { s.runtime.fail_closed_rules.unknown_tool_denied = false; }, "fail_closed_rule_missing");
assertInvalid(base, "root cli", (s) => { s.root.cli = { parameters: { "--policy-runtime": {} } }; }, "cli_extension_forbidden");
assertInvalid(base, "runtime claim", (s) => { s.runtime.integration_policy.runtime_enforcement_implemented_now = false; }, "runtime_enforcement_claim_required");

console.log("smoke_stage12_step37_policy_runtime_negative_controls ok");
