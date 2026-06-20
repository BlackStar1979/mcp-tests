const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { authResponseHeaders, createAuthPolicy, summarizeAuthFailure } = require("../src/auth/auth_policy");
const { sha256 } = require("../src/auth/auth_bearer");

const AUTH_BEARER_DRY_RUN_VERSION = "test-mcp-bearer-dry-run-v1";
const SYNTHETIC_TOKEN = "test-mcp-bearer-dry-run-token-0123456789abcdef";
const INVALID_TOKEN = "test-mcp-bearer-dry-run-invalid-0123456789abc";

function reqWithAuthHeader(value) {
  return { headers: value ? { authorization: value } : {}, url: "/mcp" };
}

function reqWithQueryToken(value) {
  return { headers: {}, url: value ? `/mcp?token=${encodeURIComponent(value)}` : "/mcp" };
}

function safeUnlink(filePath) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (_) {
    return false;
  }
}

function createTempTokenFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-bearer-dry-run-"));
  const file = path.join(dir, `token-${crypto.randomBytes(8).toString("hex")}.txt`);
  fs.writeFileSync(file, SYNTHETIC_TOKEN, { encoding: "utf8", mode: 0o600 });
  return { dir, file };
}

function cleanupTempTokenFile(temp) {
  const token_removed = safeUnlink(temp.file);
  let dir_removed = false;
  try {
    fs.rmdirSync(temp.dir);
    dir_removed = true;
  } catch (_) {
    dir_removed = false;
  }
  return { token_removed, dir_removed };
}

function runBearerDryRun() {
  const activeAuthModeBefore = String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase();
  const temp = createTempTokenFile();
  const tokenHashPrefix = sha256(SYNTHETIC_TOKEN).slice(0, 12);
  let cleanup = { token_removed: false, dir_removed: false };

  try {
    const policy = createAuthPolicy({ mode: "bearer", tokenFile: temp.file });
    const headers = authResponseHeaders(policy);
    const missing = policy.authenticate(reqWithAuthHeader(""));
    const invalid = policy.authenticate(reqWithAuthHeader(`Bearer ${INVALID_TOKEN}`));
    const valid = policy.authenticate(reqWithAuthHeader(`Bearer ${SYNTHETIC_TOKEN}`));
    const invalidQuery = policy.authenticate(reqWithQueryToken(INVALID_TOKEN));
    const validQuery = policy.authenticate(reqWithQueryToken(SYNTHETIC_TOKEN));
    const status = policy.status();
    cleanup = cleanupTempTokenFile(temp);

    const missingSummary = summarizeAuthFailure(missing);
    const invalidSummary = summarizeAuthFailure(invalid);
    const validSummary = summarizeAuthFailure(valid);
    const invalidQuerySummary = summarizeAuthFailure(invalidQuery);
    const validQuerySummary = summarizeAuthFailure(validQuery);

    const checks = {
      bearer_policy_created: policy.mode === "bearer" && policy.enabled === true && policy.requiresAuth === true,
      bearer_status_safe: status.mode === "bearer" && status.requires_auth === true && status.token_loaded === true,
      accepts_authorization_bearer: status.accepts_authorization_bearer === true,
      accepts_query_token_disabled_by_default: status.accepts_query_token === false,
      challenge_present: headers["www-authenticate"] === 'Bearer realm="mcp-tests"',
      missing_rejected_401: missing.ok === false && missing.status === 401 && missing.error === "missing_bearer_token",
      invalid_rejected_401: invalid.ok === false && invalid.status === 401 && invalid.error === "invalid_bearer_token",
      valid_accepted_200: valid.ok === true && valid.status === 200 && valid.error === "",
      invalid_query_rejected_401: invalidQuery.ok === false && invalidQuery.status === 401 && invalidQuery.error === "missing_bearer_token",
      valid_query_rejected_401: validQuery.ok === false && validQuery.status === 401 && validQuery.error === "missing_bearer_token",
      active_auth_mode_unchanged: String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase() === activeAuthModeBefore,
      temp_token_removed: cleanup.token_removed === true,
      temp_dir_removed: cleanup.dir_removed === true,
    };

    const failures = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);

    return {
      success: failures.length === 0,
      error: failures.join("; "),
      mode: "auth-bearer-dry-run",
      version: AUTH_BEARER_DRY_RUN_VERSION,
      active_auth_mode_before: activeAuthModeBefore,
      active_auth_mode_after: String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase(),
      bearer_policy_created: checks.bearer_policy_created,
      bearer_status_safe: checks.bearer_status_safe,
      accepts_authorization_bearer: checks.accepts_authorization_bearer,
      accepts_query_token: status.accepts_query_token === true,
      accepts_query_token_disabled_by_default: checks.accepts_query_token_disabled_by_default,
      challenge_present: checks.challenge_present,
      missing_rejected_401: checks.missing_rejected_401,
      invalid_rejected_401: checks.invalid_rejected_401,
      valid_accepted_200: checks.valid_accepted_200,
      invalid_query_rejected_401: checks.invalid_query_rejected_401,
      valid_query_rejected_401: checks.valid_query_rejected_401,
      active_auth_mode_unchanged: checks.active_auth_mode_unchanged,
      temp_token_removed: checks.temp_token_removed,
      temp_dir_removed: checks.temp_dir_removed,
      token_path_disclosed: false,
      token_disclosed: false,
      token_sha256_prefix: tokenHashPrefix,
      token_length: SYNTHETIC_TOKEN.length,
      response_headers_checked: ["www-authenticate"],
      missing_result: missingSummary,
      invalid_result: invalidSummary,
      valid_result: validSummary,
      invalid_query_result: invalidQuerySummary,
      valid_query_result: validQuerySummary,
      failures,
      explicit_non_scope: {
        changes_active_auth_mode: false,
        writes_repo_secret: false,
        writes_persistent_token_file: false,
        changes_connector_url: false,
        enables_oauth: false,
        removes_auth_none: false,
      },
    };
  } catch (error) {
    cleanup = cleanupTempTokenFile(temp);
    return {
      success: false,
      error: error?.message || String(error),
      mode: "auth-bearer-dry-run",
      version: AUTH_BEARER_DRY_RUN_VERSION,
      active_auth_mode_before: activeAuthModeBefore,
      active_auth_mode_after: String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase(),
      token_path_disclosed: false,
      token_disclosed: false,
      temp_token_removed: cleanup.token_removed,
      temp_dir_removed: cleanup.dir_removed,
      failures: ["dry_run_exception"],
      explicit_non_scope: {
        changes_active_auth_mode: false,
        writes_repo_secret: false,
        writes_persistent_token_file: false,
        changes_connector_url: false,
        enables_oauth: false,
        removes_auth_none: false,
      },
    };
  }
}

module.exports = {
  AUTH_BEARER_DRY_RUN_VERSION,
  runBearerDryRun,
};
