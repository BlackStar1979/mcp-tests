"use strict";

const { buildRuntimeStatus } = require("../runtime_status");

function createRuntimeStatusProvider({
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
  securityBoundary,
  profile,
  profilePolicy,
  toolPolicySummary,
  enabledTools,
  toolSurfaceFingerprint,
  schemaCompatibility,
  runtimeIdentity,
  toolLabels,
  requestContract,
  network,
  fs,
  serverStartId,
}) {
  return function getRuntimeStatus(options = {}) {
    return buildRuntimeStatus({
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
      securityBoundary,
      profile,
      profilePolicy,
      toolPolicySummary,
      enabledTools,
      toolSurfaceFingerprint,
      schemaCompatibility,
      runtimeIdentity,
      toolLabels,
      requestContract,
      network,
      fs,
      serverStartId,
    });
  };
}

module.exports = {
  createRuntimeStatusProvider,
};
