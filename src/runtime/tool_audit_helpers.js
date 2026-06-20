const { normalizeToolStartArgSummary, summarizeArg } = require("./audit_arg_summary");
const { rpcIdSummary } = require("./rpc_audit_summary");

function buildToolStartAudit(getOptionalTool, context, id, name, args) {
  const optionalTool = getOptionalTool(name);

  if (optionalTool && typeof optionalTool.summarizeArgs === "function") {
    return {
      request_id: context.requestId,
      tool: name,
      ...rpcIdSummary(id),
      ...normalizeToolStartArgSummary(optionalTool.summarizeArgs(args)),
    };
  }

  const argName = name === "search" ? "query" : name === "fetch" ? "id" : "unknown";
  const argValue = argName === "query" ? args.query : argName === "id" ? args.id : "";

  return {
    request_id: context.requestId,
    tool: name,
    arg_name: argName,
    ...rpcIdSummary(id),
    ...normalizeToolStartArgSummary(summarizeArg(argValue)),
  };
}

function getToolResultStats(getOptionalTool, name, payload) {
  const optionalTool = getOptionalTool(name);

  if (optionalTool && typeof optionalTool.resultStats === "function") {
    return optionalTool.resultStats(payload);
  }

  if (name === "search") {
    const count = Array.isArray(payload?.results) ? payload.results.length : 0;
    return {
      result_count: count,
      result_chars: JSON.stringify(payload || {}).length,
    };
  }

  if (name === "fetch") {
    return {
      result_count: payload ? 1 : 0,
      result_chars: String(payload?.text || "").length,
      result_text_truncated: Boolean(payload?.metadata?.truncated),
      result_original_chars:
        typeof payload?.metadata?.original_chars === "number"
          ? payload.metadata.original_chars
          : null,
      result_cap_chars:
        typeof payload?.metadata?.cap_chars === "number"
          ? payload.metadata.cap_chars
          : null,
    };
  }

  return {
    result_count: null,
    result_chars: null,
  };
}

function buildToolDecisionAudit(receipt) {
  return {
    decision_receipt: receipt && typeof receipt === "object" ? receipt : null,
  };
}

module.exports = {
  buildToolStartAudit,
  getToolResultStats,
  buildToolDecisionAudit,
};
