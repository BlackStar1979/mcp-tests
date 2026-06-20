const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  CURRENT_STAGE_STATUS,
  CURRENT_STAGE_STATUS_SEMANTICS,
  CURRENT_WORKING_COURSE,
  NEXT_PRIMARY_STAGE,
  NEXT_SECONDARY_STAGE,
  currentStageStatus,
  currentStageStatusSemantics,
  currentWorkingCourse,
} = require("../src/stage_metadata");

const course = fs.readFileSync(path.resolve(__dirname, "..", "_workflow", "WORKING_COURSE.md"), "utf8");

assert.equal(CURRENT_STAGE_STATUS, "stage8_20-runtime-status-compact-mode");
assert.equal(currentStageStatus(), CURRENT_STAGE_STATUS);
assert.equal(CURRENT_STAGE_STATUS_SEMANTICS, "runtime-compatibility-label-not-repo-progress-label");
assert.equal(currentStageStatusSemantics(), CURRENT_STAGE_STATUS_SEMANTICS);
assert.equal(CURRENT_WORKING_COURSE, "stage8_52e-cross-server-mechanism-parity-matrix-complete");
assert.equal(currentWorkingCourse(), CURRENT_WORKING_COURSE);
assert.equal(NEXT_PRIMARY_STAGE, "stage8_53a-internal-truth-tools-parity-preflight");
assert.equal(NEXT_SECONDARY_STAGE, "stage8_53b-server-entrypoint-split");

for (const required of [
  "No deferred item may remain implicit",
  "plugin visibility persistent state-store preview",
  "audit export redaction hardening",
  "plugin visibility state-store transaction receipt",
  "audit redaction integration planning",
  "state-store transaction pipeline dry-run",
  "controlled observability redaction summary prototype",
  "state-store transaction apply-readiness gate",
  "security-first preflight consolidation",
  "runtime log directory relocation",
  "structural topology foundation",
  "repository topology relocation",
  "workflow/plugin/readme topology cleanup",
  "Stage 8 / Step 52 — runtime identity, labels, startup report, and SERVER_SPEC cleanup",
  "Stage 8 / Step 52b",
  "Stage 8 / Step 52c",
  "Stage 8 / Step 52d",
  "Stage 8 / Step 52e",
  "Stage 8 / Step 53 — server.js runtime container extraction",
  "Full legacy flat tools implementation move",
  "Full dockerized runtime activation",
  "Real list_changed emission",
  "Dynamic import plugin loading",
  "Real auth cutover",
  "Porting to C:",
  "Audit raw export",
  "status = deferred",
  "status = deferred_pending_operator_decision",
  "status = mitigated_for_redacted_summary_only",
]) {
  assert.ok(course.includes(required), `_workflow/WORKING_COURSE.md missing: ${required}`);
}

for (const forbidden of [
  "Root `.devcontainer` cleanup",
  "assistant_message_digest",
  "longterm/operational_notes",
]) {
  assert.ok(!course.includes(forbidden), `_workflow/WORKING_COURSE.md still contains obsolete item: ${forbidden}`);
}

console.log("smoke_stage8_39_course_correction_ledger ok");
