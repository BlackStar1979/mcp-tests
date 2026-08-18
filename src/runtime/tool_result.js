"use strict";

const { parseProcessArtifactUri } = require("./process_artifact_resource");
const { sanitizeJsonPayload } = require("./output_dlp_boundary");

const OUTPUT_TRUST_META_KEY = "mcp-tests/outputTrust";
const OUTPUT_TRUST_UNTRUSTED = "untrusted_tool_output";

function markContentBlockUntrusted(contentBlock = {}) {
  if (contentBlock.type === "resource" && contentBlock.resource?.blob !== undefined) {
    throw new Error("output_embedded_resource_blob_denied");
  }
  const sanitized = sanitizeJsonPayload(contentBlock);
  if (!sanitized.success) throw new Error(sanitized.reason_code || "output_content_not_json_compatible");
  const safeBlock = sanitized.payload;
  if (safeBlock.type === "resource_link" && !parseProcessArtifactUri(safeBlock.uri)) {
    throw new Error("output_resource_link_denied");
  }
  return {
    ...safeBlock,
    _meta: {
      ...(safeBlock._meta || {}),
      [OUTPUT_TRUST_META_KEY]: OUTPUT_TRUST_UNTRUSTED,
    },
  };
}

function applyOutputTrustMetadata(result = {}) {
  result._meta = {
    ...(result._meta || {}),
    [OUTPUT_TRUST_META_KEY]: OUTPUT_TRUST_UNTRUSTED,
  };
  if (Array.isArray(result.content)) {
    result.content = result.content.map(markContentBlockUntrusted);
  }
  return result;
}

function toolResult(outputMode, payload, freshness = null) {
  const sanitized = sanitizeJsonPayload(payload);
  if (!sanitized.success) {
    throw new Error(sanitized.reason_code || "output_dlp_rejected");
  }
  const safePayload = sanitized.payload;
  const result = {
    content: [
      {
        type: "text",
        text: JSON.stringify(safePayload),
      },
    ],
  };

  if (outputMode === "structured") {
    result.structuredContent = safePayload;
  }

  if (freshness && Number.isFinite(freshness.ttlMs)) {
    result.ttlMs = freshness.ttlMs;
  }

  if (freshness && typeof freshness.cacheScope === "string" && freshness.cacheScope) {
    result.cacheScope = freshness.cacheScope;
  }

  return applyOutputTrustMetadata(result);
}

module.exports = {
  OUTPUT_TRUST_META_KEY,
  OUTPUT_TRUST_UNTRUSTED,
  applyOutputTrustMetadata,
  markContentBlockUntrusted,
  toolResult,
};
