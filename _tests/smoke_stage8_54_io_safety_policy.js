"use strict";

const assert = require("node:assert/strict");
const {
  IO_SAFETY_POLICY_VERSION,
  IO_SAFETY_POLICY,
  BASELINE_ACTIVE_CONTROLS,
  evaluatePlannedChange,
  validatePolicy,
} = require("../_workflow/scripts/io_safety_policy");

const policyCheck = validatePolicy();
assert.equal(policyCheck.ok, true, policyCheck.errors.join("; "));
assert.equal(IO_SAFETY_POLICY.version, IO_SAFETY_POLICY_VERSION);
assert.equal(IO_SAFETY_POLICY.closeout_rule.includes("block closeout"), true);
assert.ok(BASELINE_ACTIVE_CONTROLS.includes("redacted_summary_only"));
assert.ok(BASELINE_ACTIVE_CONTROLS.includes("output_schema_guard"));
assert.ok(BASELINE_ACTIVE_CONTROLS.includes("url_trust_policy"));

const noExpansion = evaluatePlannedChange({});
assert.equal(noExpansion.closeout_blocked, false);
assert.deepEqual(noExpansion.triggers, []);
assert.deepEqual(noExpansion.missing_controls, []);

const newWriteTool = evaluatePlannedChange({ new_tool: true, write_or_mutation_tool: true });
assert.equal(newWriteTool.closeout_blocked, true);
assert.ok(newWriteTool.triggers.includes("new_tool"));
assert.ok(newWriteTool.triggers.includes("write_or_mutation_tool"));
assert.ok(newWriteTool.required_controls.includes("approval_policy_map"));
assert.ok(newWriteTool.required_controls.includes("data_classification_matrix"));
assert.ok(newWriteTool.required_controls.includes("dlp_fixtures"));
assert.ok(newWriteTool.missing_controls.includes("approval_policy_map"));
assert.ok(newWriteTool.missing_controls.includes("data_classification_matrix"));
assert.ok(newWriteTool.required_next_work.some((item) => item.control === "approval_policy_map"));

const remoteMcp = evaluatePlannedChange({ external_connector_or_remote_mcp: true, prompt_or_tool_output_ingestion: true });
assert.equal(remoteMcp.closeout_blocked, true);
assert.ok(remoteMcp.required_controls.includes("connector_trust_review"));
assert.ok(remoteMcp.required_controls.includes("prompt_injection_fixtures"));
assert.ok(remoteMcp.required_controls.includes("tool_output_instruction_firewall"));
assert.ok(remoteMcp.missing_controls.includes("prompt_injection_fixtures"));
assert.ok(remoteMcp.missing_controls.includes("tool_output_instruction_firewall"));

const urlExpansion = evaluatePlannedChange({ network_allowlist_expansion: true, untrusted_url_output: true }, [
  ...BASELINE_ACTIVE_CONTROLS,
  "tool_output_instruction_firewall",
  "stress_e2e_malicious_io",
]);
assert.equal(urlExpansion.closeout_blocked, false);
assert.deepEqual(urlExpansion.missing_controls, []);

const fullyPreparedMutation = evaluatePlannedChange({ write_or_mutation_tool: true }, [
  ...BASELINE_ACTIVE_CONTROLS,
  "approval_policy_map",
  "input_taint_labels",
  "dlp_fixtures",
  "stress_e2e_malicious_io",
]);
assert.equal(fullyPreparedMutation.closeout_blocked, false);
assert.deepEqual(fullyPreparedMutation.missing_controls, []);

console.log("smoke_stage8_54_io_safety_policy ok");
