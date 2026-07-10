"use strict";

const { rpcResult } = require("./rpc_responses");

function handlePromptsListMessage(id, options = {}) {
  if (typeof options.auditLog === "function") {
    options.auditLog("prompts_list_served", {
      request_id: options.requestId,
      session_id: options.sessionId || "",
      auth_mode: options.authMode || "unknown",
      prompt_count: 0,
      compatibility_empty_list: true,
    });
  }

  return rpcResult(id, {
    prompts: [],
  });
}

module.exports = {
  handlePromptsListMessage,
};
