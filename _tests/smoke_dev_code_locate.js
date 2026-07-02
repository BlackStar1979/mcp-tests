const assert = require("node:assert/strict");
const { locateCode } = require("../src/util/code_workspace");
const { devCodeLocateTool } = require("../tools/dev_code_locate");

(async () => {
  const literal = await locateCode("src/runtime/runtime_status_assembly.js", "createRuntimeStatusProvider", {
    mode: "literal",
    max_matches: 10,
    include_preview: true,
    preview_chars: 120,
  });
  assert.equal(literal.path, "src/runtime/runtime_status_assembly.js");
  assert.equal(literal.success, undefined);
  assert.ok(literal.match_count >= 1);
  assert.ok(literal.total_matches_estimate >= literal.match_count);
  assert.ok(literal.matches[0].line > 0);
  assert.ok(literal.matches[0].column > 0);
  assert.equal(typeof literal.matches[0].line_sha256_prefix, "string");
  assert.ok(literal.matches[0].preview.length <= 120);

  const identifier = await locateCode("src/runtime_status.js", "buildRuntimeStatus", {
    mode: "identifier",
    max_matches: 5,
  });
  assert.equal(identifier.path, "src/runtime_status.js");
  assert.ok(identifier.match_count >= 1);
  assert.ok(identifier.matches.every((match) => match.line > 0 && match.column > 0));

  const noPreview = await locateCode("src/runtime_status.js", "buildRuntimeStatus", {
    mode: "identifier",
    max_matches: 1,
    include_preview: false,
  });
  assert.equal(noPreview.matches[0].preview, "");

  const toolResult = await devCodeLocateTool.execute({
    path: "src/runtime/server_bootstrap_runtime.js",
    query: "getRuntimeStatus",
    mode: "identifier",
    max_matches: 5,
  });
  assert.equal(toolResult.success, true);
  assert.equal(toolResult.error, "");
  assert.ok(toolResult.match_count >= 1);

  const badResult = await devCodeLocateTool.execute({ path: "server.js", query: "" });
  assert.equal(badResult.success, false);
  assert.match(badResult.error, /Query is required/);

  assert.equal(devCodeLocateTool.descriptor.name, "dev_code_locate");
  assert.equal(devCodeLocateTool.descriptor.inputSchema.type, "object");
  assert.ok(devCodeLocateTool.descriptor.inputSchema.required.includes("path"));
  assert.ok(devCodeLocateTool.descriptor.inputSchema.required.includes("query"));

  console.log("smoke_dev_code_locate ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
