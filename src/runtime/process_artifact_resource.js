"use strict";

const ARTIFACT_URI_PROTOCOL = "mcp-artifact:";
const ARTIFACT_URI_HOST = "process";
const ARTIFACT_DEFAULT_CHUNK_CHARS = 65536;
const ARTIFACT_MAX_CHUNK_CHARS = 262144;
const OPAQUE_ARTIFACT_ID = /^[0-9a-f]{32}$/;

function normalizeArtifactId(value) {
  const id = String(value || "").trim().toLowerCase();
  return OPAQUE_ARTIFACT_ID.test(id) && !/^0+$/.test(id) ? id : "";
}

function buildProcessArtifactUri(artifactId, cursor = null) {
  const id = normalizeArtifactId(artifactId);
  if (!id) throw new Error("Invalid process artifact identifier.");
  const base = `mcp-artifact://process/${id}`;
  if (!cursor) return base;
  const offset = Math.max(0, Math.floor(Number(cursor.offset || 0)));
  const maxChars = Math.max(1, Math.min(Math.floor(Number(cursor.maxChars || ARTIFACT_DEFAULT_CHUNK_CHARS)), ARTIFACT_MAX_CHUNK_CHARS));
  return `${base}?offset=${offset}&max_chars=${maxChars}`;
}

function parseNonNegativeInt(value, fallback) {
  if (value === null || value === "") return fallback;
  if (!/^[0-9]+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function parseProcessArtifactUri(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    return null;
  }
  if (url.protocol !== ARTIFACT_URI_PROTOCOL || url.hostname !== ARTIFACT_URI_HOST) return null;
  if (url.username || url.password || url.hash) return null;
  const artifactId = normalizeArtifactId(url.pathname.replace(/^\//, ""));
  if (!artifactId || url.pathname.slice(1).includes("/")) return null;
  const allowed = new Set(["offset", "max_chars"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) return null;
  }
  if ([...url.searchParams.getAll("offset")].length > 1 || [...url.searchParams.getAll("max_chars")].length > 1) return null;
  const offset = parseNonNegativeInt(url.searchParams.get("offset"), 0);
  const rawMax = parseNonNegativeInt(url.searchParams.get("max_chars"), ARTIFACT_DEFAULT_CHUNK_CHARS);
  if (offset === null || rawMax === null || rawMax < 1 || rawMax > ARTIFACT_MAX_CHUNK_CHARS) return null;
  return { artifactId, offset, maxChars: rawMax };
}

function buildProcessArtifactResourceLink(artifact = {}) {
  const stream = artifact.stream === "stderr" ? "stderr" : "stdout";
  const expires = Number.isFinite(Number(artifact.expiresAtMs))
    ? new Date(Number(artifact.expiresAtMs)).toISOString()
    : "unknown";
  return {
    type: "resource_link",
    uri: buildProcessArtifactUri(artifact.artifactId),
    name: `process-${stream}.txt`,
    description: `Immutable ${stream} artifact; chars=${Number(artifact.chars || 0)}; bytes=${Number(artifact.bytes || 0)}; sha256=${String(artifact.sha256 || "")}; expires=${expires}`,
    mimeType: String(artifact.mimeType || "text/plain; charset=utf-8"),
  };
}

module.exports = {
  ARTIFACT_DEFAULT_CHUNK_CHARS,
  ARTIFACT_MAX_CHUNK_CHARS,
  ARTIFACT_URI_HOST,
  ARTIFACT_URI_PROTOCOL,
  buildProcessArtifactResourceLink,
  buildProcessArtifactUri,
  normalizeArtifactId,
  parseProcessArtifactUri,
};
