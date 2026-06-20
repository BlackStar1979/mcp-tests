"use strict";

const { rpcResult } = require("./rpc_responses");
const { buildPingResponse } = require("./ping_response");

function handlePingMessage(id) {
  return rpcResult(id, buildPingResponse());
}

module.exports = {
  handlePingMessage,
};
