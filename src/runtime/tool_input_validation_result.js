"use strict";

const { rpcResult, toolError } = require("./rpc_responses");

function buildToolInputValidationResult({ id, errors = [] } = {}) {
  const validationErrors = Array.isArray(errors)
    ? errors.map((item) => String(item)).slice(0, 32)
    : [];
  return rpcResult(id, toolError("Invalid tool arguments", {
    decision_code: "invalid_tool_arguments",
    validation_errors: validationErrors,
  }));
}

module.exports = {
  buildToolInputValidationResult,
};
