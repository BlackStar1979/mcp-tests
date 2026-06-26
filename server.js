/* Minimal MCP test server for ChatGPT connector response-shape testing.
 *
 * Purpose:
 * - TEST MCP canary server.
 * - Port defaults depend on auth mode: 3009 none, 3008 oauth21, 3007 legacy oauth.
 * - Tool surface is profile/auth controlled; see SERVER_TOOLS_SPEC.json and SERVER_RUNTIME_CONFIG_SPEC.json.
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
 * Runtime configuration:
 *   see SERVER_RUNTIME_CONFIG_SPEC.json
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
