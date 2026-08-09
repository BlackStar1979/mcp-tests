"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const connectorSpec = JSON.parse(fs.readFileSync(path.join(root, "SERVER_CONNECTOR_SURFACE_SPEC.json"), "utf8"));
const resource = connectorSpec.oauth21_connector.mcp_endpoint;
const issuer = new URL(resource).origin;

async function getJson(url, init = {}) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const body = await response.json();
  return { response, body };
}

(async () => {
  const health = await getJson(`${issuer}/healthz`);
  assert.equal(health.response.status, 200);
  assert.equal(health.body.version, "0.40.0");
  assert.equal(health.body.profile, "internal");

  const metadata = await getJson(`${issuer}/.well-known/oauth-protected-resource`);
  assert.equal(metadata.response.status, 200);
  assert.equal(metadata.body.resource, resource);
  assert.deepEqual(metadata.body.authorization_servers, [issuer]);

  const getMcp = await getJson(resource);
  assert.equal(getMcp.response.status, 405);

  const unauthorized = await getJson(resource, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal(unauthorized.response.status, 401);
  assert.equal(unauthorized.body.error?.data?.auth_error, "missing_bearer_token");
  const challenge = unauthorized.response.headers.get("www-authenticate") || "";
  assert.match(challenge, /resource_metadata=/);
  assert.match(challenge, /scope="mcp:tools"/);

  console.log(JSON.stringify({
    ok: true,
    resource,
    health_status: health.response.status,
    metadata_status: metadata.response.status,
    get_mcp_status: getMcp.response.status,
    unauthenticated_post_status: unauthorized.response.status,
  }));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
