"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { hashValue, stableJson } = require("./registry_diff_dry_run");

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function loadResourcePolicySpec({ rootDir = path.resolve(__dirname, "..") } = {}) {
  const specPath = path.join(rootDir, "SERVER_RESOURCE_POLICY_SPEC.json");
  return JSON.parse(fs.readFileSync(specPath, "utf8"));
}

function requireRuntimeRegistryContext(getRuntimeRegistryContext, label) {
  if (typeof getRuntimeRegistryContext !== "function") {
    throw new Error("runtime registry context provider is required");
  }
  const context = getRuntimeRegistryContext(label);
  if (!context || typeof context !== "object" || !context.registry_snapshot || !context.policy_read_model) {
    throw new Error("runtime registry context provider returned invalid context");
  }
  return context;
}

function summarizeEntry(entry) {
  if (!entry) return null;
  return {
    tool: entry.name,
    source: entry.source || "unknown",
    enabled: true,
    title: entry.descriptor_summary?.title || "",
    description: entry.descriptor_summary?.description || "",
    surface_class: entry.catalog_summary?.surface_class || "",
    tool_category: entry.catalog_summary?.tool_category || "",
    resource_class: entry.catalog_summary?.resource_class || "",
    operation_class: entry.catalog_summary?.operation_class || "",
    auth_required: Boolean(entry.tool_policy_summary?.auth_required),
    public_safe: Boolean(entry.tool_policy_summary?.public_safe),
    read_only: Boolean(entry.tool_policy_summary?.read_only),
    open_world: Boolean(entry.tool_policy_summary?.open_world),
    uses_fs: Boolean(entry.tool_policy_summary?.uses_fs),
    uses_network: Boolean(entry.tool_policy_summary?.uses_network),
    fs_scope: entry.tool_policy_summary?.fs_scope || "none",
  };
}

function buildRuntimeRegistryState(getRuntimeRegistryContext, label = "tool-registry-runtime") {
  const context = requireRuntimeRegistryContext(getRuntimeRegistryContext, label);
  const snapshot = context.registry_snapshot;
  const model = context.policy_read_model;
  const version = String(snapshot.registry_version || "stage8-static-registry-v1");
  const registryId = String(snapshot.entries_hash || hashValue(snapshot));
  return { context, snapshot, model, version, registryId };
}

function getEntry(getRuntimeRegistryContext, toolName, label = "tool-registry-entry") {
  const state = buildRuntimeRegistryState(getRuntimeRegistryContext, label);
  const entry = state.model.get(String(toolName || "").trim()) || null;
  return { ...state, entry };
}

function allowedOperationsForEntry(entry, rootDir) {
  const resourceClass = entry?.catalog_summary?.resource_class || "";
  if (!resourceClass) return [];
  const spec = loadResourcePolicySpec({ rootDir });
  const resource = spec.resource_classes && spec.resource_classes[resourceClass];
  return Array.isArray(resource?.allowed_operations) ? resource.allowed_operations.slice() : [];
}

function validateRegistryEntry(getRuntimeRegistryContext, toolName, options = {}) {
  const rootDir = options.rootDir || path.resolve(__dirname, "..");
  const { version, registryId, entry } = getEntry(getRuntimeRegistryContext, toolName, options.label || "tool-registry-validate");
  if (!entry) {
    return {
      success: true,
      error: "",
      status: "not_found",
      connector_safe: true,
      dispatch_enabled: false,
      registry_version: version,
      registry_id: registryId,
      tool: String(toolName || ""),
      found: false,
      enabled: false,
      allowed: false,
      reason: "tool_not_found",
      metadata: null,
      descriptor_summary: null,
      tool_policy_summary: null,
      catalog_summary: null,
      allowed_operations: [],
    };
  }
  const allowedOperations = allowedOperationsForEntry(entry, rootDir);
  return {
    success: true,
    error: "",
    status: "ok",
    connector_safe: true,
    dispatch_enabled: false,
    registry_version: version,
    registry_id: registryId,
    tool: entry.name,
    found: true,
    enabled: true,
    allowed: true,
    reason: null,
    metadata: summarizeEntry(entry),
    descriptor_summary: cloneJson(entry.descriptor_summary),
    tool_policy_summary: cloneJson(entry.tool_policy_summary),
    catalog_summary: cloneJson(entry.catalog_summary),
    allowed_operations: allowedOperations,
  };
}

function preflightRegistryOperation(getRuntimeRegistryContext, toolName, operation, options = {}) {
  const base = validateRegistryEntry(getRuntimeRegistryContext, toolName, options);
  const requestedOperation = String(operation || "").trim();
  if (!base.found) {
    return {
      success: true,
      error: "",
      status: "not_found",
      connector_safe: true,
      dispatch_enabled: false,
      registry_id: base.registry_id,
      tool: base.tool,
      operation: requestedOperation,
      found: false,
      enabled: false,
      allowed: false,
      reason: "tool_not_found",
      allowed_operations: [],
      tool_policy_summary: null,
      catalog_summary: null,
    };
  }
  const allowed = base.allowed_operations.includes(requestedOperation);
  return {
    success: true,
    error: "",
    status: "ok",
    connector_safe: true,
    dispatch_enabled: false,
    registry_id: base.registry_id,
    tool: base.tool,
    operation: requestedOperation,
    found: true,
    enabled: true,
    allowed,
    reason: allowed ? null : "operation_not_allowed_for_resource_class",
    allowed_operations: base.allowed_operations,
    tool_policy_summary: base.tool_policy_summary,
    catalog_summary: base.catalog_summary,
  };
}

function buildPlanSteps(preflight) {
  return [
    { order: 1, action: `resolve tool metadata for ${preflight.tool}`, status: preflight.found ? "ok" : "blocked" },
    { order: 2, action: `validate ${preflight.operation} against resource policy`, status: preflight.allowed ? "ok" : "blocked" },
    { order: 3, action: "keep execution in dry-run/read-model mode only", status: "ok" },
  ];
}

function planRegistryOperation(getRuntimeRegistryContext, toolName, operation, options = {}) {
  const preflight = preflightRegistryOperation(getRuntimeRegistryContext, toolName, operation, options);
  return {
    success: true,
    error: "",
    status: preflight.found ? "ok" : "not_found",
    connector_safe: true,
    dispatch_enabled: false,
    execution_enabled: false,
    registry_id: preflight.registry_id,
    tool: preflight.tool,
    operation: preflight.operation,
    found: preflight.found,
    enabled: preflight.enabled,
    allowed: preflight.allowed,
    plan_ready: preflight.allowed,
    reason: preflight.reason,
    steps: buildPlanSteps(preflight),
  };
}

function executeRegistryOperationDryRun(getRuntimeRegistryContext, toolName, operation, executionMode = "simulation", options = {}) {
  const normalizedMode = String(executionMode || "simulation").trim() || "simulation";
  const plan = planRegistryOperation(getRuntimeRegistryContext, toolName, operation, options);
  const planHash = hashValue({
    registry_id: plan.registry_id,
    tool: plan.tool,
    operation: plan.operation,
    allowed: plan.allowed,
    steps: plan.steps,
  });
  const executionId = `sim_${plan.registry_id}_${plan.tool}_${plan.operation}_${planHash}`.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 160);
  return {
    success: normalizedMode === "simulation",
    error: normalizedMode === "simulation" ? "" : "Only simulation execution_mode is supported.",
    status: plan.found ? "ok" : "not_found",
    connector_safe: true,
    dispatch_enabled: false,
    execution_enabled: false,
    simulated_execution: true,
    execution_mode: "simulation",
    execution_id: executionId,
    plan_hash: planHash,
    registry_id: plan.registry_id,
    tool: plan.tool,
    operation: plan.operation,
    found: plan.found,
    enabled: plan.enabled,
    allowed: normalizedMode === "simulation" ? plan.allowed : false,
    plan_ready: normalizedMode === "simulation" ? plan.plan_ready : false,
    reason: normalizedMode === "simulation" ? plan.reason : "unsupported_execution_mode",
    steps_count: plan.steps.length,
    simulated_steps: plan.steps.map((step) => ({ ...step, simulated: true })),
  };
}

module.exports = {
  allowedOperationsForEntry,
  buildRuntimeRegistryState,
  executeRegistryOperationDryRun,
  planRegistryOperation,
  preflightRegistryOperation,
  summarizeEntry,
  validateRegistryEntry,
};
