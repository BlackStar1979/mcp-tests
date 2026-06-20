"use strict";

function shouldReturnNoRpcResponse(id, method) {
  return id === undefined || method === "notifications/initialized";
}

module.exports = {
  shouldReturnNoRpcResponse,
};
