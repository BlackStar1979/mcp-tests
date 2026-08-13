"use strict";

const fs = require("node:fs");
const path = require("node:path");

const { safeWorkspacePath } = require("./workspace_roots");

const LIMITS = Object.freeze({
  defaultTimeoutMs: 60000,
  maxTimeoutMs: 600000,
  defaultOutputChars: 250000,
  hardOutputChars: 1000000,
  maxConcurrent: 2,
  maxQueued: 8,
  maxRetained: 32,
  retentionMs: 1800000,
  outputReadChars: 65536,
});

const COMMAND_FAMILIES = Object.freeze({
  git: "source-control",
  node: "runtime",
  python: "runtime",
  python3: "runtime",
  py: "runtime",
  bun: "runtime",
  npm: "package",
  npx: "package",
  pnpm: "package",
  yarn: "package",
  pip: "package",
  pip3: "package",
  poetry: "package",
  uv: "package",
  pytest: "python-check",
  coverage: "python-check",
  unittest: "python-check",
  mypy: "python-check",
  pyright: "python-check",
  ruff: "python-check",
  black: "python-check",
  flake8: "python-check",
  tox: "python-check",
  vitest: "javascript-check",
  jest: "javascript-check",
  mocha: "javascript-check",
  tsx: "javascript-check",
  tsc: "javascript-check",
  eslint: "javascript-check",
  prettier: "javascript-check",
  powershell: "shell",
  pwsh: "shell",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  wsl: "shell",
  docker: "container",
  "docker-compose": "container",
});

const DEFAULT_ALLOWED_COMMANDS = Object.freeze(Object.keys(COMMAND_FAMILIES));

const BASE_INHERITED_ENV_KEYS = Object.freeze([
  "APPDATA",
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
]);

const CALLER_ENV_KEYS = Object.freeze(new Set([
  "CI",
  "CONTINUOUS_INTEGRATION",
  "FORCE_COLOR",
  "HOST",
  "MYPY_CACHE_DIR",
  "NODE_ENV",
  "NO_COLOR",
  "PORT",
  "TS_NODE_PROJECT",
  "VITEST_CACHE_DIR",
]));

const RESERVED_ENV_KEYS = Object.freeze(new Set([
  "BASH_ENV",
  "COMSPEC",
  "ENV",
  "KUBECONFIG",
  "NODE_OPTIONS",
  "NODE_PATH",
  "PATH",
  "PATHEXT",
  "PYTHONHOME",
  "PYTHONPATH",
  "PYTHONSTARTUP",
  "PYTEST_ADDOPTS",
]));

const FAMILY_INHERITED_ENV_KEYS = Object.freeze({
  package: ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"],
  container: ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "DOCKER_HOST"],
});

const FAMILY_CALLER_ENV_KEYS = Object.freeze({
  package: new Set(["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY"]),
  container: new Set(["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "DOCKER_HOST"]),
});

const PYTHON_MODULES = Object.freeze({
  pip: "pip",
  pip3: "pip",
  pytest: "pytest",
  coverage: "coverage",
  unittest: "unittest",
  mypy: "mypy",
  black: "black",
  flake8: "flake8",
  tox: "tox",
});

const JAVASCRIPT_PACKAGES = Object.freeze({
  vitest: ["vitest", "vitest"],
  jest: ["jest", "jest"],
  mocha: ["mocha", "mocha"],
  tsx: ["tsx", "tsx"],
  tsc: ["typescript", "tsc"],
  eslint: ["eslint", "eslint"],
  prettier: ["prettier", "prettier"],
  pyright: ["pyright", "pyright"],
});

function configError(message) {
  const error = new Error(message);
  error.code = "process_runner_invalid_config";
  return error;
}

function readBoundedInt(env, name, fallback, min, max) {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw configError(`${name} must be a finite integer between ${min} and ${max}.`);
  }
  return value;
}

function parseCommandAllowlist(raw, fallback = DEFAULT_ALLOWED_COMMANDS) {
  const text = String(raw || "").trim();
  const values = text
    ? text.split(/[;,]/).map((value) => value.trim().toLowerCase()).filter(Boolean)
    : [...fallback];

  const unique = [...new Set(values)];
  for (const command of unique) {
    if (!Object.hasOwn(COMMAND_FAMILIES, command)) {
      throw configError(`MCP_PROCESS_ALLOWLIST contains unsupported command: ${command}`);
    }
  }
  return Object.freeze(unique);
}

function resolveProcessRunnerConfig(env = process.env) {
  const maxTimeoutMs = readBoundedInt(
    env,
    "MCP_PROCESS_MAX_TIMEOUT_MS",
    LIMITS.maxTimeoutMs,
    100,
    LIMITS.maxTimeoutMs
  );
  const defaultTimeoutMs = readBoundedInt(
    env,
    "MCP_PROCESS_TIMEOUT_MS",
    LIMITS.defaultTimeoutMs,
    100,
    LIMITS.maxTimeoutMs
  );
  if (defaultTimeoutMs > maxTimeoutMs) {
    throw configError("MCP_PROCESS_TIMEOUT_MS must not exceed MCP_PROCESS_MAX_TIMEOUT_MS.");
  }

  const hardOutputChars = readBoundedInt(
    env,
    "MCP_PROCESS_HARD_OUTPUT_CHARS",
    LIMITS.hardOutputChars,
    1000,
    LIMITS.hardOutputChars
  );
  const defaultOutputChars = readBoundedInt(
    env,
    "MCP_PROCESS_MAX_OUTPUT_CHARS",
    LIMITS.defaultOutputChars,
    1000,
    LIMITS.hardOutputChars
  );
  if (defaultOutputChars > hardOutputChars) {
    throw configError("MCP_PROCESS_MAX_OUTPUT_CHARS must not exceed MCP_PROCESS_HARD_OUTPUT_CHARS.");
  }

  return Object.freeze({
    defaultTimeoutMs,
    maxTimeoutMs,
    defaultOutputChars,
    hardOutputChars,
    maxConcurrent: readBoundedInt(env, "MCP_PROCESS_MAX_CONCURRENT", LIMITS.maxConcurrent, 1, 8),
    maxQueued: readBoundedInt(env, "MCP_PROCESS_MAX_QUEUED", LIMITS.maxQueued, 0, 64),
    maxRetained: readBoundedInt(env, "MCP_PROCESS_MAX_RETAINED", LIMITS.maxRetained, 1, 256),
    retentionMs: readBoundedInt(env, "MCP_PROCESS_RETENTION_MS", LIMITS.retentionMs, 1000, 86400000),
    outputReadChars: LIMITS.outputReadChars,
    allowedCommands: parseCommandAllowlist(env.MCP_PROCESS_ALLOWLIST),
  });
}

function normalizeCommand(command, config) {
  const text = String(command || "").trim().toLowerCase();
  if (!text) throw new Error("Command cannot be empty.");
  if (text.includes("/") || text.includes("\\")) {
    throw new Error("Command must be a bare executable name from the allowlist.");
  }
  if (!config.allowedCommands.includes(text)) {
    throw new Error(`Command not allowed: ${text}`);
  }
  return text;
}

function normalizeArgs(args = []) {
  if (!Array.isArray(args)) throw new Error("args must be an array.");
  if (args.length > 100) throw new Error("Too many args; max 100.");
  return args.map((arg) => {
    const text = String(arg);
    if (text.length > 4000) throw new Error("Single argument too long; max 4000 chars.");
    return text;
  });
}

function enforcePowerShellPolicy(command, args, parentEnv = process.env) {
  if (command !== "powershell" && command !== "pwsh") return;
  const hasCommand = args.some((arg) => /^-(?:command|c)$/i.test(arg));
  const hasEncoded = args.some((arg) => /^-(?:encodedcommand|enc)$/i.test(arg));
  const fileIndex = args.findIndex((arg) => /^-file$/i.test(arg));

  if (hasEncoded) {
    throw new Error("PowerShell EncodedCommand is not allowed.");
  }
  if (hasCommand && parentEnv.MCP_ENABLE_POWERSHELL_COMMAND === "0") {
    throw new Error("PowerShell -Command is disabled by MCP_ENABLE_POWERSHELL_COMMAND=0.");
  }
  if (fileIndex >= 0) {
    const fileArg = args[fileIndex + 1];
    if (!fileArg) throw new Error("PowerShell -File requires a script path.");
    const script = safeWorkspacePath(fileArg);
    if (path.extname(script.absolutePath).toLowerCase() !== ".ps1") {
      throw new Error("PowerShell -File must point to a .ps1 file inside an allowed workspace.");
    }
    return;
  }
  if (parentEnv.MCP_ALLOW_RAW_POWERSHELL === "0") {
    throw new Error("PowerShell calls without -File are disabled by MCP_ALLOW_RAW_POWERSHELL=0.");
  }
}

function setInheritedEnv(out, parentEnv, keys) {
  for (const key of keys) {
    if (Object.hasOwn(parentEnv, key) && parentEnv[key] !== undefined) {
      out[key] = String(parentEnv[key]);
    }
  }
}

function buildProcessEnv(family, extraEnv = {}, _config = null, parentEnv = process.env) {
  const out = {};
  setInheritedEnv(out, parentEnv, BASE_INHERITED_ENV_KEYS);
  setInheritedEnv(out, parentEnv, FAMILY_INHERITED_ENV_KEYS[family] || []);

  const entries = Object.entries(extraEnv || {});
  if (entries.length > 32) throw new Error("Too many environment variables; max 32.");
  const familyAllowed = FAMILY_CALLER_ENV_KEYS[family] || new Set();
  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey).toUpperCase();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      throw new Error(`Invalid environment variable name: ${rawKey}`);
    }
    if (RESERVED_ENV_KEYS.has(key) || key.startsWith("MCP_PROCESS_")) {
      throw new Error(`Reserved environment variable: ${key}`);
    }
    if (/TOKEN|SECRET|PASSWORD|PASSWD|PRIVATE_KEY/.test(key)) {
      throw new Error(`Refusing sensitive-looking environment variable: ${key}`);
    }
    if (!CALLER_ENV_KEYS.has(key) && !familyAllowed.has(key)) {
      throw new Error(`Environment variable is not allowed for ${family}: ${key}`);
    }
    const value = String(rawValue);
    if (value.length > 8192) {
      throw new Error(`Environment variable value is too long: ${key}`);
    }
    out[key] = value;
  }
  return out;
}

function isRegularFile(filePath, fsImpl = fs) {
  try {
    return fsImpl.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isWindowsAppExecutionAlias(filePath, fsImpl = fs, parentEnv = process.env) {
  if (process.platform !== "win32" || typeof fsImpl.lstatSync !== "function") return false;
  const localAppData = String(parentEnv.LOCALAPPDATA || "");
  if (!localAppData) return false;
  const aliasRoot = path.resolve(localAppData, "Microsoft", "WindowsApps");
  const candidate = path.resolve(filePath);
  if (path.dirname(candidate).toLowerCase() !== aliasRoot.toLowerCase()) return false;
  try {
    return fsImpl.lstatSync(candidate).isSymbolicLink();
  } catch {
    return false;
  }
}

function pathCandidates(command, parentEnv = process.env) {
  const pathValue = String(parentEnv.PATH || "");
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? String(parentEnv.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean)
    : [""];
  const commandHasExtension = path.extname(command) !== "";
  const candidates = [];
  for (const directory of directories) {
    if (commandHasExtension) {
      candidates.push(path.resolve(directory, command));
      continue;
    }
    for (const extension of extensions) {
      candidates.push(path.resolve(directory, `${command}${extension.toLowerCase()}`));
      if (extension !== extension.toLowerCase()) {
        candidates.push(path.resolve(directory, `${command}${extension}`));
      }
    }
  }
  return candidates;
}

function findTrustedExecutable(command, dependencies = {}) {
  const fsImpl = dependencies.fs || fs;
  const parentEnv = dependencies.parentEnv || process.env;
  for (const candidate of pathCandidates(command, parentEnv)) {
    if (isRegularFile(candidate, fsImpl) || isWindowsAppExecutionAlias(candidate, fsImpl, parentEnv)) return candidate;
  }
  return null;
}

function commandNotFound(command) {
  const error = new Error(`Command not found in trusted runtime: ${command}`);
  error.code = "command_not_found";
  throw error;
}

function findWorkspacePython(cwdInfo, dependencies = {}) {
  const fsImpl = dependencies.fs || fs;
  const candidates = process.platform === "win32"
    ? [".venv/Scripts/python.exe", "venv/Scripts/python.exe"]
    : [".venv/bin/python", "venv/bin/python"];
  for (const relative of candidates) {
    const candidate = path.resolve(cwdInfo.absolutePath, relative);
    if (isRegularFile(candidate, fsImpl)) {
      return { executable: candidate, resolutionClass: "workspace_python_venv" };
    }
  }

  const parentEnv = dependencies.parentEnv || process.env;
  if (parentEnv.VIRTUAL_ENV) {
    const candidate = path.resolve(
      String(parentEnv.VIRTUAL_ENV),
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python"
    );
    if (isRegularFile(candidate, fsImpl)) {
      return { executable: candidate, resolutionClass: "parent_python_venv" };
    }
  }

  for (const name of process.platform === "win32" ? ["python", "python3"] : ["python3", "python"]) {
    const executable = findTrustedExecutable(name, dependencies);
    if (executable) return { executable, resolutionClass: "trusted_parent_path" };
  }
  return null;
}

function findNpmCli(command, dependencies = {}) {
  const fsImpl = dependencies.fs || fs;
  const cliName = command === "npm" ? "npm-cli.js" : "npx-cli.js";
  const bundled = path.resolve(path.dirname(process.execPath), "node_modules", "npm", "bin", cliName);
  if (isRegularFile(bundled, fsImpl)) {
    return { executable: process.execPath, prefixArgs: [bundled], resolutionClass: "bundled_npm_cli" };
  }
  const executable = findTrustedExecutable(command, dependencies);
  return executable
    ? { executable, prefixArgs: [], resolutionClass: "trusted_parent_path" }
    : null;
}

function readPackageBin(packagePath, binName, dependencies = {}) {
  const fsImpl = dependencies.fs || fs;
  const manifestPath = path.join(packagePath, "package.json");
  if (!isRegularFile(manifestPath, fsImpl)) return null;
  try {
    const manifest = JSON.parse(fsImpl.readFileSync(manifestPath, "utf8"));
    const relative = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[binName];
    if (!relative || typeof relative !== "string") return null;
    const candidate = path.resolve(packagePath, relative);
    const packagePrefix = packagePath.endsWith(path.sep) ? packagePath : `${packagePath}${path.sep}`;
    if (!candidate.startsWith(packagePrefix) || !isRegularFile(candidate, fsImpl)) return null;
    return candidate;
  } catch {
    return null;
  }
}

function findWorkspaceJavaScriptBin(command, cwdInfo, dependencies = {}) {
  const packageInfo = JAVASCRIPT_PACKAGES[command];
  if (!packageInfo) return null;
  const [packageName, binName] = packageInfo;
  let current = cwdInfo.absolutePath;
  const root = path.resolve(cwdInfo.rootPath);
  while (current === root || current.startsWith(`${root}${path.sep}`)) {
    const target = readPackageBin(path.join(current, "node_modules", packageName), binName, dependencies);
    if (target) {
      return {
        executable: process.execPath,
        prefixArgs: [target],
        resolutionClass: "workspace_node_package",
      };
    }
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

function resolveExecutable(command, cwdInfo, dependencies = {}) {
  if (command === "node") {
    return { executable: process.execPath, prefixArgs: [], resolutionClass: "pinned_node_runtime" };
  }

  if (Object.hasOwn(PYTHON_MODULES, command)) {
    const python = findWorkspacePython(cwdInfo, dependencies);
    if (!python) return commandNotFound(command);
    return {
      executable: python.executable,
      prefixArgs: ["-m", PYTHON_MODULES[command]],
      resolutionClass: python.resolutionClass,
    };
  }

  if (command === "py") {
    const launcher = findTrustedExecutable("py", dependencies);
    if (!launcher) return commandNotFound(command);
    return { executable: launcher, prefixArgs: [], resolutionClass: "windows_python_launcher" };
  }

  if (["python", "python3"].includes(command)) {
    const python = findWorkspacePython(cwdInfo, dependencies);
    if (!python) return commandNotFound(command);
    return { ...python, prefixArgs: [] };
  }

  if (command === "npm" || command === "npx") {
    const npm = findNpmCli(command, dependencies);
    if (!npm) return commandNotFound(command);
    return npm;
  }

  const workspaceJavaScript = findWorkspaceJavaScriptBin(command, cwdInfo, dependencies);
  if (workspaceJavaScript) return workspaceJavaScript;

  const executable = findTrustedExecutable(command, dependencies);
  if (!executable) return commandNotFound(command);
  return { executable, prefixArgs: [], resolutionClass: "trusted_parent_path" };
}

function prepareProcessInvocation(options = {}, config = PROCESS_RUNNER_CONFIG, dependencies = {}) {
  const logicalCommand = normalizeCommand(options.command, config);
  const args = normalizeArgs(options.args);
  enforcePowerShellPolicy(logicalCommand, args, dependencies.parentEnv || process.env);
  const cwdInfo = safeWorkspacePath(options.cwd || ".", { allowAbsolute: true });
  const family = COMMAND_FAMILIES[logicalCommand];
  const resolved = resolveExecutable(logicalCommand, cwdInfo, dependencies);
  return {
    logicalCommand,
    executable: resolved.executable,
    prefixArgs: resolved.prefixArgs,
    args: [...resolved.prefixArgs, ...args],
    originalArgs: args,
    family,
    resolutionClass: resolved.resolutionClass,
    cwdInfo,
    env: buildProcessEnv(family, options.env, config, dependencies.parentEnv || process.env),
  };
}

const PROCESS_RUNNER_CONFIG = resolveProcessRunnerConfig(process.env);

module.exports = {
  BASE_INHERITED_ENV_KEYS,
  COMMAND_FAMILIES,
  DEFAULT_ALLOWED_COMMANDS,
  LIMITS,
  PROCESS_RUNNER_CONFIG,
  buildProcessEnv,
  enforcePowerShellPolicy,
  findTrustedExecutable,
  prepareProcessInvocation,
  resolveProcessRunnerConfig,
};
