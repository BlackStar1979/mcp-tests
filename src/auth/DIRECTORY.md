# DIRECTORY

Status: source auth directory map
Updated: 2026-07-16

- `auth_access.js`, `auth_bearer.js`, `auth_none.js`, `auth_oauth.js`, `auth_policy.js`
  Auth-mode implementations and shared auth policy helpers.
- `oauth_authorization_server_metadata.js`, `oauth_introspection.js`, `oauth_jwks_cache.js`, `oauth_jwt_verify.js`, `oauth21_utils.js`
  OAuth and token-verification support modules, including bounded OAuth21 request-body parsing.
- `oauth21_persistence_store.js`
  SQLite-backed durable store for OAuth21 clients and token state, including legacy JSON bootstrap.
- `oauth21_startup_prune.js`
  Transaction-coordinated startup maintenance for stale OAuth clients and orphan tokens, with verified rollback backups and receipts.
- `oauth21_authorization_server.js`
  Main OAuth21 authorization server implementation, public-route throttling, bounded DCR client-registry growth, and durable-state orchestration.
- `oauth21_prune_preview.js`, `oauth21_prune_receipt.js`, `oauth21_prune_apply_gate.js`, `oauth21_prune_apply_package_draft.js`, `oauth21_prune_apply.js`
  Explicit OAuth21 prune preview, approval, gate, package-draft, and apply helpers.
- `README.md`
  Orientation for the auth source area.
