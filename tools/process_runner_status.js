const {
  EMPTY_INPUT_SCHEMA,
  PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
  READ_ONLY_PROCESS_ANNOTATIONS,
} = require("../src/schemas/process_tools");
const { listWorkspaceRoots } = require("../src/util/workspace_roots");

const TOOL_NAME = "process_runner_status";

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

async function execute() {
  const allowedCommands = [...parseCommandAllowlist()].sort();
  return {
    status: "ok",
    allowed_commands: allowedCommands,
    defaults: {
      timeout_ms: DEFAULT_TIMEOUT_MS,
      max_timeout_ms: MAX_TIMEOUT_MS,
      max_output_chars: DEFAULT_MAX_OUTPUT_CHARS,
      hard_output_chars: MAX_OUTPUT_CHARS,
    },
    powershell: {
      raw_powershell_enabled: process.env.MCP_ALLOW_RAW_POWERSHELL === "1",
      command_enabled: process.env.MCP_ENABLE_POWERSHELL_COMMAND === "1",
      default_policy:
        "PowerShell requires -File with a workspace-local .ps1 script unless explicitly enabled otherwise.",
    },
    workspace_roots: listWorkspaceRoots(),
    env_policy: {
      inherits_full_parent_env: false,
      inherited_keys: [...SAFE_INHERITED_ENV_KEYS].sort(),
      caller_env_is_sanitized: true,
    },
  };
}

const processRunnerStatusTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Process runner status",
    description:
      "Read-only process policy snapshot showing the command allowlist, timeout/output caps, workspace roots, and environment inheritance limits without executing a process.",
    inputSchema: EMPTY_INPUT_SCHEMA,
    outputSchema: PROCESS_RUNNER_STATUS_OUTPUT_SCHEMA,
    annotations: READ_ONLY_PROCESS_ANNOTATIONS,
  },
  execute,
  summarizeArgs() {
    return { operation: TOOL_NAME };
  },
  resultStats(payload = {}) {
    return {
      result_count: Array.isArray(payload.allowed_commands)
        ? payload.allowed_commands.length
        : 0,
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  processRunnerStatusTool,
};
