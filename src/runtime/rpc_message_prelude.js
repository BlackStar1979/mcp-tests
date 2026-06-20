"use strict";

function buildRpcMessagePrelude(message) {
  return {
    id: Object.prototype.hasOwnProperty.call(message, "id") ? message.id : undefined,
    method: message.method,
    params: message.params || {},
  };
}

module.exports = { buildRpcMessagePrelude };
