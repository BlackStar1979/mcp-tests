const { DEV_CODE_SYMBOLS_INPUT_SCHEMA, DEV_CODE_SYMBOLS_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { codeSymbols } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_symbols";

async function execute(args = {}) {
  try {
    const payload = await codeSymbols(args.path);
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, path: String(args.path || ""), language: "", bytes: 0, total_lines: 0, symbol_count: 0, truncated: false, symbols: [], error: error?.message || String(error) };
  }
}

const devCodeSymbolsTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Extract developer code symbols",
    description: "Read-only bounded structural symbol extraction for JS/TS/Python files in TEST MCP workspace.",
    inputSchema: DEV_CODE_SYMBOLS_INPUT_SCHEMA,
    outputSchema: DEV_CODE_SYMBOLS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) { return { result_count: payload.symbol_count || 0, result_chars: JSON.stringify(payload || {}).length }; },
};

module.exports = { devCodeSymbolsTool };
