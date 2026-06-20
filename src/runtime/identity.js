const {
  CURRENT_STAGE_STATUS,
  CURRENT_STAGE_STATUS_SEMANTICS,
  CURRENT_WORKING_COURSE,
} = require("../stage_metadata");

const SERVER_NAME = "mcp-tests-response-shape";
const SERVER_VERSION = "0.30.0";
const CONNECTOR_SHAPE_VERSION = "2025-05-strict-v1";
const AUDIT_VERSION = "mcp-tests-audit-v1";
const STARTUP_REPORT_VERSION = "test-mcp-startup-report-v1";
const LABELS_VERSION = "test-mcp-labels-v1";

function buildRuntimeIdentity() {
  return {
    server_name: SERVER_NAME,
    server_version: SERVER_VERSION,
    connector_shape_version: CONNECTOR_SHAPE_VERSION,
    audit_version: AUDIT_VERSION,
    startup_report_version: STARTUP_REPORT_VERSION,
    labels_version: LABELS_VERSION,
    runtime_stage_status: CURRENT_STAGE_STATUS,
    runtime_stage_status_semantics: CURRENT_STAGE_STATUS_SEMANTICS,
    current_working_course: CURRENT_WORKING_COURSE,
  };
}

module.exports = {
  SERVER_NAME,
  SERVER_VERSION,
  CONNECTOR_SHAPE_VERSION,
  AUDIT_VERSION,
  STARTUP_REPORT_VERSION,
  LABELS_VERSION,
  buildRuntimeIdentity,
};
