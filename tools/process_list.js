"use strict";

const {
  PROCESS_LIST_INPUT_SCHEMA,
  PROCESS_LIST_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
  processToolOutputSchema,
} = require("../src/schemas/process_tools");
const { executeProcessTool } = require("../src/util/process_tool_errors");
const { resolveProcessJobOwner } = require("../src/util/process_job_owner");
const { resolveProcessJobManager } = require("../src/util/process_job_manager");

const processListTool = {
  name: "process_list",
  descriptor: {
    name: "process_list",
    title: "List durable process jobs",
    description: "List bounded SQLite-backed process jobs owned by the authenticated OAuth client, including jobs recovered after restart.",
    inputSchema: PROCESS_LIST_INPUT_SCHEMA,
    outputSchema: processToolOutputSchema(PROCESS_LIST_OUTPUT_SCHEMA),
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute(args = {}, context = {}) {
    return executeProcessTool(() => resolveProcessJobManager(context).list(args, { ownerId: resolveProcessJobOwner(context) }));
  },
  summarizeArgs(args = {}) {
    return { status: String(args.status || ""), limit: Number(args.limit || 20) };
  },
  resultStats(payload = {}) {
    return { result_count: payload.jobs?.length || 0, result_chars: JSON.stringify(payload).length };
  },
};

module.exports = { processListTool };
