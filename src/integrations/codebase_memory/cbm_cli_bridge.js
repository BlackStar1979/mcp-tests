"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { buildWorkRoots, safeWorkspacePath } = require("../../util/workspace_roots");
const {
  EXPECTED_NATIVE_TOOLS,
  evaluateCbmCompatibility,
} = require("./cbm_contract_registry");

const VERSION_PATTERN = /^codebase-memory-mcp\s+(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/;
const DIAGNOSTIC_MAX_CHARS = 2048;
const DEFAULT_MAX_OUTPUT_CHARS = 250000;
const HARD_MAX_OUTPUT_CHARS = 1024 * 1024;
const DETECT_CHANGES_ITEM_LIMIT = 200;
const SNIPPET_RECOVERY_MAX_FILE_BYTES = 4 * 1024 * 1024;
const SNIPPET_RECOVERY_MAX_LINES = 240;
const SOURCE_BEARING_SKIP_BASENAME_PATTERN = "(?:assets|coverage|dist|docs|scripts|tools|examples|static|migrations|integration|env|deploy|deployed|target|temp|tmp|obj|vendor|vendored)";
const SOURCE_BEARING_EXCLUDED_DIR_PATTERNS = Object.freeze([
  new RegExp(`(^|/)(?:pages/api|app/api|src/app/api|src/routes|routes|server/routes|src/server/routes)/${SOURCE_BEARING_SKIP_BASENAME_PATTERN}(/|$)`, "i"),
]);

const SAFE_INHERITED_ENV_KEYS = new Set([
  "APPDATA",
  "COMSPEC",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LANG",
  "LC_ALL",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "SYSTEMDRIVE",
  "SYSTEMROOT",
  "TEMP",
  "TERM",
  "TMP",
  "USERPROFILE",
  "CBM_ALLOWED_ROOT",
  "CBM_CACHE_DIR",
  "CBM_CONFIG_DIR",
]);

const TOOL_DEFINITIONS = Object.freeze({
  list_projects: Object.freeze({ timeoutClass: "simpleRead", mutation: false }),
  index_repository: Object.freeze({ timeoutClass: "index", mutation: true }),
  get_architecture: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  search_graph: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  query_graph: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  trace_path: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  get_code_snippet: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  get_graph_schema: Object.freeze({ timeoutClass: "simpleRead", mutation: false }),
  search_code: Object.freeze({ timeoutClass: "heavyRead", mutation: false }),
  delete_project: Object.freeze({ timeoutClass: "heavyRead", mutation: true }),
  index_status: Object.freeze({ timeoutClass: "simpleRead", mutation: false }),
  detect_changes: Object.freeze({ timeoutClass: "heavyRead", mutation: false, maxOutputChars: HARD_MAX_OUTPUT_CHARS }),
  manage_adr: Object.freeze({ timeoutClass: "heavyRead", mutation: true }),
  ingest_traces: Object.freeze({ timeoutClass: "heavyRead", mutation: true }),
});

let cachedAvailability = null;
let activeMutationTool = "";
let activeHeavyReads = 0;
const heavyReadQueue = [];
const HEAVY_READ_CAPACITY = 2;

function acquireHeavyReadSlot(timeoutMs) {
  const queuedAt = Date.now();
  if (activeHeavyReads < HEAVY_READ_CAPACITY) {
    activeHeavyReads += 1;
    return Promise.resolve({ acquired: true, queue_wait_ms: 0 });
  }
  return new Promise((resolve) => {
    const entry = { resolve, queuedAt, timer: null };
    entry.timer = setTimeout(() => {
      const index = heavyReadQueue.indexOf(entry);
      if (index >= 0) heavyReadQueue.splice(index, 1);
      resolve({ acquired: false, queue_wait_ms: Date.now() - queuedAt });
    }, timeoutMs);
    heavyReadQueue.push(entry);
  });
}

function releaseHeavyReadSlot() {
  if (activeHeavyReads > 0) activeHeavyReads -= 1;
  const next = heavyReadQueue.shift();
  if (!next) return;
  clearTimeout(next.timer);
  activeHeavyReads += 1;
  next.resolve({ acquired: true, queue_wait_ms: Date.now() - next.queuedAt });
}

function clampInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.trunc(parsed)));
}

function defaultExecutablePath(env = process.env, platform = process.platform) {
  if (platform === "win32") {
    const localAppData = String(env.LOCALAPPDATA || "").trim();
    if (localAppData) {
      return path.join(localAppData, "Programs", "codebase-memory-mcp", "codebase-memory-mcp.exe");
    }
    const userProfile = String(env.USERPROFILE || "").trim();
    if (userProfile) {
      return path.join(userProfile, "AppData", "Local", "Programs", "codebase-memory-mcp", "codebase-memory-mcp.exe");
    }
    return "codebase-memory-mcp.exe";
  }

  const home = String(env.HOME || "").trim();
  return home ? path.join(home, ".local", "bin", "codebase-memory-mcp") : "codebase-memory-mcp";
}

function resolveExecutablePath(options = {}) {
  const configured = String(
    options.executablePath
      || process.env.CBM_EXE_PATH
      || defaultExecutablePath()
  ).trim();
  return path.normalize(configured);
}

function defaultAllowedRoot(options = {}) {
  if (options.allowedRoot) return path.resolve(String(options.allowedRoot));
  const roots = options.workspaceOptions?.roots || buildWorkRoots(options.workspaceOptions || {});
  const primaryAlias = options.workspaceOptions?.primaryAlias || "work";
  return path.resolve(roots.get(primaryAlias));
}

function readExecutableIdentity(executablePath, options = {}, includeSha256 = true) {
  if (typeof options.identityReader === "function") {
    const identity = options.identityReader(executablePath, { includeSha256 });
    return {
      path: path.normalize(String(identity.path || executablePath)),
      size: Number(identity.size || 0),
      mtime_ms: Number(identity.mtime_ms || 0),
      sha256: includeSha256 ? String(identity.sha256 || "") : String(identity.sha256 || ""),
    };
  }
  const stats = fs.statSync(executablePath);
  return {
    path: path.normalize(executablePath),
    size: Number(stats.size),
    mtime_ms: Number(stats.mtimeMs),
    sha256: includeSha256
      ? crypto.createHash("sha256").update(fs.readFileSync(executablePath)).digest("hex")
      : "",
  };
}

function sameFastIdentity(left, right) {
  return Boolean(left && right)
    && path.normalize(String(left.path || "")) === path.normalize(String(right.path || ""))
    && Number(left.size) === Number(right.size)
    && Number(left.mtime_ms) === Number(right.mtime_ms);
}

function parseNativeToolsFromHelp(helpText) {
  const block = String(helpText || "").match(/\nTools:\s*([\s\S]*?)(?:\r?\n\r?\n|$)/);
  if (!block) return [];
  const names = block[1].match(/[a-z][a-z0-9_]+/g) || [];
  return [...new Set(names)];
}

function buildTimeoutPolicy(options = {}) {
  const provided = options.timeouts || {};
  const hardIndex = clampInteger(
    provided.hardIndex ?? process.env.MCP_TEST_CBM_HARD_INDEX_TIMEOUT_MS,
    30 * 60 * 1000,
    1000,
    30 * 60 * 1000
  );
  const index = Math.min(
    clampInteger(
      provided.index ?? process.env.MCP_TEST_CBM_INDEX_TIMEOUT_MS,
      10 * 60 * 1000,
      50,
      30 * 60 * 1000
    ),
    hardIndex
  );

  return Object.freeze({
    probe: clampInteger(
      provided.probe ?? process.env.MCP_TEST_CBM_PROBE_TIMEOUT_MS,
      5000,
      50,
      30000
    ),
    simpleRead: clampInteger(
      provided.simpleRead ?? process.env.MCP_TEST_CBM_SIMPLE_READ_TIMEOUT_MS,
      30000,
      50,
      120000
    ),
    heavyRead: clampInteger(
      provided.heavyRead ?? process.env.MCP_TEST_CBM_HEAVY_READ_TIMEOUT_MS,
      60000,
      50,
      300000
    ),
    index,
    hardIndex,
  });
}

function resolveMaxOutputChars(options = {}) {
  return clampInteger(
    options.maxOutputChars ?? process.env.MCP_TEST_CBM_MAX_OUTPUT_CHARS,
    DEFAULT_MAX_OUTPUT_CHARS,
    1024,
    HARD_MAX_OUTPUT_CHARS
  );
}

function sanitizeExtraEnv(extraEnv = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(extraEnv || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid CBM environment variable name: ${key}`);
    }
    if (/token|secret|password|passwd|api[_-]?key/i.test(key)) {
      throw new Error(`Refusing sensitive-looking CBM environment variable: ${key}`);
    }
    sanitized[key] = String(value);
  }
  return sanitized;
}

function pathWithinRoot(rootValue, candidateValue) {
  const root = path.resolve(String(rootValue || ""));
  const candidate = path.resolve(String(candidateValue || ""));
  const left = process.platform === "win32" ? root.toLowerCase() : root;
  const right = process.platform === "win32" ? candidate.toLowerCase() : candidate;
  return right === left || right.startsWith(left.endsWith(path.sep) ? left : left + path.sep);
}

function buildChildEnv(extraEnv = {}, options = {}) {
  const env = {};
  for (const key of SAFE_INHERITED_ENV_KEYS) {
    if (Object.hasOwn(process.env, key) && process.env[key] !== undefined) {
      env[key] = String(process.env[key]);
    }
  }
  const sanitized = sanitizeExtraEnv(extraEnv);
  const authorizedRoot = path.resolve(String(options.allowedRoot || defaultAllowedRoot(options)));
  const requestedRoot = String(sanitized.CBM_ALLOWED_ROOT || env.CBM_ALLOWED_ROOT || "").trim();
  const allowedRoot = requestedRoot && pathWithinRoot(authorizedRoot, requestedRoot)
    ? path.resolve(requestedRoot)
    : authorizedRoot;
  return { ...env, ...sanitized, CBM_ALLOWED_ROOT: allowedRoot };
}

function commandPrefixArgs(options = {}) {
  if (!Array.isArray(options.commandPrefixArgs)) return [];
  return options.commandPrefixArgs.map((value) => String(value));
}

function baseAvailability(options = {}) {
  const executablePath = resolveExecutablePath(options);
  return {
    enabled: true,
    available: false,
    executable_path: executablePath,
    executable_exists: false,
    executable_regular_file: false,
    executable_size: 0,
    executable_mtime_ms: 0,
    executable_sha256: "",
    version_probe_ok: false,
    version: "",
    manifest_version: "",
    compatibility_status: "probe_failed",
    compatibility_accepted: false,
    native_tool_count: 0,
    native_tools: [],
    binary_changed_since_probe: Boolean(options.binaryChangedSinceProbe),
    allowed_root: defaultAllowedRoot(options),
    error_code: "",
    error: "",
    watcher_mode: "not_managed_by_bridge",
    freshness_note: "Read operations use the latest successful CBM index and never trigger implicit indexing.",
    timeouts_ms: normalizeTimeoutStatus(buildTimeoutPolicy(options)),
  };
}

function normalizeTimeoutStatus(timeouts) {
  return {
    probe: timeouts.probe,
    simple_read: timeouts.simpleRead,
    heavy_read: timeouts.heavyRead,
    index: timeouts.index,
    hard_index: timeouts.hardIndex,
  };
}

function probeCbmAvailability(options = {}) {
  const status = baseAvailability(options);
  const executablePath = status.executable_path;
  const spawnSyncImpl = options.spawnSyncImpl || childProcess.spawnSync;

  try {
    if (!fs.existsSync(executablePath)) {
      status.error_code = "executable_missing";
      status.error = "Configured codebase-memory-mcp executable does not exist.";
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }

    status.executable_exists = true;
    const stats = fs.statSync(executablePath);
    if (!stats.isFile()) {
      status.error_code = "executable_not_file";
      status.error = "Configured codebase-memory-mcp path is not a regular file.";
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }
    status.executable_regular_file = true;

    const identity = readExecutableIdentity(executablePath, options, true);
    status.executable_size = identity.size;
    status.executable_mtime_ms = identity.mtime_ms;
    status.executable_sha256 = identity.sha256;

    const args = [...commandPrefixArgs(options), "--version"];
    const result = spawnSyncImpl(executablePath, args, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: buildChildEnv(options.env, { ...options, allowedRoot: defaultAllowedRoot(options) }),
      encoding: "utf8",
      timeout: buildTimeoutPolicy(options).probe,
      maxBuffer: Math.max(resolveMaxOutputChars(options) * 2, 64 * 1024),
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.error) {
      const timedOut = result.error.code === "ETIMEDOUT";
      status.error_code = timedOut ? "probe_timeout" : "probe_spawn_error";
      status.error = timedOut
        ? "codebase-memory-mcp version probe timed out."
        : `codebase-memory-mcp version probe failed: ${result.error.message || String(result.error)}`;
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }

    if (result.status !== 0) {
      status.error_code = "probe_nonzero_exit";
      status.error = `codebase-memory-mcp version probe exited with code ${result.status}.`;
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }

    const output = String(result.stdout || "").trim();
    const match = output.match(VERSION_PATTERN);
    if (!match) {
      status.error_code = "invalid_version_output";
      status.error = "codebase-memory-mcp version output did not match the expected format.";
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }

    status.version_probe_ok = true;
    status.version = match[1];

    const helpArgs = [...commandPrefixArgs(options), "--help"];
    const helpResult = spawnSyncImpl(executablePath, helpArgs, {
      cwd: process.cwd(),
      shell: false,
      windowsHide: true,
      env: buildChildEnv(options.env, { ...options, allowedRoot: defaultAllowedRoot(options) }),
      encoding: "utf8",
      timeout: buildTimeoutPolicy(options).probe,
      maxBuffer: Math.max(resolveMaxOutputChars(options) * 2, 64 * 1024),
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (helpResult.error || helpResult.status !== 0) {
      status.error_code = helpResult.error ? "probe_spawn_error" : "probe_nonzero_exit";
      status.error = "codebase-memory-mcp native tool discovery failed.";
      cachedAvailability = Object.freeze(status);
      return cachedAvailability;
    }

    status.native_tools = parseNativeToolsFromHelp(helpResult.stdout);
    status.native_tool_count = status.native_tools.length;
    const compatibility = evaluateCbmCompatibility({
      version: status.version,
      nativeTools: status.native_tools,
      executableSha256: status.executable_sha256,
    });
    status.manifest_version = compatibility.manifest_version;
    status.compatibility_status = compatibility.status;
    status.compatibility_accepted = compatibility.accepted;
    status.available = compatibility.accepted;
    if (!compatibility.accepted) {
      status.error_code = compatibility.status === "contract_mismatch" ? "contract_mismatch" : "version_incompatible";
      status.error = "codebase-memory-mcp compatibility check failed: " + compatibility.status + ".";
    }
    cachedAvailability = Object.freeze(status);
    return cachedAvailability;
  } catch (error) {
    status.error_code = "probe_exception";
    status.error = error?.message || String(error);
    cachedAvailability = Object.freeze(status);
    return cachedAvailability;
  }
}

function getCbmAvailability(options = {}) {
  if (!cachedAvailability) return probeCbmAvailability(options);

  try {
    const executablePath = resolveExecutablePath(options);
    if (!fs.existsSync(executablePath)) {
      return probeCbmAvailability({ ...options, binaryChangedSinceProbe: true });
    }
    const identity = readExecutableIdentity(executablePath, options, false);
    const cachedIdentity = {
      path: cachedAvailability.executable_path,
      size: cachedAvailability.executable_size,
      mtime_ms: cachedAvailability.executable_mtime_ms,
    };
    if (!sameFastIdentity(identity, cachedIdentity)) {
      return probeCbmAvailability({ ...options, binaryChangedSinceProbe: true });
    }
  } catch {
    return probeCbmAvailability({ ...options, binaryChangedSinceProbe: true });
  }

  return cachedAvailability;
}

function appendBounded(current, chunk, maxChars) {
  const text = String(chunk || "");
  if (current.length >= maxChars) {
    return { value: current, truncated: true };
  }
  const remaining = maxChars - current.length;
  if (text.length > remaining) {
    return { value: current + text.slice(0, remaining), truncated: true };
  }
  return { value: current + text, truncated: false };
}

function diagnosticExcerpt(...parts) {
  return parts
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, DIAGNOSTIC_MAX_CHARS);
}

function killChild(child) {
  try {
    child.kill("SIGTERM");
  } catch {}
  const forceTimer = setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {}
  }, 500);
  forceTimer.unref?.();
}

async function runCbmProcess(toolName, argsObject, options = {}) {
  const executablePath = resolveExecutablePath(options);
  const definition = TOOL_DEFINITIONS[toolName];
  const timeouts = buildTimeoutPolicy(options);
  const timeoutMs = clampInteger(options.timeoutMs, timeouts[definition.timeoutClass], 1, timeouts.hardIndex);
  const maxOutputChars = Math.max(resolveMaxOutputChars(options), Number(definition.maxOutputChars || 0));
  const spawnImpl = options.spawnImpl || childProcess.spawn;
  const inputJson = JSON.stringify(argsObject || {});
  const args = [
    ...commandPrefixArgs(options),
    "cli",
    "--json",
    toolName,
  ];
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let child;
    let stdout = "";
    let stderr = "";
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let outputLimited = false;
    let settled = false;

    function finish(payload) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      resolve({
        ...payload,
        executable_path: executablePath,
        args,
        duration_ms: Date.now() - startedAt,
        stdout,
        stderr,
        stdout_truncated: stdoutTruncated,
        stderr_truncated: stderrTruncated,
        timed_out: timedOut,
        output_limited: outputLimited,
      });
    }

    try {
      child = spawnImpl(executablePath, args, {
        cwd: process.cwd(),
        shell: false,
        windowsHide: true,
        env: buildChildEnv(options.env, { ...options, allowedRoot: defaultAllowedRoot(options) }),
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({
        status: "spawn_error",
        exit_code: null,
        signal: null,
        error: error?.message || String(error),
        executable_path: executablePath,
        args,
        duration_ms: Date.now() - startedAt,
        stdout: "",
        stderr: "",
        stdout_truncated: false,
        stderr_truncated: false,
        timed_out: false,
        output_limited: false,
      });
      return;
    }

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killChild(child);
    }, timeoutMs);

    child.stdin?.on("error", (error) => {
      killChild(child);
      finish({
        status: "spawn_error",
        exit_code: null,
        signal: null,
        error: error?.message || String(error),
      });
    });
    try {
      child.stdin.end(inputJson, "utf8");
    } catch (error) {
      killChild(child);
      finish({
        status: "spawn_error",
        exit_code: null,
        signal: null,
        error: error?.message || String(error),
      });
    }

    child.stdout?.on("data", (buffer) => {
      const appended = appendBounded(stdout, buffer.toString("utf8"), maxOutputChars);
      stdout = appended.value;
      if (appended.truncated && !stdoutTruncated) {
        stdoutTruncated = true;
        outputLimited = true;
        killChild(child);
      }
    });

    child.stderr?.on("data", (buffer) => {
      const appended = appendBounded(stderr, buffer.toString("utf8"), maxOutputChars);
      stderr = appended.value;
      if (appended.truncated && !stderrTruncated) {
        stderrTruncated = true;
        outputLimited = true;
        killChild(child);
      }
    });

    child.on("error", (error) => {
      finish({
        status: "spawn_error",
        exit_code: null,
        signal: null,
        error: error?.message || String(error),
      });
    });

    child.on("close", (code, signal) => {
      finish({
        status: timedOut
          ? "timeout"
          : outputLimited
            ? "output_limit"
            : code === 0
              ? "ok"
              : "nonzero_exit",
        exit_code: code,
        signal: signal || null,
        error: "",
      });
    });
  });
}

function normalizeCbmPayload(parsed) {
  let result = parsed;
  let toolReportedError = Boolean(parsed && parsed.isError === true);

  if (parsed && Array.isArray(parsed.content)) {
    const textParts = parsed.content
      .filter((item) => item && item.type === "text" && typeof item.text === "string")
      .map((item) => item.text);
    const text = textParts.join("\n");
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        result = { text };
      }
    } else {
      result = { content: parsed.content };
    }
  }

  if (result && typeof result === "object" && typeof result.error === "string" && result.error) {
    toolReportedError = true;
  }

  return { result, toolReportedError };
}

function normalizeScopePath(value) {
  return String(value || "").trim().replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function pathMatchesScope(filePath, scope) {
  const file = normalizeScopePath(filePath);
  const target = normalizeScopePath(scope);
  if (!file || !target) return false;
  const left = process.platform === "win32" ? file.toLowerCase() : file;
  const right = process.platform === "win32" ? target.toLowerCase() : target;
  return left === right || left.startsWith(right + "/");
}

function pathIdentity(value) {
  const normalized = normalizeScopePath(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function uniqueChangedFiles(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const normalized = normalizeScopePath(value);
    if (!normalized) continue;
    const key = pathIdentity(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function uniqueImpactedSymbols(values) {
  const seen = new Set();
  const unique = [];
  for (const value of values) {
    const normalized = value && typeof value === "object" && !Array.isArray(value)
      ? {
          ...value,
          ...(value.file_path ? { file_path: normalizeScopePath(value.file_path) } : {}),
        }
      : value;
    const key = normalized && typeof normalized === "object" && !Array.isArray(normalized)
      ? JSON.stringify([
          String(normalized.qualified_name || normalized.name || ""),
          pathIdentity(normalized.file_path || ""),
          String(normalized.label || ""),
          String(normalized.depth ?? ""),
        ])
      : `${typeof normalized}:${String(normalized)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(normalized);
  }
  return unique;
}

function isVolatileNativeWarning(value) {
  return /^search took \d+ms \(>5s\); /i.test(String(value || ""));
}

function sanitizeResultWarnings(result) {
  if (!result || typeof result !== "object" || Array.isArray(result) || !Array.isArray(result.warnings)) return result;
  const filtered = result.warnings
    .map((warning) => String(warning).slice(0, 500))
    .filter((warning) => !isVolatileNativeWarning(warning));
  if (filtered.length === result.warnings.length) return result;
  const sanitized = { ...result };
  if (filtered.length > 0) sanitized.warnings = filtered;
  else delete sanitized.warnings;
  return sanitized;
}

function isSemanticOnlySearchGraph(args = {}) {
  const semanticQuery = Array.isArray(args.semantic_query) ? args.semantic_query.filter((value) => String(value || "").trim()) : [];
  if (semanticQuery.length === 0) return false;
  return [
    "query",
    "label",
    "name_pattern",
    "qn_pattern",
    "file_pattern",
    "relationship",
    "min_degree",
    "max_degree",
    "exclude_entry_points",
    "include_connected",
  ].every((key) => args[key] === undefined || args[key] === null || args[key] === "");
}

function excludedDirs(result) {
  const dirs = result?.excluded?.dirs;
  return Array.isArray(dirs) ? dirs.map((value) => normalizeScopePath(value)).filter(Boolean) : [];
}

function sourceBearingExcludedDirs(result) {
  return excludedDirs(result).filter((dir) => SOURCE_BEARING_EXCLUDED_DIR_PATTERNS.some((pattern) => pattern.test(dir)));
}

function hasNonAsciiText(value) {
  return typeof value === "string" && /[^\x00-\x7F]/.test(value);
}

function firstNonAsciiText(...values) {
  return values.find((value) => hasNonAsciiText(value)) || "";
}

function firstWhitespaceText(...values) {
  return values.find((value) => typeof value === "string" && /\s/.test(value)) || "";
}

function withBridgeAnalysis(result, patch) {
  return {
    ...result,
    bridge_analysis: {
      ...(result.bridge_analysis && typeof result.bridge_analysis === "object" && !Array.isArray(result.bridge_analysis)
        ? result.bridge_analysis
        : {}),
      ...patch,
    },
  };
}

function queryContainsInlinePropertyMap(query) {
  return /\(\s*[A-Za-z_][A-Za-z0-9_]*?(?::[A-Za-z_][A-Za-z0-9_]*)?\s*\{[^}]+}\s*\)/.test(String(query || ""));
}

function queryContainsUnlabeledSourceRelationship(query) {
  return /MATCH\s*\(\s*(?:[A-Za-z_][A-Za-z0-9_]*)?\s*\)\s*-\s*\[/i.test(String(query || ""));
}

function queryContainsTypeFunction(query) {
  return /\btype\s*\(/i.test(String(query || ""));
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function snippetSymbolName(result, args = {}) {
  const explicit = String(result?.name || "").trim();
  if (explicit) return explicit;
  const qualified = String(result?.qualified_name || args.qualified_name || "").trim();
  if (!qualified) return "";
  return qualified.split(/::|[./#]/).filter(Boolean).at(-1) || "";
}

function lineDeclarationScore(line, symbolName) {
  const escaped = escapeRegExp(symbolName);
  if (!escaped) return 0;
  const checks = [
    [new RegExp(`\\b(?:async\\s+)?function\\s+${escaped}\\b`), 120],
    [new RegExp(`\\b(?:async\\s+)?def\\s+${escaped}\\b`), 120],
    [new RegExp(`\\b(?:class|interface|enum|struct|trait)\\s+${escaped}\\b`), 115],
    [new RegExp(`\\b(?:fn|func)\\s+${escaped}\\b`), 115],
    [new RegExp(`\\b(?:const|let|var)\\s+${escaped}\\s*=`), 110],
    [new RegExp(`\\b${escaped}\\s*[:=]\\s*(?:async\\s*)?\\([^)]*\\)\\s*=>`), 105],
    [new RegExp(`\\b${escaped}\\s*\\([^;]*\\)\\s*(?:\\{|:)`), 80],
    [new RegExp(`\\b${escaped}\\b`), 10],
  ];
  for (const [pattern, score] of checks) {
    if (pattern.test(line)) return score;
  }
  return 0;
}

function recoverSnippetSource(result, args = {}, options = {}) {
  const symbolName = snippetSymbolName(result, args);
  const nativeSource = String(result?.source || result?.code || "");
  const symbolPattern = symbolName
    ? new RegExp(`(^|[^A-Za-z0-9_$])${escapeRegExp(symbolName)}([^A-Za-z0-9_$]|$)`)
    : null;
  if (!symbolName || (symbolPattern && symbolPattern.test(nativeSource))) {
    return { result, warnings: [] };
  }

  const mismatchBase = withBridgeAnalysis({
    ...result,
    native_source_integrity: "symbol_name_missing",
    source_reliable: false,
  }, {
    snippet_source_validation: {
      status: "native_mismatch",
      expected_symbol: symbolName,
      recovery_attempted: false,
      recovery_succeeded: false,
    },
  });
  const filePath = String(result?.file_path || "").trim();
  if (!filePath) {
    return {
      result: mismatchBase,
      warnings: [`get_code_snippet source did not contain ${symbolName}; no file_path was available for bounded recovery.`],
    };
  }

  try {
    const allowedRoot = fs.realpathSync(defaultAllowedRoot(options));
    const candidatePath = path.resolve(filePath);
    if (!pathWithinRoot(allowedRoot, candidatePath)) {
      throw new Error("snippet file path is outside the authorized workspace root");
    }
    const candidateStats = fs.lstatSync(candidatePath);
    if (candidateStats.isSymbolicLink() || !candidateStats.isFile()) {
      throw new Error("snippet file path is not a regular non-symlink file");
    }
    const realPath = fs.realpathSync(candidatePath);
    if (!pathWithinRoot(allowedRoot, realPath)) {
      throw new Error("snippet real path escapes the authorized workspace root");
    }
    if (candidateStats.size > SNIPPET_RECOVERY_MAX_FILE_BYTES) {
      throw new Error(`snippet file exceeds ${SNIPPET_RECOVERY_MAX_FILE_BYTES} bytes`);
    }

    const lines = fs.readFileSync(realPath, "utf8").split(/\r?\n/);
    const nativeStart = Number(result.start_line || 0);
    const candidates = [];
    for (let index = 0; index < lines.length; index += 1) {
      const score = lineDeclarationScore(lines[index], symbolName);
      if (score > 0) {
        candidates.push({
          index,
          score,
          distance: nativeStart > 0 ? Math.abs(index + 1 - nativeStart) : 0,
        });
      }
    }
    candidates.sort((left, right) => right.score - left.score || left.distance - right.distance || left.index - right.index);
    const best = candidates[0];
    if (!best || best.score < 80) {
      throw new Error("no declaration-like symbol occurrence was found");
    }

    const nativeEnd = Number(result.end_line || 0);
    const declaredLineCount = Number(result.lines || 0);
    const spanLineCount = nativeStart > 0 && nativeEnd >= nativeStart
      ? nativeEnd - nativeStart + 1
      : 0;
    const lineCount = Math.max(
      1,
      Math.min(SNIPPET_RECOVERY_MAX_LINES, declaredLineCount || spanLineCount || 40)
    );
    const neighborPadding = args.include_neighbors ? 5 : 0;
    const startIndex = Math.max(0, best.index - neighborPadding);
    const endIndexExclusive = Math.min(lines.length, best.index + lineCount + neighborPadding);
    const recoveredSource = lines.slice(startIndex, endIndexExclusive).join("\n");
    if (!symbolPattern.test(recoveredSource)) {
      throw new Error("recovered source still does not contain the expected symbol");
    }

    return {
      result: withBridgeAnalysis({
        ...result,
        native_start_line: nativeStart,
        native_end_line: nativeEnd,
        start_line: startIndex + 1,
        end_line: endIndexExclusive,
        source: recoveredSource,
        native_source_integrity: "symbol_name_missing",
        source_integrity: "bridge_recovered",
        source_reliable: true,
        source_recovered_by_bridge: true,
      }, {
        snippet_source_validation: {
          status: "bridge_recovered",
          expected_symbol: symbolName,
          recovery_attempted: true,
          recovery_succeeded: true,
          declaration_line: best.index + 1,
          declaration_score: best.score,
        },
      }),
      warnings: [`get_code_snippet native source did not contain ${symbolName}; the bridge recovered a bounded source range from the verified workspace file.`],
    };
  } catch (error) {
    return {
      result: withBridgeAnalysis({
        ...mismatchBase,
        source_integrity: "native_mismatch_unrecovered",
      }, {
        snippet_source_validation: {
          status: "native_mismatch_unrecovered",
          expected_symbol: symbolName,
          recovery_attempted: true,
          recovery_succeeded: false,
          reason: String(error?.message || error).slice(0, 300),
        },
      }),
      warnings: [`get_code_snippet source did not contain ${symbolName}; bounded recovery failed: ${String(error?.message || error).slice(0, 300)}.`],
    };
  }
}

function boundConnectorResult(toolName, result, args = {}, options = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return { result, warnings: [] };
  }
  const warnings = [];
  let bounded = sanitizeResultWarnings(result);
  if (toolName === "search_graph" && isSemanticOnlySearchGraph(args)) {
    const structuralResults = Array.isArray(result.results) ? result.results : [];
    if (structuralResults.length > 0) {
      bounded = {
        ...bounded,
        results: [],
        semantic_only_structural_results_suppressed: true,
        semantic_only_structural_results_total: structuralResults.length,
        bridge_analysis: {
          ...(bounded.bridge_analysis && typeof bounded.bridge_analysis === "object" && !Array.isArray(bounded.bridge_analysis)
            ? bounded.bridge_analysis
            : {}),
          semantic_only_search: true,
          structural_results_suppressed: structuralResults.length,
        },
      };
      warnings.push("search_graph semantic-only request returned unfiltered structural results; the bridge suppressed them and preserved semantic_results.");
    }
  }
  if (toolName === "index_repository") {
    const sourceDirs = sourceBearingExcludedDirs(result);
    if (sourceDirs.length > 0) {
      bounded = {
        ...bounded,
        source_bearing_excluded_dirs: sourceDirs,
        source_bearing_excluded_dir_count: sourceDirs.length,
      };
      warnings.push(`Native CBM excluded possible source-bearing framework route directories: ${sourceDirs.slice(0, 5).join(", ")}.`);
    }
    if (process.platform === "win32" && firstNonAsciiText(args.repo_path, args.path)) {
      bounded = withBridgeAnalysis({
        ...bounded,
        non_ascii_index_path_windows_caveat: true,
      }, {
        non_ascii_index_path: true,
        windows_path_utf8_caveat: true,
      });
      warnings.push("index_repository used a non-ASCII path on Windows; native CBM v0.9.0 may later report source unavailable or false zero code matches for this project. Prefer an ASCII workspace alias or verify with repository truth.");
    }
    if (firstWhitespaceText(args.repo_path, args.path)) {
      bounded = withBridgeAnalysis({
        ...bounded,
        path_with_space_index_path_caveat: true,
      }, {
        path_with_space_index_path: true,
        search_code_path_space_caveat: true,
      });
      warnings.push("index_repository used a path containing whitespace; native CBM may later return false zero search_code matches for this project on affected platforms. Prefer a no-space workspace alias or verify with graph/source tools.");
    }
  }
  if (toolName === "search_code" && process.platform === "win32" && hasNonAsciiText(args.pattern)) {
    bounded = withBridgeAnalysis({
      ...bounded,
      non_ascii_search_code_windows_caveat: true,
    }, {
      non_ascii_pattern: true,
      windows_search_code_utf8_caveat: true,
    });
    warnings.push("search_code used a non-ASCII pattern on Windows; native CBM v0.9.0 may return false zero matches due to UTF-8/ANSI content pipeline issues. Verify with repository truth or get_code_snippet.");
  }
  if (["search_code", "get_code_snippet"].includes(toolName) && process.platform === "win32" && firstNonAsciiText(args.project, args.project_name)) {
    bounded = withBridgeAnalysis({
      ...bounded,
      non_ascii_project_windows_caveat: true,
    }, {
      non_ascii_project: true,
      windows_project_utf8_caveat: true,
    });
    warnings.push(`${toolName} used a non-ASCII project identifier on Windows; if the project name came from a non-ASCII path, native CBM v0.9.0 may return false empty or source-unavailable results. Verify against repository truth.`);
  }
  if (["search_code", "get_code_snippet"].includes(toolName) && firstWhitespaceText(args.project, args.project_name)) {
    bounded = withBridgeAnalysis({
      ...bounded,
      project_with_space_caveat: true,
    }, {
      project_with_space: true,
      search_code_path_space_caveat: toolName === "search_code",
    });
    warnings.push(`${toolName} used a project identifier containing whitespace; if the project name came from a path with spaces, native CBM may return false empty or source-unavailable results. Verify against repository truth or graph tools.`);
  }
  if (toolName === "get_code_snippet") {
    const verifiedSnippet = recoverSnippetSource(bounded, args, options);
    bounded = verifiedSnippet.result;
    warnings.push(...verifiedSnippet.warnings);
  }
  if (toolName === "detect_changes") {
    bounded = { ...bounded };
    const nativeChangedFiles = Array.isArray(result.changed_files) ? result.changed_files : [];
    const nativeImpactedSymbols = Array.isArray(result.impacted_symbols) ? result.impacted_symbols : [];
    const normalizedChangedFiles = uniqueChangedFiles(nativeChangedFiles);
    const normalizedImpactedSymbols = uniqueImpactedSymbols(nativeImpactedSymbols);
    const removedChangedFiles = nativeChangedFiles.length - normalizedChangedFiles.length;
    const removedImpactedSymbols = nativeImpactedSymbols.length - normalizedImpactedSymbols.length;
    const scope = normalizeScopePath(args.scope);
    let changedFiles = normalizedChangedFiles;
    let impactedSymbols = normalizedImpactedSymbols;
    let scopeUnresolvedImpactedSymbols = 0;
    bounded.native_changed_files_total = nativeChangedFiles.length;
    bounded.native_impacted_symbols_total = nativeImpactedSymbols.length;
    bounded.normalized_changed_files_total = normalizedChangedFiles.length;
    bounded.normalized_impacted_symbols_total = normalizedImpactedSymbols.length;
    bounded.duplicate_changed_files_removed = removedChangedFiles;
    bounded.duplicate_impacted_symbols_removed = removedImpactedSymbols;
    bounded.connector_item_limit = DETECT_CHANGES_ITEM_LIMIT;
    if (removedChangedFiles > 0 || removedImpactedSymbols > 0) {
      warnings.push(
        `detect_changes duplicate normalization removed ${removedChangedFiles} changed-file entries and ${removedImpactedSymbols} impacted-symbol entries.`
      );
    }
    if (scope) {
      changedFiles = normalizedChangedFiles.filter((value) => pathMatchesScope(value, scope));
      const unresolved = normalizedImpactedSymbols.filter((item) => !item || typeof item !== "object" || !item.file_path);
      impactedSymbols = normalizedImpactedSymbols.filter((item) => item && typeof item === "object" && pathMatchesScope(item.file_path, scope));
      scopeUnresolvedImpactedSymbols = unresolved.length;
      bounded.scope = scope;
      bounded.scope_applied_by_bridge = true;
      bounded.scope_unresolved_impacted_symbols = scopeUnresolvedImpactedSymbols;
      if (unresolved.length > 0) warnings.push("Some impacted symbols lacked file paths and could not be included in the bridge-applied scope filter.");
    } else {
      bounded.scope_applied_by_bridge = false;
      bounded.scope_unresolved_impacted_symbols = 0;
    }
    bounded.changed_count = changedFiles.length;
    bounded.changed_files_total = changedFiles.length;
    bounded.impacted_symbols_total = impactedSymbols.length;
    bounded.changed_files_truncated = changedFiles.length > DETECT_CHANGES_ITEM_LIMIT;
    bounded.impacted_symbols_truncated = impactedSymbols.length > DETECT_CHANGES_ITEM_LIMIT;
    bounded.changed_files = changedFiles.slice(0, DETECT_CHANGES_ITEM_LIMIT);
    bounded.impacted_symbols = impactedSymbols.slice(0, DETECT_CHANGES_ITEM_LIMIT);
    bounded.changed_files_returned = bounded.changed_files.length;
    bounded.impacted_symbols_returned = bounded.impacted_symbols.length;
    bounded.changed_files_omitted = Math.max(0, changedFiles.length - bounded.changed_files.length);
    bounded.impacted_symbols_omitted = Math.max(0, impactedSymbols.length - bounded.impacted_symbols.length);
    if (bounded.changed_files_truncated || bounded.impacted_symbols_truncated) {
      warnings.push("detect_changes result was bounded to 200 changed files and 200 impacted symbols; total counts and truncation flags are included.");
    }
    if (changedFiles.length > 0 && impactedSymbols.length === 0) {
      bounded.impact_resolution = "unknown_or_unresolved";
      bounded.impact_resolution_reason = scopeUnresolvedImpactedSymbols > 0
        ? "scoped_impacted_symbols_without_file_paths"
        : normalizedImpactedSymbols.length > 0
          ? "impacted_symbols_filtered_by_scope"
          : "native_returned_no_impacted_symbols";
      warnings.push("detect_changes found changed files but no impacted symbols; impact is unresolved, not confirmed absent.");
    } else {
      bounded.impact_resolution = impactedSymbols.length > 0 ? "resolved" : "not_applicable";
      bounded.impact_resolution_reason = impactedSymbols.length > 0
        ? "impacted_symbols_returned"
        : "no_changed_files";
    }
    bounded.bridge_analysis = {
      scope_applied: Boolean(scope),
      duplicates_removed: {
        changed_files: removedChangedFiles,
        impacted_symbols: removedImpactedSymbols,
      },
      item_limit: DETECT_CHANGES_ITEM_LIMIT,
      changed_files: {
        native_total: nativeChangedFiles.length,
        normalized_total: normalizedChangedFiles.length,
        scoped_total: changedFiles.length,
        returned: bounded.changed_files_returned,
        omitted: bounded.changed_files_omitted,
        truncated: bounded.changed_files_truncated,
      },
      impacted_symbols: {
        native_total: nativeImpactedSymbols.length,
        normalized_total: normalizedImpactedSymbols.length,
        scoped_total: impactedSymbols.length,
        returned: bounded.impacted_symbols_returned,
        omitted: bounded.impacted_symbols_omitted,
        truncated: bounded.impacted_symbols_truncated,
        unresolved_without_file_path: scopeUnresolvedImpactedSymbols,
      },
      impact_resolution: bounded.impact_resolution,
      impact_resolution_reason: bounded.impact_resolution_reason,
    };
  }
  if (toolName === "query_graph" && Array.isArray(result.columns) && Array.isArray(result.rows)) {
    const cypherCaveats = [];
    if (queryContainsInlinePropertyMap(args.query)) {
      cypherCaveats.push("inline_property_map");
      bounded = { ...bounded, cypher_inline_property_map_caveat: true };
      warnings.push("query_graph used an inline property map in MATCH; native CBM v0.9.0 may silently return false empty results for this unsupported shape. Rewrite with WHERE before relying on it.");
    }
    if (Number.isInteger(args.max_rows) && queryContainsUnlabeledSourceRelationship(args.query)) {
      cypherCaveats.push("unlabeled_source_with_max_rows");
      bounded = { ...bounded, cypher_unlabeled_source_limit_caveat: true };
      warnings.push("query_graph used max_rows with an unlabeled source relationship pattern; native CBM v0.9.0 may apply the limit to source-candidate enumeration and return a plausible partial result. Add a source label before relying on it.");
    }
    if (queryContainsTypeFunction(args.query)) {
      cypherCaveats.push("type_function");
      bounded = { ...bounded, cypher_type_function_caveat: true };
      warnings.push("query_graph used type(); native CBM v0.9.0 may return fabricated scalar values for this unsupported function. Verify relationship types another way.");
    }
    if (cypherCaveats.length > 0) {
      bounded.bridge_analysis = {
        ...(bounded.bridge_analysis && typeof bounded.bridge_analysis === "object" && !Array.isArray(bounded.bridge_analysis)
          ? bounded.bridge_analysis
          : {}),
        cypher_caveats: cypherCaveats,
      };
    }
    const labelIndex = result.columns.findIndex((value) => /^labels\(/i.test(String(value)));
    const countIndex = result.columns.findIndex((value) => /^count\(/i.test(String(value)));
    if (labelIndex >= 0 && countIndex >= 0 && result.rows.some((row) => /^\d+$/.test(String(row?.[labelIndex] || "")))) {
      warnings.push("Native CBM returned a numeric scalar for labels() aggregation; verify this aggregation before relying on it.");
    }
  }
  if (toolName === "ingest_traces" && /not yet implemented/i.test(String(result.note || ""))) {
    bounded = {
      ...bounded,
      trace_ingestion_status: String(result.status || "accepted"),
      traces_received: Number(result.traces_received || 0),
      runtime_edges_created: 0,
      runtime_edge_creation: "not_implemented",
      runtime_edge_creation_supported: false,
    };
    warnings.push("Native CBM accepted the trace batch, but runtime edge creation is not implemented in this version.");
  }
  return { result: bounded, warnings };
}

function normalizeWarnings(result) {
  const warnings = [];
  if (result && Array.isArray(result.warnings)) {
    for (const warning of result.warnings.slice(0, 20)) {
      const text = String(warning).slice(0, 500);
      if (isVolatileNativeWarning(text)) continue;
      warnings.push(text);
    }
  }
  if (result && Array.isArray(result.skipped)) {
    for (const item of result.skipped.slice(0, 20)) {
      const pathValue = String(item?.path || item?.file || "unknown").slice(0, 300);
      const reason = String(item?.reason || item?.error || "skipped").slice(0, 300);
      warnings.push(`Skipped ${pathValue}: ${reason}`);
    }
  }
  return warnings;
}

function errorResult(toolName, errorCode, error, details = {}) {
  const queueWaitMs = Number(details.queue_wait_ms || 0);
  const executionMs = Number(details.execution_ms ?? details.duration_ms ?? 0);
  return {
    success: false,
    error_code: errorCode,
    error: String(error || "CBM operation failed."),
    cbm_tool: toolName,
    duration_ms: Number(details.total_duration_ms ?? (queueWaitMs + executionMs)),
    queue_wait_ms: queueWaitMs,
    execution_ms: executionMs,
    binary_version: String(details.binary_version || ""),
    compatibility_status: String(details.compatibility_status || ""),
    partial_success: false,
    warnings: [],
    timed_out: Boolean(details.timed_out),
    exit_code: details.exit_code ?? null,
    signal: details.signal || null,
    stdout_truncated: Boolean(details.stdout_truncated),
    stderr_truncated: Boolean(details.stderr_truncated),
    diagnostic: diagnosticExcerpt(details.diagnostic),
    result: details.result ?? null,
  };
}

async function callCbmTool(toolName, args = {}, options = {}) {
  const totalStartedAt = Date.now();
  const definition = TOOL_DEFINITIONS[toolName];
  if (!definition) {
    return errorResult(toolName, "unsupported_tool", `Unsupported CBM tool: ${toolName}`);
  }
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return errorResult(toolName, "invalid_arguments", "CBM tool arguments must be an object.");
  }

  const availability = getCbmAvailability(options);
  const baseDetails = {
    binary_version: availability.version,
    compatibility_status: availability.compatibility_status,
  };
  if (!availability.available) {
    const code = availability.compatibility_status === "contract_mismatch"
      ? "cbm_contract_mismatch"
      : availability.version_probe_ok
        ? "cbm_version_incompatible"
        : "cbm_binary_unavailable";
    return errorResult(toolName, code, availability.error || "codebase-memory-mcp is unavailable.", {
      ...baseDetails,
      diagnostic: availability.error_code,
      total_duration_ms: Date.now() - totalStartedAt,
    });
  }

  if (definition.mutation && activeMutationTool) {
    return errorResult(toolName, "mutation_busy", `Another CBM mutation is already active: ${activeMutationTool}.`, {
      ...baseDetails,
      total_duration_ms: Date.now() - totalStartedAt,
    });
  }

  const timeoutPolicy = buildTimeoutPolicy(options);
  const totalTimeoutMs = timeoutPolicy[definition.timeoutClass];
  let queueWaitMs = 0;
  let heavyReadAcquired = false;
  if (definition.timeoutClass === "heavyRead") {
    const slot = await acquireHeavyReadSlot(totalTimeoutMs);
    queueWaitMs = slot.queue_wait_ms;
    if (!slot.acquired) {
      return errorResult(toolName, "cbm_timeout", "CBM operation timed out while waiting for a heavy-read slot.", {
        ...baseDetails,
        queue_wait_ms: queueWaitMs,
        timed_out: true,
        total_duration_ms: Date.now() - totalStartedAt,
      });
    }
    heavyReadAcquired = true;
  }

  if (definition.mutation) activeMutationTool = toolName;
  try {
    const remainingTimeoutMs = Math.max(1, totalTimeoutMs - queueWaitMs);
    const execution = await runCbmProcess(toolName, args, { ...options, timeoutMs: remainingTimeoutMs });
    const details = {
      ...execution,
      ...baseDetails,
      queue_wait_ms: queueWaitMs,
      execution_ms: execution.duration_ms,
      total_duration_ms: Date.now() - totalStartedAt,
    };

    if (execution.status === "timeout") {
      return errorResult(toolName, "cbm_timeout", "CBM operation timed out and was terminated.", {
        ...details,
        diagnostic: diagnosticExcerpt(execution.stderr, execution.stdout),
      });
    }
    if (execution.status === "output_limit") {
      return errorResult(toolName, "cbm_output_limit", "CBM output exceeded the configured limit and the process was terminated.", {
        ...details,
        diagnostic: diagnosticExcerpt(execution.stderr, execution.stdout),
      });
    }
    if (execution.status === "spawn_error") {
      return errorResult(toolName, "cbm_binary_unavailable", `Failed to start codebase-memory-mcp: ${execution.error}`, {
        ...details,
        diagnostic: execution.error,
      });
    }
    if (execution.status === "nonzero_exit") {
      return errorResult(toolName, "cbm_native_rejected", `codebase-memory-mcp exited with code ${execution.exit_code}.`, {
        ...details,
        diagnostic: diagnosticExcerpt(execution.stderr, execution.stdout),
      });
    }

    const stdout = String(execution.stdout || "").trim();
    if (!stdout) {
      return errorResult(toolName, "cbm_invalid_output", "codebase-memory-mcp returned empty stdout.", details);
    }

    let parsed;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return errorResult(toolName, "cbm_invalid_output", "codebase-memory-mcp returned invalid JSON.", {
        ...details,
        diagnostic: diagnosticExcerpt(execution.stderr, stdout),
      });
    }

    const normalized = normalizeCbmPayload(parsed);
    if (normalized.toolReportedError) {
      const projectNotFound = normalized.result && normalized.result.status === "not_found";
      const message = normalized.result && typeof normalized.result.error === "string"
        ? normalized.result.error
        : normalized.result && typeof normalized.result.text === "string"
          ? normalized.result.text
          : projectNotFound
            ? "Codebase-memory project was not found."
            : "codebase-memory-mcp reported a tool error.";
      return errorResult(toolName, projectNotFound ? "cbm_project_not_found" : "cbm_native_rejected", message, {
        ...details,
        diagnostic: execution.stderr,
        result: normalized.result,
      });
    }

    const bounded = boundConnectorResult(toolName, normalized.result, args, options);
    const warnings = [...normalizeWarnings(bounded.result), ...bounded.warnings].slice(0, 40);
    return {
      success: true,
      error_code: "",
      error: "",
      cbm_tool: toolName,
      duration_ms: Date.now() - totalStartedAt,
      queue_wait_ms: queueWaitMs,
      execution_ms: execution.duration_ms,
      binary_version: availability.version,
      compatibility_status: availability.compatibility_status,
      partial_success: warnings.length > 0,
      warnings,
      timed_out: false,
      exit_code: execution.exit_code,
      signal: execution.signal,
      stdout_truncated: execution.stdout_truncated,
      stderr_truncated: execution.stderr_truncated,
      diagnostic: diagnosticExcerpt(execution.stderr),
      result: bounded.result,
    };
  } finally {
    if (definition.mutation && activeMutationTool === toolName) activeMutationTool = "";
    if (heavyReadAcquired) releaseHeavyReadSlot();
  }
}

function comparePath(value) {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function resolveCbmRepositoryPath(logicalPath, options = {}) {
  const resolved = safeWorkspacePath(logicalPath, options.workspaceOptions || {});
  const stats = fs.lstatSync(resolved.absolutePath);
  if (stats.isSymbolicLink()) {
    throw new Error("Repository path cannot be a symbolic link.");
  }
  if (!stats.isDirectory()) {
    throw new Error("Repository path must be a directory.");
  }

  const realRoot = fs.realpathSync(resolved.rootPath);
  const realPath = fs.realpathSync(resolved.absolutePath);
  const comparableRoot = comparePath(realRoot);
  const comparablePath = comparePath(realPath);
  const rootWithSeparator = comparableRoot.endsWith(path.sep)
    ? comparableRoot
    : `${comparableRoot}${path.sep}`;

  if (comparablePath !== comparableRoot && !comparablePath.startsWith(rootWithSeparator)) {
    throw new Error("Repository real path escapes the configured workspace root.");
  }

  return {
    ...resolved,
    rootPath: realRoot,
    absolutePath: realPath,
  };
}

function getCbmRuntimeStatus(options = {}) {
  const availability = getCbmAvailability(options);
  return {
    ...availability,
    enabled: true,
    index_busy: activeMutationTool === "index_repository",
    mutation_busy: Boolean(activeMutationTool),
    active_mutation_tool: activeMutationTool,
    heavy_read_capacity: HEAVY_READ_CAPACITY,
    heavy_read_active: activeHeavyReads,
    heavy_read_queued: heavyReadQueue.length,
    timeouts_ms: normalizeTimeoutStatus(buildTimeoutPolicy(options)),
  };
}

function resetCbmBridgeForTests() {
  cachedAvailability = null;
  activeMutationTool = "";
  activeHeavyReads = 0;
  while (heavyReadQueue.length) {
    const entry = heavyReadQueue.shift();
    clearTimeout(entry.timer);
    entry.resolve({ acquired: false, queue_wait_ms: 0 });
  }
}

module.exports = {
  TOOL_DEFINITIONS,
  buildTimeoutPolicy,
  callCbmTool,
  defaultExecutablePath,
  getCbmAvailability,
  getCbmRuntimeStatus,
  probeCbmAvailability,
  resetCbmBridgeForTests,
  resolveCbmRepositoryPath,
  resolveExecutablePath,
};
