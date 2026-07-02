const crypto = require("node:crypto");
const { buildPluginRegistry } = require("./plugin_registry");
const {
  BUILTIN_READONLY_HANDLERS_VERSION,
  executeReadonlyHandler,
  getReadonlyHandlerMetadata,
  hasReadonlyHandler,
  listReadonlyHandlerTypes,
} = require("./plugin_readonly_handlers");

const ALLOWED_READONLY_HANDLER_TYPES = new Set(listReadonlyHandlerTypes());
const MAX_STRING_INPUT_CHARS = 1000;

const AUDIT_ENVELOPE_VERSION = "test-mcp-plugin-execution-audit-envelope-v1";
const AUDIT_STAGE = "plugin-execution-audit-envelope";

function policyFingerprint() {
  return stableHash({
    allowed_handler_types: listReadonlyHandlerTypes(),
    allowed_risks: ["readonly-local"],
    allowed_permissions: { network: false, fs: false, process: false, write: false, destructive: false },
    required_tool_properties: {
      public_safe: true,
      annotations_readOnlyHint: true,
      annotations_destructiveHint: false,
      annotations_openWorldHint: false,
      execution_dynamic_import: false,
      execution_allowlisted: true,
      execution_readonly_wrapper: true,
    },
  });
}

function buildAuditEnvelope({ operation, toolName = "", pluginId = "", handlerType = "", inputHash = "", resultHash = "", success = false } = {}) {
  const policyHash = policyFingerprint();
  const basis = {
    version: AUDIT_ENVELOPE_VERSION,
    stage: AUDIT_STAGE,
    operation,
    tool_name: toolName,
    plugin_id: pluginId,
    handler_type: handlerType,
    input_hash: inputHash,
    result_hash: resultHash,
    policy_hash: policyHash,
    success: Boolean(success),
  };
  return {
    ...basis,
    execution_id: stableHash(basis).slice(0, 24),
    correlation_scope: "plugin-execution-wrapper",
    wrapper_mode: "readonly-allowlisted-builtin",
    dynamic_import_enabled: false,
    plugin_execution_allowed: false,
    real_tools_list_mutation_enabled: false,
    list_changed_enabled: false,
  };
}


function stableHash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null), "utf8").digest("hex");
}

function getCandidateTool(registry, toolName) {
  for (const plugin of registry.plugins || []) {
    for (const tool of plugin.tools || []) {
      if (tool.name === toolName) return { plugin, tool };
    }
  }
  return null;
}

function validateBasicObjectArgs(schema, args = {}) {
  const errors = [];
  if (!schema || schema.type !== "object") return ["input schema must be an object"];
  if (!args || typeof args !== "object" || Array.isArray(args)) return ["arguments must be an object"];
  const allowed = new Set(Object.keys(schema.properties || {}));
  for (const key of Object.keys(args)) {
    if (!allowed.has(key)) errors.push(`unexpected argument: ${key}`);
  }
  for (const key of schema.required || []) {
    if (!(key in args)) errors.push(`missing required argument: ${key}`);
  }
  for (const [key, spec] of Object.entries(schema.properties || {})) {
    if (!(key in args)) continue;
    const value = args[key];
    if (spec.type === "string") {
      if (typeof value !== "string") errors.push(`${key} must be string`);
      else {
        if (spec.minLength !== undefined && value.length < spec.minLength) errors.push(`${key} shorter than minLength`);
        if (spec.maxLength !== undefined && value.length > spec.maxLength) errors.push(`${key} longer than maxLength`);
        if (value.length > MAX_STRING_INPUT_CHARS) errors.push(`${key} exceeds wrapper max string length`);
      }
    }
  }
  return errors;
}

function assessExecution({ registry, plugin, tool }) {
  const errors = [];
  const warnings = [];
  const execution = tool.execution || {};
  const handlerType = execution.handler_type || "";
  const risk = tool.risk;

  if (!registry.ok) errors.push("plugin registry is not valid");
  if (!plugin.validation?.ok) errors.push("plugin manifest validation failed");
  if (plugin.status !== "candidate" && plugin.status !== "enabled") errors.push(`plugin status is not executable by wrapper: ${plugin.status}`);
  if (tool.public_safe !== true) errors.push("tool is not public_safe");
  if (risk !== "readonly-local") errors.push(`tool risk is not readonly-local: ${risk}`);
  if (tool.annotations?.readOnlyHint !== true) errors.push("tool is not annotated read-only");
  if (tool.annotations?.destructiveHint !== false) errors.push("tool destructiveHint must be false");
  if (tool.annotations?.openWorldHint !== false) errors.push("tool openWorldHint must be false");
  if (tool.permissions?.network || tool.permissions?.fs || tool.permissions?.process || tool.permissions?.write || tool.permissions?.destructive) {
    errors.push("tool requests a permission forbidden by readonly execution wrapper");
  }
  if (execution.dynamic_import !== false) errors.push("execution.dynamic_import must be false");
  if (execution.allowlisted !== true) errors.push("execution.allowlisted must be true");
  if (execution.readonly_wrapper !== true) errors.push("execution.readonly_wrapper must be true");
  if (!hasReadonlyHandler(handlerType)) errors.push(`handler type is not allowlisted: ${handlerType}`);

  warnings.push("Readonly wrapper does not activate candidate tool in tools/list.");
  warnings.push("Readonly wrapper does not dynamically import plug-in files.");

  return {
    ok: errors.length === 0,
    handler_type: handlerType,
    errors,
    warnings,
  };
}

async function preflightPluginExecution(args = {}) {
  const toolName = String(args.tool_name || "").trim();
  const registry = await buildPluginRegistry();
  const found = getCandidateTool(registry, toolName);
  if (!found) {
    return {
      success: false,
      error: "Candidate tool not found.",
      mode: "readonly-plugin-execution-preflight",
      tool_name: toolName,
      execution_allowed_now: false,
      readonly_plugin_execution_wrapper_allowed: false,
      dynamic_import_enabled: false,
      plugin_execution_allowed: false,
      real_tools_list_mutation_enabled: false,
      list_changed_enabled: false,
      audit_envelope: buildAuditEnvelope({ operation: "preflight", toolName, success: false }),
    };
  }

  const assessment = assessExecution({ registry, ...found });
  return {
    success: assessment.ok,
    error: assessment.errors.join("; "),
    mode: "readonly-plugin-execution-preflight",
    tool_name: toolName,
    plugin_id: found.plugin.plugin_id,
    plugin_version: found.plugin.plugin_version,
    plugin_status: found.plugin.status,
    handler_type: assessment.handler_type,
    risk: found.tool.risk,
    public_safe: found.tool.public_safe,
    execution_allowed_now: assessment.ok,
    readonly_plugin_execution_wrapper_allowed: assessment.ok,
    dynamic_import_enabled: false,
    plugin_execution_allowed: false,
    real_tools_list_mutation_enabled: false,
    list_changed_enabled: false,
    errors: assessment.errors,
    warnings: assessment.warnings,
    input_schema_hash: stableHash(found.tool.input_schema),
    output_schema_hash: stableHash(found.tool.output_schema),
    audit_envelope: buildAuditEnvelope({ operation: "preflight", toolName, pluginId: found.plugin.plugin_id, handlerType: assessment.handler_type, success: assessment.ok }),
  };
}

async function executeReadonlyPlugin(args = {}) {
  const toolName = String(args.tool_name || "").trim();
  const input = args.text !== undefined ? { text: args.text } : (args.input || args.arguments || {});
  const inputHash = stableHash(input);
  const registry = await buildPluginRegistry();
  const found = getCandidateTool(registry, toolName);
  if (!found) {
    return {
      success: false,
      error: "Candidate tool not found.",
      mode: "readonly-plugin-execution-wrapper",
      tool_name: toolName,
      result: null,
      execution_allowed_now: false,
      readonly_plugin_execution_wrapper_allowed: false,
      dynamic_import_enabled: false,
      plugin_execution_allowed: false,
      real_tools_list_mutation_enabled: false,
      list_changed_enabled: false,
      audit_envelope: buildAuditEnvelope({ operation: "execute", toolName, inputHash, success: false }),
    };
  }

  const assessment = assessExecution({ registry, ...found });
  if (!assessment.ok) {
    return {
      success: false,
      error: assessment.errors.join("; "),
      mode: "readonly-plugin-execution-wrapper",
      tool_name: toolName,
      plugin_id: found.plugin.plugin_id,
      handler_type: assessment.handler_type,
      result: null,
      execution_allowed_now: false,
      readonly_plugin_execution_wrapper_allowed: false,
      dynamic_import_enabled: false,
      plugin_execution_allowed: false,
      real_tools_list_mutation_enabled: false,
      list_changed_enabled: false,
      errors: assessment.errors,
      warnings: assessment.warnings,
      audit_envelope: buildAuditEnvelope({ operation: "execute", toolName, pluginId: found.plugin.plugin_id, handlerType: assessment.handler_type, inputHash, success: false }),
    };
  }

  const argErrors = validateBasicObjectArgs(found.tool.input_schema, input);
  if (argErrors.length > 0) {
    return {
      success: false,
      error: argErrors.join("; "),
      mode: "readonly-plugin-execution-wrapper",
      tool_name: toolName,
      plugin_id: found.plugin.plugin_id,
      handler_type: assessment.handler_type,
      result: null,
      execution_allowed_now: true,
      readonly_plugin_execution_wrapper_allowed: true,
      dynamic_import_enabled: false,
      plugin_execution_allowed: false,
      real_tools_list_mutation_enabled: false,
      list_changed_enabled: false,
      errors: argErrors,
      warnings: assessment.warnings,
      audit_envelope: buildAuditEnvelope({ operation: "execute", toolName, pluginId: found.plugin.plugin_id, handlerType: assessment.handler_type, inputHash, success: false }),
    };
  }

  const result = executeReadonlyHandler(assessment.handler_type, input);
  const resultHash = stableHash(result);
  return {
    success: result.success === true,
    error: result.error || "",
    mode: "readonly-plugin-execution-wrapper",
    tool_name: toolName,
    plugin_id: found.plugin.plugin_id,
    plugin_version: found.plugin.plugin_version,
    plugin_status: found.plugin.status,
    handler_type: assessment.handler_type,
    result,
    execution_allowed_now: true,
    readonly_plugin_execution_wrapper_allowed: true,
    dynamic_import_enabled: false,
    plugin_execution_allowed: false,
    real_tools_list_mutation_enabled: false,
    list_changed_enabled: false,
    input_hash: inputHash,
    result_hash: resultHash,
    audit_envelope: buildAuditEnvelope({ operation: "execute", toolName, pluginId: found.plugin.plugin_id, handlerType: assessment.handler_type, inputHash, resultHash, success: result.success === true }),
    warnings: assessment.warnings,
  };
}

function asBoolString(value) {
  return value === true || value === "true" ? "true" : "false";
}

function verifyExecutionReceipt(args = {}) {
  const expectedVersion = AUDIT_ENVELOPE_VERSION;
  const expectedStage = AUDIT_STAGE;
  const operation = String(args.operation || "").trim();
  const toolName = String(args.tool_name || "");
  const pluginId = String(args.plugin_id || "");
  const handlerType = String(args.handler_type || "");
  const inputHash = String(args.input_hash || "");
  const resultHash = String(args.result_hash || "");
  const policyHash = String(args.policy_hash || "");
  const executionId = String(args.execution_id || "");
  const success = asBoolString(args.success) === "true";

  const errors = [];
  const warnings = [];
  const allowedOperations = new Set(["governance", "preflight", "execute"]);
  const hash64 = /^[a-f0-9]{64}$/;
  const hash24 = /^[a-f0-9]{24}$/;

  if (String(args.version || "") !== expectedVersion) errors.push("version mismatch");
  if (String(args.stage || "") !== expectedStage) errors.push("stage mismatch");
  if (!allowedOperations.has(operation)) errors.push("operation is not allowed");
  if (!hash24.test(executionId)) errors.push("execution_id must be 24 lowercase hex chars");
  if (!hash64.test(policyHash)) errors.push("policy_hash must be 64 lowercase hex chars");
  if (inputHash && !hash64.test(inputHash)) errors.push("input_hash must be empty or 64 lowercase hex chars");
  if (resultHash && !hash64.test(resultHash)) errors.push("result_hash must be empty or 64 lowercase hex chars");
  if (operation === "execute" && !toolName) errors.push("execute operation requires tool_name");
  if (operation !== "governance" && !pluginId) errors.push("non-governance operation requires plugin_id");
  if (operation !== "governance" && !handlerType) errors.push("non-governance operation requires handler_type");

  const currentPolicyHash = policyFingerprint();
  const expectedEnvelope = buildAuditEnvelope({
    operation,
    toolName,
    pluginId,
    handlerType,
    inputHash,
    resultHash,
    success,
  });

  const executionIdMatches = executionId === expectedEnvelope.execution_id;
  const policyHashMatchesCurrent = policyHash === currentPolicyHash;
  const policyHashMatchesExpected = policyHash === expectedEnvelope.policy_hash;

  if (!executionIdMatches) errors.push("execution_id mismatch");
  if (!policyHashMatchesCurrent) errors.push("policy_hash does not match current wrapper policy");
  if (!policyHashMatchesExpected) errors.push("policy_hash does not match expected envelope policy hash");

  if (operation === "governance" && (toolName || pluginId || handlerType || inputHash || resultHash)) {
    warnings.push("governance receipts normally use empty tool/plugin/handler/input/result fields");
  }

  return {
    success: errors.length === 0,
    error: errors.join("; "),
    mode: "plugin-execution-receipt-verifier",
    receipt_valid: errors.length === 0,
    version: String(args.version || ""),
    expected_version: expectedVersion,
    stage: String(args.stage || ""),
    expected_stage: expectedStage,
    operation,
    tool_name: toolName,
    plugin_id: pluginId,
    handler_type: handlerType,
    input_hash: inputHash,
    result_hash: resultHash,
    policy_hash: policyHash,
    current_policy_hash: currentPolicyHash,
    execution_id: executionId,
    expected_execution_id: expectedEnvelope.execution_id,
    execution_id_matches: executionIdMatches,
    policy_hash_matches_current: policyHashMatchesCurrent,
    policy_hash_matches_expected: policyHashMatchesExpected,
    errors,
    warnings,
    verifier_flags: {
      read_only: true,
      executes_plugin: false,
      dynamic_import_enabled: false,
      plugin_execution_allowed: false,
      real_tools_list_mutation_enabled: false,
      list_changed_enabled: false,
    },
  };
}

function getPluginExecutionGovernance() {
  return {
    success: true,
    error: "",
    mode: "plugin-execution-governance",
    governance_version: "test-mcp-plugin-execution-governance-v1",
    general_plugin_execution_allowed: false,
    readonly_plugin_execution_wrapper_allowed: true,
    dynamic_import_enabled: false,
    arbitrary_plugin_file_execution_enabled: false,
    real_tools_list_mutation_enabled: false,
    list_changed_enabled: false,
    allowed_handler_types: listReadonlyHandlerTypes(),
    allowed_risks: ["readonly-local"],
    handler_registry_version: BUILTIN_READONLY_HANDLERS_VERSION,
    handler_registry: listReadonlyHandlerTypes().map((handlerType) => getReadonlyHandlerMetadata(handlerType)),
    policy_hash: policyFingerprint(),
    audit_envelope: buildAuditEnvelope({ operation: "governance", success: true }),
    allowed_permissions: {
      network: false,
      fs: false,
      process: false,
      write: false,
      destructive: false,
    },
    required_tool_properties: {
      public_safe: true,
      annotations_readOnlyHint: true,
      annotations_destructiveHint: false,
      annotations_openWorldHint: false,
      execution_dynamic_import: false,
      execution_allowlisted: true,
      execution_readonly_wrapper: true,
    },
    deny_matrix: [
      { capability: "network", denied: true, reason: "readonly wrapper has no network permission" },
      { capability: "fs", denied: true, reason: "readonly wrapper has no plug-in filesystem permission" },
      { capability: "process", denied: true, reason: "process execution is not allowed" },
      { capability: "write", denied: true, reason: "write/edit/delete behavior is not allowed" },
      { capability: "destructive", denied: true, reason: "destructive behavior is not allowed" },
      { capability: "dynamic_import", denied: true, reason: "arbitrary dynamic import is not allowed" },
      { capability: "unknown_handler", denied: true, reason: "handler type must be allowlisted" },
    ],
  };
}

module.exports = {
  ALLOWED_READONLY_HANDLER_TYPES,
  BUILTIN_READONLY_HANDLERS_VERSION,
  AUDIT_ENVELOPE_VERSION,
  buildAuditEnvelope,
  assessExecution,
  executeReadonlyPlugin,
  getPluginExecutionGovernance,
  preflightPluginExecution,
  validateBasicObjectArgs,
  verifyExecutionReceipt,
};
