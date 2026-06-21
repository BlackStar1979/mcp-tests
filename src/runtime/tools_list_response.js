"use strict";

function securitySchemesForAuthMode(authMode) {
  const mode = String(authMode || "none").trim().toLowerCase();
  if (mode === "oauth" || mode === "oauth21") {
    return [{ type: "oauth2", scopes: ["mcp:tools"] }];
  }
  return [{ type: "noauth" }];
}

function withSecuritySchemes(tool, authMode) {
  const securitySchemes = Array.isArray(tool?.securitySchemes) && tool.securitySchemes.length > 0
    ? tool.securitySchemes
    : securitySchemesForAuthMode(authMode);
  return {
    ...tool,
    securitySchemes,
    _meta: {
      ...(tool?._meta || {}),
      securitySchemes,
    },
  };
}

function buildToolsListResponse(tools, options = {}) {
  return {
    tools: tools.map((tool) => withSecuritySchemes(tool, options.authMode)),
  };
}

module.exports = {
  buildToolsListResponse,
  securitySchemesForAuthMode,
  withSecuritySchemes,
};
