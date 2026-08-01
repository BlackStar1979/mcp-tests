# MEM-1 Secret-File Activation Package

Status: GREEN / LIVE LOADED / CREDENTIAL PROVISIONING PENDING
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

## Remaining controlled operation

1. Provision the real OVH token with `scripts/provision-memory-embedding-token.ps1` through its secure prompt.
2. Start/take over the supervisor with provider `ovh`, external egress `1`, and the provisioned token-file path.
3. Require `activation_ready = true` before any quality claim.
4. Run bounded related/unrelated Polish and English probes, verify cache contains no plaintext, and verify keyword fallback under provider failure before any backfill.

No connector refresh or tool-surface change is required.
