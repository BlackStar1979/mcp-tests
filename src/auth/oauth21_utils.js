"use strict";

const crypto = require("node:crypto");
const { URLSearchParams } = require("node:url");

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(String(value)).digest("base64url");
}

function parseForm(raw) {
  const out = {};
  for (const [key, value] of new URLSearchParams(String(raw || ""))) out[key] = value;
  return out;
}

function invalidRequestError() {
  const error = new Error("invalid_request");
  error.statusCode = 400;
  return error;
}

function normalizedContentType(req) {
  return String(req.headers?.["content-type"] || "").toLowerCase().split(";")[0].trim();
}

function readRequestBody(req, maxBytes = 65536) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += String(chunk);
      if (Buffer.byteLength(raw) > maxBytes) reject(new Error("body_too_large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function readBody(req) {
  const raw = await readRequestBody(req);
  if (normalizedContentType(req) === "application/json") {
    try {
      return JSON.parse(raw || "{}");
    } catch (_) {
      throw invalidRequestError();
    }
  }
  return parseForm(raw);
}

async function readJsonBody(req) {
  if (normalizedContentType(req) !== "application/json") throw invalidRequestError();
  return readBody(req);
}

async function readFormBody(req) {
  if (normalizedContentType(req) !== "application/x-www-form-urlencoded") throw invalidRequestError();
  const raw = await readRequestBody(req);
  return parseForm(raw);
}

function jsonResponse(res, statusCode, body) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
  });
  res.end(text);
}

function htmlResponse(res, statusCode, text) {
  const body = String(text || "");
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  res.end(body);
}

function redirectResponse(res, location) {
  res.writeHead(302, { location, "cache-control": "no-store" });
  res.end();
}

function clientIp(req = {}, options = {}) {
  const trustProxyHeaders = options.trustProxyHeaders === true;
  if (trustProxyHeaders) {
    return String(req.headers?.["cf-connecting-ip"] || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  }
  return String(req.socket?.remoteAddress || "unknown").split(",")[0].trim();
}

module.exports = {
  clientIp,
  htmlResponse,
  readFormBody,
  readJsonBody,
  jsonResponse,
  parseForm,
  randomToken,
  readBody,
  redirectResponse,
  sha256Base64Url,
  trimSlash,
};
