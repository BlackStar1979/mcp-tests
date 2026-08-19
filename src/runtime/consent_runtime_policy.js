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

function consentDenied(reason) {
  return {
    status: "denied",
    code: "human_consent_denied",
    reason,
  };
}

function hasBoundedDigest(value) {
  return typeof value === "string" && value.length >= 16 && value.length <= 128;
}

function validateConsentMetadata(consent) {
  if (!isPlainObject(consent)) return false;
  if (consent.response_key !== CONSENT_RESPONSE_KEY) return false;
  for (const key of ["tool_name", "resource_class", "operation_class", "risk_class"]) {
    if (typeof consent[key] !== "string" || consent[key].length < 1 || consent[key].length > 256) return false;
  }
  if (!Array.isArray(consent.scope_delta) || consent.scope_delta.length > 32) return false;
  if (!consent.scope_delta.every((entry) => typeof entry === "string" && entry.length <= 256)) return false;
  if (consent.external_origin !== null && (typeof consent.external_origin !== "string" || consent.external_origin.length > 2048)) return false;
  return true;
}

function verifyConsentResponse({ requirement, inputResponses, mrtrAudit } = {}) {
  if (!isPlainObject(requirement) || requirement.kind !== CONSENT_REQUIREMENT_KIND) {
    return { status: "not_required" };
  }
  if (!validateConsentMetadata(requirement.consent)) {
    return consentDenied("consent_requirement_invalid");
  }
  if (!isPlainObject(inputResponses)) {
    return consentDenied("consent_responses_invalid");
  }
  const responseKeys = Object.keys(inputResponses).sort();
  if (responseKeys.length !== 1 || responseKeys[0] !== CONSENT_RESPONSE_KEY) {
    return consentDenied("consent_response_keys_invalid");
  }
  const response = inputResponses[CONSENT_RESPONSE_KEY];
  if (!isPlainObject(response)) {
    return consentDenied("consent_response_invalid");
  }
  if (response.action === "decline") return consentDenied("consent_declined");
  if (response.action === "cancel") return consentDenied("consent_cancelled");
  if (response.action !== "accept") return consentDenied("consent_action_invalid");
  if (!isPlainObject(response.content)) {
    return consentDenied("consent_content_invalid");
  }
  const contentKeys = Object.keys(response.content).sort();
  if (contentKeys.length !== 1 || contentKeys[0] !== "confirmed") {
    return consentDenied("consent_content_keys_invalid");
  }
  if (response.content.confirmed !== true) {
    return consentDenied("consent_not_confirmed");
  }
  if (
    !isPlainObject(mrtrAudit)
    || !hasBoundedDigest(mrtrAudit.state_handle_sha256)
    || !hasBoundedDigest(mrtrAudit.requirement_sha256)
  ) {
    return consentDenied("consent_binding_evidence_missing");
  }

  const consent = requirement.consent;
  return {
    status: "accepted",
    receipt: {
      version: "human-consent-receipt-v1",
      outcome: "accepted",
      tool_name: consent.tool_name,
      resource_class: consent.resource_class,
      operation_class: consent.operation_class,
      risk_class: consent.risk_class,
      scope_delta: [...consent.scope_delta],
      external_origin: consent.external_origin,
      state_handle_sha256: mrtrAudit.state_handle_sha256,
      requirement_sha256: mrtrAudit.requirement_sha256,
      binding_verified: true,
    },
  };
}

module.exports = {
  CONSENT_REQUIREMENT_KIND,
  CONSENT_RESPONSE_KEY,
  resolveConsentRequirement,
  verifyConsentResponse,
};
