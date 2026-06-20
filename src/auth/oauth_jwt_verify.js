"use strict";

const crypto = require("node:crypto");

function b64urlDecodeBuffer(value) {
  const text = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = text.length % 4 ? "=".repeat(4 - (text.length % 4)) : "";
  return Buffer.from(text + pad, "base64");
}

function jwkToPublicKey(jwk) {
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

function verifyRs256({ signingInput, signature, jwk } = {}) {
  if (!jwk) return false;
  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(String(signingInput || ""));
  verifier.end();
  return verifier.verify(jwkToPublicKey(jwk), b64urlDecodeBuffer(signature));
}

function verifyJwtTimeClaims(payload = {}, now = Math.floor(Date.now() / 1000)) {
  if (typeof payload.exp === "number" && payload.exp <= now) return { ok: false, reason: "token_expired" };
  if (typeof payload.nbf === "number" && payload.nbf > now) return { ok: false, reason: "token_not_yet_valid" };
  if (typeof payload.iat === "number" && payload.iat > now + 60) return { ok: false, reason: "token_issued_in_future" };
  return { ok: true };
}

module.exports = {
  jwkToPublicKey,
  verifyJwtTimeClaims,
  verifyRs256,
};
