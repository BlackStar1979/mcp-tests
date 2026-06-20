"use strict";

const { rpcError } = require("./rpc_responses");

function buildMethodNotFoundResponse(id, method) {
  return rpcError(id, -32601, `Method not found: ${method}`);
}

module.exports = {
  buildMethodNotFoundResponse,
};
