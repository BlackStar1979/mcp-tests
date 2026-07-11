"use strict";

const {
  createOAuth21AuthorizationServer,
} = require("./oauth21_authorization_server");
const {
  jsonResponse,
  readFormBody,
  redirectResponse,
  trimSlash,
} = require("./oauth21_utils");

function matchesResource(value, expected) {
  return trimSlash(value) === trimSlash(expected);
}

function createOAuth21McpAuthorizationServer({
  issuer,
  resource,
  allowIssuerResourceAlias = true,
  ...options
} = {}) {
  const normalizedIssuer = trimSlash(issuer);
  const normalizedResource = trimSlash(resource);

  if (!normalizedResource) throw new Error("oauth21_resource_required");

  const inner = createOAuth21AuthorizationServer({
    issuer: normalizedIssuer,
    ...options,
  });

  function mapRequestedResource(value) {
    if (matchesResource(value, normalizedResource)) return normalizedIssuer;
    if (allowIssuerResourceAlias === true && matchesResource(value, normalizedIssuer)) return normalizedIssuer;
    return value;
  }

  function authorize(query = {}) {
    return inner.authorize({
      ...query,
      resource: mapRequestedResource(query.resource),
    });
  }

  function token(body = {}) {
    return inner.token({
      ...body,
      resource: mapRequestedResource(body.resource),
    });
  }

  function validateAccessToken(value, options = {}) {
    const expectedResource = String(
      options.resource || options.audience || normalizedResource,
    );
    if (!matchesResource(expectedResource, normalizedResource)) {
      return {
        ok: false,
        status: 401,
        error: "invalid_token",
        mode: "oauth21",
      };
    }
    return inner.validateAccessToken(value, { resource: normalizedIssuer });
  }

  async function handleRoute({ req, res, url }) {
    if (url.pathname === "/authorize" && req.method === "GET") {
      const result = authorize(Object.fromEntries(url.searchParams));
      if (result.status === 302) return redirectResponse(res, result.location);
      return jsonResponse(res, result.status, result.body);
    }
    if (url.pathname === "/token" && req.method === "POST") {
      const result = token(await readFormBody(req));
      return jsonResponse(res, result.status, result.body, { pragma: "no-cache" });
    }
    return inner.handleRoute({ req, res, url });
  }

  return {
    ...inner,
    issuer: normalizedIssuer,
    resource: normalizedResource,
    authorize,
    token,
    validateAccessToken,
    handleRoute,
    status: () => ({
      ...inner.status(),
      resource: normalizedResource,
      issuer_resource_alias_enabled: allowIssuerResourceAlias === true,
    }),
  };
}

module.exports = {
  createOAuth21McpAuthorizationServer,
};
