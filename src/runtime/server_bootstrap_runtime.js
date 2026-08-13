"use strict";

const os = require("node:os");
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
const { canonicalResource } = require("./oauth_metadata");
const { parseServerCliArgs } = require("./server_cli_args");
const { loadServerProfileConfig } = require("../server_profile_loader");
const { createRestartController } = require("./restart_controller");
const { createRuntimeRateLimiter } = require("./rate_limit_policy");
const { DOCS } = require("./static_docs");
const { defaultToolSurfaceStateFile, evaluateToolSurfaceState } = require("../tool_surface_state");
const { resolveRuntimeOutputConfig } = require("./runtime_output_config");
const { getDefaultProcessJobManager, shutdownDefaultProcessJobManager } = require("../util/process_job_manager");
const { closeDefaultContentStageManager, getDefaultContentStageManager } = require("../util/content_stage_manager");
const { closeDefaultFileComposeManager, getDefaultFileComposeManager } = require("../util/file_compose");

function resolveStructuredFileStoragePaths({ env = process.env, port }) {
  return {
    contentStageStorageFile: env.MCP_CONTENT_STAGE_STORAGE_FILE
      || path.join(os.homedir(), ".romion", `tests_content_stages_${port}.sqlite`),
    fileComposeStorageFile: env.MCP_FILE_COMPOSE_STORAGE_FILE
      || path.join(os.homedir(), ".romion", `tests_file_compose_${port}.sqlite`),
  };
}

function runServerBootstrapRuntime({ argv = process.argv, env = process.env, rootDir = path.resolve(__dirname, "../..") } = {}) {
  const serverCliConfig = parseServerCliArgs(argv.slice(2));

  const bootstrapConfig = resolveAuthBootstrapConfig({
    argv: serverCliConfig.bootstrapArgv,
    env,
  });
  const { outputMode, maxFetchTextChars } = resolveRuntimeOutputConfig(env);
  const runtimeSideEffectsEnabled = bootstrapConfig.selfTest !== true;

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
  const mcpResourceUrl = canonicalResource(publicBaseUrl);
  const serverStartId = new Date().toISOString();

  const auditLogDir = env.MCP_TEST_LOG_DIR || path.join(rootDir, "_logs");
  const auditLogPath = env.MCP_TEST_AUDIT_LOG || path.join(auditLogDir, ".mcp-tests-audit.jsonl");

  const optionalTools = [];
  let oauth21AuthorizationServer = null;
  let oauth21Issuer = env.MCP_TEST_OAUTH_ISSUER;
  if (bootstrapConfig.authMode === "oauth21") {
    const secretConfig = loadOAuth21SecretConfig({ secretFile: bootstrapConfig.oauthConfigFile, env, fallbackIssuer: publicBaseUrl });
    oauth21Issuer = secretConfig.issuer;
    // Legacy JSON backend is selected only when BOTH file vars are set. Setting exactly
    // one used to silently select it anyway, leaving the unset half to default to a REAL
    // path under ~/.romion -- so a test that meant to be hermetic would quietly read and
    // write the operator's live store. That is the F1 failure, and it is the kind that
    // reappears in the next hand-written test. Fail fast instead of guessing an intent.
    const legacyStateFile = String(env.MCP_TEST_OAUTH_STATE_FILE || "").trim();
    const legacyClientsFile = String(env.MCP_TEST_OAUTH_CLIENTS_FILE || "").trim();
    if (Boolean(legacyStateFile) !== Boolean(legacyClientsFile)) {
      throw new Error(
        "oauth21_legacy_backend_half_configured: set BOTH MCP_TEST_OAUTH_STATE_FILE and "
        + "MCP_TEST_OAUTH_CLIENTS_FILE, or NEITHER. Exactly one was set ("
        + (legacyStateFile ? "MCP_TEST_OAUTH_STATE_FILE" : "MCP_TEST_OAUTH_CLIENTS_FILE")
        + "), which would silently fall back to the JSON backend and default the missing "
        + "file to a real path under ~/.romion."
      );
    }
    const oauth21StorageFile = env.MCP_TEST_OAUTH_STORAGE_FILE
      || ((!legacyStateFile && !legacyClientsFile)
        ? path.join(os.homedir(), ".romion", "tests_oauth.sqlite")
        : "");
    oauth21AuthorizationServer = createOAuth21AuthorizationServer({
      issuer: oauth21Issuer,
      resource: mcpResourceUrl,
      operatorSecret: secretConfig.operatorSecret,
      storageFile: oauth21StorageFile || undefined,
      startupPruneEnabled: env.MCP_TEST_OAUTH_STARTUP_PRUNE_ENABLED !== "0",
      startupPruneBackupDir: env.MCP_TEST_OAUTH_STARTUP_PRUNE_BACKUP_DIR
        || (oauth21StorageFile ? path.join(path.dirname(oauth21StorageFile), "oauth21-prune-backups") : ""),
      trustedProxyHeaders: bootstrapConfig.trustedProxy === true,
    });
  }

  const authPolicy = createAuthPolicy({
    mode: bootstrapConfig.authMode,
    tokenFile: bootstrapConfig.tokenFile,
    allowQueryToken: bootstrapConfig.allowQueryToken,
    trustedProxy: bootstrapConfig.trustedProxy,
    publicBaseUrl,
    oauthIssuer: oauth21Issuer || env.MCP_TEST_OAUTH_ISSUER,
    oauthAudience: env.MCP_TEST_OAUTH_AUDIENCE || mcpResourceUrl,
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

  const { auditLog, documentRuntimeContext, toolIntrospection, toolsList, registryContext } = createRuntimeSupportAssembly({
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

  if (oauth21AuthorizationServer && typeof oauth21AuthorizationServer.setAuditLog === "function") {
    oauth21AuthorizationServer.setAuditLog(auditLog);
  }

  if (runtimeSideEffectsEnabled) {
    const { contentStageStorageFile, fileComposeStorageFile } = resolveStructuredFileStoragePaths({ env, port });
    getDefaultContentStageManager({
      audit: (payload) => {
        const { event, ...details } = payload;
        auditLog(event, details);
      },
      storageFile: contentStageStorageFile,
    });
    getDefaultFileComposeManager({
      audit: (payload) => {
        const { event, ...details } = payload;
        auditLog(event, details);
      },
      storageFile: fileComposeStorageFile,
    });
    const processJobStorageFile = env.MCP_PROCESS_JOB_STORAGE_FILE
      || path.join(os.homedir(), ".romion", `tests_process_jobs_${port}.sqlite`);
    getDefaultProcessJobManager({
      audit: (payload) => {
        const { event, ...details } = payload;
        auditLog(event, details);
      },
      storageFile: processJobStorageFile,
      runtimeScope: mcpResourceUrl,
      serverInstanceId: serverStartId,
    });
  }

  const rateLimiter = createRuntimeRateLimiter({ env, rootDir });
  const restartController = createRestartController({
    auditLog,
    env,
    rootDir,
    rateLimiter,
    beforeExit: async () => {
      try {
        await shutdownDefaultProcessJobManager("server_restart");
      } finally {
        closeDefaultContentStageManager();
        closeDefaultFileComposeManager();
      }
    },
  });
  if (runtimeSideEffectsEnabled) restartController.start();

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
    toolIntrospection,
    toolsList,
    serverStartId,
    disableLegacyInitialize: bootstrapConfig.disableLegacyInitialize === true,
    oauth21RuntimeStatus: oauth21AuthorizationServer && typeof oauth21AuthorizationServer.status === "function"
      ? () => oauth21AuthorizationServer.status()
      : undefined,
  });

  const { getOptionalTool } = configureOptionalToolsAssembly({
    optionalTools,
    profile: runtimeProfile,
    authPolicy,
    serverProfileConfig,
    runtimeStatusProvider: getRuntimeStatus,
    auditLogPath,
    restartController,
    runtimeRegistryContextProvider: (label) => registryContext({ label }),
  });

  if (runtimeSideEffectsEnabled) {
    const toolSurfaceStateFile = env.MCP_TEST_TOOL_SURFACE_STATE_FILE || defaultToolSurfaceStateFile(rootDir);
    evaluateToolSurfaceState({
      stateFile: toolSurfaceStateFile,
      currentSurface: toolIntrospection().toolSurface,
      serverStartId,
      auditLog,
    });
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
    toolIntrospection,
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
    serverStartId,
    disableLegacyInitialize: bootstrapConfig.disableLegacyInitialize === true,
  });
}

module.exports = {
  resolveStructuredFileStoragePaths,
  runServerBootstrapRuntime,
};
