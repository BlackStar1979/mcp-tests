"use strict";

const OVH_EMBEDDINGS_URL = "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/embeddings";
const OVH_MODEL = "bge-m3";
const BGE_M3_DIMENSIONS = 1024;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_RESPONSE_BYTES = 256 * 1024;

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) return fallback;
  return parsed;
}

function disabledResult(status, provider = "disabled", model = "") {
  return { vector: null, status, provider, model, dimensions: 0 };
}

async function readJsonBounded(response) {
  const declaredLength = Number(response.headers?.get?.("content-length") || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("embedding_response_too_large");

  if (!response.body?.getReader) return response.json();

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("embedding_response_too_large");
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
  return JSON.parse(body);
}

function createEmbeddingClient({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const provider = String(env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER || "disabled").trim().toLowerCase();
  const externalEgressEnabled = env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS === "1";
  const token = String(env.OVH_AI_ENDPOINTS_ACCESS_TOKEN || "");
  const timeoutMs = boundedInteger(
    env.MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    500,
    15000,
  );

  async function generate(text) {
    if (provider === "disabled" || !provider) return disabledResult("disabled");
    if (provider !== "ovh") return disabledResult("unsupported_provider", provider);
    if (!externalEgressEnabled) return disabledResult("external_egress_disabled", provider, OVH_MODEL);
    if (!token) return disabledResult("token_missing", provider, OVH_MODEL);
    if (typeof fetchImpl !== "function") return disabledResult("fetch_unavailable", provider, OVH_MODEL);

    const input = String(text || "");
    if (!input.trim()) return disabledResult("input_empty", provider, OVH_MODEL);
    if (input.length > 4096) return disabledResult("input_too_large", provider, OVH_MODEL);

    try {
      const response = await fetchImpl(OVH_EMBEDDINGS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ model: OVH_MODEL, input }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 429) return disabledResult("rate_limited", provider, OVH_MODEL);
      if (!response.ok) return disabledResult(`http_${response.status}`, provider, OVH_MODEL);

      const payload = await readJsonBounded(response);
      const vector = payload?.data?.[0]?.embedding;
      if (!Array.isArray(vector) || vector.length !== BGE_M3_DIMENSIONS) {
        return disabledResult("invalid_dimensions", provider, OVH_MODEL);
      }
      if (!vector.every((value) => Number.isFinite(value))) {
        return disabledResult("invalid_vector", provider, OVH_MODEL);
      }
      return {
        vector,
        status: "ok",
        provider,
        model: OVH_MODEL,
        dimensions: BGE_M3_DIMENSIONS,
      };
    } catch (error) {
      const status = error?.name === "TimeoutError" || error?.name === "AbortError"
        ? "timeout"
        : error?.message === "embedding_response_too_large"
          ? "response_too_large"
          : "request_failed";
      return disabledResult(status, provider, OVH_MODEL);
    }
  }

  return { generate };
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) {
    return 0;
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftValue = Number(left[index]);
    const rightValue = Number(right[index]);
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) return 0;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }
  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  return denominator === 0 ? 0 : dot / denominator;
}

module.exports = {
  BGE_M3_DIMENSIONS,
  OVH_EMBEDDINGS_URL,
  createEmbeddingClient,
  cosineSimilarity,
};
