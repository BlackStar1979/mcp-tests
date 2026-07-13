"use strict";

const { buildPublicHealthAuthStatus } = require("./health_auth_status");

function handleHealthRoute({
  res,
  jsonResponse,
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  maxFetchTextChars,
  auditVersion,
  authPolicy,
  runtimeProfile,
  stageStatus,
  securityBoundary,
  publicBaseUrl,
  toolIntrospection,
  toolsList,
  oauth21RuntimeStatus,
}) {
  const full = ["1", "true", "yes", "on"].includes(String(process.env.MCP_TEST_HEALTH_FULL || "").trim().toLowerCase());
  const introspection = typeof toolIntrospection === "function" ? toolIntrospection() : null;
  const tools = Array.isArray(introspection?.toolNames)
    ? introspection.toolNames.slice()
    : toolsList().map((tool) => tool.name);
  const body = {
    status: "ok",
    server: serverName,
    version: serverVersion,
    connectorShapeVersion,
    auth: buildPublicHealthAuthStatus(authPolicy),
    profile: runtimeProfile,
    mcp: "/mcp",
    tools_count: tools.length,
  };
  if (full) {
    Object.assign(body, {
      outputMode,
      fetchTextCapChars: maxFetchTextChars,
      audit: {
        enabled: true,
        version: auditVersion,
      },
      compatibility_label: stageStatus,
      stage_status: stageStatus,
      security_boundary: securityBoundary,
      public_base_url: publicBaseUrl,
      tools,
      oauth21_runtime: typeof oauth21RuntimeStatus === "function" ? oauth21RuntimeStatus() : null,
    });
  }
  jsonResponse(res, 200, body);
}

module.exports = {
  handleHealthRoute,
};
