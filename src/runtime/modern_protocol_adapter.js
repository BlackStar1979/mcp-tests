"use strict";

const { isModernProtocolVersion } = require("./protocol_version_policy");
const { SERVER_INFO_META_KEY } = require("./request_metadata_policy");

function decorateModernRpcResponse(response, { protocolVersion, serverInfo } = {}) {
  if (!isModernProtocolVersion(protocolVersion) || !response?.result || typeof response.result !== "object") {
    return response;
  }

  return {
    ...response,
    result: {
      resultType: "complete",
      ...response.result,
      _meta: {
        ...(response.result._meta || {}),
        [SERVER_INFO_META_KEY]: {
          name: serverInfo?.name || "",
          version: serverInfo?.version || "",
        },
      },
    },
  };
}

function modernHttpStatusForResponse(protocolVersion, response) {
  if ([-32020, -32021, -32022].includes(response?.error?.code)) return 400;
  if (!isModernProtocolVersion(protocolVersion)) return 200;
  if (response?.error?.code === -32601) return 404;
  return 200;
}

module.exports = {
  decorateModernRpcResponse,
  modernHttpStatusForResponse,
};
