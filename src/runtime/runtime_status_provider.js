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
  network,
  fs,
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
      network,
      fs,
    });
  };
}

module.exports = {
  createRuntimeStatusProvider,
};
