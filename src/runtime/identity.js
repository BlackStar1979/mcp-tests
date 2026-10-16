const {
  CURRENT_STAGE_STATUS,
  CURRENT_STAGE_STATUS_SEMANTICS,
  CURRENT_COMPATIBILITY_LABEL,
  CURRENT_COMPATIBILITY_LABEL_SEMANTICS,
  CURRENT_WORKING_COURSE,
} = require("../stage_metadata");

// Production identity since 2026-10-16 (operator decision): the PC-local MCP server is LocalNodeMCP.
const SERVER_NAME = "LocalNodeMCP";
// Names a running instance may still report while it is replaced; supervisors must recognise them
// so a takeover works across the rename instead of treating the old server as a foreign process.
const LEGACY_SERVER_NAMES = Object.freeze(["mcp-tests-response-shape"]);
const SERVER_VERSION = "0.40.0";
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
    runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL,
    runtime_compatibility_label_semantics: CURRENT_COMPATIBILITY_LABEL_SEMANTICS,
    runtime_stage_status: CURRENT_STAGE_STATUS,
    runtime_stage_status_semantics: CURRENT_STAGE_STATUS_SEMANTICS,
    current_working_course: CURRENT_WORKING_COURSE,
  };
}

module.exports = {
  SERVER_NAME,
  LEGACY_SERVER_NAMES,
  SERVER_VERSION,
  CONNECTOR_SHAPE_VERSION,
  AUDIT_VERSION,
  STARTUP_REPORT_VERSION,
  LABELS_VERSION,
  buildRuntimeIdentity,
};
