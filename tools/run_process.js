"use strict";

const {
  PROCESS_TOOL_ANNOTATIONS,
  SYNC_RUN_PROCESS_INPUT_SCHEMA,
  RUN_PROCESS_OUTPUT_SCHEMA,
} = require("../src/schemas/process_tools");
const { runProcess } = require("../src/util/process_runner");

const TOOL_NAME = "run_process";

function redactProcessResultArgs(result = {}) {
  if (!result || typeof result !== "object") return result;
  return {
    ...result,
    args: [],
  };
}

const runProcessTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Run bounded workspace process",
    description: "Run a SHORT allowlisted workspace process synchronously and return its output in this call. Hard ceiling: 90 seconds. This call holds the MCP request open for the whole job; Cloudflare's 125-second proxy read timeout can close longer silent responses and surface only an opaque transport error. For ANY job that may exceed 90 seconds — full test suites, multi-node pytest runs, builds, installs — use process_start and poll process_status/process_output instead; it is durable, survives disconnects, and allows up to 600 seconds.",
    inputSchema: SYNC_RUN_PROCESS_INPUT_SCHEMA,
    outputSchema: RUN_PROCESS_OUTPUT_SCHEMA,
    annotations: PROCESS_TOOL_ANNOTATIONS,
  },
  async execute(args = {}) {
    return redactProcessResultArgs(await runProcess(args));
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

module.exports = { redactProcessResultArgs, runProcessTool };
