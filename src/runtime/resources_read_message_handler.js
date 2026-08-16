"use strict";

const { rpcError, rpcResult } = require("./rpc_responses");
const { resolveProcessJobManager } = require("../util/process_job_manager");
const { resolveProcessJobOwner } = require("../util/process_job_owner");
const {
  buildProcessArtifactUri,
  parseProcessArtifactUri,
} = require("./process_artifact_resource");

function resourceNotFound(id, uri) {
  return rpcError(id, -32002, "Resource not found", { uri: String(uri || "") });
}

function handleResourcesReadMessage({ id, params = {}, context = {}, auditLog = () => {} } = {}) {
  const uri = typeof params.uri === "string" ? params.uri : "";
  const parsed = parseProcessArtifactUri(uri);
  if (!parsed) return resourceNotFound(id, uri);

  let ownerId;
  let manager;
  try {
    ownerId = resolveProcessJobOwner(context);
    manager = resolveProcessJobManager(context);
  } catch {
    return resourceNotFound(id, uri);
  }

  const artifact = manager.readArtifact(
    parsed.artifactId,
    { offset: parsed.offset, maxChars: parsed.maxChars },
    { ownerId }
  );
  if (!artifact) return resourceNotFound(id, uri);

  const nextChunkUri = artifact.eof
    ? null
    : buildProcessArtifactUri(parsed.artifactId, {
        offset: artifact.nextOffset,
        maxChars: parsed.maxChars,
      });
  const ttlMs = Math.max(0, Math.min(
    60000,
    Number(artifact.expiresAtMs || Date.now()) - Date.now()
  ));

  auditLog("process_artifact_read", {
    request_id: context.requestId,
    artifact_id: parsed.artifactId,
    offset: artifact.offset,
    next_offset: artifact.nextOffset,
    returned_chars: String(artifact.text || "").length,
    eof: artifact.eof === true,
    trace_id: artifact.traceId || null,
    span_id: artifact.spanId || null,
  });

  return rpcResult(id, {
    contents: [
      {
        uri,
        mimeType: artifact.mimeType,
        text: artifact.text,
      },
    ],
    ttlMs,
    cacheScope: "private",
    _meta: {
      "mcp-tests/artifactSha256": artifact.sha256,
      "mcp-tests/artifactChars": artifact.chars,
      "mcp-tests/artifactBytes": artifact.bytes,
      "mcp-tests/artifactNextOffset": artifact.nextOffset,
      "mcp-tests/artifactEof": artifact.eof === true,
      ...(nextChunkUri ? { "mcp-tests/nextChunkUri": nextChunkUri } : {}),
      ...(artifact.traceId ? { "mcp-tests/traceId": artifact.traceId } : {}),
      ...(artifact.spanId ? { "mcp-tests/spanId": artifact.spanId } : {}),
    },
  });
}

module.exports = {
  handleResourcesReadMessage,
  resourceNotFound,
};
