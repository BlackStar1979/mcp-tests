"use strict";

const { rpcResponseSummary } = require("./rpc_audit_summary");
const { byteLength } = require("./runtime_helpers");

function auditJsonRpcResponseSent(auditLog, {
  requestId,
  statusCode,
  response,
  batch = Array.isArray(response),
  phase,
}) {
  const text = JSON.stringify(response);
  const base = {
    request_id: requestId,
    status_code: statusCode,
    response_mode: "json",
    response_bytes: byteLength(text),
  };

  if (phase) {
    base.phase = phase;
  }

  if (batch) {
    auditLog("rpc_response_sent", {
      ...base,
      batch: true,
      response_count: Array.isArray(response) ? response.length : 1,
      responses: Array.isArray(response)
        ? response.map((item) => rpcResponseSummary(item))
        : [rpcResponseSummary(response)],
    });
    return;
  }

  auditLog("rpc_response_sent", {
    ...base,
    ...rpcResponseSummary(response),
  });
}

function auditEmptyRpcResponseSent(auditLog, {
  requestId,
  statusCode,
  phase,
  batch = false,
}) {
  const entry = {
    request_id: requestId,
    status_code: statusCode,
    response_mode: "empty",
    response_bytes: 0,
    phase,
  };

  if (batch) {
    entry.batch = true;
  }

  auditLog("rpc_response_sent", entry);
}

module.exports = {
  auditJsonRpcResponseSent,
  auditEmptyRpcResponseSent,
};
