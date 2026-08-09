"use strict";

const {
  PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
  PROCESS_TOOL_ANNOTATIONS,
  RUN_PROCESS_INPUT_SCHEMA,
  processToolOutputSchema,
} = require("../src/schemas/process_tools");
const { executeProcessTool } = require("../src/util/process_tool_errors");
const {
  resolveProcessJobManager,
  resolveProcessJobOwner,
} = require("../src/util/process_job_manager");

const TOOL_NAME = "process_start";

const processStartTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Start bounded workspace process",
    description: "Validate and enqueue an allowlisted workspace process, returning immediately with a bounded OAuth-client-bound durable job handle.",
    inputSchema: RUN_PROCESS_INPUT_SCHEMA,
    outputSchema: processToolOutputSchema(PROCESS_JOB_STATUS_OUTPUT_SCHEMA),
    annotations: PROCESS_TOOL_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return executeProcessTool(() => resolveProcessJobManager(context).start(args, {
      ownerId: resolveProcessJobOwner(context),
    }));
  },
  summarizeArgs(args = {}) {
    return {
      command: String(args.command || ""),
      arg_count: Array.isArray(args.args) ? args.args.length : 0,
      cwd_length_chars: String(args.cwd || ".").length,
      timeout_ms: Number(args.timeout_ms || 60000),
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.job_id ? 1 : 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processStartTool };
