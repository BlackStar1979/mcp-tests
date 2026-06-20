const fs = require("node:fs");
const path = require("node:path");
const { getModularAuthParityStatus } = require("./auth_modular_parity");

const AUTH_TRANSITION_VERSION = "test-mcp-auth-transition-v1";

function fileExists(filePath) {
  try {
    return Boolean(filePath) && fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch (_) {
    return false;
  }
}

function moduleExists(relativePath) {
  return fileExists(path.join(__dirname, "..", relativePath));
}

function getAuthTransitionStatus(options = {}) {
  const authMode = String(options.authMode || process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase();
  const tokenFile = String(options.tokenFile || process.env.MCP_TEST_TOKEN_FILE || "").trim();
  const bearerImplExists = moduleExists("src/auth/auth_bearer.js");
  const accessImplExists = moduleExists("src/auth/auth_access.js");
  const noneImplExists = moduleExists("src/auth/auth_none.js");
  const policyImplExists = moduleExists("src/auth/auth_policy.js");
  const tokenFileExists = fileExists(tokenFile);
  const parity = getModularAuthParityStatus();

  const blockers = [];
  const warnings = [];
  const nextSteps = [];

  if (!bearerImplExists) blockers.push("src/auth/auth_bearer.js is missing");
  if (!accessImplExists) blockers.push("src/auth/auth_access.js is missing");
  if (!policyImplExists) blockers.push("src/auth/auth_policy.js is missing");
  if (!parity.success) blockers.push(`modular auth parity failed: ${parity.error}`);
  if (authMode === "bearer" && !tokenFile) blockers.push("MCP_TEST_TOKEN_FILE is required when MCP_TEST_AUTH_MODE=bearer");
  if (authMode === "bearer" && tokenFile && !tokenFileExists) blockers.push("MCP_TEST_TOKEN_FILE does not point to an existing file");
  if (authMode === "none") warnings.push("active runtime still uses auth.none");
  if (authMode === "none") warnings.push("public TEST MCP should remain read-only/public_safe while auth.none is active");
  if (authMode !== "none" && authMode !== "bearer" && authMode !== "access") blockers.push(`unsupported auth mode: ${authMode}`);

  if (authMode === "none") {
    nextSteps.push("Create a token file outside public docs and outside committed sources for bearer direct mode.");
    nextSteps.push("For ChatGPT/direct connector, use bearer mode with /mcp?token=<token> when connector header configuration is unavailable.");
    nextSteps.push("Use Authorization: Bearer <token>; query-token delivery is disabled by default.");
    nextSteps.push("For Codex/Cloudflare mode, run modular MCP behind Cloudflare Access and rely on cf-access-jwt-assertion at the backend.");
    nextSteps.push("Start TEST MCP with MCP_TEST_AUTH_MODE=bearer and MCP_TEST_TOKEN_FILE=<token-file> in a controlled test run before cutover.");
    nextSteps.push("Refresh or recreate the connector with the correct credential delivery variant after runtime switch.");
    nextSteps.push("Document rollback to MCP_TEST_AUTH_MODE=none for emergency recovery only.");
  }

  const bearerReadyForDryRun = bearerImplExists && policyImplExists && parity.bearer_header_ready;
  const bearerReadyForActiveSwitch = bearerReadyForDryRun && Boolean(tokenFile) && tokenFileExists;

  return {
    success: blockers.length === 0,
    error: blockers.join("; "),
    mode: "auth-transition-status",
    version: AUTH_TRANSITION_VERSION,
    current_auth_mode: authMode,
    auth_none_present: noneImplExists,
    bearer_implementation_present: bearerImplExists,
    access_implementation_present: accessImplExists,
    auth_policy_present: policyImplExists,
    modular_auth_parity_version: parity.version,
    access_cloudflare_ready: parity.access_cloudflare_ready,
    bearer_header_ready: parity.bearer_header_ready,
    bearer_query_ready: parity.bearer_query_ready,
    bearer_ready_for_dry_run: bearerReadyForDryRun,
    bearer_ready_for_active_switch: bearerReadyForActiveSwitch,
    token_file_configured: Boolean(tokenFile),
    token_file_exists: tokenFileExists,
    token_file_path_disclosed: false,
    public_auth_none_exit_distance: bearerReadyForDryRun ? "very-near-but-requires-controlled-rollout" : "blocked-by-missing-implementation-or-parity",
    credential_delivery_variants: parity.credential_delivery_variants,
    blockers,
    warnings,
    no_auth_exit_workflow: nextSteps,
    explicit_non_scope: {
      changes_active_auth_mode: false,
      writes_secret: false,
      writes_token_file: false,
      changes_connector_url: false,
      configures_connector_credential: false,
      validates_cloudflare_jwt: false,
      handles_cf_access_client_secret: false,
      enables_oauth: false,
      removes_auth_none: false,
    },
  };
}

module.exports = {
  AUTH_TRANSITION_VERSION,
  getAuthTransitionStatus,
};
