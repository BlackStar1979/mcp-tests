"use strict";

function toolResult(outputMode, payload, freshness = null) {
  const result = {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };

  if (outputMode === "structured") {
    result.structuredContent = payload;
  }

  if (freshness && Number.isFinite(freshness.ttlMs)) {
    result.ttlMs = freshness.ttlMs;
  }

  if (freshness && typeof freshness.cacheScope === "string" && freshness.cacheScope) {
    result.cacheScope = freshness.cacheScope;
  }

  return result;
}

module.exports = {
  toolResult,
};
