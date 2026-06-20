"use strict";

const JSON_MEDIA_TYPE = "application/json";
const SSE_MEDIA_TYPE = "text/event-stream";

function splitAcceptHeader(headerValue) {
  if (Array.isArray(headerValue)) headerValue = headerValue.join(",");
  if (typeof headerValue !== "string") return [];
  return headerValue
    .split(",")
    .map((part) => part.split(";")[0].trim().toLowerCase())
    .filter(Boolean);
}

function acceptsMediaType(mediaTypes, expected) {
  return mediaTypes.includes(expected) || mediaTypes.includes("*/*");
}

function isStrictStreamableHttpAcceptEnabled(env = process.env) {
  return env.MCP_TEST_STRICT_STREAMABLE_HTTP_ACCEPT === "1";
}

function evaluatePostAccept(req = {}, { strict = isStrictStreamableHttpAcceptEnabled() } = {}) {
  const mediaTypes = splitAcceptHeader(req.headers?.accept);
  if (!strict && mediaTypes.length === 0) {
    return { ok: true, mode: "legacy_missing_accept", acceptsJson: true, acceptsSse: false, mediaTypes };
  }
  const acceptsJson = acceptsMediaType(mediaTypes, JSON_MEDIA_TYPE);
  const acceptsSse = acceptsMediaType(mediaTypes, SSE_MEDIA_TYPE);
  if (strict && !(acceptsJson && acceptsSse)) {
    return { ok: false, reason: "accept_must_include_json_and_sse", acceptsJson, acceptsSse, mediaTypes };
  }
  if (!acceptsJson && !acceptsSse) {
    return { ok: false, reason: "accept_no_supported_media_type", acceptsJson, acceptsSse, mediaTypes };
  }
  return { ok: true, mode: acceptsSse ? "sse_capable" : "json_only", acceptsJson, acceptsSse, mediaTypes };
}

function evaluateGetAccept(req = {}) {
  const mediaTypes = splitAcceptHeader(req.headers?.accept);
  const acceptsSse = mediaTypes.includes(SSE_MEDIA_TYPE);
  return acceptsSse
    ? { ok: true, acceptsSse, mediaTypes }
    : { ok: false, reason: "accept_must_include_sse", acceptsSse, mediaTypes };
}

module.exports = {
  JSON_MEDIA_TYPE,
  SSE_MEDIA_TYPE,
  acceptsMediaType,
  evaluateGetAccept,
  evaluatePostAccept,
  isStrictStreamableHttpAcceptEnabled,
  splitAcceptHeader,
};
