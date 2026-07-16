"use strict";

const crypto = require("node:crypto");
const { URLSearchParams } = require("node:url");

const OAUTH_REPEATABLE_PARAMS = new Set(["resource"]);

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(String(value)).digest("base64url");
}

function parseParams(entries, options = {}) {
  const out = {};
  const allowRepeatedKeys = options.allowRepeatedKeys instanceof Set
    ? options.allowRepeatedKeys
    : OAUTH_REPEATABLE_PARAMS;
  for (const [key, value] of entries) {
    const textKey = String(key || "");
    const textValue = String(value || "");
    if (!Object.prototype.hasOwnProperty.call(out, textKey)) {
      out[textKey] = textValue;
      continue;
    }
    if (!allowRepeatedKeys.has(textKey)) throw invalidRequestError();
    if (out[textKey] !== textValue) throw invalidRequestError();
  }
  return out;
}

function parseForm(raw, options = {}) {
  return parseParams(new URLSearchParams(String(raw || "")), options);
}

function parseSearchParams(searchParams, options = {}) {
  return parseParams(searchParams, options);
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
    let settled = false;
    let raw = "";
    const cleanup = () => {
      req.removeListener("data", onData);
      req.removeListener("end", onEnd);
      req.removeListener("error", onError);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        if (typeof req.destroy === "function" && !req.destroyed) req.destroy(error);
      } catch (_) {}
      reject(error);
    };
    const onData = (chunk) => {
      if (settled) return;
      raw += String(chunk);
      if (Buffer.byteLength(raw) > maxBytes) fail(new Error("body_too_large"));
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(raw);
    };
    const onError = (error) => fail(error);
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
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

function jsonResponse(res, statusCode, body, extraHeaders = {}) {
  const text = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store",
    ...extraHeaders,
  });
  res.end(text);
}

function htmlResponse(res, statusCode, text, extraHeaders = {}) {
  const body = String(text || "");
  res.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    ...extraHeaders,
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
  parseSearchParams,
  randomToken,
  readBody,
  redirectResponse,
  sha256Base64Url,
  trimSlash,
};
