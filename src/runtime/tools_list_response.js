"use strict";

const { buildToolSurfaceFingerprint } = require("../schema_compat");

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
  const sourceTools = Array.isArray(tools) ? tools : [];
  const toolSurface = buildToolSurfaceFingerprint(sourceTools);
  const serverStartId = typeof options.serverStartId === "string" ? options.serverStartId : "";
  return {
    tools: sourceTools.map((tool) => withSecuritySchemes(tool, options.authMode)),
    ttlMs: 0,
    cacheScope: "private",
    _meta: {
      "mcp-tests/toolSurfaceFingerprint": toolSurface.combined_fingerprint,
      "mcp-tests/toolNamesHash": toolSurface.tool_names_hash,
      "mcp-tests/toolSurfaceCount": toolSurface.tool_count,
      "mcp-tests/serverStartId": serverStartId,
    },
  };
}

module.exports = {
  buildToolsListResponse,
  securitySchemesForAuthMode,
  withSecuritySchemes,
};
