# Memory Embeddings Hardening Report

Status: REPOSITORY READY / RUNTIME DISABLED BY DEFAULT
Date: 2026-07-29

## Objective

Improve Polish and cross-language memory retrieval without weakening the append-only memory authority, leaking vectors through MCP output, or making memory writes depend on an external provider.

The original `_docs/memory-embeddings-upgrade/IMPLEMENTATION.md` blueprint identified the correct retrieval gap and provider family, but its inline-vector JSONL design was not adopted.

## Current External Evidence

OVHcloud currently documents `bge-m3` as:

- multilingual across more than 100 languages;
- `1024` output dimensions;
- maximum sequence length `8192` tokens;
- maximum batch size `25`;
- OpenAI-compatible at `POST https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/embeddings`.

Source: `https://www.ovhcloud.com/en-sg/public-cloud/ai-endpoints/catalog/bge-m3/`.

## Implemented Architecture

- `_logs/.mcp-agent-memory.jsonl` remains the authoritative append-only memory store.
- `src/memory/embedding_client.js` owns the fixed OVH endpoint and `bge-m3` contract.
- `src/memory/embedding_cache.js` owns a non-authoritative SQLite sidecar.
- The cache stores SHA-256 content hashes, provider/model identity, dimensions, timestamps, and float32 vectors. It stores no memory plaintext.
- `memory_save` appends the authoritative entry before attempting external embedding or cache work.
- `memory_search` always computes keyword relevance and adds semantic relevance only when the query vector and a compatible cached entry vector exist.
- Cache/provider failure falls back to keyword search.
- Tool responses preserve the existing schema and never include vectors or provider credentials.

## Activation Boundary

External embedding requests require all three runtime conditions:

```text
MCP_TEST_MEMORY_EMBEDDING_PROVIDER=ovh
MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS=1
OVH_AI_ENDPOINTS_ACCESS_TOKEN=<server-owned token>
```

The current environment has none of these configured. Therefore the repository capability is implemented, while the live runtime remains on keyword fallback.

The endpoint URL and model are not caller-configurable. The server-owned token is used only in the Authorization header and is never returned or logged.

## Failure and Data-Safety Controls

- default provider state: disabled;
- explicit separate external-egress opt-in;
- fixed HTTPS endpoint;
- `5000 ms` default timeout, bounded to `500..15000 ms`;
- `256 KiB` response cap;
- exact `1024`-dimension validation;
- finite-number validation;
- authoritative memory input cap inherited from the `4096`-character tool schema;
- no vector fields in JSONL or MCP output;
- cache write failure cannot turn a completed authoritative append into a failed tool response;
- cache read/corruption failure cannot disable keyword retrieval.

## Ranking Contract

Keyword scoring remains backward-compatible. For entries with a compatible vector:

```text
semantic_relevance = clamp((cosine_similarity - 0.45) / 0.55, 0, 1)
hybrid_score = max(keyword_score, 0.8 * semantic_relevance + 0.2 * keyword_score)
```

The threshold removes the high unrelated-similarity floor common to dense embedding models while preserving exact keyword matches.

## Validation

`_tests/smoke_memory_embeddings.js` covers:

- disabled-by-default behavior with zero network calls;
- refusal when provider is selected without explicit external-egress opt-in;
- fixed endpoint/model/auth request shape;
- cosine behavior;
- invalid dimension rejection;
- cross-language Polish-to-English ranking;
- vectors absent from authoritative JSONL and returned entries;
- separate SQLite cache creation;
- authoritative-write survival when the cache is unavailable;
- keyword-search survival when the cache is unreadable.

The memory, network, database, and DLP root specs record the same boundary.

## Deferred Work

- Configure server-owned OVH credentials and explicit egress opt-in in the deployment environment.
- Restart through `scripts/request-restart.js`.
- Run a live PL/EN relevance probe and compare related/unrelated scores before declaring runtime activation.
- Add a bounded backfill control plane only after live quality is accepted. Backfill must be restart-safe, rate-limited, auditable, and resumable.
- Revisit full memory-store migration only if JSONL read cost or concurrent-write behavior becomes a measured blocker.
