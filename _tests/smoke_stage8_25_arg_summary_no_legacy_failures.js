const assert = require("node:assert/strict");

const tools = [
  ["devCodeAuditTool", require("../tools/dev_code_audit").devCodeAuditTool, { path: "server.js" }],
  ["devCodeDependenciesTool", require("../tools/dev_code_dependencies").devCodeDependenciesTool, { path: "server.js" }],
  ["devCodeImpactTool", require("../tools/dev_code_impact").devCodeImpactTool, { path: "src", target: "src/runtime_status.js" }],
  ["devCodeLocateTool", require("../tools/dev_code_locate").devCodeLocateTool, { path: "server.js", query: "getRuntimeStatus", mode: "identifier" }],
  ["devCodeSymbolsTool", require("../tools/dev_code_symbols").devCodeSymbolsTool, { path: "server.js" }],
  ["devCodeSyntaxCheckTool", require("../tools/dev_code_syntax_check").devCodeSyntaxCheckTool, { path: "server.js" }],
  ["fsGetPublicInfoTool", require("../tools/fs_get_public_info").fsGetPublicInfoTool, { path: "." }],
  ["fsListPublicTool", require("../tools/fs_list_public").fsListPublicTool, { path: "." }],
  ["fsReadPublicChunkTool", require("../tools/fs_read_public_chunk").fsReadPublicChunkTool, { path: "sample.txt" }],
  ["fsReadPublicLinesTool", require("../tools/fs_read_public_lines").fsReadPublicLinesTool, { path: "sample.txt" }],
  ["fsReadPublicTextTool", require("../tools/fs_read_public_text").fsReadPublicTextTool, { path: "sample.txt" }],
];

for (const [name, tool, args] of tools) {
  assert.equal(typeof tool.summarizeArgs, "function", `${name} summarizeArgs missing`);
  const summary = tool.summarizeArgs(args);
  assert.equal(summary.success, undefined, `${name} must not return success:false in arg summary`);
  assert.equal(summary.error, undefined, `${name} must not return error in arg summary`);
  assert.equal(summary.error_kind, undefined, `${name} must not return error_kind in arg summary`);
  assert.equal(summary.arg_summary_status, undefined, `${name} should let runtime normalize status to ok`);
  assert.equal(typeof summary.arg_sha256, "string", `${name} should return arg hash`);
  assert.equal(typeof summary.arg_length_chars, "number", `${name} should return char length`);
  assert.equal(summary.raw_value_redacted, true, `${name} must mark raw value redacted`);
}

console.log("smoke_stage8_25_arg_summary_no_legacy_failures ok");
