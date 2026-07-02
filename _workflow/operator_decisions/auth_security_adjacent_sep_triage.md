# Auth and Security Adjacent SEP Triage

Status: GREEN / WORKFLOW-ONLY TRIAGE / NO RUNTIME CHANGE
Date: 2026-07-01

## Purpose

Triage the 7 Final SEPs currently classified in `_workflow/sessionless_inventory.json#all_seps_index` as `auth_security_adjacent`.

This record only classifies adjacent auth/security SEPs against the current TEST MCP repo. It does not authorize auth-topology changes by itself.

## Covered by existing runtime/spec/test evidence

- `SEP-2468` Recommend Issuer (`iss`) Parameter in MCP Auth Responses
  - Covered by validated authorization-server metadata, issuer checks, and protected-resource metadata publishing.
- `SEP-2207` OIDC-Flavored Refresh Token Guidance
  - Covered in the local OAuth21 authorization-server path, including refresh-token issuance and persistence tests.
- `SEP-985` Align OAuth 2.0 Protected Resource Metadata with RFC 9728
  - Covered by `src/runtime/oauth_metadata.js`, OAuth preflight behavior, and protected-resource metadata tests.

## Explicit non-target or no current repo dependency

- `SEP-1046` Support OAuth client credentials flow in authorization
  - No current repo evidence shows active client-credentials support as a target behavior.
- `SEP-1024` MCP Client Security Requirements for Local Server Installation
  - Client-installation requirements are not a server-runtime target of this repo.
- `SEP-990` Enable enterprise IdP policy controls during MCP OAuth flows
  - No current repo dependency requires a dedicated workflow package here.

## Partial-coverage watchlist

- `SEP-991` Enable URL-based Client Registration using OAuth Client ID Metadata Documents
  - Current repo has DCR policy and local OAuth21 registration flow evidence, but no explicit target to support URL-based external client-registration metadata yet.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- public_3009_start_required: false

## Validation

- `_tests/smoke_sep_sessionless_inventory.js`
- `_tests/smoke_workflow_navigation_index.js`
- full `node _tests/run_all_smokes.js --skip-network`
