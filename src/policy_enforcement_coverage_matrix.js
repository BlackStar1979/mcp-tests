"use strict";

const fs = require("node:fs");
const path = require("node:path");
function loadResourcePolicySpec({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const parsed = JSON.parse(fs.readFileSync(path.join(rootDir, "SERVER_RESOURCE_POLICY_SPEC.json"), "utf8"));
  if (!parsed.resource_classes || !parsed.operation_classes) throw new Error("SERVER_RESOURCE_POLICY_SPEC.json missing resource_classes or operation_classes.");
  return parsed;
}
function asArray(value) { return Array.isArray(value) ? value : []; }
function getSurfaceConfig(serverProfileConfig, surfaceName) {
  const surface = serverProfileConfig?.surfaces?.[surfaceName] || serverProfileConfig?.raw?.surfaces?.[surfaceName];
  if (!surface) throw new Error(`Profile surface not found: ${surfaceName}`);
  return surface;
}
function buildEntryCoverage({ entry, surfaceConfig, resourcePolicySpec, surfaceName }) {
  const errors = []; const warnings = [];
  const catalog = entry.catalog_summary || null;
  const toolPolicy = entry.tool_policy_summary || null;
  const descriptor = entry.descriptor_summary || null;
  if (!descriptor || descriptor.name !== entry.name) errors.push("descriptor_missing_or_mismatch");
  if (!toolPolicy) errors.push("missing_tool_policy");
  if (!catalog) errors.push("missing_catalog_entry");
  const resourceClass = catalog?.resource_class || null;
  const operationClass = catalog?.operation_class || null;
  const resourceClassSpec = resourceClass ? resourcePolicySpec.resource_classes[resourceClass] : null;
  const operationClassSpec = operationClass ? resourcePolicySpec.operation_classes[operationClass] : null;
  const allowedResourceRefs = asArray(surfaceConfig.allowed_resource_policy_refs);
  const deniedResourceRefs = asArray(surfaceConfig.denied_resource_policy_refs);
  if (!resourceClass) errors.push("resource_class_missing");
  if (resourceClass && !resourceClassSpec) errors.push("resource_class_unknown");
  if (!operationClass) errors.push("operation_class_missing");
  if (operationClass && !operationClassSpec) errors.push("operation_class_unknown");
  if (resourceClassSpec && operationClass && !asArray(resourceClassSpec.allowed_operations).includes(operationClass)) errors.push("operation_not_allowed_for_resource_class");
  if (resourceClass && allowedResourceRefs.length > 0 && !allowedResourceRefs.includes(resourceClass)) errors.push("profile_resource_class_not_allowed");
  if (resourceClass && deniedResourceRefs.includes(resourceClass)) errors.push("profile_resource_class_denied");
  if (surfaceName === "public" && resourceClassSpec && resourceClassSpec.public_surface_allowed !== true) errors.push("public_surface_resource_not_allowed");
  if (catalog?.surface_class === "public_mcp_tools" && toolPolicy?.public_safe !== true) errors.push("public_tool_not_public_safe");
  if (operationClassSpec?.mutation === true && catalog?.audit_required !== true) errors.push("mutating_operation_without_audit_required");
  if (operationClassSpec?.mutation === true && toolPolicy?.read_only === true) errors.push("mutating_operation_marked_read_only");
  return {
    name: entry.name, descriptor_present: Boolean(descriptor), tool_policy_present: Boolean(toolPolicy), catalog_entry_present: Boolean(catalog),
    surface_class: catalog?.surface_class || null, tool_category: catalog?.tool_category || null, resource_class: resourceClass, operation_class: operationClass,
    resource_policy_refs: asArray(catalog?.resource_policy_refs), audit_required: catalog?.audit_required === true, mutation: operationClassSpec?.mutation === true,
    public_safe: toolPolicy?.public_safe === true, read_only: toolPolicy?.read_only === true,
    readiness: errors.length === 0 ? "ready_for_preflight" : "blocked_for_preflight", errors, warnings,
  };
}
function buildPolicyEnforcementCoverageMatrix({ registryContext, serverProfileConfig, surfaceName, authMode, rootDir, resourcePolicySpec, label = "policy-enforcement-coverage" } = {}) {
  if (typeof registryContext !== "function") throw new Error("buildPolicyEnforcementCoverageMatrix requires registryContext function.");
  const resources = resourcePolicySpec || loadResourcePolicySpec({ rootDir });
  const surfaceConfig = getSurfaceConfig(serverProfileConfig, surfaceName);
  const context = registryContext({ label });
  const entries = context.policy_read_model.entries().map((entry) => buildEntryCoverage({ entry, surfaceConfig, resourcePolicySpec: resources, surfaceName }));
  const blocked = entries.filter((entry) => entry.errors.length > 0);
  const warnings = entries.flatMap((entry) => entry.warnings.map((warning) => ({ tool: entry.name, warning })));
  const mutating = entries.filter((entry) => entry.mutation).map((entry) => entry.name).sort();
  const auditRequired = entries.filter((entry) => entry.audit_required).map((entry) => entry.name).sort();
  return Object.freeze({
    schema_version: "stage10-policy-enforcement-coverage-matrix-v1", mode: "preflight_only", label: String(label || "policy-enforcement-coverage"),
    profile_surface: surfaceName, auth_mode: authMode || "", tool_count: entries.length, ready_count: entries.length - blocked.length, blocked_count: blocked.length,
    warning_count: warnings.length, mutating_tool_count: mutating.length, audit_required_count: auditRequired.length, policy_model_ok: context.policy_read_model.ok,
    registry_tool_count: context.registry_snapshot.tool_count, diff_snapshot_hash: context.diff_snapshot.entries_hash, runtime_enforcement_changed: false, allow_deny_behavior_changed: false, connector_visible_schema_changed: false,
    entries, blocked_tools: blocked.map((entry) => ({ name: entry.name, errors: entry.errors })), warnings, mutating_tools: mutating, audit_required_tools: auditRequired,
  });
}
module.exports = { buildEntryCoverage, buildPolicyEnforcementCoverageMatrix, loadResourcePolicySpec };
