"use strict";

const {
  CONTENT_BOUNDARY_KEY,
  PROMPT_CONTENT_POLICY_VERSION,
  UNTRUSTED_TOOL_OUTPUT,
} = require("./prompt_content_policy");

function parsePrimaryTextJsonToolResult(result, label, outputMode) {
  if (!Array.isArray(result.content)) {
    throw new Error(`${label} content must be an array`);
  }

  if (result.content.length !== 2) {
    throw new Error(`${label} content must contain primary JSON plus one trust-boundary item`);
  }

  if (result.content[0].type !== "text") {
    throw new Error(`${label} content[0].type must be text`);
  }

  if (!result.content[0].text.trim().startsWith("{")) {
    throw new Error(`${label} content[0].text must be top-level JSON object`);
  }

  if (result.content[1].type !== "text") {
    throw new Error(`${label} content[1].type must be text`);
  }
  let boundaryEnvelope;
  try {
    boundaryEnvelope = JSON.parse(result.content[1].text);
  } catch {
    throw new Error(`${label} content[1].text must be trust-boundary JSON`);
  }
  const boundary = boundaryEnvelope?.[CONTENT_BOUNDARY_KEY];
  if (!boundary || boundary.policy_version !== PROMPT_CONTENT_POLICY_VERSION) {
    throw new Error(`${label} trust-boundary policy version mismatch`);
  }
  if (boundary.trust_class !== UNTRUSTED_TOOL_OUTPUT || boundary.instruction_handling !== "data_only") {
    throw new Error(`${label} trust-boundary classification mismatch`);
  }
  if (boundary.promotion_allowed !== false) {
    throw new Error(`${label} trust-boundary must forbid promotion`);
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
  parsePrimaryTextJsonToolResult,
};
