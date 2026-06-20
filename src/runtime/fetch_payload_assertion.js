"use strict";

const { assertObjectKeysExact } = require("./object_key_assertion");
const { isPublicHttpsUrl } = require("./url_helpers");

const FETCH_PAYLOAD_KEYS = ["id", "metadata", "text", "title", "url"];

function assertPublicFetchPayloadFields(payload, options) {
  const {
    label,
    objectKeyLabel,
    expectedId = "",
    expectedIdMessage = "",
    checkRequiredKeys = false,
    missingKeyPrefix = "",
    maxTextChars = 0,
    textCapMessage = "",
  } = options || {};

  assertObjectKeysExact(payload, FETCH_PAYLOAD_KEYS, objectKeyLabel || `${label} payload`);

  if (checkRequiredKeys) {
    for (const key of ["id", "title", "text", "url", "metadata"]) {
      if (!(key in payload)) {
        throw new Error(`${missingKeyPrefix || label} missing key: ${key}`);
      }
    }
  }

  if (expectedId && payload.id !== expectedId) {
    throw new Error(expectedIdMessage || `${label} id mismatch`);
  }

  if (!isPublicHttpsUrl(payload.url)) {
    throw new Error(`${label} URL is not public HTTPS: ${payload.url}`);
  }

  if (maxTextChars && payload.text.length > maxTextChars) {
    throw new Error(textCapMessage || `${label} text exceeds cap`);
  }
}

module.exports = {
  assertPublicFetchPayloadFields,
};
