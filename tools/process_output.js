"use strict";

const {
  PROCESS_OUTPUT_INPUT_SCHEMA,
  PROCESS_OUTPUT_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  processToolOutputSchema,
} = require("../src/schemas/process_tools");
const { executeProcessTool } = require("../src/util/process_tool_errors");
const {
  resolveProcessJobManager,
  resolveProcessJobOwner,
} = require("../src/util/process_job_manager");

const TOOL_NAME = "process_output";

const processOutputTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read process job output",
    description: "Read bounded cursor-based stdout and stderr chunks for one OAuth-client-bound durable process job, including after restart.",
    inputSchema: PROCESS_OUTPUT_INPUT_SCHEMA,
    outputSchema: processToolOutputSchema(PROCESS_OUTPUT_OUTPUT_SCHEMA),
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return executeProcessTool(() => resolveProcessJobManager(context).output(args.job_id, args, {
      ownerId: resolveProcessJobOwner(context),
    }));
  },
  summarizeArgs(args = {}) {
    return {
      job_id: String(args.job_id || ""),
      stdout_offset: Number(args.stdout_offset || 0),
      stderr_offset: Number(args.stderr_offset || 0),
      max_chars: Number(args.max_chars || 65536),
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.job_id ? 1 : 0,
      result_chars: String(payload.stdout || "").length + String(payload.stderr || "").length,
    };
  },
};

module.exports = { processOutputTool };
