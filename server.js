/* Minimal MCP test server for ChatGPT connector response-shape testing.
 *
 * Purpose:
 * - TEST MCP canary server.
 * - Port 3009 by default.
 * - Exposes only search/fetch.
 * - Supports A/B response-shape testing:
 *   - structured: outputSchema + structuredContent + content[0].text JSON
 *   - content-only: no outputSchema, no structuredContent, content[0].text JSON only
 * - Adds local JSONL audit logging without storing raw sensitive arguments.
 * - Self-test now also enforces exact read-only annotations and strict search outputSchema.
 *
 * Run:
 *   node C:\Work\mcp-tests\server.js
 *
 * Self-test:
 *   node C:\Work\mcp-tests\server.js --self-test
 *
 * Optional old strict mode:
 *   set MCP_TEST_OUTPUT_MODE=content-only
 *
 * Audit log:
 *   C:\Work\mcp-tests\_logs\.mcp-tests-audit.jsonl
 */

const { runServerBootstrapRuntime } = require("./src/runtime/server_bootstrap_runtime");

try {
  runServerBootstrapRuntime({
    argv: process.argv,
    env: process.env,
    rootDir: __dirname,
  });
} catch (error) {
  console.error(`MCP TEST SERVER FAILED: ${error && error.message ? error.message : String(error)}`);
  process.exitCode = 1;
}
