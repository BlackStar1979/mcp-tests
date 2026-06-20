"use strict";

const {
  classifyPayload,
  evaluateOutputPolicy,
} = require("./io_data_policy");
const {
  inspectForPromptInjection,
} = require("./io_prompt_firewall");
const {
  evaluateApprovalRequirement,
} = require("./io_approval_policy");

const MCP_APPS_RISK_POLICY_VERSION = "mcp-apps-risk-policy-v1";

const APP_CONNECTOR_TERMS = Object.freeze({
  connector: "app",
  connectors: "apps",
  connector_visible: "app_visible",
  data_only_connector: "data_only_app",
});

const DATA_ONLY_COMPATIBILITY = Object.freeze({
  required_tools: ["search", "fetch"],
  search: {
    args: ["query"],
    output: ["results[].id", "results[].title", "results[].url"],
  },
  fetch: {
    args: ["id"],
    output: ["id", "title", "text", "url", "metadata?"],
  },
  response_shape: "structuredContent plus matching JSON text in content[]",
});

const SENSITIVE_PARAMETER_PATTERNS = Object.freeze([
  /summary\s*of\s*conversation/i,
  /conversation/i,
  /annual\s*income/i,
  /home\s*address/i,
  /address/i,
  /password/i,
  /token/i,
  /api[ _-]?key/i,
  /secret/i,
  /credential/i,
  /email/i,
  /phone/i,
  /ssn|national\s*id/i,
]);

const MUTATION_VERB_PATTERN = /\b(write|delete|remove|destroy|send|email|post|create|update|patch|deploy|book|purchase|transfer|submit|execute|run)\b/i;

function normalizeAppTerm(term) {
  return APP_CONNECTOR_TERMS[term] || term;
}

function collectSchemaPropertyNames(schema, out = []) {
  if (!schema || typeof schema !== "object") return out;
  if (schema.properties && typeof schema.properties === "object") {
    for (const key of Object.keys(schema.properties)) {
      out.push(key);
      collectSchemaPropertyNames(schema.properties[key], out);
    }
  }
  for (const key of ["items", "anyOf", "oneOf", "allOf"]) {
    const value = schema[key];
    if (Array.isArray(value)) value.forEach((item) => collectSchemaPropertyNames(item, out));
    else if (value && typeof value === "object") collectSchemaPropertyNames(value, out);
  }
  return out;
}

function inspectParameterOverreach(tool = {}) {
  const names = [
    ...(Array.isArray(tool.parameters) ? tool.parameters : []),
    ...collectSchemaPropertyNames(tool.input_schema || tool.inputSchema || tool.schema),
  ].map(String);
  const flagged = [];
  for (const name of names) {
    for (const pattern of SENSITIVE_PARAMETER_PATTERNS) {
      if (pattern.test(name)) {
        flagged.push(name);
        break;
      }
    }
  }
  const excessiveParameterCount = names.length > (tool.name === "search" || tool.name === "fetch" ? 2 : 8);
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    tool_name: tool.name || "unknown",
    parameter_count: names.length,
    flagged_parameters: [...new Set(flagged)],
    excessive_parameter_count: excessiveParameterCount,
    overreach_detected: flagged.length > 0 || excessiveParameterCount,
    review_required: flagged.length > 0 || excessiveParameterCount,
  };
}

function inspectReadActionSemantics(tool = {}) {
  const name = String(tool.name || "");
  const description = String(tool.description || tool.title || "");
  const readOnly = tool.read_only === true || tool.readOnlyHint === true || tool.annotations?.readOnlyHint === true || tool.risk === "readonly-local";
  const mutationLanguage = MUTATION_VERB_PATTERN.test(`${name} ${description}`);
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    tool_name: name || "unknown",
    declared_read_only: readOnly,
    mutation_language_detected: mutationLanguage,
    mismatch_detected: readOnly && mutationLanguage,
    blocked_until_review: readOnly && mutationLanguage,
  };
}

function inspectToolDefinitionSafety(tool = {}) {
  const dataDecision = evaluateOutputPolicy(tool, "public_chat", { source: "tool" });
  const overreach = inspectParameterOverreach(tool);
  const readMismatch = inspectReadActionSemantics(tool);
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    tool_name: tool.name || "unknown",
    sensitive_json_detected: dataDecision.redaction_required || dataDecision.blocked_classes.length > 0,
    blocked_classes: dataDecision.blocked_classes,
    parameter_overreach: overreach.overreach_detected,
    flagged_parameters: overreach.flagged_parameters,
    read_action_mismatch: readMismatch.mismatch_detected,
    blocked_until_review: dataDecision.redaction_required || overreach.review_required || readMismatch.blocked_until_review,
  };
}

function evaluateReadActionLeakage(action = {}) {
  const dataClasses = action.data_classes || classifyPayload(action.payload || {}, { source: action.source || "user" });
  const sensitiveClasses = dataClasses.filter((cls) => ["secret_or_credential", "private_path_or_file", "pii_like", "external_connector_data"].includes(cls));
  const sendsToMcp = action.sends_to_mcp !== false;
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    action_kind: action.action_kind || "read",
    data_classes: dataClasses,
    sends_to_mcp: sendsToMcp,
    sensitive_classes: sensitiveClasses,
    leakage_risk: sendsToMcp && sensitiveClasses.length > 0,
    require_redaction_or_review: sendsToMcp && sensitiveClasses.length > 0,
  };
}

function evaluateCrossMcpExfiltration(scenario = {}) {
  const source = scenario.source_mcp || "unknown_source";
  const target = scenario.target_mcp || "unknown_target";
  const dataClasses = scenario.data_classes || classifyPayload(scenario.payload || {}, { source: "connector" });
  const actionKind = scenario.action_kind || "read";
  const prompt = inspectForPromptInjection(scenario.prompt || scenario.payload || "", { source: "connector" });
  const approval = evaluateApprovalRequirement({
    kind: actionKind === "write" ? "send_external" : "read_internal",
    data_classes: dataClasses,
    prompt_injection_severity: prompt.severity,
    external_domain: target,
    trusted_domain: scenario.trusted_target === true,
    approved: scenario.approved === true,
  });
  const differentMcp = source !== target;
  const sensitive = dataClasses.some((cls) => ["secret_or_credential", "private_path_or_file", "pii_like", "external_connector_data"].includes(cls));
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    source_mcp: source,
    target_mcp: target,
    different_mcp: differentMcp,
    action_kind: actionKind,
    data_classes: dataClasses,
    prompt_injection_severity: prompt.severity,
    sensitive_cross_mcp_transfer: differentMcp && sensitive,
    blocked_until_review: (differentMcp && sensitive) || approval.blocked_until_review,
    approval_required: approval.require_approval,
    reasons: approval.reasons,
  };
}

function evaluateDeepResearchMcpMode(config = {}) {
  const allowedTools = config.allowed_tools || [];
  const requireApproval = config.require_approval;
  const toolDefinitions = config.tool_definitions || [];
  const unknownTools = allowedTools.filter((name) => !DATA_ONLY_COMPATIBILITY.required_tools.includes(name));
  const unsafeDefinitions = toolDefinitions.map(inspectReadActionSemantics).filter((item) => item.blocked_until_review);
  const noApprovalRequired = requireApproval === "never" || requireApproval === false;
  return {
    policy_version: MCP_APPS_RISK_POLICY_VERSION,
    mode: "deep_research_api",
    require_approval: requireApproval,
    no_approval_required: noApprovalRequired,
    allowed_tools: allowedTools,
    unknown_or_non_data_only_tools: unknownTools,
    unsafe_read_only_definitions: unsafeDefinitions,
    allowed: noApprovalRequired && unknownTools.length === 0 && unsafeDefinitions.length === 0,
    blocked_reasons: [
      ...(noApprovalRequired ? [] : ["deep research MCP mode requires no approval interaction" ]),
      ...(unknownTools.length ? ["non search/fetch tool in no-approval deep research mode"] : []),
      ...(unsafeDefinitions.length ? ["read-only tool definition contains mutation language"] : []),
    ],
  };
}

function validateAppsRiskPolicy() {
  const errors = [];
  if (!DATA_ONLY_COMPATIBILITY.required_tools.includes("search")) errors.push("search tool missing from compatibility policy");
  if (!DATA_ONLY_COMPATIBILITY.required_tools.includes("fetch")) errors.push("fetch tool missing from compatibility policy");
  if (normalizeAppTerm("connector_visible") !== "app_visible") errors.push("connector/app alias missing");
  return { ok: errors.length === 0, errors };
}

module.exports = {
  MCP_APPS_RISK_POLICY_VERSION,
  APP_CONNECTOR_TERMS,
  DATA_ONLY_COMPATIBILITY,
  normalizeAppTerm,
  inspectParameterOverreach,
  inspectReadActionSemantics,
  inspectToolDefinitionSafety,
  evaluateReadActionLeakage,
  evaluateCrossMcpExfiltration,
  evaluateDeepResearchMcpMode,
  validateAppsRiskPolicy,
};
