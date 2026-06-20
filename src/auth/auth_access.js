const ACCESS_ASSERTION_HEADER = "cf-access-jwt-assertion";

function extractAccessAssertion(req = {}) {
  const headers = req.headers || {};
  const value = headers[ACCESS_ASSERTION_HEADER] || headers[ACCESS_ASSERTION_HEADER.toUpperCase()] || headers["Cf-Access-Jwt-Assertion"] || "";
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim();
}

function hasCloudflareAccessAssertion(req = {}) {
  return extractAccessAssertion(req).length > 0;
}

function trustedAccessProxyEnabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.MCP_TEST_ACCESS_TRUSTED_PROXY || "").trim().toLowerCase());
}

function createAccessAuth(options = {}) {
  const trustedProxy = options.trustedProxy === true || trustedAccessProxyEnabled();
  if (!trustedProxy) {
    throw new Error("MCP_TEST_ACCESS_TRUSTED_PROXY=1 is required when MCP_TEST_AUTH_MODE=access. Presence-only cf-access-jwt-assertion auth is safe only behind a trusted Cloudflare Access proxy boundary.");
  }
  return {
    mode: "access",
    enabled: true,
    requiresAuth: true,
    assertionHeader: ACCESS_ASSERTION_HEADER,
    authenticate(req = {}) {
      if (!hasCloudflareAccessAssertion(req)) {
        return {
          ok: false,
          status: 401,
          error: "missing_access_assertion",
          mode: "access",
        };
      }

      return {
        ok: true,
        status: 200,
        error: "",
        mode: "access",
      };
    },
    status() {
      return {
        mode: "access",
        enabled: true,
        requires_auth: true,
        assertion_header: ACCESS_ASSERTION_HEADER,
        validates_cloudflare_jwt: false,
        trusted_proxy_required: true,
        trusted_proxy_configured: trustedProxy,
        expects_cloudflare_proxy: true,
        accepts_cf_access_service_token_headers_directly: false,
      };
    },
  };
}

module.exports = {
  ACCESS_ASSERTION_HEADER,
  createAccessAuth,
  extractAccessAssertion,
  hasCloudflareAccessAssertion,
  trustedAccessProxyEnabled,
};
