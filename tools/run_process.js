"use strict";

const {
  PROCESS_TOOL_ANNOTATIONS,
  RUN_PROCESS_INPUT_SCHEMA,
  RUN_PROCESS_OUTPUT_SCHEMA,
} = require("../src/schemas/process_tools");
const { runProcess } = require("../src/util/process_runner");

const TOOL_NAME = "run_process";

const runProcessTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Run bounded workspace process",
    description: "Run an allowlisted local process inside an allowed workspace root with pinned executable resolution, combined bounded output, timeout, and restrictive environment policy.",
    inputSchema: RUN_PROCESS_INPUT_SCHEMA,
    outputSchema: RUN_PROCESS_OUTPUT_SCHEMA,
    annotations: PROCESS_TOOL_ANNOTATIONS,
  },
  execute(args = {}) {
    return runProcess(args);
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
    return {
      result_count: payload.status ? 1 : 0,
      result_chars: Number(String(payload.stdout || "").length + String(payload.stderr || "").length),
    };
  },
};

module.exports = { runProcessTool };
