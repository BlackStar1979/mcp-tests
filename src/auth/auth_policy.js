const { createNoneAuth } = require("./auth_none");
const { createBearerAuth } = require("./auth_bearer");
const { createAccessAuth } = require("./auth_access");
const { createOAuthAuth } = require("./auth_oauth");
const { buildWwwAuthenticateHeader } = require("../runtime/oauth_metadata");

const VALID_AUTH_MODES = new Set(["none", "bearer", "access", "oauth", "oauth21"]);

function getAuthMode() {
  return String(process.env.MCP_TEST_AUTH_MODE || "none").trim().toLowerCase();
}

function createAuthPolicy(options = {}) {
  const mode = String(options.mode || getAuthMode()).trim().toLowerCase();

  if (!VALID_AUTH_MODES.has(mode)) {
    throw new Error(`Invalid MCP_TEST_AUTH_MODE: ${mode}. Allowed values: none, bearer, access, oauth, oauth21.`);
  }

  if (mode === "none") {
    return createNoneAuth();
  }

  if (mode === "access") {
    return createAccessAuth({ trustedProxy: options.trustedProxy === true });
  }

  if (mode === "oauth" || mode === "oauth21") {
    return createOAuthAuth({
      issuer: options.oauthIssuer,
      audience: options.oauthAudience || options.publicBaseUrl,
      hmacSecretFile: options.oauthHmacSecretFile,
      jwksFile: options.oauthJwksFile,
      publicBaseUrl: options.publicBaseUrl,
    });
  }

  return createBearerAuth({
    tokenFile: options.tokenFile || process.env.MCP_TEST_TOKEN_FILE,
    allowQueryToken: options.allowQueryToken === true,
  });
}

function authResponseHeaders(policy) {
  if (!policy) return {};
  if (policy.mode === "oauth") {
    return {
      "www-authenticate": buildWwwAuthenticateHeader({ publicBaseUrl: policy.audience, error: "invalid_token", scope: "mcp:tools" }),
    };
  }
  if (policy.mode !== "bearer") {
    return {};
  }

  return {
    "www-authenticate": 'Bearer realm="mcp-tests"',
  };
}

function summarizeAuthFailure(result = {}) {
  return {
    auth_mode: result.mode || "unknown",
    auth_ok: Boolean(result.ok),
    auth_error: result.error || "",
    auth_status: Number(result.status) || 0,
  };
}

module.exports = {
  VALID_AUTH_MODES,
  authResponseHeaders,
  createAuthPolicy,
  getAuthMode,
  summarizeAuthFailure,
};
