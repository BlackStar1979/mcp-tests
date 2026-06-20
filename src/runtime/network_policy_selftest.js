"use strict";

const { assertAllowedUrl, isBlockedIp } = require("../util/network_policy");

const EXPECTED_NETWORK_OUTPUT_SCHEMA_REQUIRED_KEYS = [
  "bytes",
  "content_type",
  "duration_ms",
  "error",
  "final_url",
  "ok",
  "origin",
  "sha256",
  "status",
  "success",
  "text",
  "truncated",
  "url",
].sort();

async function assertRejectedAllowedUrl(input, expectedMessageParts, allowedMessage) {
  try {
    await assertAllowedUrl(input);
    throw new Error(allowedMessage);
  } catch (error) {
    const message = String(error.message || "");
    const expectedParts = Array.isArray(expectedMessageParts)
      ? expectedMessageParts
      : [expectedMessageParts];

    if (!expectedParts.some((part) => message.includes(part))) {
      throw error;
    }
  }
}

async function assertPublicNetworkPolicySelfTest(netTools) {
  if (netTools.length <= 0) {
    return;
  }

  if (!isBlockedIp("127.0.0.1")) {
    throw new Error("network policy must block loopback IPv4");
  }

  if (!isBlockedIp("10.0.0.1")) {
    throw new Error("network policy must block RFC1918 IPv4");
  }

  if (!isBlockedIp("::1")) {
    throw new Error("network policy must block loopback IPv6");
  }

  await assertRejectedAllowedUrl(
    "http://modelcontextprotocol.io/",
    "Only HTTPS",
    "network policy allowed non-HTTPS URL"
  );
  await assertRejectedAllowedUrl(
    "https://localhost/",
    ["allowlisted", "Local/internal"],
    "network policy allowed localhost URL"
  );

  for (const tool of netTools) {
    if (!tool.descriptor.outputSchema) {
      throw new Error(`${tool.name} missing outputSchema`);
    }

    const required = [...(tool.descriptor.outputSchema.required || [])].sort();

    if (JSON.stringify(required) !== JSON.stringify(EXPECTED_NETWORK_OUTPUT_SCHEMA_REQUIRED_KEYS)) {
      throw new Error(`${tool.name} network outputSchema required keys mismatch`);
    }
  }
}

module.exports = {
  assertPublicNetworkPolicySelfTest,
};
