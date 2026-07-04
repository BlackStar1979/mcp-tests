const {
  EMPTY_INPUT_SCHEMA,
  PROJECT_TRUTH_AUDIT_OUTPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
} = require("../src/schemas/truth_tools");
const { buildProjectTruthAudit } = require("../src/truth/project_truth_audit");

const TOOL_NAME = "project_truth_audit";

async function execute() {
  return buildProjectTruthAudit();
}

const projectTruthAuditTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Project truth audit",
    description: "Read-only repo truth audit covering stage metadata, canonical workflow docs, and drift findings.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: PROJECT_TRUTH_AUDIT_OUTPUT_SCHEMA,
    annotations: READ_ONLY_TRUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() {
    return { operation: TOOL_NAME };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.findings) ? payload.findings.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  projectTruthAuditTool,
};
