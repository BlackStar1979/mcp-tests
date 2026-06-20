"use strict";

function canonicalResource(publicBaseUrl) {
  return String(publicBaseUrl || "").replace(/\/+$/, "");
}

function buildProtectedResourceMetadata({ publicBaseUrl, authorizationServers = [], authorizationServerMetadata } = {}) {
  const resource = canonicalResource(publicBaseUrl);
  const metadataAuthorizationServers = authorizationServerMetadata?.issuer ? [authorizationServerMetadata.issuer] : [];
  const resolvedAuthorizationServers = authorizationServers.length > 0 ? authorizationServers : metadataAuthorizationServers;
  return {
    resource,
    authorization_servers: resolvedAuthorizationServers.length > 0 ? resolvedAuthorizationServers : [`${resource}/.well-known/oauth-authorization-server`],
    scopes_supported: ["mcp:public", "mcp:tools", "mcp:operator"],
    bearer_methods_supported: ["header"],
    resource_documentation: `${resource}/docs/auth`,
  };
}

function buildWwwAuthenticateHeader({ publicBaseUrl, error, scope } = {}) {
  const resource = canonicalResource(publicBaseUrl);
  const parts = [`Bearer resource_metadata="${resource}/.well-known/oauth-protected-resource"`];
  if (error) parts.push(`error="${String(error)}"`);
  if (scope) parts.push(`scope="${String(scope)}"`);
  return parts.join(", ");
}

module.exports = {
  buildProtectedResourceMetadata,
  buildWwwAuthenticateHeader,
  canonicalResource,
};
