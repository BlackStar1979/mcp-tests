function jsonResponse(res, statusCode, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(text);
}

function textResponse(res, statusCode, text) {
  const body = String(text || "");
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function emptyResponse(res, statusCode = 204) {
  res.writeHead(statusCode, { "cache-control": "no-store" });
  res.end();
}

function methodNotAllowed(res) {
  jsonResponse(res, 405, {
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST /mcp.",
    },
    id: null,
  });
}

module.exports = {
  jsonResponse,
  textResponse,
  emptyResponse,
  methodNotAllowed,
};
