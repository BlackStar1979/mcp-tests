"use strict";

const MESSAGE_RULES = [
  [/Unknown process job/i, "process_job_not_found", "Process job was not found or is not owned by this client."],
  [/Command not allowed/i, "process_command_not_allowed", "Command is not allowed by the process policy."],
  [/Command not found/i, "process_command_not_found", "Command could not be resolved in the trusted runtime."],
  [/outside configured workspace roots|outside.*workspace|path is not allowed/i, "process_cwd_not_allowed", "Working directory is outside the configured workspace roots."],
  [/environment variable|PYTHONPATH|NODE_OPTIONS|KUBECONFIG/i, "process_env_not_allowed", "Environment override is not allowed by the process policy."],
  [/queue.*full|queued process job capacity/i, "process_queue_full", "Process queue capacity is exhausted."],
  [/PowerShell/i, "process_powershell_policy_denied", "PowerShell invocation is not allowed by the configured process policy."],
];

function normalizeProcessToolError(error) {
  const rawMessage = error?.message || String(error || "");
  let code = typeof error?.code === "string" ? error.code : "";
  if (code === "command_not_found") code = "process_command_not_found";
  let message = "Process request was rejected.";
  for (const [pattern, matchedCode, matchedMessage] of MESSAGE_RULES) {
    if (!pattern.test(rawMessage)) continue;
    code = code || matchedCode;
    message = matchedMessage;
    break;
  }
  if (!code) code = "process_request_rejected";
  return {
    success: false,
    error: {
      code,
      message,
      retryable: code === "process_queue_full",
    },
  };
}

async function executeProcessTool(callback) {
  try {
    return await callback();
  } catch (error) {
    return normalizeProcessToolError(error);
  }
}

module.exports = {
  executeProcessTool,
  normalizeProcessToolError,
};
