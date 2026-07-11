"use strict";

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function canonicalResource(publicBaseUrl, mcpPath = "/mcp") {
  const base = trimSlash(publicBaseUrl);
  const path = String(mcpPath || "/mcp").trim() || "/mcp";
  if (!base) return "";
  return base.endsWith(path) ? base : `${base}${path}`;
}

function buildProtectedResourceMetadata({ publicBaseUrl, resourceUrl = "", authorizationServers = [], authorizationServerMetadata } = {}) {
  const baseUrl = trimSlash(publicBaseUrl);
  const resource = trimSlash(resourceUrl) || baseUrl;
  const metadataAuthorizationServers = authorizationServerMetadata?.issuer ? [authorizationServerMetadata.issuer] : [];
  const resolvedAuthorizationServers = authorizationServers.length > 0 ? authorizationServers : metadataAuthorizationServers;
  const scopesSupported = Array.isArray(authorizationServerMetadata?.scopes_supported) && authorizationServerMetadata.scopes_supported.length > 0
    ? authorizationServerMetadata.scopes_supported.map(String)
    : ["mcp:public", "mcp:tools", "mcp:operator"];
  return {
    resource,
    authorization_servers: resolvedAuthorizationServers.length > 0 ? resolvedAuthorizationServers : [`${baseUrl}/.well-known/oauth-authorization-server`],
    scopes_supported: scopesSupported,
    bearer_methods_supported: ["header"],
    resource_documentation: `${baseUrl}/docs/auth`,
  };
}

function buildWwwAuthenticateHeader({ publicBaseUrl, error, scope } = {}) {
  const metadataBaseUrl = trimSlash(publicBaseUrl);
  const parts = [`Bearer resource_metadata="${metadataBaseUrl}/.well-known/oauth-protected-resource"`];
  if (error) parts.push(`error="${String(error)}"`);
  if (scope) parts.push(`scope="${String(scope)}"`);
  return parts.join(", ");
}

module.exports = {
  buildProtectedResourceMetadata,
  buildWwwAuthenticateHeader,
  canonicalResource,
};
