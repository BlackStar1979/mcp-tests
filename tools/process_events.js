"use strict";

const {
  PROCESS_EVENTS_INPUT_SCHEMA,
  PROCESS_EVENTS_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  processToolOutputSchema,
} = require("../src/schemas/process_tools");
const { executeProcessTool } = require("../src/util/process_tool_errors");
const { resolveProcessJobOwner } = require("../src/util/process_job_owner");
const { resolveProcessJobManager } = require("../src/util/process_job_manager");

const processEventsTool = {
  name: "process_events",
  descriptor: {
    name: "process_events",
    title: "Read durable process job events",
    description: "Read the bounded append-only SQLite transition history for one process job owned by the authenticated OAuth client.",
    inputSchema: PROCESS_EVENTS_INPUT_SCHEMA,
    outputSchema: processToolOutputSchema(PROCESS_EVENTS_OUTPUT_SCHEMA),
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return executeProcessTool(() => resolveProcessJobManager(context).events(
      args.job_id,
      args,
      { ownerId: resolveProcessJobOwner(context) }
    ));
  },
  summarizeArgs(args = {}) {
    return { job_id: String(args.job_id || ""), limit: Number(args.limit || 50) };
  },
  resultStats(payload = {}) {
    return { result_count: payload.events?.length || 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processEventsTool };
