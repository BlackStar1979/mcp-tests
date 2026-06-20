const crypto = require("node:crypto");
const { assessAuditExportSafety } = require("./audit_export_safety");

const AUDIT_EXPORT_REDACTOR_VERSION = "test-mcp-audit-export-redactor-v1";

const ABSOLUTE_PATH_RE = /(?:[a-zA-Z]:[\\/][^\s"'<>|]+|\\\\[^\s"'<>|]+[\\/][^\s"'<>|]+|\/(?:home|mnt|var|tmp|etc|usr|opt|work|workspace)\/[^\s"'<>|]+)/g;
const RELATIVE_PATH_RE = /(?:^|[\s"'=:])(?:\.\.?[\\/]|[A-Za-z0-9_.-]+[\\/])[A-Za-z0-9_.@+\-\\/]+\.[A-Za-z0-9]{1,12}(?=$|[\s"',;])/g;
const SENSITIVE_HINT_RE = /(?:private|credential|passwd|password|secret|token|\.pem|\.pfx|\.p12|\.key|\.secrets)/i;

function hashPrefix(value, length = 16) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function classifyString(value) {
  const text = String(value || "");
  const absoluteMatches = text.match(ABSOLUTE_PATH_RE) || [];
  const relativeMatches = text.match(RELATIVE_PATH_RE) || [];
  const sensitive = SENSITIVE_HINT_RE.test(text);
  return {
    path_like: absoluteMatches.length > 0 || relativeMatches.length > 0,
    path_is_absolute: absoluteMatches.length > 0,
    path_is_relative: relativeMatches.length > 0,
    sensitive_path_hint: sensitive,
    match_count: absoluteMatches.length + relativeMatches.length,
  };
}

function redactString(value, stats) {
  const text = String(value || "");
  const classification = classifyString(text);
  stats.inspected_string_count += 1;
  if (!classification.path_like && !classification.sensitive_path_hint) return text;

  stats.redacted_string_count += 1;
  if (classification.path_like) stats.path_like_value_count += 1;
  if (classification.path_is_absolute) stats.absolute_path_hint_count += 1;
  if (classification.path_is_relative) stats.relative_path_hint_count += 1;
  if (classification.sensitive_path_hint) stats.sensitive_path_hint_count += 1;

  return {
    redacted: true,
    value_sha256_prefix: hashPrefix(text),
    value_kind: classification.sensitive_path_hint ? "sensitive_or_path_like" : "path_like",
    path_like: classification.path_like,
    path_is_absolute: classification.path_is_absolute,
    path_is_relative: classification.path_is_relative,
    sensitive_path_hint: classification.sensitive_path_hint,
  };
}

function redactValue(value, stats, depth = 0, options = {}) {
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 8;
  const maxArrayItems = Number.isInteger(options.maxArrayItems) ? options.maxArrayItems : 500;
  const maxObjectKeys = Number.isInteger(options.maxObjectKeys) ? options.maxObjectKeys : 200;

  if (depth > maxDepth) {
    stats.truncated_value_count += 1;
    return { redacted: true, reason: "max_depth_exceeded" };
  }
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value, stats);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const out = value.slice(0, maxArrayItems).map((item) => redactValue(item, stats, depth + 1, options));
    if (value.length > maxArrayItems) {
      stats.truncated_value_count += 1;
      out.push({ redacted: true, reason: "array_item_limit_exceeded", omitted_count: value.length - maxArrayItems });
    }
    return out;
  }
  if (typeof value === "object") {
    const out = {};
    const keys = Object.keys(value);
    for (const key of keys.slice(0, maxObjectKeys)) {
      const redactedKey = redactString(key, stats);
      const safeKey = typeof redactedKey === "string" ? redactedKey : `redacted_key_${redactedKey.value_sha256_prefix}`;
      if (typeof redactedKey !== "string") stats.redacted_key_count += 1;
      out[safeKey] = redactValue(value[key], stats, depth + 1, options);
    }
    if (keys.length > maxObjectKeys) {
      stats.truncated_value_count += 1;
      out.__redacted_extra_keys__ = { redacted: true, reason: "object_key_limit_exceeded", omitted_count: keys.length - maxObjectKeys };
    }
    return out;
  }
  return { redacted: true, reason: "unsupported_value_type", value_type: typeof value };
}

function createStats() {
  return {
    inspected_string_count: 0,
    redacted_string_count: 0,
    redacted_key_count: 0,
    path_like_value_count: 0,
    absolute_path_hint_count: 0,
    relative_path_hint_count: 0,
    sensitive_path_hint_count: 0,
    truncated_value_count: 0,
  };
}

function buildRedactedAuditExport(value, options = {}) {
  const before = assessAuditExportSafety(value, options);
  const stats = createStats();
  const redacted = redactValue(value, stats, 0, options);
  const after = assessAuditExportSafety(redacted, options);
  const exportSafe = after.export_safe === true;
  return {
    success: exportSafe,
    error: exportSafe ? "" : "redacted export still contains path-like or sensitive hints",
    redactor_version: AUDIT_EXPORT_REDACTOR_VERSION,
    export_mode: "redacted_summary_only",
    raw_export_allowed: false,
    raw_export_blocked_reasons: before.raw_export_blocked_reasons || [],
    before_safety: before,
    after_safety: after,
    redaction_stats: stats,
    redacted_payload: redacted,
    redacted_payload_hash: hashPrefix(JSON.stringify(redacted)),
    raw_payload_redacted: true,
  };
}

module.exports = {
  AUDIT_EXPORT_REDACTOR_VERSION,
  buildRedactedAuditExport,
  classifyString,
  redactValue,
};
