"use strict";

function canonicalResource(value) {
  return String(value || "").replace(/\/+$/, "");
}

function buildProtectedResourceMetadata({
  publicBaseUrl,
  resource,
  authorizationServers = [],
  authorizationServerMetadata,
} = {}) {
  const metadataBaseUrl = canonicalResource(publicBaseUrl);
  const protectedResource = canonicalResource(resource || publicBaseUrl);
  const metadataAuthorizationServers = authorizationServerMetadata?.issuer ? [authorizationServerMetadata.issuer] : [];
  const resolvedAuthorizationServers = authorizationServers.length > 0 ? authorizationServers : metadataAuthorizationServers;
  const scopesSupported = Array.isArray(authorizationServerMetadata?.scopes_supported) && authorizationServerMetadata.scopes_supported.length > 0
    ? authorizationServerMetadata.scopes_supported.map(String)
    : ["mcp:public", "mcp:tools", "mcp:operator"];
  return {
    resource: protectedResource,
    authorization_servers: resolvedAuthorizationServers.length > 0
      ? resolvedAuthorizationServers
      : [`${metadataBaseUrl}/.well-known/oauth-authorization-server`],
    scopes_supported: scopesSupported,
    bearer_methods_supported: ["header"],
    resource_documentation: `${metadataBaseUrl}/docs/auth`,
  };
}

function buildWwwAuthenticateHeader({ publicBaseUrl, error, scope } = {}) {
  const metadataBaseUrl = canonicalResource(publicBaseUrl);
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
