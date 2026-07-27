"use strict";

const { jsonResponse } = require("../util/http_response_helpers");

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
