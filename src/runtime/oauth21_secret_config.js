"use strict";

const fs = require("node:fs");

function loadOAuth21SecretConfig({ secretFile = "", env = process.env, fallbackIssuer = "" } = {}) {
  let data = {};
  let source = "env";
  if (secretFile) {
    data = JSON.parse(fs.readFileSync(secretFile, "utf8"));
    source = "file";
  }
  const operatorSecret = String(data.operator_secret || env.MCP_TEST_OAUTH_OPERATOR_SECRET || "");
  const issuer = String(data.issuer || env.MCP_TEST_OAUTH_ISSUER || fallbackIssuer || "").replace(/\/+$/, "");
  if (!operatorSecret) throw new Error("MCP_TEST_OAUTH_OPERATOR_SECRET or --oauth-secret-file operator_secret is required when auth=oauth21.");
  if (!issuer) throw new Error("OAuth21 issuer is required.");
  return { operatorSecret, issuer, source };
}

module.exports = { loadOAuth21SecretConfig };
