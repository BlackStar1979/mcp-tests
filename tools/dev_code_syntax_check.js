const { DEV_CODE_SYNTAX_INPUT_SCHEMA, DEV_CODE_SYNTAX_OUTPUT_SCHEMA, READ_ONLY_DEV_ANNOTATIONS } = require("../src/schemas/dev_tools");
const { syntaxCheck } = require("../src/util/code_workspace");
const { safeArgSummary } = require("../src/util/path_policy");

const TOOL_NAME = "dev_code_syntax_check";

async function execute(args = {}) {
  try {
    const payload = await syntaxCheck(args.path);
    return { success: true, error: "", ...payload };
  } catch (error) {
    return { success: false, path: String(args.path || ""), language: "", checker: "", ok: false, exit_code: null, timed_out: false, duration_ms: 0, stdout: "", stderr: "", error: error?.message || String(error) };
  }
}

const devCodeSyntaxCheckTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Validate developer code syntax",
    description: "Validate syntax of one bounded JS/CJS/MJS or Python file without writing changes.",
    inputSchema: DEV_CODE_SYNTAX_INPUT_SCHEMA,
    outputSchema: DEV_CODE_SYNTAX_OUTPUT_SCHEMA,
    annotations: READ_ONLY_DEV_ANNOTATIONS,
  },
  execute,
  summarizeArgs(args = {}) { return safeArgSummary(args.path || ""); },
  resultStats(payload = {}) { return { result_count: payload.ok ? 1 : 0, result_chars: String(payload.stderr || payload.stdout || "").length }; },
};

module.exports = { devCodeSyntaxCheckTool };
