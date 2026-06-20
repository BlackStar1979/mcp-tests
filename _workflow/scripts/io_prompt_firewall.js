"use strict";

const IO_PROMPT_FIREWALL_VERSION = "mcp-io-prompt-firewall-v1";

const INJECTION_PATTERNS = Object.freeze([
  { id: "ignore_previous", severity: "high", pattern: /\b(ignore|disregard|forget)\b.{0,80}\b(previous|system|developer|instructions|policy)\b/i },
  { id: "system_override", severity: "high", pattern: /\b(system|developer)\s+(prompt|message|instruction)\b.{0,80}\b(reveal|print|override|bypass|ignore)\b/i },
  { id: "secret_exfiltration", severity: "critical", pattern: /\b(send|exfiltrate|leak|reveal|print|dump)\b.{0,80}\b(secret|token|api[ _-]?key|password|credential|private[ _-]?key)\b/i },
  { id: "tool_escalation", severity: "high", pattern: /\b(call|invoke|use|run)\b.{0,80}\b(write|delete|deploy|shell|exec|powershell|curl|wget)\b/i },
  { id: "approval_bypass", severity: "critical", pattern: /\b(skip|bypass|disable)\b.{0,80}\b(approval|guard|guardrail|safety|policy|review)\b/i },
  { id: "hidden_instruction", severity: "medium", pattern: /<!--|<\s*script|display\s*:\s*none|base64\s*:/i },
]);

function collectText(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectText(item, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      out.push(String(key));
      collectText(item, out);
    }
  }
  return out;
}

function maxSeverity(findings) {
  const order = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return findings.reduce((max, item) => (order[item.severity] > order[max] ? item.severity : max), "none");
}

function inspectForPromptInjection(payload, options = {}) {
  const findings = [];
  const texts = collectText(payload);
  for (const text of texts) {
    for (const rule of INJECTION_PATTERNS) {
      if (rule.pattern.test(text)) {
        findings.push({ id: rule.id, severity: rule.severity, source: options.source || "unknown" });
      }
    }
  }
  const unique = [];
  const seen = new Set();
  for (const finding of findings) {
    const key = `${finding.id}:${finding.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(finding);
    }
  }
  const severity = maxSeverity(unique);
  return {
    firewall_version: IO_PROMPT_FIREWALL_VERSION,
    source: options.source || "unknown",
    finding_count: unique.length,
    severity,
    findings: unique,
    treat_as_data_only: options.source === "tool" || options.source === "connector" || options.source === "remote_mcp",
    blocked: severity === "high" || severity === "critical",
    review_required: severity === "medium" || severity === "high" || severity === "critical",
  };
}

function validatePromptFirewall() {
  const errors = [];
  for (const rule of INJECTION_PATTERNS) {
    if (!rule.id || !rule.severity || !(rule.pattern instanceof RegExp)) errors.push("invalid firewall rule");
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  IO_PROMPT_FIREWALL_VERSION,
  INJECTION_PATTERNS,
  inspectForPromptInjection,
  validatePromptFirewall,
};
