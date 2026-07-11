# Codex handoff — OAuth21 MCP resource binding

Date: 2026-07-11
Branch: `fix/oauth21-mcp-resource`
PR: `#1`
Base: `d20a9c4`

## Incident

Codex configured `workbench` at:

`https://mcp-tests-oauth21.romionologic.dev/mcp`

During `codex mcp login workbench`, Codex correctly sent the endpoint URI as the OAuth resource:

`resource=https://mcp-tests-oauth21.romionologic.dev/mcp`

The authorization server accepted only its issuer root as a resource:

`https://mcp-tests-oauth21.romionologic.dev`

The browser therefore received:

```json
{
  "error": "invalid_target",
  "error_description": "resource_mismatch"
}
```

The repository was clean and synchronized with `origin/main`; this was a committed contract bug, not an interrupted working tree.

## Root cause

The local OAuth21 implementation reused one URI for two different roles:

- authorization-server issuer;
- protected MCP resource/audience.

The production MCP route is `/mcp`, while OAuth21 authorization validation was bound to the issuer root.

## Implemented design

The fix introduces an explicit MCP-facing authorization adapter:

`src/auth/oauth21_mcp_authorization_server.js`

External contract:

- issuer: `<public-base-url>`;
- protected resource: `<public-base-url>/mcp`;
- protected-resource metadata remains discoverable at the root `/.well-known/oauth-protected-resource` route;
- token validation is bound to the canonical `/mcp` audience;
- the issuer root is temporarily accepted as an input alias for compatibility with existing clients, but is not advertised as the canonical resource.

The generic issuer-bound OAuth21 core remains available for isolated unit tests and non-MCP callers.

## Changed surfaces

- `src/auth/oauth21_mcp_authorization_server.js`
- `src/runtime/server_bootstrap_runtime.js`
- `src/runtime/oauth_metadata.js`
- `src/runtime/create_server_route_dispatcher.js`
- `src/auth/auth_oauth.js`
- `src/auth/auth_policy.js`
- `_tests/smoke_oauth21_resource_binding.js`
- `_tests/smoke_oauth21_local_as_flow.js`
- `.github/workflows/oauth21-resource-fix-verification.yml`

Legacy `oauth` mode retains its previous protected-resource metadata behavior.

## Verification contract

The PR workflow runs:

```text
node --check <all changed JavaScript files>
node _tests/smoke_oauth21_resource_binding.js
node _tests/smoke_oauth21_local_as_flow.js
node _tests/smoke_oauth21_runtime_status_response.js
npm test
```

Do not merge until the workflow is green.

## Deployment verification

After merge, deploy/restart the OAuth21 instance, then check:

```powershell
$Base = "https://mcp-tests-oauth21.romionologic.dev"

Invoke-RestMethod "$Base/.well-known/oauth-protected-resource" |
  ConvertTo-Json -Depth 10
```

Required result:

```json
{
  "resource": "https://mcp-tests-oauth21.romionologic.dev/mcp",
  "authorization_servers": [
    "https://mcp-tests-oauth21.romionologic.dev"
  ]
}
```

Then refresh Codex credentials:

```powershell
codex mcp logout workbench
codex mcp login workbench
```

The authorize URL must carry `resource=.../mcp`, and operator login must open instead of returning `resource_mismatch`.

## TinyPyMCP memory payload

Save this only after merge and successful live verification:

```text
Project: mcp-tests
Decision: OAuth21 issuer and MCP protected resource are distinct identifiers.
Issuer is the public root URL; canonical resource/audience is the exact MCP endpoint `<public-base-url>/mcp`.
Protected-resource metadata advertises `/mcp`, while discovery and authorization-server endpoints remain at the root.
Codex sends the exact MCP endpoint as RFC 8707 resource during `mcp login`.
A temporary issuer-root request alias exists only for backward compatibility and must not become the advertised canonical resource.
Regression guards: smoke_oauth21_resource_binding.js and smoke_oauth21_local_as_flow.js.
PR: #1, branch fix/oauth21-mcp-resource.
```
