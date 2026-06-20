const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createAccessAuth, ACCESS_ASSERTION_HEADER } = require("../src/auth/auth_access");
const { createBearerAuth, extractQueryToken, extractHeaderBearerToken } = require("../src/auth/auth_bearer");

const AUTH_MODULAR_PARITY_VERSION = "test-mcp-modular-auth-parity-v1";
const SYNTHETIC_TOKEN = "test-mcp-modular-parity-token-0123456789abcdef";
const WRONG_TOKEN = "test-mcp-modular-parity-wrong-0123456789abcdef";
const SYNTHETIC_ACCESS_ASSERTION = "synthetic-cloudflare-access-assertion";

function makeTempTokenFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-tests-modular-parity-"));
  const file = path.join(dir, "token.txt");
  fs.writeFileSync(file, SYNTHETIC_TOKEN, { encoding: "utf8", mode: 0o600 });
  return { dir, file };
}

function cleanupTemp(temp) {
  const cleanup = { token_removed: false, dir_removed: false };
  try {
    fs.unlinkSync(temp.file);
    cleanup.token_removed = true;
  } catch (_) {}
  try {
    fs.rmdirSync(temp.dir);
    cleanup.dir_removed = true;
  } catch (_) {}
  return cleanup;
}

function runAccessParityDryRun() {
  const policy = createAccessAuth({ trustedProxy: true });
  const missing = policy.authenticate({ headers: {} });
  const present = policy.authenticate({ headers: { [ACCESS_ASSERTION_HEADER]: SYNTHETIC_ACCESS_ASSERTION } });
  const status = policy.status();

  return {
    mode: "access",
    success: missing.ok === false && missing.status === 401 && present.ok === true && present.status === 200,
    assertion_header: ACCESS_ASSERTION_HEADER,
    missing_rejected_401: missing.ok === false && missing.status === 401 && missing.error === "missing_access_assertion",
    assertion_present_accepted_200: present.ok === true && present.status === 200,
    expects_cloudflare_proxy: status.expects_cloudflare_proxy === true,
    validates_cloudflare_jwt: status.validates_cloudflare_jwt === true,
    accepts_cf_access_service_token_headers_directly: status.accepts_cf_access_service_token_headers_directly === true,
  };
}

function runBearerParityDryRun() {
  const temp = makeTempTokenFile();
  try {
    const policy = createBearerAuth({ tokenFile: temp.file });
    const missing = policy.authenticate({ headers: {}, url: "/mcp" });
    const invalidHeader = policy.authenticate({ headers: { authorization: `Bearer ${WRONG_TOKEN}` }, url: "/mcp" });
    const invalidQuery = policy.authenticate({ headers: {}, url: `/mcp?token=${encodeURIComponent(WRONG_TOKEN)}` });
    const header = policy.authenticate({ headers: { authorization: `Bearer ${SYNTHETIC_TOKEN}` }, url: "/mcp" });
    const query = policy.authenticate({ headers: {}, url: `/mcp?token=${encodeURIComponent(SYNTHETIC_TOKEN)}` });
    const status = policy.status();
    const cleanup = cleanupTemp(temp);

    return {
      mode: "bearer",
      success: missing.ok === false && invalidHeader.ok === false && invalidQuery.ok === false && header.ok === true && query.ok === false && cleanup.token_removed === true && cleanup.dir_removed === true,
      accepts_authorization_bearer: status.accepts_authorization_bearer === true,
      accepts_query_token: status.accepts_query_token === true,
      accepts_query_token_disabled_by_default: status.accepts_query_token === false,
      missing_rejected_401: missing.ok === false && missing.status === 401 && missing.error === "missing_bearer_token",
      invalid_header_rejected_401: invalidHeader.ok === false && invalidHeader.status === 401 && invalidHeader.error === "invalid_bearer_token",
      invalid_query_rejected_401: invalidQuery.ok === false && invalidQuery.status === 401 && invalidQuery.error === "missing_bearer_token",
      header_accepted_200: header.ok === true && header.status === 200,
      query_rejected_401: query.ok === false && query.status === 401 && query.error === "missing_bearer_token",
      header_extractor_ok: extractHeaderBearerToken({ headers: { authorization: `Bearer ${SYNTHETIC_TOKEN}` } }) === SYNTHETIC_TOKEN,
      query_extractor_ok: extractQueryToken({ url: `/mcp?token=${encodeURIComponent(SYNTHETIC_TOKEN)}` }) === SYNTHETIC_TOKEN,
      temp_token_removed: cleanup.token_removed === true,
      temp_dir_removed: cleanup.dir_removed === true,
      token_disclosed: false,
      token_path_disclosed: false,
    };
  } catch (error) {
    const cleanup = cleanupTemp(temp);
    return {
      mode: "bearer",
      success: false,
      error: error?.message || String(error),
      temp_token_removed: cleanup.token_removed,
      temp_dir_removed: cleanup.dir_removed,
      token_disclosed: false,
      token_path_disclosed: false,
    };
  }
}

function getModularAuthParityStatus() {
  const access = runAccessParityDryRun();
  const bearer = runBearerParityDryRun();
  const blockers = [];
  const warnings = [];

  if (!access.success) blockers.push("access parity dry-run failed");
  if (!bearer.success) blockers.push("bearer parity dry-run failed");
  if (access.validates_cloudflare_jwt !== false) blockers.push("access parity unexpectedly claims direct Cloudflare JWT validation");
  if (access.accepts_cf_access_service_token_headers_directly !== false) blockers.push("access parity unexpectedly accepts CF service-token headers directly");
  if (!bearer.accepts_authorization_bearer) blockers.push("bearer header token is not accepted");

  warnings.push("access mode expects Cloudflare proxy to produce cf-access-jwt-assertion");
  warnings.push("bearer query-token mode is disabled by default; Authorization header is the default credential delivery path");

  return {
    success: blockers.length === 0,
    error: blockers.join("; "),
    mode: "auth-modular-parity-status",
    version: AUTH_MODULAR_PARITY_VERSION,
    modular_mcp_modes: ["access", "bearer"],
    credential_delivery_variants: [
      "cloudflare_access_assertion_header",
      "authorization_bearer_header",
    ],
    access_cloudflare_ready: access.success === true && access.expects_cloudflare_proxy === true,
    bearer_header_ready: bearer.success === true && bearer.header_accepted_200 === true,
    bearer_query_ready: false,
    bearer_query_disabled_by_default: bearer.accepts_query_token_disabled_by_default === true,
    access,
    bearer,
    blockers,
    warnings,
    explicit_non_scope: {
      changes_active_auth_mode: false,
      writes_real_secret: false,
      writes_persistent_token_file: false,
      configures_connector_credential: false,
      validates_cloudflare_jwt: false,
      handles_cf_access_client_secret: false,
      removes_auth_none: false,
    },
  };
}

module.exports = {
  AUTH_MODULAR_PARITY_VERSION,
  getModularAuthParityStatus,
  runAccessParityDryRun,
  runBearerParityDryRun,
};
