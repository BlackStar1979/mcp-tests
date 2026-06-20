const crypto = require("node:crypto");

const ABSOLUTE_PATH_RE = /(?:[a-zA-Z]:[\\/][^\s"'<>|]+|\\\\[^\s"'<>|]+[\\/][^\s"'<>|]+|\/(?:home|mnt|var|tmp|etc|usr|opt|work|workspace)\/[^\s"'<>|]+)/;
const RELATIVE_PATH_RE = /(?:^|[\s"'=:])(?:\.\.?[\\/]|[A-Za-z0-9_.-]+[\\/])[A-Za-z0-9_.@+\-\\/]+\.[A-Za-z0-9]{1,12}(?:$|[\s"',;])/;
const SENSITIVE_PATH_HINT_RE = /(?:private|credential|passwd|password|secret|token|\.pem|\.pfx|\.p12|\.key|\.secrets)/i;

function hashPrefix(value, length = 12) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function createSafety(maxSamples = 10) {
  return {
    export_safe: true,
    recommended_export_mode: "raw_ok",
    raw_export_blocked_reasons: [],
    raw_path_like_value_count: 0,
    sensitive_path_hint_count: 0,
    absolute_path_hint_count: 0,
    relative_path_hint_count: 0,
    inspected_string_count: 0,
    sample_limit: maxSamples,
    samples: [],
  };
}

function addReason(safety, reason) {
  if (!safety.raw_export_blocked_reasons.includes(reason)) safety.raw_export_blocked_reasons.push(reason);
}

function inspectString(text, safety) {
  safety.inspected_string_count += 1;
  const looksAbsolute = ABSOLUTE_PATH_RE.test(text);
  const looksRelative = RELATIVE_PATH_RE.test(text);
  const sensitive = SENSITIVE_PATH_HINT_RE.test(text);

  if (looksAbsolute || looksRelative) {
    safety.raw_path_like_value_count += 1;
    if (looksAbsolute) safety.absolute_path_hint_count += 1;
    if (looksRelative) safety.relative_path_hint_count += 1;
    addReason(safety, "path_like_value_present");
  }
  if (sensitive) {
    safety.sensitive_path_hint_count += 1;
    addReason(safety, "sensitive_path_hint_present");
  }
  if ((looksAbsolute || looksRelative || sensitive) && safety.samples.length < safety.sample_limit) {
    safety.samples.push({
      value_sha256_prefix: hashPrefix(text),
      path_is_absolute: looksAbsolute,
      path_like: looksAbsolute || looksRelative,
      sensitive_path_hint: sensitive,
      raw_value_redacted: true,
    });
  }
}

function visit(value, safety, depth, options) {
  if (value === null || value === undefined || depth > options.maxDepth) return;
  if (typeof value === "string") return inspectString(value, safety);
  if (Array.isArray(value)) {
    for (const item of value.slice(0, options.maxArrayItems)) visit(item, safety, depth + 1, options);
    return;
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value).slice(0, options.maxObjectKeys)) {
      inspectString(key, safety);
      visit(value[key], safety, depth + 1, options);
    }
  }
}

function assessAuditExportSafety(value, options = {}) {
  const effective = {
    maxDepth: Number.isInteger(options.maxDepth) ? options.maxDepth : 8,
    maxArrayItems: Number.isInteger(options.maxArrayItems) ? options.maxArrayItems : 500,
    maxObjectKeys: Number.isInteger(options.maxObjectKeys) ? options.maxObjectKeys : 200,
    maxSamples: Number.isInteger(options.maxSamples) ? options.maxSamples : 10,
  };
  const safety = createSafety(effective.maxSamples);
  visit(value, safety, 0, effective);
  safety.export_safe = safety.raw_export_blocked_reasons.length === 0;
  safety.recommended_export_mode = safety.export_safe ? "raw_ok" : "redacted_summary_only";
  safety.note = safety.export_safe
    ? "No path-like or sensitive path hints detected in inspected audit data."
    : "Do not export raw audit data outside the local machine; export hashed/redacted summaries only.";
  return safety;
}

module.exports = {
  assessAuditExportSafety,
};
