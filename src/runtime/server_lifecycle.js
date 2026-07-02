"use strict";

const { runConnectorShapeSelfTest } = require("./connector_shape_selftest_runner");
const { createServer } = require("./server_factory");
const { startServer } = require("./server_startup_listener_handler");
const { buildStartupReport, printStartupReport } = require("./startup_report_builder");

function runSelfTestBranch({
  toolsList,
  optionalTools,
  getOptionalTool,
  authPolicy,
  runtimeProfile,
  outputMode,
  maxFetchTextChars,
  connectorShapeVersion,
  documentRuntimeContext,
  auditLogPath,
  serverStartId,
  logger = console.log,
  errorLogger = console.error,
  exit = process.exit,
}) {
  return runConnectorShapeSelfTest({
    toolsList,
    optionalTools,
    getOptionalTool,
    authPolicy,
    runtimeProfile,
    outputMode,
    maxFetchTextChars,
    connectorShapeVersion,
    documentRuntimeContext,
  })
    .then(() => {
      logger("self-test ok");
      logger(`outputMode=${outputMode}`);
      logger(`connectorShapeVersion=${connectorShapeVersion}`);
      logger(`fetchTextCapChars=${maxFetchTextChars}`);
      logger(`auditLog=${auditLogPath}`);
      exit(0);
    })
    .catch((error) => {
      errorLogger(error?.stack || error?.message || String(error));
      exit(1);
    });
}

function startRuntimeServer({
  host,
  port,
  dispatchCreateServerRoute,
  handleMcp,
  handleHealthRoute,
  handleDocsRoute,
  handleNotFoundRoute,
  jsonResponse,
  textResponse,
  fetchDoc,
  documentRuntimeContext,
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
  toolsList,
  authorizationServerMetadataProvider,
  oauth21AuthorizationServer,
  auditLog,
  bootstrapAuthMode,
  startupReportVersion,
  labelsVersion,
  auditLogPath,
  serverStartId,
  logger = console.log,
  errorLogger = console.error,
  exit = process.exit,
}) {
  const server = createServer({
    host,
    port,
    dispatchCreateServerRoute,
    handleMcp,
    handleHealthRoute,
    handleDocsRoute,
    handleNotFoundRoute,
    jsonResponse,
    textResponse,
    fetchDoc,
    documentRuntimeContext,
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
    toolsList,
    authorizationServerMetadataProvider,
    oauth21AuthorizationServer,
    auditLog,
  });

  return startServer({
    server,
    host,
    port,
    onError(error) {
      auditLog("server_error", {
        error_message: error?.message || String(error),
      });

      errorLogger("MCP TEST SERVER FAILED:", error.message || String(error));
      exit(1);
    },
    onListening() {
      auditLog("server_start", {
        host,
        port,
        public_base_url: publicBaseUrl,
        outputMode,
        fetchTextCapChars: maxFetchTextChars,
        audit_log_path: auditLogPath,
        server_start_id: typeof serverStartId === "string" ? serverStartId : "",
      });

      logger(`Auth mode: ${bootstrapAuthMode}`);
      const report = buildStartupReport({
        serverName,
        serverVersion,
        connectorShapeVersion,
        outputMode,
        startupReportVersion,
        labelsVersion,
        host,
        port,
        publicBaseUrl,
        maxFetchTextChars,
        auditLogPath,
        serverStartId,
        tools: toolsList(),
      });

      printStartupReport(report, logger);
    },
  });
}

function runServerLifecycle({ selfTest, selfTestContext, startupContext }) {
  if (selfTest) return runSelfTestBranch(selfTestContext);
  return startRuntimeServer(startupContext);
}

module.exports = {
  runSelfTestBranch,
  runServerLifecycle,
  startRuntimeServer,
};
