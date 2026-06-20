"use strict";

function assertCodeSampleJsSelfTest(codeSampleTool) {
  if (!codeSampleTool) {
    return;
  }

  const output = codeSampleTool.execute({
    path: "src/runtime/mcp_runtime_handlers.js",
    search: "handleRpcMessage",
    extract: "block",
    max_chars: 12000,
  });

  if (!output.success) {
    throw new Error(`code_sample_js self-test failed: ${output.note || "unknown error"}`);
  }

  if (output.path !== "src/runtime/mcp_runtime_handlers.js") {
    throw new Error("code_sample_js self-test path mismatch");
  }

  if (output.identifier !== "handleRpcMessage") {
    throw new Error("code_sample_js self-test identifier mismatch");
  }

  if (!output.code.includes("async function handleRpcMessage")) {
    throw new Error("code_sample_js self-test did not extract handleRpcMessage");
  }

  if (output.startLine < 1 || output.endLine < output.startLine) {
    throw new Error("code_sample_js self-test invalid line range");
  }
}

module.exports = {
  assertCodeSampleJsSelfTest,
};
