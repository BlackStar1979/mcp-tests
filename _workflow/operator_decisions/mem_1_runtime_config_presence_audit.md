# MEM-1 Runtime Configuration Presence Audit

Status: GREEN / LIVE CONFIGURATION ABSENT / ACTIVATION BLOCKED SAFELY
Date: 2026-08-01

## Scope

Determine whether the live OAuth21 runtime has all configuration gates required for OVH `bge-m3` embeddings without reading secrets into logs, documentation, or MCP output.

## Method

- Identified the live `server.js --profile tests --auth oauth21 --port 3008` process as PID `444`.
- Read the process environment through a bounded Windows process-memory reader restricted to four fixed names.
- Converted values immediately into presence/validity booleans; raw values are never emitted.
- Required the target PID to own the `127.0.0.1:3008` listener and its `/healthz` identity to match the internal OAuth21 mcp-tests runtime.
- Repeated the check with `scripts/audit-memory-embedding-runtime.ps1`.
- Confirmed independently that a fresh live `memory_save` did not create `_logs/.mcp-agent-embeddings.sqlite`.

## Live result

- Target identity: `target_verified = true`.
- `MCP_TEST_MEMORY_EMBEDDING_PROVIDER`: absent; provider is not enabled.
- `MCP_TEST_MEMORY_EMBEDDING_EXTERNAL_EGRESS`: absent; external egress is not enabled.
- `OVH_AI_ENDPOINTS_ACCESS_TOKEN`: absent; no token is available to the process.
- `MCP_TEST_MEMORY_EMBEDDING_TIMEOUT_MS`: absent; the validated default timeout remains effective.
- Embedding cache: absent, `0` bytes.
- `activation_ready = false`.
- `secret_values_exposed = false`.

## Decision

Do not restart the runtime and do not attempt a live PL/EN quality proof. The current process is correctly fail-closed to keyword retrieval because all mandatory activation gates are absent.

Prepare a bounded secret-file activation package before requesting a credential. The package should avoid a durable token in a user or machine environment variable, preserve explicit egress opt-in, support supervisor restarts, and keep diagnostics boolean-only. Runtime activation remains a separate controlled step after the secret file exists.

## Reopen conditions

Re-run the audit after the secret-file package is complete and a credential is provisioned, or when the live server PID changes. Proceed to semantic quality probes only when `activation_ready = true` and the cache remains non-plaintext.
