const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function stableSha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value ?? ""), "utf8")
    .digest("hex");
}

function byteLength(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({
      error: "json_stringify_failed",
    });
  }
}

module.exports = {
  nowIso,
  stableSha256,
  byteLength,
  safeJsonStringify,
};
