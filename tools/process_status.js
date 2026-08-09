"use strict";

const {
  PROCESS_JOB_ID_INPUT_SCHEMA,
  PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  processToolOutputSchema,
} = require("../src/schemas/process_tools");
const { executeProcessTool } = require("../src/util/process_tool_errors");
const {
  resolveProcessJobManager,
  resolveProcessJobOwner,
} = require("../src/util/process_job_manager");

const TOOL_NAME = "process_status";

const processStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Read process job status",
    description: "Read bounded SQLite-backed lifecycle and output metadata for one OAuth-client-bound process job, including after restart.",
    inputSchema: PROCESS_JOB_ID_INPUT_SCHEMA,
    outputSchema: processToolOutputSchema(PROCESS_JOB_STATUS_OUTPUT_SCHEMA),
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return executeProcessTool(() => resolveProcessJobManager(context).status(args.job_id, {
      ownerId: resolveProcessJobOwner(context),
    }));
  },
  summarizeArgs(args = {}) {
    return { job_id: String(args.job_id || "") };
  },
  resultStats(payload = {}) {
    return { result_count: payload.job_id ? 1 : 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processStatusTool };
