const {
  CODE_RUNTIME_MAP_OUTPUT_SCHEMA,
  EMPTY_INPUT_SCHEMA,
  READ_ONLY_TRUTH_ANNOTATIONS,
} = require("../src/schemas/truth_tools");
const { buildCodeRuntimeMap } = require("../src/truth/code_runtime_map");

const TOOL_NAME = "code_runtime_map";

async function execute() {
  return buildCodeRuntimeMap();
}

const codeRuntimeMapTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Code runtime map",
    description: "Read-only map of runtime entrypoints, truth modules, canonical docs, guards, and control-plane links.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: CODE_RUNTIME_MAP_OUTPUT_SCHEMA,
    annotations: READ_ONLY_TRUTH_ANNOTATIONS,
  },
  execute,
  summarizeArgs() {
    return { operation: TOOL_NAME };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.missing) ? payload.missing.length : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  codeRuntimeMapTool,
};
