"use strict";

const childProcess = require("node:child_process");

const { listWorkspaceRoots } = require("./workspace_roots");
const { startProcessExecution } = require("./process_execution");
const {
  BASE_INHERITED_ENV_KEYS,
  PROCESS_RUNNER_CONFIG,
  resolveProcessRunnerConfig,
} = require("./process_runner_config");

const DEFAULT_TIMEOUT_MS = PROCESS_RUNNER_CONFIG.defaultTimeoutMs;
const MAX_TIMEOUT_MS = PROCESS_RUNNER_CONFIG.maxTimeoutMs;
const DEFAULT_MAX_OUTPUT_CHARS = PROCESS_RUNNER_CONFIG.defaultOutputChars;
const MAX_OUTPUT_CHARS = PROCESS_RUNNER_CONFIG.hardOutputChars;
const SAFE_INHERITED_ENV_KEYS = new Set([
  ...BASE_INHERITED_ENV_KEYS,
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "NO_PROXY",
  "DOCKER_HOST",
]);

function parseCommandAllowlist(raw = process.env.MCP_PROCESS_ALLOWLIST || "") {
  return new Set(resolveProcessRunnerConfig({
    ...process.env,
    MCP_PROCESS_ALLOWLIST: raw,
  }).allowedCommands);
}

async function runProcessWithSpawn(options = {}, spawnImpl = childProcess.spawn) {
  return startProcessExecution(options, { spawn: spawnImpl }).completion;
}

async function runProcess(options = {}) {
  return startProcessExecution(options).completion;
}

function processRunnerPolicySnapshot() {
  return {
    status: "ok",
    allowed_commands: [...PROCESS_RUNNER_CONFIG.allowedCommands].sort(),
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
