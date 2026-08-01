# MEM-1 Secret-File Activation Package

Status: GREEN / LIVE ACTIVATED / QUALITY VERIFIED / BACKFILL COMPLETE
Date: 2026-08-01

## Delivered

- `MCP_TEST_MEMORY_EMBEDDING_TOKEN_FILE` is the preferred token source.
- Legacy `OVH_AI_ENDPOINTS_ACCESS_TOKEN` remains compatible only when no token file is configured.
- Simultaneous token sources fail closed with `token_source_conflict` before any network request.
- Missing, unreadable, empty, non-file, or larger-than-16-KiB token files fail closed without exposing paths.
- Windows and Linux supervisors accept provider, explicit egress, and token-file settings with pre-start validation.
- `scripts/provision-memory-embedding-token.ps1` accepts a secure prompt or stdin, writes UTF-8 without a BOM, disables ACL inheritance, grants the current identity read/write access, and emits no token or path.
- `scripts/audit-memory-embedding-runtime.ps1` recognizes file and legacy token sources, conflict state, file readiness, and activation readiness while remaining boolean-only.

## Verification

- Repository commits: `0247e2b` and `2a6a68d`, pushed on `feature/cbm-cli-bridge-mvp`.
- Full offline suite: `7` public plus `270` authenticated smoke scripts.
- Self-test: GREEN.
- Dependency audit: zero known production vulnerabilities.
- Controlled restart: `manual-1785608748116`, PID `444` to PID `3804`.
- Live runtime: `server_start_id = 2026-08-01T18:25:49.624Z`, OAuth21/internal, `84` tools, unchanged combined fingerprint `673f28e12afea85c`.
- Direct own-connector `memory_search` succeeded after restart.
- Post-restart secret-safe audit: target verified, no provider/egress/token source, no conflict, no cache, `activation_ready = false`, and `secret_values_exposed = false`.
- The operator provisioned the real token through the restricted-ACL helper without exposing its value or path.
- Supervisor takeover and controlled reload produced live PID `24132`, `server_start_id = 2026-08-01T18:52:13.024Z`, `activation_ready = true`, and the unchanged `84`-tool surface.
- Live EN-to-PL and PL-to-EN probes ranked the intended cross-language entries first with scores `0.27563825236035094` and `0.3169951525979191`.
- A controlled missing-token-file probe returned the intended entry through lexical fallback with score `1`, restored the file in `finally`, and retained `activation_ready = true` afterwards.
- The cache contains `67` `ovh/bge-m3` vectors with `1024` dimensions. Its schema contains only content hashes, provider/model metadata, dimensions, vector BLOBs, and timestamps; controlled plaintext probes were absent.
- Bounded backfill stored all `64` previously missing active-memory vectors and finished with `remaining = 0`.

## Completion

The planned provisioning, activation, quality, confidentiality, fallback, and backfill operations are complete. The live probe also exposed lexical substring/stop-word noise that outranked a valid cross-language semantic result; full-word Unicode tokenization, bounded EN/PL query stop words, and a regression with non-perfect cosine similarity now guard that defect.

No connector refresh or tool-surface change is required.
