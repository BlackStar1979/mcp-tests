"use strict";

const {
  PROCESS_TOOL_ANNOTATIONS,
  RUN_PROCESS_TOOL_OUTPUT_SCHEMA,
  SYNC_TIMEOUT_CEILING_MS,
  TASK_AWARE_RUN_PROCESS_INPUT_SCHEMA,
} = require("../src/schemas/process_tools");
const { runProcess } = require("../src/util/process_runner");

const TOOL_NAME = "run_process";

const runProcessTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Run bounded workspace process",
    description: "Execute an allowlisted workspace process. A 2026-07-28 client declaring io.modelcontextprotocol/tasks receives a durable MCP Task backed by the existing process registry, up to 600 seconds. Other clients use the synchronous fallback, which is limited to 90 seconds below Cloudflare's proxy read timeout. Task results deliberately omit raw args, env, and trace metadata from durable state.",
    inputSchema: TASK_AWARE_RUN_PROCESS_INPUT_SCHEMA,
    outputSchema: RUN_PROCESS_TOOL_OUTPUT_SCHEMA,
    annotations: PROCESS_TOOL_ANNOTATIONS,
  },
  execute(args = {}) {
    const timeoutMs = Number(args.timeout_ms || 60000);
    if (timeoutMs > SYNC_TIMEOUT_CEILING_MS) {
      const error = new Error("run_process calls above 90 seconds require negotiated MCP Tasks.");
      error.code = "process_tasks_capability_required";
      throw error;
    }
    const { idempotency_key: _idempotencyKey, ...syncArgs } = args;
    return runProcess(syncArgs);
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
