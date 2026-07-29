"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  BGE_M3_DIMENSIONS,
  createEmbeddingClient,
  cosineSimilarity,
} = require("../src/memory/embedding_client");

function vectorAt(index, value = 1) {
  const vector = Array(BGE_M3_DIMENSIONS).fill(0);
  vector[index] = value;
  return vector;
}

function responseFor(vector) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({ data: [{ embedding: vector }] }),
  };
}

(async () => {
  let disabledFetches = 0;
  const disabled = createEmbeddingClient({
    env: {},
    fetchImpl: async () => {
      disabledFetches += 1;
      throw new Error("disabled client must not fetch");
    },
  });
  assert.deepEqual(await disabled.generate("lead management"), {
    vector: null,
    status: "disabled",
    provider: "disabled",
    model: "",
    dimensions: 0,
  });
  assert.equal(disabledFetches, 0);

  const missingEgress = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async () => {
      throw new Error("egress-disabled client must not fetch");
    },
  });
  assert.equal((await missingEgress.generate("lead management")).status, "external_egress_disabled");

  const leadVector = vectorAt(0);
  const enabled = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/embeddings");
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, "Bearer test-token");
      assert.equal(JSON.parse(options.body).model, "bge-m3");
      return responseFor(leadVector);
    },
  });
  const generated = await enabled.generate("zarządzanie leadami");
  assert.equal(generated.status, "ok");
  assert.equal(generated.provider, "ovh");
  assert.equal(generated.model, "bge-m3");
  assert.equal(generated.dimensions, BGE_M3_DIMENSIONS);
  assert.deepEqual(generated.vector, leadVector);
  assert.equal(cosineSimilarity(leadVector, leadVector), 1);
  assert.equal(cosineSimilarity(leadVector, vectorAt(1)), 0);

  const invalid = createEmbeddingClient({
    env: {
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: "ovh",
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: "1",
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: "test-token",
    },
    fetchImpl: async () => responseFor([1, 2, 3]),
  });
  assert.equal((await invalid.generate("invalid dimensions")).status, "invalid_dimensions");

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-embeddings-"));
  const previousEnv = {
    logDir: process.env.MCP_TEST_MEMORY_LOG_DIR,
    provider: process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER,
    egress: process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS,
    token: process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN,
  };
  const previousFetch = globalThis.fetch;
  try {
    process.env.MCP_TEST_MEMORY_LOG_DIR = tempRoot;
    process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER = "ovh";
    process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS = "1";
    process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN = "test-token";

    const filmVector = vectorAt(1);
    globalThis.fetch = async (_url, options) => {
      const input = JSON.parse(options.body).input;
      if (input.includes("film")) return responseFor(filmVector);
      return responseFor(leadVector);
    };

    delete require.cache[require.resolve("../src/memory/memory_store")];
    delete require.cache[require.resolve("../src/memory/embedding_client")];
    delete require.cache[require.resolve("../src/memory/embedding_cache")];
    const { saveMemory, searchMemory } = require("../src/memory/memory_store");

    await saveMemory({
      agent_name: "codex",
      content: "zarządzanie leadami sprzedażowymi",
      type: "conclusion",
      category: "sales",
    });
    await saveMemory({
      agent_name: "codex",
      content: "recenzja filmu science fiction",
      type: "fact",
      category: "cinema",
    });

    const search = await searchMemory({
      query: "lead management pipeline",
      agent_name: "codex",
      top_k: 5,
      min_score: 0.1,
    });
    assert.equal(search.total_searched, 2);
    assert.equal(search.results.length, 1);
    assert.match(search.results[0].content, /leadami/);
    assert.ok(search.results[0].score > 0.7);
    assert.equal("embedding_v1" in search.results[0], false);

    const memoryText = fs.readFileSync(path.join(tempRoot, ".mcp-agent-memory.jsonl"), "utf8");
    assert.equal(memoryText.includes("embedding_v1"), false);
    assert.equal(fs.existsSync(path.join(tempRoot, ".mcp-agent-embeddings.sqlite")), true);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      MCP_TEST_MEMORY_LOG_DIR: previousEnv.logDir,
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: previousEnv.provider,
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: previousEnv.egress,
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: previousEnv.token,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const cacheFailureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-memory-cache-failure-"));
  try {
    process.env.MCP_TEST_MEMORY_LOG_DIR = cacheFailureRoot;
    process.env.MCP_TEST_MEMORY_EMBEDDING_PROVIDER = "ovh";
    process.env.MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS = "1";
    process.env.OVH_AI_ENDPOINTS_ACCESS_TOKEN = "test-token";
    fs.mkdirSync(path.join(cacheFailureRoot, ".mcp-agent-embeddings.sqlite"));
    globalThis.fetch = async () => responseFor(leadVector);

    delete require.cache[require.resolve("../src/memory/memory_store")];
    const { saveMemory, searchMemory } = require("../src/memory/memory_store");
    const saved = await saveMemory({
      agent_name: "codex",
      content: "authoritative memory survives embedding cache failure",
      type: "experience",
      category: "resilience",
    });
    assert.ok(saved.id);
    assert.match(
      fs.readFileSync(path.join(cacheFailureRoot, ".mcp-agent-memory.jsonl"), "utf8"),
      /authoritative memory survives embedding cache failure/,
    );
    const fallbackSearch = await searchMemory({
      query: "authoritative memory",
      agent_name: "codex",
      top_k: 5,
      min_score: 0.1,
    });
    assert.equal(fallbackSearch.results.length, 1);
    assert.equal(fallbackSearch.results[0].id, saved.id);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      MCP_TEST_MEMORY_LOG_DIR: previousEnv.logDir,
      MCP_TEST_MEMORY_EMBEDDING_PROVIDER: previousEnv.provider,
      MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS: previousEnv.egress,
      OVH_AI_ENDPOINTS_ACCESS_TOKEN: previousEnv.token,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fs.rmSync(cacheFailureRoot, { recursive: true, force: true });
  }

  console.log("smoke_memory_embeddings ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
