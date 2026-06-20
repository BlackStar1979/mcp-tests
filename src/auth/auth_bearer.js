const crypto = require("node:crypto");
const fs = require("node:fs");

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function extractHeaderBearerToken(req = {}) {
  const headers = req.headers || {};
  const header = headers.authorization || headers.Authorization || "";
  const value = Array.isArray(header) ? header[0] : String(header || "");
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function extractQueryToken(req = {}) {
  const query = req.query || {};
  const direct = query.token;

  if (Array.isArray(direct) && direct.length > 0) {
    return String(direct[0] || "").trim();
  }

  if (direct) {
    return String(direct || "").trim();
  }

  const rawUrl = String(req.originalUrl || req.url || "");
  if (!rawUrl) {
    return "";
  }

  try {
    const parsed = new URL(rawUrl, "http://mcp-tests.local");
    return String(parsed.searchParams.get("token") || "").trim();
  } catch (_) {
    return "";
  }
}

function queryTokenEnabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.MCP_TEST_BEARER_ALLOW_QUERY_TOKEN || "").trim().toLowerCase());
}

function extractBearerToken(req = {}) {
  return extractHeaderBearerToken(req) || (queryTokenEnabled() ? extractQueryToken(req) : "");
}

function createBearerAuth(options = {}) {
  const tokenFile = String(options.tokenFile || "").trim();

  if (!tokenFile) {
    throw new Error("MCP_TEST_TOKEN_FILE is required when MCP_TEST_AUTH_MODE=bearer.");
  }

  let token = "";

  try {
    token = fs.readFileSync(tokenFile, "utf8").trim();
  } catch (error) {
    throw new Error(`Cannot read bearer token file: ${error.message || String(error)}`);
  }

  if (token.length < 32 || token.length > 4096) {
    throw new Error("Bearer token length must be between 32 and 4096 characters.");
  }

  const digest = sha256(token);
  const allowQueryToken = options.allowQueryToken === true || queryTokenEnabled();

  return {
    mode: "bearer",
    enabled: true,
    requiresAuth: true,
    tokenFileConfigured: true,
    tokenLoaded: true,
    tokenLength: token.length,
    tokenSha256Prefix: digest.slice(0, 12),
    allowQueryToken,
    authenticate(req) {
      const presented = extractHeaderBearerToken(req) || (allowQueryToken ? extractQueryToken(req) : "");

      if (!presented) {
        return {
          ok: false,
          status: 401,
          error: "missing_bearer_token",
          mode: "bearer",
        };
      }

      if (!timingSafeEqualString(presented, token)) {
        return {
          ok: false,
          status: 401,
          error: "invalid_bearer_token",
          mode: "bearer",
        };
      }

      return {
        ok: true,
        status: 200,
        error: "",
        mode: "bearer",
      };
    },
    status() {
      return {
        mode: "bearer",
        enabled: true,
        requires_auth: true,
        token_file_configured: true,
        token_loaded: true,
        token_length: token.length,
        token_sha256_prefix: digest.slice(0, 12),
        accepts_authorization_bearer: true,
        accepts_query_token: allowQueryToken,
      };
    },
  };
}

module.exports = {
  createBearerAuth,
  extractBearerToken,
  extractHeaderBearerToken,
  extractQueryToken,
  queryTokenEnabled,
  sha256,
  timingSafeEqualString,
};
