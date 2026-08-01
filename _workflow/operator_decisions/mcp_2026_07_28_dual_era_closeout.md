# MCP 2026-07-28 Dual-Era Closeout

Status: GREEN / FINAL MODERN ERA ADAPTER LIVE / LEGACY INITIALIZE RETAINED
Date: 2026-08-01

## Decision

The surviving `/mcp` route now has an explicit dual-era boundary:

- protocol revisions `2025-03-26`, `2025-06-18`, and `2025-11-25` stay on the legacy compatibility path;
- protocol revision `2026-07-28` uses per-request metadata, final standard HTTP header validation, modern result envelopes, and `server/discover`;
- legacy `initialize` remains enabled because current operational clients still use it.

This is one route and one tool surface with version-gated codecs. It is not a second server or a second connector architecture.

## Standards delta

The final stable MCP revision was released on 2026-07-28. The implementation was checked against primary sources:

- `https://github.com/modelcontextprotocol/modelcontextprotocol/releases/tag/2026-07-28`
- `https://modelcontextprotocol.io/specification/2026-07-28/changelog`
- `https://modelcontextprotocol.io/specification/2026-07-28/server/discover`
- `https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http`

The previous bridge used a pre-final shape under version `2025-06-18`. The final revision requires a distinct modern era and changed server identity, result discrimination, error codes, and mirrored headers.

## Implemented contract

- `2026-07-28` is an explicitly supported protocol version.
- `server/discover` returns `resultType: "complete"`, `supportedVersions`, capabilities, cache fields, and server identity under `_meta["io.modelcontextprotocol/serverInfo"]`.
- Every successful modern result receives `resultType: "complete"` and server identity metadata.
- Every modern request validates body/header protocol equality and requires `io.modelcontextprotocol/clientCapabilities`.
- `clientInfo` is optional but validated when present, matching its final SHOULD status.
- `Mcp-Method` is required and compared with the body method.
- `Mcp-Name` is required for supported named operations, including Base64 sentinel decoding.
- OAuth DCR validates and persists `application_type`; older clients that omit it are classified deterministically from their redirect URIs instead of being locked out.
- DCR remains a backward-compatibility path. Client ID Metadata Documents are not implemented, so this package does not claim complete adoption of every optional authorization mechanism in the 2026 revision.
- Header mismatch, missing capability, and unsupported version use `-32020`, `-32021`, and `-32022`.
- A removed or unknown modern method returns HTTP 404 with JSON-RPC `-32601`.
- Modern HTTP batch payloads are rejected; each modern message is one POST.
- Cacheable list responses return conservative `ttlMs: 0` and `cacheScope: "private"`.
- No `x-mcp-header` annotations exist in the current tool descriptors, so no `Mcp-Param-*` runtime obligation is active.

Legacy clients do not enter the modern adapter. Existing `initialize`, notification, batch, and tool-call behavior remains regression-covered.

## Fresh client evidence

The 2026-08-01 operational report selected `server_start_id 2026-08-01T17:51:19.986Z` and found:

- `codex-mcp-client 0.146.0-alpha.9.2`;
- protocol version `2025-06-18`;
- `2` successful legacy `initialize` entries;
- `0` `server/discover` entries.

Therefore the modern adapter is ready, but `initialize` retirement remains blocked by client behavior rather than server capability.

## Validation

- focused bridge test: GREEN, including the repaired real-stream harness;
- isolated HTTP dispatch on port `3197`: GREEN for modern discover/list/call, header rejection, removed-method 404, and legacy regression;
- protocol preflight and discover audit smokes: GREEN;
- full offline suite: `7 public + 270 authenticated`, GREEN;
- controlled restart request `manual-1785616149554` loaded the final change set on PID `27900` at `server_start_id 2026-08-01T20:29:11.207Z`;
- direct `workbench.get_info({"path":"mcp-tests"})` succeeded after restart without OAuth relogin.

## Scope boundary

This closeout does not claim every optional MCP 2026 feature. The server advertises only capabilities it implements. It does not add `subscriptions/listen`, MRTR-driven sampling/elicitation, custom `x-mcp-header` parameters, or a second route. Those features require separate evidence and target authorization.

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- oauth_relogin_required: false
- rollback_path: git revert the package commit and request one controlled code-42 restart
