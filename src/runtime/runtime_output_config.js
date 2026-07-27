"use strict";

const VALID_OUTPUT_MODES = new Set(["structured", "content-only"]);

class RuntimeOutputConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuntimeOutputConfigError";
    this.code = "invalid_runtime_output_config";
    this.exitCode = 2;
  }
}

function resolveRuntimeOutputConfig(env = process.env) {
  const outputMode = String(env.MCP_TEST_OUTPUT_MODE || "structured")
    .trim()
    .toLowerCase();
  if (!VALID_OUTPUT_MODES.has(outputMode)) {
    throw new RuntimeOutputConfigError(
      `Invalid MCP_TEST_OUTPUT_MODE: ${outputMode}\nAllowed values: structured, content-only`
    );
  }

  const maxFetchTextChars = Number(env.MCP_TEST_FETCH_CAP_CHARS || 2500);
  if (!Number.isInteger(maxFetchTextChars) || maxFetchTextChars < 100) {
    throw new RuntimeOutputConfigError(
      `Invalid MCP_TEST_FETCH_CAP_CHARS: ${env.MCP_TEST_FETCH_CAP_CHARS}\nExpected integer >= 100.`
    );
  }

  return Object.freeze({ outputMode, maxFetchTextChars });
}

module.exports = {
  RuntimeOutputConfigError,
  resolveRuntimeOutputConfig,
};
