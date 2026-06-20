"use strict";

const IO_SAFETY_POLICY_VERSION = "mcp-io-safety-policy-v1";

const CONTROL_CATALOG = Object.freeze({
  data_classification_matrix: "Map data classes to allowed tools, outputs, logs, approvals, and retention.",
  input_taint_labels: "Label user/tool/connector input as trusted, untrusted, sensitive, or external.",
  prompt_injection_fixtures: "Exercise hostile instructions embedded in user/tool/connector content.",
  tool_output_instruction_firewall: "Treat tool output as data, not instructions; detect policy override/exfiltration language.",
  url_trust_policy: "Allow/embed only trusted URL domains and forbid blind use of tool-provided URLs.",
  approval_policy_map: "Require explicit approval for write, deploy, external-send, state mutation, or destructive actions.",
  redacted_summary_only: "For logs/audits use redacted summaries; raw audit export remains blocked.",
  dlp_fixtures: "Test secrets, tokens, private paths, PII-like payloads, and credential hints.",
  connector_trust_review: "Require trust review for every new remote MCP server or connector.",
  output_schema_guard: "Require strict output schema/fingerprint guard for connector-visible output.",
  stress_e2e_malicious_io: "Run end-to-end malicious input/output stress before closeout.",
});

const TRIGGER_POLICY = Object.freeze({
  new_tool: ["data_classification_matrix", "output_schema_guard", "stress_e2e_malicious_io"],
  tool_surface_change: ["data_classification_matrix", "output_schema_guard", "stress_e2e_malicious_io"],
  connector_visible_change: ["data_classification_matrix", "output_schema_guard", "connector_trust_review"],
  write_or_mutation_tool: ["approval_policy_map", "input_taint_labels", "dlp_fixtures", "stress_e2e_malicious_io"],
  external_connector_or_remote_mcp: ["connector_trust_review", "input_taint_labels", "prompt_injection_fixtures", "redacted_summary_only"],
  network_allowlist_expansion: ["url_trust_policy", "connector_trust_review", "stress_e2e_malicious_io"],
  untrusted_url_output: ["url_trust_policy", "tool_output_instruction_firewall"],
  file_or_audit_output_expansion: ["redacted_summary_only", "dlp_fixtures"],
  prompt_or_tool_output_ingestion: ["input_taint_labels", "prompt_injection_fixtures", "tool_output_instruction_firewall"],
  plugin_execution_enablement: ["approval_policy_map", "connector_trust_review", "stress_e2e_malicious_io"],
});

const BASELINE_ACTIVE_CONTROLS = Object.freeze([
  "redacted_summary_only",
  "output_schema_guard",
  "url_trust_policy",
  "connector_trust_review",
]);

const CURRENTLY_DEFERRED_CONTROLS = Object.freeze([
  "data_classification_matrix",
  "input_taint_labels",
  "prompt_injection_fixtures",
  "tool_output_instruction_firewall",
  "approval_policy_map",
  "dlp_fixtures",
  "stress_e2e_malicious_io",
]);

function unique(values) {
  return [...new Set(values)];
}

function validatePolicy(policy = IO_SAFETY_POLICY) {
  const errors = [];
  if (!policy || typeof policy !== "object") errors.push("policy must be an object");
  if (policy && policy.version !== IO_SAFETY_POLICY_VERSION) errors.push("unexpected policy version");
  for (const [trigger, controls] of Object.entries(policy.triggers || {})) {
    if (!Array.isArray(controls) || controls.length === 0) errors.push(`${trigger} has no controls`);
    for (const control of controls || []) {
      if (!policy.controls[control]) errors.push(`${trigger} references unknown control ${control}`);
    }
  }
  for (const control of policy.baseline_active_controls || []) {
    if (!policy.controls[control]) errors.push(`baseline references unknown control ${control}`);
  }
  return { ok: errors.length === 0, errors };
}

function evaluatePlannedChange(change = {}, activeControls = BASELINE_ACTIVE_CONTROLS) {
  const triggers = Object.keys(TRIGGER_POLICY).filter((trigger) => change[trigger] === true);
  const requiredControls = unique(triggers.flatMap((trigger) => TRIGGER_POLICY[trigger]));
  const missingControls = requiredControls.filter((control) => !activeControls.includes(control));
  const closeoutBlocked = missingControls.length > 0;
  return {
    policy_version: IO_SAFETY_POLICY_VERSION,
    triggers,
    required_controls: requiredControls,
    active_controls: [...activeControls],
    missing_controls: missingControls,
    closeout_blocked: closeoutBlocked,
    required_next_work: missingControls.map((control) => ({ control, description: CONTROL_CATALOG[control] })),
  };
}

const IO_SAFETY_POLICY = Object.freeze({
  version: IO_SAFETY_POLICY_VERSION,
  controls: CONTROL_CATALOG,
  triggers: TRIGGER_POLICY,
  baseline_active_controls: BASELINE_ACTIVE_CONTROLS,
  currently_deferred_controls: CURRENTLY_DEFERRED_CONTROLS,
  closeout_rule: "Any future server expansion that activates a trigger must either prove required controls active or block closeout with required_next_work.",
});

module.exports = {
  IO_SAFETY_POLICY_VERSION,
  IO_SAFETY_POLICY,
  CONTROL_CATALOG,
  TRIGGER_POLICY,
  BASELINE_ACTIVE_CONTROLS,
  CURRENTLY_DEFERRED_CONTROLS,
  evaluatePlannedChange,
  validatePolicy,
};
