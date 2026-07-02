const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  MECHANISM_PARITY_MATRIX_VERSION,
  MECHANISM_ENDURANCE_MATRIX,
  GPT_MCP_TOOLS_MECHANISMS,
  buildMechanismParityReport,
} = require("../src/mechanism_parity_matrix");

assert.equal(MECHANISM_PARITY_MATRIX_VERSION, "test-mcp-mechanism-endurance-v2");
assert.equal(GPT_MCP_TOOLS_MECHANISMS, MECHANISM_ENDURANCE_MATRIX);

const expectedMechanisms = [
  "index_mechanisms",
  "filesystem_mechanisms",
  "science_data_introspection_mechanisms",
  "connector_safe_code_mechanisms",
  "registry_governance_mechanisms",
  "web_access_mechanisms",
  "truth_drift_detection_mechanisms",
  "process_runner_policy_mechanisms",
  "remote_site_lifecycle_mechanisms",
  "deploy_rollback_control_plane_mechanisms",
];

assert.deepEqual(
  MECHANISM_ENDURANCE_MATRIX.map((entry) => entry.mechanism),
  expectedMechanisms,
);

for (const entry of MECHANISM_ENDURANCE_MATRIX) {
  assert.ok(entry.source_server, `${entry.mechanism} must name source server`);
  assert.ok(Array.isArray(entry.source_modules), `${entry.mechanism} must list source modules`);
  assert.ok(entry.source_modules.length > 0, `${entry.mechanism} must list at least one source module`);
  assert.ok(Array.isArray(entry.source_tools), `${entry.mechanism} must list source tool references`);
  assert.ok(entry.source_tools.length > 0, `${entry.mechanism} must list source tool references for traceability`);
  assert.ok(Array.isArray(entry.source_methods), `${entry.mechanism} must list source techniques/methods/processes`);
  assert.ok(entry.source_methods.length > 0, `${entry.mechanism} must list at least one technique/method/process`);
  assert.ok(["covered", "on_hold", "required_now"].includes(entry.endurance_status), `${entry.mechanism} must have valid endurance_status`);
  assert.ok(entry.exposure_decision, `${entry.mechanism} must define runtime exposure decision`);
  assert.ok(Array.isArray(entry.endurance_probes), `${entry.mechanism} must list endurance probes`);
  assert.ok(Array.isArray(entry.negative_controls), `${entry.mechanism} must list negative controls`);
  assert.ok(entry.hold_reason, `${entry.mechanism} must explain hold/coverage state`);
  assert.ok(entry.required_next_step, `${entry.mechanism} must define next step`);
}

for (const entry of MECHANISM_ENDURANCE_MATRIX.filter((item) => item.endurance_status === "covered")) {
  assert.ok(entry.endurance_probes.length > 0, `${entry.mechanism} covered mechanisms need probes`);
  assert.ok(entry.negative_controls.length > 0, `${entry.mechanism} covered mechanisms need negative controls`);
  assert.ok(!/must expose|must add.*tool/i.test(entry.required_next_step), `${entry.mechanism} must not require name-identical tool exposure`);
}

for (const entry of MECHANISM_ENDURANCE_MATRIX.filter((item) => item.endurance_status === "on_hold")) {
  assert.match(entry.exposure_decision, /defer|on_hold|runtime|probe/i, `${entry.mechanism} must record deferral/exposure decision`);
  assert.ok(entry.hold_reason.length > 40, `${entry.mechanism} must have substantive hold reason`);
  assert.ok(entry.required_next_step.length > 40, `${entry.mechanism} must have substantive next step`);
  assert.ok(!entry.required_next_step.includes("connector-visible science tools"), `${entry.mechanism} must avoid tool-porting language`);
}

const report = buildMechanismParityReport();
assert.equal(report.version, MECHANISM_PARITY_MATRIX_VERSION);
assert.equal(report.status, "step39_ready_with_on_hold_endurance_debt");
assert.equal(report.total, expectedMechanisms.length);
assert.equal(report.covered_count, 7);
assert.equal(report.on_hold_count, 3);
assert.equal(report.required_now_count, 0);

const onHoldMechanisms = report.mechanisms
  .filter((entry) => entry.endurance_status === "on_hold")
  .map((entry) => entry.mechanism);

assert.deepEqual(onHoldMechanisms, [
  "science_data_introspection_mechanisms",
  "process_runner_policy_mechanisms",
  "remote_site_lifecycle_mechanisms",
]);

const requiredNowMechanisms = report.mechanisms
  .filter((entry) => entry.endurance_status === "required_now")
  .map((entry) => entry.mechanism);
assert.deepEqual(requiredNowMechanisms, []);

const processEntry = report.mechanisms.find((entry) => entry.mechanism === "process_runner_policy_mechanisms");
assert.equal(processEntry.exposure_decision, "defer_runtime_process_capability_before_step39");
assert.ok(processEntry.source_methods.includes("restricted environment inheritance"));
assert.ok(processEntry.hold_reason.includes("high-risk"));

const remoteEntry = report.mechanisms.find((entry) => entry.mechanism === "remote_site_lifecycle_mechanisms");
assert.equal(remoteEntry.exposure_decision, "defer_remote_site_mock_harness_before_step39");
assert.ok(remoteEntry.source_methods.includes("retention preview before cleanup"));
assert.ok(remoteEntry.required_next_step.includes("mock remote-root harness"));

const scienceEntry = report.mechanisms.find((entry) => entry.mechanism === "science_data_introspection_mechanisms");
assert.equal(scienceEntry.exposure_decision, "defer_probe_no_runtime_tool_before_step39");
assert.ok(scienceEntry.source_methods.includes("safe corrupt-input failure envelope"));

const truthEntry = report.mechanisms.find((entry) => entry.mechanism === "truth_drift_detection_mechanisms");
assert.equal(truthEntry.endurance_status, "covered");
assert.ok(truthEntry.endurance_probes.includes("_tests/smoke_truth_parity_internal.js"));
assert.ok(truthEntry.endurance_probes.includes("_tests/smoke_workflow_state.js"));

const root = path.resolve(__dirname, "..");
const course = fs.readFileSync(path.join(root, "_workflow", "WORKING_COURSE.md"), "utf8");
const handoff = fs.readFileSync(path.join(root, "_workflow", "NEXT_CHAT_HANDOFF.md"), "utf8");
const index = fs.readFileSync(path.join(root, "_workflow", "INDEX.md"), "utf8");

for (const doc of [course, handoff, index]) {
  assert.ok(doc.includes("Stage 8 / Step 53"), "Stage 8 / Step 53 gate must remain documented");
  assert.ok(doc.includes("fresh") || doc.includes("Fresh"), "fresh backup requirement must be documented");
  assert.ok(doc.includes("full smoke") || doc.includes("full smokes") || doc.includes("Full smoke"), "full smoke requirement must be documented");
  assert.ok(doc.includes("truth_tools"), "legacy truth_tools gap context must remain discoverable");
  assert.ok(doc.includes("process_tools"), "legacy process_tools gap context must remain discoverable");
  assert.ok(doc.includes("remote_site_tools"), "legacy remote_site_tools gap context must remain discoverable");
  assert.ok(doc.includes("science_tools"), "legacy science_tools gap context must remain discoverable");
}

assert.ok(
  course.includes("operator-approved exclusion") || course.includes("operator-approved deferral") || course.includes("operator-approved"),
  "WORKING_COURSE must preserve operator-approved handling language for unresolved mechanism context",
);
assert.ok(
  handoff.includes("Stage 8 / Step 53a — internal-only truth_tools parity preflight"),
  "NEXT_CHAT_HANDOFF must route Stage 8 / Step 53a before the server.js split",
);
assert.ok(
  handoff.includes("Stage 8 / Step 53b — server.js runtime container extraction"),
  "NEXT_CHAT_HANDOFF must keep server.js extraction as Stage 8 / Step 53b",
);
assert.ok(
  handoff.includes("Do not start with the server.js split"),
  "NEXT_CHAT_HANDOFF must record the operator decision not to start with server.js split",
);

const spec = fs.readFileSync(path.join(root, "_workflow", "SERVER_SPEC.md"), "utf8");
for (const doc of [course, handoff, spec]) {
  assert.ok(
    doc.includes("src/stage_metadata.js") && doc.includes("restart TEST MCP") && doc.includes("current_working_course"),
    "stage metadata changes must be documented as requiring TEST MCP restart for live current_working_course truth",
  );
}

console.log("smoke_mechanism_parity_matrix ok");
