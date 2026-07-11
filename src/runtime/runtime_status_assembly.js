"use strict";

const { assertToolSchemas, buildToolSurfaceFingerprint } = require("../schema_compat");
const { buildSecurityBoundary } = require("../security_boundary");
const { buildToolLabelsSync } = require("../tool_labels");
const { envFlagEnabled } = require("../tool_loader");
const { assertProfilePolicy, summarizeToolPolicies } = require("../tool_policy");
const { getAllowedDomains, getMaxBytes, getTimeoutMs } = require("../util/network_policy");
const { getPublicFsMaxFileBytes, getPublicFsMaxListEntries, getPublicFsMaxTextChars, getPublicFsRoot } = require("../util/path_policy");
const { buildRuntimeIdentity } = require("./identity");
const { createRuntimeStatusProvider } = require("./runtime_status_provider");

function sameToolReferences(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((tool, index) => tool === right[index]);
}

function createRuntimeStatusAssembly({
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  publicBaseUrl,
  host,
  port,
  authPolicy,
  auditVersion,
  auditLogPath,
  maxFetchTextChars,
  stageStatus,
  runtimeProfile,
  toolIntrospection,
  toolsList,
  serverStartId,
  disableLegacyInitialize,
}) {
  let cachedToolRefs = null;
  let cachedToolData = null;
  let currentToolData = null;

  function buildToolData(tools) {
    const introspection = typeof toolIntrospection === "function" ? toolIntrospection() : null;
    const names = tools.map((tool) => tool.name);
    return {
      names,
      profilePolicy: assertProfilePolicy(tools, { profile: runtimeProfile, authMode: authPolicy.mode }),
      toolPolicySummary: summarizeToolPolicies(names),
      toolSurfaceFingerprint: introspection?.toolSurface || buildToolSurfaceFingerprint(tools),
      schemaCompatibility: introspection?.schemaCompatibility || assertToolSchemas(tools),
      toolLabels: buildToolLabelsSync(tools),
    };
  }

  function getCachedToolData() {
    if (currentToolData) return currentToolData;

    const tools = toolsList();
    if (!sameToolReferences(cachedToolRefs, tools)) {
      cachedToolRefs = tools.slice();
      cachedToolData = buildToolData(cachedToolRefs);
    }

    currentToolData = cachedToolData;
    return currentToolData;
  }

  const provider = createRuntimeStatusProvider({
    serverName,
    serverVersion,
    connectorShapeVersion,
    outputMode,
    publicBaseUrl,
    host,
    port,
    authPolicy,
    auditVersion,
    auditLogPath,
    maxFetchTextChars,
    stageStatus,
    securityBoundary: () => buildSecurityBoundary({ profile: runtimeProfile, authPolicy, stageStatus }),
    profile: runtimeProfile,
    profilePolicy: () => getCachedToolData().profilePolicy,
    toolPolicySummary: () => getCachedToolData().toolPolicySummary,
    enabledTools: () => getCachedToolData().names.slice(),
    toolSurfaceFingerprint: () => getCachedToolData().toolSurfaceFingerprint,
    schemaCompatibility: () => getCachedToolData().schemaCompatibility,
    runtimeIdentity: () => buildRuntimeIdentity(),
    toolLabels: () => getCachedToolData().toolLabels,
    requestContract: () => ({
      route: "/mcp",
      post_only: true,
      initialize_required: false,
      protocol_sessions: false,
      server_discover_supported: true,
      legacy_initialize_supported: disableLegacyInitialize !== true,
      transport_mode: disableLegacyInitialize === true
        ? "streamable_http_stateless_no_initialize"
        : "streamable_http_stateless_legacy_initialize_compat",
    }),
    network: {
      envFlagEnabled,
      getAllowedDomains,
      getMaxBytes,
      getTimeoutMs,
    },
    serverStartId,
    fs: {
      envFlagEnabled,
      getPublicFsRoot,
      getPublicFsMaxFileBytes,
      getPublicFsMaxTextChars,
      getPublicFsMaxListEntries,
    },
  });

  return function getRuntimeStatus(options = {}) {
    currentToolData = null;
    try {
      return provider(options);
    } finally {
      currentToolData = null;
    }
  };
}

module.exports = {
  createRuntimeStatusAssembly,
};
