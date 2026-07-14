"use strict";

const path = require("node:path");
const childProcess = require("node:child_process");

const { listWorkspaceRoots, safeWorkspacePath } = require("./workspace_roots");

const DEFAULT_TIMEOUT_MS = Number(process.env.MCP_PROCESS_TIMEOUT_MS || 30000);
const MAX_TIMEOUT_MS = Number(process.env.MCP_PROCESS_MAX_TIMEOUT_MS || 120000);
const DEFAULT_MAX_OUTPUT_CHARS = Number(process.env.MCP_PROCESS_MAX_OUTPUT_CHARS || 60000);
const MAX_OUTPUT_CHARS = Number(process.env.MCP_PROCESS_HARD_OUTPUT_CHARS || 250000);

const DEFAULT_ALLOWED_COMMANDS = [
  "git",
  "node",
  "npm",
  "python",
  "py",
  "pytest",
  "powershell",
  "pwsh",
];

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
]);

const SHELL_METACHARS = /[&|;<>()`$]/;

function parseCommandAllowlist(raw = process.env.MCP_PROCESS_ALLOWLIST || "") {
  const text = String(raw || "").trim();
  if (!text) return new Set(DEFAULT_ALLOWED_COMMANDS);
  return new Set(
    text
      .split(/[;,]/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeCommand(command) {
  const text = String(command || "").trim();
  if (!text) throw new Error("Command cannot be empty.");
  if (text.includes("/") || text.includes("\\")) {
    throw new Error("Command must be a bare executable name from the allowlist.");
  }
  const allowlist = parseCommandAllowlist();
  if (!allowlist.has(text.toLowerCase())) {
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

function sanitizeEnv(env = {}) {
  const out = {};
  for (const [key, value] of Object.entries(env || {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      throw new Error(`Invalid env var name: ${key}`);
    }
    if (/token|secret|password|passwd|key/i.test(key)) {
      throw new Error(`Refusing to pass sensitive-looking env var: ${key}`);
    }
    out[key] = String(value);
  }
  return out;
}

function buildSpawnEnv(extraEnv = {}) {
  const base = {};
  for (const key of SAFE_INHERITED_ENV_KEYS) {
    if (Object.hasOwn(process.env, key) && process.env[key] !== undefined) {
      base[key] = String(process.env[key]);
    }
  }
  return {
    ...base,
    ...sanitizeEnv(extraEnv),
  };
}

function resolveCwd(cwd = ".") {
  const resolved = safeWorkspacePath(cwd || ".");
  return {
    absolutePath: resolved.absolutePath,
    displayPath: resolved.displayPath,
    rootAlias: resolved.rootAlias,
  };
}

function truncateAppend(current, chunk, maxChars) {
  if (current.length >= maxChars) {
    return { value: current, truncated: true };
  }
  const next = current + chunk;
  if (next.length <= maxChars) {
    return { value: next, truncated: false };
  }
  return { value: next.slice(0, maxChars), truncated: true };
}

function powershellPolicy(command, args) {
  const lower = command.toLowerCase();
  if (!["powershell", "pwsh"].includes(lower)) return;

  const joined = args.join(" ");
  const hasCommand = args.some((arg) => /^-command$/i.test(arg) || /^-c$/i.test(arg));
  const hasEncoded = args.some((arg) => /^-encodedcommand$/i.test(arg) || /^-enc$/i.test(arg));
  const hasFile = args.some((arg) => /^-file$/i.test(arg));

  if (hasEncoded) {
    throw new Error("PowerShell EncodedCommand is not allowed.");
  }

  if (hasCommand && process.env.MCP_ENABLE_POWERSHELL_COMMAND !== "1") {
    throw new Error("PowerShell -Command is disabled. Use -File with a workspace-local .ps1 script, or set MCP_ENABLE_POWERSHELL_COMMAND=1.");
  }

  if (hasFile) {
    const fileIndex = args.findIndex((arg) => /^-file$/i.test(arg));
    const fileArg = args[fileIndex + 1];
    if (!fileArg) throw new Error("PowerShell -File requires a script path.");
    const script = safeWorkspacePath(fileArg);
    if (path.extname(script.absolutePath).toLowerCase() !== ".ps1") {
      throw new Error("PowerShell -File must point to a .ps1 file inside an allowed workspace.");
    }
    return;
  }

  if (process.env.MCP_ALLOW_RAW_POWERSHELL !== "1") {
    throw new Error("PowerShell calls must use -File by default.");
  }

  if (SHELL_METACHARS.test(joined)) {
    throw new Error("PowerShell args contain shell metacharacters; rejected.");
  }
}

async function runProcessWithSpawn(options = {}, spawnImpl = childProcess.spawn) {
  const exe = normalizeCommand(options.command);
  const args = normalizeArgs(options.args);
  powershellPolicy(exe, args);

  const timeoutMs = clampInt(options.timeout_ms, DEFAULT_TIMEOUT_MS, 100, MAX_TIMEOUT_MS);
  const maxOutputChars = clampInt(options.max_output_chars, DEFAULT_MAX_OUTPUT_CHARS, 1000, MAX_OUTPUT_CHARS);
  const cwdInfo = resolveCwd(options.cwd || ".");

  let stdout = "";
  let stderr = "";
  let stdoutTruncated = false;
  let stderrTruncated = false;
  let timedOut = false;
  let timeoutKillError = null;
  const started = Date.now();

  const result = await new Promise((resolve) => {
    const child = spawnImpl(exe, args, {
      cwd: cwdInfo.absolutePath,
      shell: false,
      windowsHide: true,
      env: buildSpawnEnv(options.env),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      timedOut = true;
      try {
        const killed = child.kill("SIGTERM");
        if (killed === false && !timeoutKillError) timeoutKillError = "kill(SIGTERM) returned false";
      } catch (error) {
        if (!timeoutKillError) timeoutKillError = `kill(SIGTERM) failed: ${error?.message || String(error)}`;
      }
      setTimeout(() => {
        try {
          const killed = child.kill("SIGKILL");
          if (killed === false && !timeoutKillError) timeoutKillError = "kill(SIGKILL) returned false";
        } catch (error) {
          if (!timeoutKillError) timeoutKillError = `kill(SIGKILL) failed: ${error?.message || String(error)}`;
        }
      }, 1500).unref?.();
    }, timeoutMs);

    child.stdout?.on("data", (buf) => {
      const appended = truncateAppend(stdout, buf.toString("utf8"), maxOutputChars);
      stdout = appended.value;
      stdoutTruncated = stdoutTruncated || appended.truncated;
    });

    child.stderr?.on("data", (buf) => {
      const appended = truncateAppend(stderr, buf.toString("utf8"), maxOutputChars);
      stderr = appended.value;
      stderrTruncated = stderrTruncated || appended.truncated;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        status: "spawn_error",
        exit_code: null,
        signal: null,
        error: error?.message || String(error),
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        status: timedOut ? "timeout" : (code === 0 ? "ok" : "nonzero_exit"),
        exit_code: code,
        signal: signal || null,
        error: timedOut ? timeoutKillError : null,
      });
    });
  });

  return {
    status: result.status,
    command: exe,
    args,
    cwd: cwdInfo.displayPath,
    workspace: cwdInfo.rootAlias,
    exit_code: result.exit_code,
    signal: result.signal,
    timed_out: timedOut,
    duration_ms: Date.now() - started,
    stdout,
    stderr,
    stdout_truncated: stdoutTruncated,
    stderr_truncated: stderrTruncated,
    output_limit_chars: maxOutputChars,
    trace_id: options.trace_id ?? null,
    error: result.error,
  };
}

async function runProcess(options = {}) {
  return runProcessWithSpawn(options, childProcess.spawn);
}

function processRunnerPolicySnapshot() {
  return {
    status: "ok",
    allowed_commands: [...parseCommandAllowlist()].sort(),
    defaults: {
      timeout_ms: DEFAULT_TIMEOUT_MS,
      max_timeout_ms: MAX_TIMEOUT_MS,
      max_output_chars: DEFAULT_MAX_OUTPUT_CHARS,
      hard_output_chars: MAX_OUTPUT_CHARS,
    },
    powershell: {
      raw_powershell_enabled: process.env.MCP_ALLOW_RAW_POWERSHELL === "1",
      command_enabled: process.env.MCP_ENABLE_POWERSHELL_COMMAND === "1",
      default_policy: "PowerShell requires -File with a workspace-local .ps1 script unless explicitly enabled otherwise.",
    },
    workspace_roots: listWorkspaceRoots(),
    env_policy: {
      inherits_full_parent_env: false,
      inherited_keys: [...SAFE_INHERITED_ENV_KEYS].sort(),
      caller_env_is_sanitized: true,
    },
  };
}

module.exports = {
  DEFAULT_MAX_OUTPUT_CHARS,
  DEFAULT_TIMEOUT_MS,
  MAX_OUTPUT_CHARS,
  MAX_TIMEOUT_MS,
  SAFE_INHERITED_ENV_KEYS,
  parseCommandAllowlist,
  processRunnerPolicySnapshot,
  runProcess,
  runProcessWithSpawn,
};
