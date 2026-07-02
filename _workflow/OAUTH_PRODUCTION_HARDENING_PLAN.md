# OAuth Production Hardening, Sampling Policy, SSE Resumability, and Live Connector Plan

Status: ACTIVE
Created: 2026-06-20
Baseline: ok_0_40_0_8_128
Scope: post Phase G hardening plan for production-grade OAuth, sampling approval policy, stream reliability, and live connector refresh.

## 1. Current state

Phase A-G are green. The repository has a minimal OAuth resource-server validator with HS256 JWT validation, Protected Resource Metadata, Authorization header-only token use, query-token rejection, audience binding, and scope checking.

Historical note: this plan started before OAuth hardening and local OAuth21 AS closure. H1-H9 are now green and Stage 6 validated the OAuth21 connector; future productionization beyond TEST MCP remains a separate operator decision, not a broad architecture reset.

## 2. External authorization server metadata integration

Goal: trust an external authorization server by discovery metadata rather than static assumptions.

Touchpoints:

```text
src/runtime/oauth_metadata.js
src/auth/oauth_authorization_server_metadata.js
src/auth/auth_oauth.js
SERVER_AUTH_SPEC.json
_tests/smoke_oauth_as_metadata_integration.js
```

Checklist:

- [x] Add configured authorization server issuer URL.
- [x] Fetch or load Authorization Server Metadata from `/.well-known/oauth-authorization-server`.
- [x] Validate exact issuer match.
- [x] Require authorization_endpoint and token_endpoint in metadata.
- [x] Require jwks_uri or introspection_endpoint depending on selected token validation mode.
- [x] Publish authorization_servers in Protected Resource Metadata from configured AS metadata.
- [x] Cache metadata with bounded TTL and fail closed on invalid metadata.

Acceptance:

```text
node _tests/smoke_oauth_as_metadata_integration.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 3. Token validation mode: JWKS / RS256 or introspection

Decision: prefer JWKS/RS256 for low-latency local validation when the AS issues JWT access tokens. Use introspection when tokens are opaque or policy requires server-side revocation checks.

Touchpoints:

```text
src/auth/oauth_jwks_cache.js
src/auth/oauth_jwt_verify.js
src/auth/oauth_introspection.js
src/auth/auth_oauth.js
SERVER_AUTH_SPEC.json
_tests/smoke_oauth_jwks_rs256_validation.js
_tests/smoke_oauth_introspection_validation.js
```

Checklist JWKS/RS256:

- [x] Support RS256 verification through Node crypto.
- [x] Fetch/load JWKS from `jwks_uri`.
- [x] Match JWT `kid` to JWK.
- [x] Reject unsupported alg, missing kid, unknown kid, and expired cache.
- [x] Validate iss, aud/resource, exp, nbf, scope.
- [x] Cache JWKS with TTL and refresh-on-unknown-kid guard.

Checklist introspection:

- [x] Implement RFC 7662 introspection client.
- [x] Authenticate resource server to introspection endpoint through configured client credentials or private channel.
- [x] Require `active: true`.
- [x] Validate iss when available, aud/resource when available, exp, nbf, scope.
- [x] Cache positive introspection minimally; never cache negative as valid.

Acceptance:

```text
node _tests/smoke_oauth_jwks_rs256_validation.js = ok
node _tests/smoke_oauth_introspection_validation.js = ok
node _tests/run_all_smokes.js --skip-network = ok
```

## 4. Dynamic client registration policy

Goal: define whether this deployment expects automatic client registration or manually provisioned clients.

Touchpoints:

```text
SERVER_AUTH_SPEC.json
_workflow/OAUTH_PRODUCTION_HARDENING_PLAN.md
_tests/smoke_oauth_dcr_policy.js
```

Checklist:

- [x] Decide `dcr_mode`: required, supported, or disabled-with-manual-registration.
- [x] If DCR is enabled, require registration_endpoint from AS metadata.
- [x] Define allowed redirect URI patterns.
- [x] Define allowed token endpoint auth methods.
- [x] Define operator approval policy for public/untrusted clients.
- [x] Explicitly reject wildcard redirect URI policy.

Acceptance:

```text
node _tests/smoke_oauth_dcr_policy.js = ok
```

## 5. PKCE / client-facing authorization flow at AS boundary

Goal: document and verify client-side flow expectations even though the AS is external.

Touchpoints:

```text
SERVER_AUTH_SPEC.json
_tests/smoke_oauth_pkce_policy.js
```

Checklist:

- [x] Require authorization code + PKCE for public clients.
- [x] Require `code_challenge_method=S256`.
- [x] Require state parameter verification by clients.
- [x] Require exact redirect URI validation by AS.
- [x] Require resource parameter in authorization and token requests.
- [x] Document that MCP server validates only access tokens presented to it; it does not issue authorization codes.

Acceptance:

```text
node _tests/smoke_oauth_pkce_policy.js = ok
```

## 6. Key rotation

Goal: make token validation robust when AS rotates signing keys.

Touchpoints:

```text
src/auth/oauth_jwks_cache.js
src/auth/oauth_jwt_verify.js
SERVER_AUTH_SPEC.json
_tests/smoke_oauth_key_rotation.js
```

Checklist:

- [x] Cache JWKS by issuer and jwks_uri.
- [x] Support multiple active keys.
- [x] Refresh JWKS on unknown kid once per bounded interval.
- [x] Reject tokens if kid remains unknown after refresh.
- [x] Respect cache-control/max-age where available, bounded by local maximum TTL.
- [x] Keep previous key only while still present in JWKS or within configured overlap window.
- [x] Add audit reason codes for key refresh, unknown kid, and key rotation.

Acceptance:

```text
node _tests/smoke_oauth_key_rotation.js = ok
```

## 7. Sampling user-approval policy

Goal: prevent silent model-sampling escalation from tools.

Touchpoints:

```text
src/runtime/sampling_context.js
SERVER_AUTH_SPEC.json
SERVER_SAMPLING_POLICY_SPEC.json
_tests/smoke_sampling_user_approval_policy.js
```

Checklist:

- [x] Add sampling policy spec.
- [x] Classify sampling requests by risk.
- [x] Require explicit user approval for sampling above low-risk thresholds.
- [x] Require audit receipt for requestSampling calls.
- [x] Forbid tool-provided hidden instructions from bypassing approval.
- [x] Add per-session sampling budget.
- [x] Add deny path when approval is required but unavailable.

Acceptance:

```text
node _tests/smoke_sampling_user_approval_policy.js = ok
```

## 8. SSE keepalive and resumability

Goal: make Streamable HTTP sessions reliable over real proxies and mobile clients.

Touchpoints:

```text
src/runtime/sse_response.js
src/runtime/mcp_get_stream_handler.js
src/runtime/session.js
_tests/smoke_sse_keepalive.js
_tests/smoke_sse_resumability.js
```

Checklist:

- [x] Add periodic keepalive comments or ping events.
- [x] Bound keepalive interval by config.
- [x] Assign monotonic event ids to outbound events.
- [x] Store bounded event replay buffer per session.
- [x] Read Last-Event-ID on GET SSE.
- [x] Replay missed events when possible.
- [x] Fail closed or require new session when event id is too old.
- [x] Define maximum queue and replay buffer sizes.

Acceptance:

```text
node _tests/smoke_sse_keepalive.js = ok
node _tests/smoke_sse_resumability.js = ok
```

## 9. Live connector refresh after explicit operator approval

Goal: align live ChatGPT connector surface with repo truth only after the operator approves refresh.

Touchpoints:

```text
SERVER_CONNECTOR_SURFACE_SPEC.json
_workflow/CONNECTOR_REFRESH_READINESS.md
_tests/smoke_connector_refresh_readiness.js
```

Checklist:

- [x] Confirm repo public surface remains 13 tools.
- [x] Confirm public connector must not expose workspace mutation, process execution, remote-site mutation, or registry introspection tools.
- [x] Confirm OAuth/resource-server connector is separate from public auth:none connector.
- [x] Confirm query-token URLs are not OAuth-ready.
- [x] Prepare operator checklist for live connector refresh.
- [x] Require post-refresh evidence: visible tool list, auth mode, publicBaseUrl/resource, tool count, and no forbidden tools.
- [x] Do not perform refresh automatically.

Acceptance:

```text
node _tests/smoke_connector_refresh_readiness.js = ok
```

## 10. Recommended execution order

```text
H1 - AS metadata integration
H2 - JWKS/RS256 validation path
H3 - Introspection path or explicit decision to defer introspection
H4 - DCR policy
H5 - PKCE/client-flow policy at AS boundary
H6 - Key rotation
H7 - Sampling user-approval policy
H8 - SSE keepalive/resumability
H9 - Live connector refresh readiness
```

Do not refresh the live connector before H9. Do not claim production OAuth until H1-H6 are green or explicitly waived.

## H1 completion note

H1 is green. Implemented: `src/auth/oauth_authorization_server_metadata.js`, validated AS metadata loading from `MCP_TEST_OAUTH_AS_METADATA_FILE`, exact issuer validation, required endpoint validation, JWKS-or-introspection requirement, metadata cache, runtime provider wiring, and Protected Resource Metadata publishing from validated AS metadata. Guard: `_tests/smoke_oauth_as_metadata_integration.js`. Next step: H2 - JWKS/RS256 validation path.

## H2 completion note

H2 is green. Implemented: `src/auth/oauth_jwks_cache.js`, `src/auth/oauth_jwt_verify.js`, JWKS/RS256 branch in `src/auth/auth_oauth.js`, `MCP_TEST_OAUTH_JWKS_FILE` runtime wiring, and `_tests/smoke_oauth_jwks_rs256_validation.js`. HS256 remains available only as compatibility/test fallback when JWKS is not configured. Next step: H3 - Introspection path or explicit decision to defer introspection.

## H3 completion note

H3 is green. Implemented optional introspection validation for opaque-token style inputs: `src/auth/oauth_introspection.js`, introspection branch in `src/auth/auth_oauth.js`, env-driven `MCP_TEST_OAUTH_INTROSPECTION_FILE`, active=true requirement, issuer/audience/time/scope validation, positive-only cache, and `_tests/smoke_oauth_introspection_validation.js`. JWKS/RS256 remains the preferred production path. Next step: H4 - DCR policy.

## H4 completion note

H4 is green. Implemented DCR policy/spec only: `dynamic_client_registration_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_oauth_dcr_policy.js`. Decision: `dcr_mode=supported`, manual registration fallback is allowed, wildcard redirect URIs are forbidden, localhost/127.0.0.1 redirects are allowed for development, HTTPS redirects are required otherwise, and untrusted public clients require operator approval. MCP server does not implement its own runtime client registration endpoint. Next step: H5 - PKCE/client-flow policy at AS boundary.

## H5 completion note

H5 is green. Implemented PKCE/client-flow policy at AS boundary: `pkce_client_flow_policy` in `SERVER_AUTH_SPEC.json` and `_tests/smoke_oauth_pkce_policy.js`. Policy requires authorization code flow, PKCE for public clients, S256 only, state verification, exact redirect URI validation by AS, and resource parameter in both authorization and token requests. `mcp-tests` remains a resource server and does not issue authorization codes. Next step: H6 - Key rotation.

## H6 completion note

H6 is green. Implemented JWKS key-rotation behavior in `src/auth/oauth_jwks_cache.js`: issuer/jwks_uri status fields, multiple active keys, bounded refresh-on-unknown-kid, unknown-kid refresh suppression reason, optional previous-key overlap window, and `_tests/smoke_oauth_key_rotation.js`. HTTP cache-control/max-age parsing was later closed by jwks_ttl_guard; local TTL remains bounded. Next step: H7 - Sampling user-approval policy.

## H7 completion note

H7 is green. Implemented sampling user-approval policy: `SERVER_SAMPLING_POLICY_SPEC.json`, runtime approval/budget enforcement in `src/runtime/sampling_context.js`, and `_tests/smoke_sampling_user_approval_policy.js`. Low-risk text-only single-message sampling can proceed automatically within per-session budget. Non-low-risk sampling requires an approved receipt; hidden instruction keys cannot bypass approval. Next step: H8 - SSE keepalive/resumability.

## H8 completion note

H8 is green. Implemented SSE keepalive/resumability: `encodeSseComment`, `writeSseComment`, keepalive timer in GET stream handler, `Last-Event-ID` parsing, monotonic SSE IDs, bounded replay buffer in `McpSession`, replay of buffered sent events, and `_tests/smoke_sse_keepalive.js` / `_tests/smoke_sse_resumability.js`. Fail-closed on too-old Last-Event-ID was later closed by replay_gap_guard. Next step: H9 - Live connector refresh readiness after explicit operator approval.

## H9 completion note

H9 is green. Implemented live connector refresh readiness contract only: `SERVER_CONNECTOR_SURFACE_SPEC.json`, `_workflow/CONNECTOR_REFRESH_READINESS.md`, and `_tests/smoke_connector_refresh_readiness.js`. Public connector remains `auth:none` with 13 allowed public tools. OAuth/resource-server connector must remain separate. Query-token URLs are not OAuth-ready. Stage 6 later performed OAuth21 connector refresh externally by operator approval and recorded post-refresh evidence. Public connector remained disconnected; public runtime was validated locally.

## Post-H9 debt closure note

Closed the two remaining debts required before any live connector refresh authorization: too-old Last-Event-ID now fails closed through replay validation before opening the SSE stream, and JWKS cache-control max-age is parsed into an effective TTL bounded by local maximum TTL. Guards: `_tests/replay_gap_guard.js` and `_tests/jwks_ttl_guard.js`.

## H10 OAuth21 local authorization server note

H10 is green. `mcp-tests` now has a separate `oauth21` mode on port 3008 with public base URL `https://mcp-tests-oauth21.romionologic.dev`, path `/mcp`, app-layer OAuth 2.1 authorization server endpoints, public DCR, PKCE S256, operator login gate, no Cloudflare Access requirement, and Authorization header Bearer validation for MCP. Guards: `_tests/smoke_oauth21_bootstrap_config.js`, `_tests/smoke_oauth21_host_header.js`, `_tests/smoke_oauth21_local_as_flow.js`.
