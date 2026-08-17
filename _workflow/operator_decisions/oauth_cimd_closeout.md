# OAuth CIMD closeout

Status: repo-validated, live-loaded and live-accepted
Date: 2026-08-16
Package: `CIMD`

## Decision

The repository now accepts HTTPS Client ID Metadata Document identifiers as ephemeral OAuth clients without adding them to the persistent DCR registry.

## Accepted contract

- The implementation tracks `draft-ietf-oauth-client-id-metadata-document-02` and the MCP `2026-07-28` authorization direction.
- A CIMD `client_id` must be an HTTPS URL and the fetched document must repeat the exact same textual `client_id`.
- Resolution rejects RFC 6890/IANA special-use IP ranges, validates DNS before connect, pins the selected address for transport, and does not automatically follow redirects.
- Response processing is bounded to 5 KiB and rejects non-200 responses, malformed JSON, invalid metadata, and private JWK material.
- Cache lifetime respects HTTP freshness, including `Age`; `no-store` disables caching and failures are not cached.
- CIMD redirect URIs use exact textual matching. Existing DCR loopback-port tolerance remains isolated to DCR clients.
- CIMD clients are ephemeral: authorize, code exchange, refresh, and revocation can use resolved metadata without persisting the remote client into the DCR registry.
- Opaque unknown client identifiers do not trigger network resolution.
- Audit events distinguish accepted and rejected CIMD resolution without logging fetched private material.
- The local authorization server continues to advertise only the client authentication methods it implements; this package does not add `private_key_jwt`.

## Regression evidence

Canonical run-all includes `_tests/smoke_oauth_cimd_policy.js`, `_tests/smoke_oauth_cimd_resolver.js`, and `_tests/smoke_oauth21_cimd_flow.js`.

Final source commit: `c6b706b4083dc4da67a45cc31356c2ffe4edb175`, based directly on P2 truth-sync commit `f1329f3ac5c0be3c098888967a7541eb7249e312`.

Clean-history validation run `31959846622` passed:

```text
ok=true, version=0.40.0, public=7, tests_authenticated=304
```

The same run passed source ancestry/tree checks, targeted CIMD/OAuth/DCR guards, matrix and repository-hygiene guards, pre/post full-suite clean-tree checks, and temporary-workflow self-clean.

## Runtime boundary

Controlled live load completed on 2026-08-16 at `server_start_id = 2026-08-16T19:04:37.288Z` from final source `737cdc8b97ec1e966823dc2566eb7d5cd221e9b6`. OAuth clients and token state reopened from the existing SQLite store, the connector remained callable, and the authenticated surface stayed at `98` tools with fingerprint `ec7d3af5b4ea17f5`.

A bounded live SSRF-negative probe called `/authorize` with `client_id = https://127.0.0.1/oauth/client.json`. Runtime returned HTTP `400`, `error = invalid_client`, `error_description = client_metadata_unavailable`; audit recorded `oauth21_cimd_rejected` with `reason = cimd_special_use_ip`. The request was rejected at the special-use IP boundary before any client metadata fetch could proceed. This is direct live evidence that the CIMD resolver and its SSRF boundary are loaded.

## Next package

`MRTR` is now the highest-leverage internally actionable package. Keep it fixture-scoped: validate `InputRequiredResult`, matching `inputResponses`, and opaque `requestState` retry behavior without creating a second execution or session architecture. `COMP-1A` remains the next evidence-gated package after MRTR.
