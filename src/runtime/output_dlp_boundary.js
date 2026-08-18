"use strict";

const Ajv2020 = require("ajv/dist/2020");

const OUTPUT_DLP_POLICY_VERSION = "mcp-tests-output-dlp-runtime-v1";
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});
const validatorCache = new WeakMap();
const REDACTED_SECRET = "[REDACTED_SECRET]";
const SENSITIVE_KEY_NAMES = new Set([
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "token",
  "authorization",
  "password",
  "passwd",
  "pwd",
  "secret",
  "clientsecret",
  "operatorsecret",
  "apikey",
  "privatekey",
  "credential",
  "credentials",
  "cookie",
  "setcookie",
]);
const TEXT_SECRET_PATTERNS = [
  { regex: /\bBearer\s+[A-Za-z0-9._~+\/-]{8,}={0,2}/gi, replacement: `Bearer ${REDACTED_SECRET}` },
  { regex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g, replacement: REDACTED_SECRET },
  { regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g, replacement: REDACTED_SECRET },
  { regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, replacement: REDACTED_SECRET },
  { regex: /\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, replacement: REDACTED_SECRET },
];

function normalizeSensitiveKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function redactTextSecrets(value, stats) {
  let text = String(value);
  for (const pattern of TEXT_SECRET_PATTERNS) {
    text = text.replace(pattern.regex, () => {
      stats.redacted_secret_count += 1;
      return pattern.replacement;
    });
  }
  return text;
}

function sanitizeJsonPayload(payload) {
  const stats = { redacted_secret_count: 0, redacted_field_count: 0, inspected_node_count: 0 };
  const ancestors = new WeakSet();
  const maxDepth = 32;
  const maxNodes = 100000;

  function visit(value, depth, key = "") {
    stats.inspected_node_count += 1;
    if (stats.inspected_node_count > maxNodes || depth > maxDepth) {
      throw new Error("output_complexity_limit");
    }

    if (SENSITIVE_KEY_NAMES.has(normalizeSensitiveKey(key))) {
      stats.redacted_secret_count += 1;
      stats.redacted_field_count += 1;
      return REDACTED_SECRET;
    }
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") return redactTextSecrets(value, stats);
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("output_not_json_compatible");
      return value;
    }
    if (Array.isArray(value)) {
      if (ancestors.has(value)) throw new Error("output_cycle_detected");
      ancestors.add(value);
      try {
        return value.map((item) => visit(item, depth + 1));
      } finally {
        ancestors.delete(value);
      }
    }
    if (value && typeof value === "object") {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("output_not_json_compatible");
      if (ancestors.has(value)) throw new Error("output_cycle_detected");
      ancestors.add(value);
      try {
        const result = {};
        for (const [childKey, childValue] of Object.entries(value)) {
          if (childValue === undefined || typeof childValue === "function" || typeof childValue === "symbol" || typeof childValue === "bigint") {
            throw new Error("output_not_json_compatible");
          }
          result[childKey] = visit(childValue, depth + 1, childKey);
        }
        return result;
      } finally {
        ancestors.delete(value);
      }
    }
    throw new Error("output_not_json_compatible");
  }

  try {
    return { success: true, payload: visit(payload, 0), stats, reason_code: "" };
  } catch (error) {
    return {
      success: false,
      payload: null,
      stats,
      reason_code: String(error?.message || "output_not_json_compatible").slice(0, 100),
    };
  }
}

function validateOutputSchema(payload, outputSchema) {
  let validate = validatorCache.get(outputSchema);
  try {
    if (!validate) {
      validate = ajv.compile(outputSchema);
      validatorCache.set(outputSchema, validate);
    }
  } catch {
    return {
      success: false,
      reason_code: "output_schema_invalid",
      issues: [{ path: "$", message: "output schema could not be compiled" }],
    };
  }

  if (validate(payload)) {
    return { success: true, reason_code: "", issues: [] };
  }

  return {
    success: false,
    reason_code: "output_schema_mismatch",
    issues: (validate.errors || []).slice(0, 20).map((issue) => ({
      path: issue.instancePath ? `$${issue.instancePath}` : "$",
      message: `${String(issue.keyword || "schema")} validation failed`,
    })),
  };
}

function evaluateToolOutputPolicy({ payload, outputSchema } = {}) {
  const sanitized = sanitizeJsonPayload(payload);
  if (!sanitized.success) {
    return {
      allow: false,
      policy_version: OUTPUT_DLP_POLICY_VERSION,
      reason_codes: [sanitized.reason_code],
      sanitized_payload: null,
      validation_errors: [],
      redaction_stats: sanitized.stats,
    };
  }

  if (!outputSchema || typeof outputSchema !== "object") {
    return {
      allow: true,
      policy_version: OUTPUT_DLP_POLICY_VERSION,
      reason_codes: [],
      sanitized_payload: sanitized.payload,
      validation_errors: [],
      redaction_stats: sanitized.stats,
    };
  }

  const validation = validateOutputSchema(sanitized.payload, outputSchema);
  if (!validation.success) {
    return {
      allow: false,
      policy_version: OUTPUT_DLP_POLICY_VERSION,
      reason_codes: [validation.reason_code],
      sanitized_payload: null,
      validation_errors: validation.issues,
      redaction_stats: sanitized.stats,
    };
  }

  return {
    allow: true,
    policy_version: OUTPUT_DLP_POLICY_VERSION,
    reason_codes: [],
    sanitized_payload: sanitized.payload,
    validation_errors: [],
    redaction_stats: sanitized.stats,
  };
}

module.exports = {
  OUTPUT_DLP_POLICY_VERSION,
  evaluateToolOutputPolicy,
  sanitizeJsonPayload,
};
