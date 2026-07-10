"use strict";

const {
  TOOL_DISPATCH_INPUT_SCHEMA,
  TOOL_DISPATCH_OUTPUT_SCHEMA,
  STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/code_mutation_tools");
const { executeToolDispatch } = require("../src/util/code_mutation_tools");

const TOOL_NAME = "tool_dispatch";

const toolDispatchTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Dispatch bounded tool runtime",
    description: "Dispatch a bounded code_analysis operation through one connector-visible entrypoint. Supports planning and guarded patch flows.",
    inputSchema: TOOL_DISPATCH_INPUT_SCHEMA,
    outputSchema: TOOL_DISPATCH_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return executeToolDispatch(args);
  },
  summarizeArgs(args = {}) {
    const input = args.input && typeof args.input === "object" ? args.input : {};
    return {
      tool: String(args.tool || ""),
      operation: String(input.operation || ""),
      has_target: typeof input.target === "string" && input.target.length > 0,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.result ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { toolDispatchTool };
