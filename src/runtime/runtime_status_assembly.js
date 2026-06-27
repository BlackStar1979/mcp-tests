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
  toolsList,
  serverStartId,
}) {
  return createRuntimeStatusProvider({
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
    profilePolicy: () => assertProfilePolicy(toolsList(), { profile: runtimeProfile, authMode: authPolicy.mode }),
    toolPolicySummary: () => summarizeToolPolicies(toolsList().map((tool) => tool.name)),
    enabledTools: () => toolsList().map((tool) => tool.name),
    toolSurfaceFingerprint: () => buildToolSurfaceFingerprint(toolsList()),
    schemaCompatibility: () => assertToolSchemas(toolsList()),
    runtimeIdentity: () => buildRuntimeIdentity(),
    toolLabels: () => buildToolLabelsSync(toolsList()),
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
}

module.exports = {
  createRuntimeStatusAssembly,
};
