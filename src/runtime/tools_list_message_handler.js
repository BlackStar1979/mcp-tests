"use strict";

const { rpcResult } = require("./rpc_responses");
const { buildToolsListResponse } = require("./tools_list_response");

function handleToolsListMessage(id, tools, options = {}) {
  return rpcResult(id, buildToolsListResponse(tools, options));
}

module.exports = {
  handleToolsListMessage,
};
