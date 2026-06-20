const { byteLength, stableSha256 } = require("./runtime_helpers");
const { classifySensitiveMarkers } = require("./audit_arg_markers");

function summarizeArg(value) {
  const text = String(value ?? "");

  return {
    arg_sha256: stableSha256(text),
    arg_length_chars: text.length,
    arg_length_bytes: byteLength(text),
    flags: classifySensitiveMarkers(text),
  };
}

function normalizeToolStartArgSummary(summary = {}) {
  const normalized = summary && typeof summary === "object" ? { ...summary } : {};
  const legacyArgSummaryFailure =
    normalized.success === false &&
    (normalized.error === "arg_summary" || normalized.error_kind === "arg_summary");

  delete normalized.success;

  if (!normalized.arg_summary_status) {
    normalized.arg_summary_status = legacyArgSummaryFailure ? "failed" : "ok";
  }

  if (legacyArgSummaryFailure) {
    normalized.arg_summary_error = normalized.error || normalized.error_kind || "arg_summary";
    delete normalized.error;
    delete normalized.error_kind;
  }

  normalized.execution_success = "unknown";
  return normalized;
}

module.exports = {
  summarizeArg,
  normalizeToolStartArgSummary,
};
