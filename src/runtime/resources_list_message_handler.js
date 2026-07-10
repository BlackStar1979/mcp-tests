"use strict";

const { rpcResult } = require("./rpc_responses");

function handleResourcesListMessage(id, options = {}) {
  if (typeof options.auditLog === "function") {
    options.auditLog("resources_list_served", {
      request_id: options.requestId,
      session_id: options.sessionId || "",
      auth_mode: options.authMode || "unknown",
      resource_count: 0,
      compatibility_empty_list: true,
    });
  }

  return rpcResult(id, {
    resources: [],
  });
}

module.exports = {
  handleResourcesListMessage,
};
