"use strict";

const {
  CODE_ROLLBACK_PATCH_INPUT_SCHEMA,
  CODE_ROLLBACK_PATCH_OUTPUT_SCHEMA,
  STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
} = require("../src/schemas/code_mutation_tools");
const { executeCodeRollbackPatch } = require("../src/util/code_mutation_tools");

const TOOL_NAME = "code_rollback_patch";

const codeRollbackPatchTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Rollback code patch",
    description: "Restore a previously committed code patch using its ledger operation_id.",
    inputSchema: CODE_ROLLBACK_PATCH_INPUT_SCHEMA,
    outputSchema: CODE_ROLLBACK_PATCH_OUTPUT_SCHEMA,
    annotations: STATE_CHANGING_CODE_MUTATION_ANNOTATIONS,
  },
  execute(args = {}) {
    return executeCodeRollbackPatch(args);
  },
  summarizeArgs(args = {}) {
    return {
      operation_id_length_chars: String(args.operation_id || "").length,
      confirm: args.confirm === true,
    };
  },
  resultStats(payload = {}) {
    return {
      result_count: payload.applied ? 1 : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = { codeRollbackPatchTool };
