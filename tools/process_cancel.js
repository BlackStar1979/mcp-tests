"use strict";

const {
  PROCESS_CANCEL_INPUT_SCHEMA,
  PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
  PROCESS_TOOL_ANNOTATIONS,
} = require("../src/schemas/process_tools");
const {
  resolveProcessJobManager,
  resolveProcessJobOwner,
} = require("../src/util/process_job_manager");

const TOOL_NAME = "process_cancel";

const processCancelTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Cancel process job",
    description: "Cancel an owned queued process job or terminate its running process tree, returning terminal state only after tree termination completes.",
    inputSchema: PROCESS_CANCEL_INPUT_SCHEMA,
    outputSchema: PROCESS_JOB_STATUS_OUTPUT_SCHEMA,
    annotations: PROCESS_TOOL_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return resolveProcessJobManager(context).cancel(
      args.job_id,
      args.reason || "cancelled",
      { ownerId: resolveProcessJobOwner(context) }
    );
  },
  summarizeArgs(args = {}) {
    return {
      job_id: String(args.job_id || ""),
      reason_length_chars: String(args.reason || "cancelled").length,
    };
  },
  resultStats(payload = {}) {
    return { result_count: payload.job_id ? 1 : 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processCancelTool };
