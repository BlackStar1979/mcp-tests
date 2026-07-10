"use strict";

const {
  CODE_ORCHESTRATE_INPUT_SCHEMA,
  CODE_ORCHESTRATE_OUTPUT_SCHEMA,
  READ_ONLY_CODE_MUTATION_ORCHESTRATION_ANNOTATIONS,
} = require("../src/schemas/code_mutation_tools");
const { executeCodeOrchestrate } = require("../src/util/code_mutation_tools");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "code_orchestrate";

const codeOrchestrateTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Orchestrate code change",
    description: "Build a deterministic plan-only orchestration for a code change without modifying files.",
    inputSchema: CODE_ORCHESTRATE_INPUT_SCHEMA,
    outputSchema: CODE_ORCHESTRATE_OUTPUT_SCHEMA,
    annotations: READ_ONLY_CODE_MUTATION_ORCHESTRATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return executeCodeOrchestrate(args);
  },
  summarizeArgs(args = {}) {
    return safeArgSummary(`${args.path || ""}:${args.target || ""}:${args.intent || "refactor"}`);
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.plan) ? payload.plan.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { codeOrchestrateTool };
