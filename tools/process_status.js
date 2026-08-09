"use strict";

const {
  PROCESS_JOB_ID_INPUT_SCHEMA,
  PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
} = require("../src/schemas/process_tools");
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
    description: "Read bounded lifecycle and output metadata for one OAuth-client-bound in-memory process job without returning output bodies.",
    inputSchema: PROCESS_JOB_ID_INPUT_SCHEMA,
    outputSchema: PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return resolveProcessJobManager(context).status(args.job_id, {
      ownerId: resolveProcessJobOwner(context),
    });
  },
  summarizeArgs(args = {}) {
    return { job_id: String(args.job_id || "") };
  },
  resultStats(payload = {}) {
    return { result_count: payload.job_id ? 1 : 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processStatusTool };
