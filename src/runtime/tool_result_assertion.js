"use strict";

function parseSingleTextJsonToolResult(result, label, outputMode) {
  if (!Array.isArray(result.content)) {
    throw new Error(`${label} content must be an array`);
  }

  if (result.content.length !== 1) {
    throw new Error(`${label} content must have exactly one item`);
  }

  if (result.content[0].type !== "text") {
    throw new Error(`${label} content[0].type must be text`);
  }

  if (!result.content[0].text.trim().startsWith("{")) {
    throw new Error(`${label} content[0].text must be top-level JSON object`);
  }

  if (outputMode === "structured") {
    if (!result.structuredContent) {
      throw new Error(`${label} structuredContent missing in structured mode`);
    }

    if (JSON.stringify(JSON.parse(result.content[0].text)) !== JSON.stringify(result.structuredContent)) {
      throw new Error(`${label} structuredContent does not match content JSON`);
    }
  }

  if (outputMode === "content-only" && result.structuredContent) {
    throw new Error(`${label} structuredContent must be absent in content-only mode`);
  }

  return JSON.parse(result.content[0].text);
}

module.exports = {
  parseSingleTextJsonToolResult,
};
