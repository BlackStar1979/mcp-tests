const { getAuthTransitionStatus } = require("./auth_transition");
const { runBearerDryRun } = require("./auth_bearer_dry_run");
const { getModularAuthParityStatus } = require("./auth_modular_parity");

const AUTH_BEARER_CUTOVER_GUARD_VERSION = "test-mcp-bearer-cutover-guard-v1";

function buildRollbackPlan() {
  return [
    "Stop TEST MCP bearer-mode process.",
    "Restart TEST MCP with MCP_TEST_AUTH_MODE=none only for emergency recovery.",
    "Refresh or recreate TEST MCP connector without bearer credentials if rolling back.",
    "Run test_mcp_runtime_status and verify auth.mode=none, security_boundary.status=ok.",
    "Run descriptor/profile policy audits after rollback.",
  ];
}

function buildCutoverPlan() {
  return [
    "Create a token file outside public docs and outside committed sources.",
    "Set restrictive permissions on the token file.",
    "Start TEST MCP with MCP_TEST_AUTH_MODE=bearer and MCP_TEST_TOKEN_FILE=<token-file>.",
    "Configure credential delivery with Authorization: Bearer <token>.",
    "Query-token delivery is disabled by default and requires a separate explicit local/dev flag if ever used.",
    "Verify missing token returns 401 missing_bearer_token with Bearer challenge.",
    "Verify invalid token returns 401 invalid_bearer_token with Bearer challenge.",
    "Verify valid Authorization header token returns 200.",
    "Refresh TEST MCP connector and verify tools/list succeeds.",
    "Run test_mcp_runtime_status and verify auth.mode=bearer, requires_auth=true, token_loaded=true.",
    "Run descriptor/profile policy audits and the current auth smoke suite.",
  ];
}

function getBearerCutoverGuard() {
  const transition = getAuthTransitionStatus();
  const dryRun = runBearerDryRun();
  const parity = getModularAuthParityStatus();
  const blockers = [];
  const warnings = [];

  if (!transition.bearer_implementation_present) blockers.push("bearer implementation missing");
  if (!transition.auth_policy_present) blockers.push("auth policy missing");
  if (!transition.bearer_ready_for_dry_run) blockers.push("bearer dry-run prerequisites are not ready");
  if (!transition.bearer_header_ready) blockers.push("bearer Authorization header delivery is not ready");
  if (!parity.access_cloudflare_ready) warnings.push("access Cloudflare assertion parity is not ready");
  if (!dryRun.success) blockers.push("bearer dry-run failed");
  if (!transition.token_file_configured) blockers.push("MCP_TEST_TOKEN_FILE is not configured");
  if (!transition.token_file_exists) blockers.push("MCP_TEST_TOKEN_FILE does not point to an existing file");
  if (transition.current_auth_mode === "none") warnings.push("active runtime is still auth.none; this guard intentionally does not change it");
  warnings.push("query-token delivery is disabled by default; Authorization header delivery is required unless separately allowed for local/dev.");

  const externalOperatorSteps = [
    "operator must create and protect a real token file outside the repository",
    "operator must start the server with MCP_TEST_AUTH_MODE=bearer and MCP_TEST_TOKEN_FILE=<token-file>",
    "operator must configure Authorization header credential delivery",
    "operator must verify rollback instructions before cutover",
  ];

  const rollbackPlan = buildRollbackPlan();
  const cutoverPlan = buildCutoverPlan();
  const cutoverAllowedNow = blockers.length === 0 && dryRun.success === true && rollbackPlan.length > 0;

  return {
    success: true,
    error: "",
    mode: "auth-bearer-cutover-guard",
    version: AUTH_BEARER_CUTOVER_GUARD_VERSION,
    current_auth_mode: transition.current_auth_mode,
    cutover_allowed_now: cutoverAllowedNow,
    cutover_recommended_now: false,
    access_cloudflare_ready: transition.access_cloudflare_ready === true,
    bearer_header_ready: transition.bearer_header_ready === true,
    bearer_query_ready: false,
    bearer_query_disabled_by_default: true,
    bearer_dry_run_success: dryRun.success === true,
    bearer_ready_for_dry_run: transition.bearer_ready_for_dry_run === true,
    bearer_ready_for_active_switch: transition.bearer_ready_for_active_switch === true,
    token_file_configured: transition.token_file_configured === true,
    token_file_exists: transition.token_file_exists === true,
    token_path_disclosed: false,
    token_disclosed: false,
    connector_bearer_credential_verified: false,
    connector_bearer_credential_verification_scope: "external-client-ui-action",
    recommended_chatgpt_direct_delivery: "authorization_bearer_header",
    recommended_header_capable_client_delivery: "authorization_bearer_header",
    blockers,
    warnings,
    external_operator_steps: externalOperatorSteps,
    cutover_plan: cutoverPlan,
    rollback_plan: rollbackPlan,
    dry_run_summary: {
      missing_rejected_401: dryRun.missing_rejected_401 === true,
      invalid_rejected_401: dryRun.invalid_rejected_401 === true,
      valid_accepted_200: dryRun.valid_accepted_200 === true,
      invalid_query_rejected_401: dryRun.invalid_query_rejected_401 === true,
      valid_query_rejected_401: dryRun.valid_query_rejected_401 === true,
      accepts_query_token_disabled_by_default: dryRun.accepts_query_token_disabled_by_default === true,
      challenge_present: dryRun.challenge_present === true,
      active_auth_mode_unchanged: dryRun.active_auth_mode_unchanged === true,
      temp_token_removed: dryRun.temp_token_removed === true,
      temp_dir_removed: dryRun.temp_dir_removed === true,
      token_disclosed: dryRun.token_disclosed === true,
      token_path_disclosed: dryRun.token_path_disclosed === true,
    },
    explicit_non_scope: {
      changes_active_auth_mode: false,
      writes_secret: false,
      writes_token_file: false,
      discloses_token_path: false,
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
  AUTH_BEARER_CUTOVER_GUARD_VERSION,
  getBearerCutoverGuard,
};
