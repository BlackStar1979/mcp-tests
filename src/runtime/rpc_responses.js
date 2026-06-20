function rpcResult(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function rpcError(id, code, message, data) {
  const error = {
    code,
    message,
  };

  if (data !== undefined) {
    error.data = data;
  }

  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error,
  };
}

function toolError(message, extra = {}) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          error: String(message || "Tool error"),
          ...extra,
        }),
      },
    ],
    isError: true,
  };
}

module.exports = {
  rpcResult,
  rpcError,
  toolError,
};
