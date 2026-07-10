"use strict";

const { rpcResult } = require("./rpc_responses");

function handleResourceTemplatesListMessage(id, options = {}) {
  if (typeof options.auditLog === "function") {
    options.auditLog("resource_templates_list_served", {
      request_id: options.requestId,
      session_id: options.sessionId || "",
      auth_mode: options.authMode || "unknown",
      resource_template_count: 0,
      compatibility_empty_list: true,
    });
  }

  return rpcResult(id, {
    resourceTemplates: [],
  });
}

module.exports = {
  handleResourceTemplatesListMessage,
};
