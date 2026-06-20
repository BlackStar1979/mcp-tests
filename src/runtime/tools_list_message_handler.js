"use strict";

const { rpcResult } = require("./rpc_responses");
const { buildToolsListResponse } = require("./tools_list_response");

function handleToolsListMessage(id, tools) {
  return rpcResult(id, buildToolsListResponse(tools));
}

module.exports = {
  handleToolsListMessage,
};
