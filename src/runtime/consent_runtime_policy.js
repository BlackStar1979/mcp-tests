"use strict";

const toolsSpec = require("../../SERVER_TOOLS_SPEC.json");

const CONSENT_REQUIREMENT_KIND = "human_consent_v1";
const CONSENT_RESPONSE_KEY = "human_approval";
const PROCESS_CONSENT_TOOLS = new Set(["run_process", "process_start", "process_cancel"]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function invalidRequired(reason) {
  return { required: true, ok: false, reason };
}

function buildConsentMessage({ toolName, resourceClass, operationClass }) {
  return [
    `Human approval required for ${toolName}:`,
    `resource=${resourceClass};`,
    `operation=${operationClass};`,
    "risk=high;",
    "scope_delta=none;",
    "external_origin=none.",
    "Approve this exact call?",
  ].join(" ");
}

function resolveConsentRequirement({
  toolName,
  toolPolicy,
  toolCatalog = toolsSpec.tool_catalog,
} = {}) {
  const normalizedToolName = typeof toolName === "string" ? toolName : "";
  if (!PROCESS_CONSENT_TOOLS.has(normalizedToolName)) {
    return { required: false, ok: true };
  }

  if (
    !isPlainObject(toolPolicy)
    || toolPolicy.destructive !== true
    || toolPolicy.read_only !== false
    || toolPolicy.auth_required !== true
  ) {
    return invalidRequired("consent_tool_policy_invalid");
  }

  if (!isPlainObject(toolCatalog)) {
    return invalidRequired("consent_tool_catalog_invalid");
  }
  const catalogEntry = toolCatalog[normalizedToolName];
  if (!isPlainObject(catalogEntry)) {
    return invalidRequired("consent_tool_catalog_entry_missing");
  }
  if (
    catalogEntry.name !== normalizedToolName
    || typeof catalogEntry.resource_class !== "string"
    || catalogEntry.resource_class.length < 1
    || typeof catalogEntry.operation_class !== "string"
    || catalogEntry.operation_class.length < 1
  ) {
    return invalidRequired("consent_tool_catalog_entry_invalid");
  }

  const consent = {
    response_key: CONSENT_RESPONSE_KEY,
    tool_name: normalizedToolName,
    resource_class: catalogEntry.resource_class,
    operation_class: catalogEntry.operation_class,
    risk_class: "high",
    scope_delta: [],
    external_origin: null,
  };

  return {
    required: true,
    ok: true,
    requirement: {
      kind: CONSENT_REQUIREMENT_KIND,
      consent,
      inputRequests: {
        [CONSENT_RESPONSE_KEY]: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: buildConsentMessage({
              toolName: normalizedToolName,
              resourceClass: consent.resource_class,
              operationClass: consent.operation_class,
            }),
            requestedSchema: {
              type: "object",
              properties: {
                confirmed: { type: "boolean" },
              },
              required: ["confirmed"],
              additionalProperties: false,
            },
          },
        },
      },
    },
  };
}

module.exports = {
  CONSENT_REQUIREMENT_KIND,
  CONSENT_RESPONSE_KEY,
  resolveConsentRequirement,
};
