"use strict";

const { assertObjectKeysExact } = require("./object_key_assertion");
const { isPublicHttpsUrl } = require("./url_helpers");

function assertPublicSearchResults(payload, options) {
  const {
    label,
    resultLabel,
    requiredFirstId = "",
    requiredAnyId = "",
    emptyMessage = "",
    missingFirstMessage = "",
    missingAnyMessage = "",
  } = options || {};

  if (!Array.isArray(payload?.results)) {
    throw new Error(`${label} must return results array`);
  }

  if (requiredFirstId) {
    if (payload.results.length < 1) {
      throw new Error(emptyMessage || `${label} must return at least one result for ${requiredFirstId}`);
    }

    if (payload.results[0].id !== requiredFirstId) {
      throw new Error(missingFirstMessage || `${requiredFirstId} must be first result`);
    }
  }

  if (requiredAnyId && !payload.results.some((item) => item.id === requiredAnyId)) {
    throw new Error(missingAnyMessage || `${label} did not return ${requiredAnyId}`);
  }

  for (const item of payload.results) {
    assertObjectKeysExact(item, ["id", "title", "url"], resultLabel);

    if (!isPublicHttpsUrl(item.url)) {
      throw new Error(`${resultLabel} URL is not public HTTPS: ${item.url}`);
    }
  }
}

module.exports = {
  assertPublicSearchResults,
};
