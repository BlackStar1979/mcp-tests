"use strict";

function sseHeaders(extraHeaders = {}) {
  return {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-store, no-cache",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    ...extraHeaders,
  };
}

function encodeSseComment(comment = "keepalive") {
  const text = String(comment || "keepalive");
  return `: ${text.replace(/\r?\n/g, "\n: ")}\n\n`;
}

function encodeSseEvent({ event = "message", data, id } = {}) {
  const lines = [];
  if (id !== undefined && id !== null) lines.push(`id: ${String(id)}`);
  if (event) lines.push(`event: ${String(event)}`);
  const text = typeof data === "string" ? data : JSON.stringify(data);
  for (const line of String(text).split(/\r?\n/)) {
    lines.push(`data: ${line}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function writeSseHead(res, statusCode = 200, extraHeaders = {}) {
  res.writeHead(statusCode, sseHeaders(extraHeaders));
}

function writeSseComment(res, comment = "keepalive") {
  res.write(encodeSseComment(comment));
}

function writeSseEvent(res, event) {
  res.write(encodeSseEvent(event));
}

function sseResponse(res, { statusCode = 200, event = "message", data, id, close = true } = {}) {
  writeSseHead(res, statusCode);
  writeSseEvent(res, { event, data, id });
  if (close) res.end();
}

module.exports = {
  encodeSseComment,
  encodeSseEvent,
  sseHeaders,
  sseResponse,
  writeSseComment,
  writeSseEvent,
  writeSseHead,
};
