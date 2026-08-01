# MEM-1 Live Provider Quality Proof

Status: GREEN / ACCEPTED
Date: 2026-08-01

## Runtime identity

- OAuth21/internal runtime on `127.0.0.1:3008`
- PID `24132`
- `server_start_id = 2026-08-01T18:52:13.024Z`
- `84` tools; connector descriptor shape unchanged
- provider `ovh`, explicit external egress enabled, protected token file ready
- `activation_ready = true`, legacy inline token absent, token-source conflict absent

## Quality evidence

- EN query to PL memory: intended entry ranked first at `0.27563825236035094`.
- PL query to EN memory: intended entry ranked first at `0.3169951525979191`.
- The first live EN-to-PL attempt exposed lexical substring and common-word noise. The scorer now uses exact Unicode words and bounded EN/PL query stop words; regression coverage uses a realistic `0.64` cosine target rather than an ideal vector.
- Controlled token-file unavailability preserved lexical retrieval; the intended entry ranked first at `1.0`, the file was restored in `finally`, and the post-test runtime audit remained ready.

## Cache and backfill evidence

- SQLite sidecar after backfill: `67` rows, provider `ovh`, model `bge-m3`, dimensions `1024`.
- Backfill result: `64` attempted, `64` stored, `0` remaining.
- Cache columns: `content_hash`, `provider`, `model`, `dimensions`, `vector`, `created_at`.
- Controlled Polish and English plaintext probes were absent from the cache file.
- Backfill and runtime reports expose neither memory plaintext, vectors, credentials, nor credential paths.

## Operational conclusion

`MEM-1` satisfies its 4/4 done signal. JSONL remains authoritative, the SQLite vector sidecar is reconstructable and non-authoritative, provider failure degrades to lexical search, and no connector refresh is required.
