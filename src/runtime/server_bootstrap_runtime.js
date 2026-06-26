"use strict";

const path = require("node:path");
const { createAuthPolicy } = require("../auth/auth_policy");
const { assertSecurityBoundary } = require("../security_boundary");
const { AUDIT_VERSION, CONNECTOR_SHAPE_VERSION, LABELS_VERSION, SERVER_NAME, SERVER_VERSION, STARTUP_REPORT_VERSION } = require("./identity");
const { CURRENT_STAGE_STATUS } = require("../stage_metadata");
const { jsonResponse, textResponse } = require("./http_responses");
const { handleHealthRoute } = require("./health_route_handler");
const { handleDocsRoute } = require("./docs_route_handler");
const { handleNotFoundRoute } = require("./not_found_route_handler");
const { dispatchCreateServerRoute } = require("./create_server_route_dispatcher");
const { fetchDoc } = require("./search_fetch_docs");
const { createRuntimeStatusAssembly } = require("./runtime_status_assembly");
const { createRuntimeSupportAssembly } = require("./runtime_support_assembly");
const { configureOptionalToolsAssembly } = require("./optional_tools_assembly");
const { runConfiguredRuntime } = require("./runtime_context_assembly");
const { resolveAuthBootstrapConfig } = require("./auth_bootstrap_config_resolver");
const { createAuthorizationServerMetadataProvider } = require("../auth/oauth_authorization_server_metadata");
const { createOAuth21AuthorizationServer } = require("../auth/oauth21_authorization_server");
const { loadOAuth21SecretConfig } = require("./oauth21_secret_config");
const { parseServerCliArgs } = require("./server_cli_args");
const { loadServerProfileConfig } = require("../server_profile_loader");
const { createRestartController } = require("./restart_controller");
const { createRuntimeRateLimiter } = require("./rate_limit_policy");
const { DOCS } = require("./static_docs");

const VALID_OUTPUT_MODES = new Set(["structured", "content-only"]);

function runServerBootstrapRuntime({ argv = process.argv, env = process.env, rootDir = path.resolve(__dirname, "../..") } = {}) {
  const serverCliConfig = parseServerCliArgs(argv.slice(2));

  const bootstrapConfig = resolveAuthBootstrapConfig({
    argv: serverCliConfig.bootstrapArgv,
    env,
  });

  const serverProfileConfig = loadServerProfileConfig({
    profileName: serverCliConfig.serverProfileName,
    authMode: bootstrapConfig.authMode,
    rootDir,
  });

  const runtimeProfileFromAuth = String(bootstrapConfig.authMode || "none").trim().toLowerCase() === "none" ? "public" : "internal";
  env.MCP_TEST_PROFILE = runtimeProfileFromAuth;

  const host = bootstrapConfig.host;
  const port = bootstrapConfig.port;
  const publicBaseUrl = bootstrapConfig.publicBaseUrl;

  const outputMode = String(env.MCP_TEST_OUTPUT_MODE || "structured")
    .trim()
    .toLowerCase();

  const maxFetchTextChars = Number(env.MCP_TEST_FETCH_CAP_CHARS || 2500);

  const auditLogDir = env.MCP_TEST_LOG_DIR || path.join(rootDir, "_logs");
  const auditLogPath = env.MCP_TEST_AUDIT_LOG || path.join(auditLogDir, ".mcp-tests-audit.jsonl");

  const optionalTools = [];
  let oauth21AuthorizationServer = null;
  let oauth21Issuer = env.MCP_TEST_OAUTH_ISSUER;
  if (bootstrapConfig.authMode === "oauth21") {
    const secretConfig = loadOAuth21SecretConfig({ secretFile: bootstrapConfig.oauthConfigFile, env, fallbackIssuer: publicBaseUrl });
    oauth21Issuer = secretConfig.issuer;
    oauth21AuthorizationServer = createOAuth21AuthorizationServer({ issuer: oauth21Issuer, operatorSecret: secretConfig.operatorSecret });
  }

  const authPolicy = createAuthPolicy({
    mode: bootstrapConfig.authMode,
    tokenFile: bootstrapConfig.tokenFile,
    allowQueryToken: bootstrapConfig.allowQueryToken,
    trustedProxy: bootstrapConfig.trustedProxy,
    publicBaseUrl,
    oauthIssuer: oauth21Issuer || env.MCP_TEST_OAUTH_ISSUER,
    oauthAudience: env.MCP_TEST_OAUTH_AUDIENCE || publicBaseUrl,
    oauthHmacSecretFile: env.MCP_TEST_OAUTH_HS256_SECRET_FILE,
    oauthJwksFile: env.MCP_TEST_OAUTH_JWKS_FILE,
    tokenValidator: oauth21AuthorizationServer ? oauth21AuthorizationServer.validateAccessToken : undefined,
  });

  let authorizationServerMetadataProvider = null;
  if (bootstrapConfig.authMode === "oauth21" && oauth21AuthorizationServer) {
    authorizationServerMetadataProvider = { get: () => oauth21AuthorizationServer.metadata() };
  } else if (bootstrapConfig.authMode === "oauth") {
    authorizationServerMetadataProvider = createAuthorizationServerMetadataProvider({
      issuer: env.MCP_TEST_OAUTH_ISSUER,
      metadataFile: env.MCP_TEST_OAUTH_AS_METADATA_FILE,
    });
  }
  const runtimeProfile = runtimeProfileFromAuth;
  const stageStatus = CURRENT_STAGE_STATUS;
  const securityBoundary = assertSecurityBoundary({ profile: runtimeProfile, authPolicy, stageStatus });

  const { auditLog, documentRuntimeContext, toolsList } = createRuntimeSupportAssembly({
    auditLogPath,
    auditVersion: AUDIT_VERSION,
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    docs: DOCS,
    publicBaseUrl,
    maxFetchTextChars,
    outputMode,
    optionalTools,
  });

  const rateLimiter = createRuntimeRateLimiter({ env, rootDir });
  const restartController = createRestartController({ auditLog, env, rootDir, rateLimiter });
  restartController.start();

  const getRuntimeStatus = createRuntimeStatusAssembly({
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode,
    publicBaseUrl,
    host,
    port,
    authPolicy,
    auditVersion: AUDIT_VERSION,
    auditLogPath,
    maxFetchTextChars,
    stageStatus,
    runtimeProfile,
    toolsList,
  });

  const { getOptionalTool } = configureOptionalToolsAssembly({
    optionalTools,
    profile: runtimeProfile,
    authPolicy,
    serverProfileConfig,
    runtimeStatusProvider: getRuntimeStatus,
    auditLogPath,
    restartController,
  });

  if (!VALID_OUTPUT_MODES.has(outputMode)) {
    console.error(`Invalid MCP_TEST_OUTPUT_MODE: ${outputMode}`);
    console.error("Allowed values: structured, content-only");
    process.exit(2);
  }

  if (!Number.isInteger(maxFetchTextChars) || maxFetchTextChars < 100) {
    console.error(`Invalid MCP_TEST_FETCH_CAP_CHARS: ${env.MCP_TEST_FETCH_CAP_CHARS}`);
    console.error("Expected integer >= 100.");
    process.exit(2);
  }

  return runConfiguredRuntime({
    bootstrapConfig,
    host,
    port,
    dispatchCreateServerRoute,
    handleHealthRoute,
    handleDocsRoute,
    handleNotFoundRoute,
    jsonResponse,
    textResponse,
    fetchDoc,
    documentRuntimeContext,
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
    connectorShapeVersion: CONNECTOR_SHAPE_VERSION,
    outputMode,
    maxFetchTextChars,
    auditVersion: AUDIT_VERSION,
    authPolicy,
    runtimeProfile,
    stageStatus,
    securityBoundary,
    publicBaseUrl,
    toolsList,
    authorizationServerMetadataProvider,
    oauth21AuthorizationServer,
    optionalTools,
    getOptionalTool,
    auditLog,
    startupReportVersion: STARTUP_REPORT_VERSION,
    labelsVersion: LABELS_VERSION,
    auditLogPath,
    rateLimiter,
  });
}

module.exports = {
  runServerBootstrapRuntime,
};
