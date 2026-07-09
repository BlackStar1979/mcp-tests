const {
  EMPTY_INPUT_SCHEMA,
  PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
} = require("../src/schemas/process_tools");
const { processRunnerPolicySnapshot } = require("../src/util/process_runner");

const TOOL_NAME = "process_runner_status";

async function execute() {
  return processRunnerPolicySnapshot();
}

const processRunnerStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Process runner status",
    description:
      "Read-only process policy snapshot showing the command allowlist, timeout/output caps, workspace roots, and environment inheritance limits without executing a process.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute,
  summarizeArgs() {
    return { operation: TOOL_NAME };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.allowed_commands)
        ? payload.allowed_commands.length
        : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  processRunnerStatusTool,
};
