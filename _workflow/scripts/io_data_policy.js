"use strict";

const IO_DATA_POLICY_VERSION = "mcp-io-data-policy-v1";

const DATA_CLASSES = Object.freeze({
  public: "Safe public content.",
  untrusted_user_input: "User-provided content that may include instructions or payloads.",
  untrusted_tool_output: "Tool or connector output treated as data, never as instructions.",
  external_connector_data: "Data received from remote MCP or connector services.",
  secret_or_credential: "Tokens, keys, passwords, credentials, private keys, or auth material.",
  private_path_or_file: "Local absolute paths, private relative paths, or file names indicating sensitive material.",
  pii_like: "Email, phone, or personal identifier-like strings.",
  untrusted_url: "URL whose trust must be evaluated before embedding, fetching, or following.",
});

const CLASSIFIERS = Object.freeze([
  { data_class: "secret_or_credential", pattern: /\b(api[_-]?key|token|bearer|password|secret|private[_-]?key|credential|oauth|mcp_token)\b/i },
  { data_class: "private_path_or_file", pattern: /(?:[A-Za-z]:\\|[A-Za-z]:\/|\/home\/|\/tmp\/|\.secrets\/|\.ssh\/|private\.pem|credential\.key|config\.json)/i },
  { data_class: "pii_like", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { data_class: "pii_like", pattern: /\b(?:\+?\d[\d .-]{7,}\d)\b/ },
  { data_class: "untrusted_url", pattern: /https?:\/\/[^\s)]+/i },
]);

const OUTPUT_POLICY = Object.freeze({
  public_chat: {
    allowed: ["public"],
    blocked: ["secret_or_credential", "private_path_or_file", "pii_like", "external_connector_data"],
    redaction_required: ["secret_or_credential", "private_path_or_file", "pii_like"],
  },
  redacted_summary: {
    allowed: ["public", "untrusted_user_input", "untrusted_tool_output", "external_connector_data", "untrusted_url"],
    blocked: ["secret_or_credential", "private_path_or_file", "pii_like"],
    redaction_required: ["secret_or_credential", "private_path_or_file", "pii_like"],
  },
  local_audit: {
    allowed: Object.keys(DATA_CLASSES),
    blocked: [],
    redaction_required: [],
  },
});

function collectStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      out.push(String(key));
      collectStrings(item, out);
    }
  }
  return out;
}

function classifyText(text, baseClasses = []) {
  const classes = new Set(baseClasses.length ? baseClasses : ["public"]);
  for (const classifier of CLASSIFIERS) {
    if (classifier.pattern.test(text)) {
      classes.add(classifier.data_class);
      classes.delete("public");
    }
  }
  return [...classes].sort();
}

function classifyPayload(payload, options = {}) {
  const base = [];
  if (options.source === "user") base.push("untrusted_user_input");
  if (options.source === "tool") base.push("untrusted_tool_output");
  if (options.source === "connector" || options.source === "remote_mcp") base.push("external_connector_data", "untrusted_tool_output");
  const classes = new Set(base.length ? base : ["public"]);
  for (const text of collectStrings(payload)) {
    for (const cls of classifyText(text, base)) classes.add(cls);
  }
  if (classes.size > 1) classes.delete("public");
  return [...classes].sort();
}

function evaluateOutputPolicy(payload, target = "public_chat", options = {}) {
  const policy = OUTPUT_POLICY[target];
  if (!policy) throw new Error(`unknown output target: ${target}`);
  const dataClasses = classifyPayload(payload, options);
  const blocked = dataClasses.filter((cls) => policy.blocked.includes(cls));
  const redactionRequired = dataClasses.filter((cls) => policy.redaction_required.includes(cls));
  return {
    policy_version: IO_DATA_POLICY_VERSION,
    target,
    data_classes: dataClasses,
    allowed: blocked.length === 0,
    blocked_classes: blocked,
    redaction_required: redactionRequired.length > 0,
    redaction_classes: redactionRequired,
  };
}

function validateDataPolicy() {
  const errors = [];
  for (const [target, policy] of Object.entries(OUTPUT_POLICY)) {
    if (!Array.isArray(policy.allowed)) errors.push(`${target} missing allowed list`);
    if (!Array.isArray(policy.blocked)) errors.push(`${target} missing blocked list`);
    if (!Array.isArray(policy.redaction_required)) errors.push(`${target} missing redaction list`);
    for (const cls of [...policy.allowed, ...policy.blocked, ...policy.redaction_required]) {
      if (!DATA_CLASSES[cls]) errors.push(`${target} references unknown data class ${cls}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  IO_DATA_POLICY_VERSION,
  DATA_CLASSES,
  OUTPUT_POLICY,
  classifyText,
  classifyPayload,
  evaluateOutputPolicy,
  validateDataPolicy,
};
