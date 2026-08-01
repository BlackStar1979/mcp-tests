# DIRECTORY

Status: source memory directory map
Updated: 2026-08-01

- `memory_store.js`
  Authoritative JSON/JSONL memory-state storage plus keyword and optional hybrid semantic retrieval.
- `embedding_client.js`
  Fail-closed OVH `bge-m3` client with explicit external-egress opt-in, bounded timeout/response size, and strict vector validation.
- `embedding_cache.js`
  Non-authoritative SQLite sidecar storing content hashes and versioned vectors without memory plaintext.
- `embedding_backfill.js`
  Idempotent, bounded hydration of missing embeddings from the authoritative active-memory JSONL store.
