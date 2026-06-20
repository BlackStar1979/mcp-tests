function rpcIdSummary(id) {
  if (id === undefined) {
    return {
      has_rpc_id: false,
      rpc_id_type: "undefined",
    };
  }

  if (id === null) {
    return {
      has_rpc_id: true,
      rpc_id_type: "null",
    };
  }

  return {
    has_rpc_id: true,
    rpc_id_type: typeof id,
  };
}

function rpcMethodSummary(message) {
  const method = typeof message?.method === "string" ? message.method : null;
  const id = Object.prototype.hasOwnProperty.call(message || {}, "id")
    ? message.id
    : undefined;

  return {
    method,
    ...rpcIdSummary(id),
  };
}

module.exports = {
  rpcIdSummary,
  rpcMethodSummary,
};
