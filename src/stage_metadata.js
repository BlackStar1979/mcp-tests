const CURRENT_STAGE_STATUS = "stage8_20-runtime-status-compact-mode";
const CURRENT_STAGE_STATUS_SEMANTICS = "runtime-compatibility-label-not-repo-progress-label";
const CURRENT_COMPATIBILITY_LABEL = CURRENT_STAGE_STATUS;
const CURRENT_COMPATIBILITY_LABEL_SEMANTICS = CURRENT_STAGE_STATUS_SEMANTICS;
const CURRENT_WORKING_COURSE = "stage8_52e-cross-server-mechanism-parity-matrix-complete";
const NEXT_PRIMARY_STAGE = "stage8_53a-internal-truth-tools-parity-preflight";
const NEXT_SECONDARY_STAGE = "stage8_53b-server-entrypoint-split";

function currentStageStatus() {
  return CURRENT_STAGE_STATUS;
}

function currentStageStatusSemantics() {
  return CURRENT_STAGE_STATUS_SEMANTICS;
}

function currentCompatibilityLabel() {
  return CURRENT_COMPATIBILITY_LABEL;
}

function currentCompatibilityLabelSemantics() {
  return CURRENT_COMPATIBILITY_LABEL_SEMANTICS;
}

function currentWorkingCourse() {
  return CURRENT_WORKING_COURSE;
}

module.exports = {
  CURRENT_STAGE_STATUS,
  CURRENT_STAGE_STATUS_SEMANTICS,
  CURRENT_COMPATIBILITY_LABEL,
  CURRENT_COMPATIBILITY_LABEL_SEMANTICS,
  CURRENT_WORKING_COURSE,
  NEXT_PRIMARY_STAGE,
  NEXT_SECONDARY_STAGE,
  currentStageStatus,
  currentStageStatusSemantics,
  currentCompatibilityLabel,
  currentCompatibilityLabelSemantics,
  currentWorkingCourse,
};
