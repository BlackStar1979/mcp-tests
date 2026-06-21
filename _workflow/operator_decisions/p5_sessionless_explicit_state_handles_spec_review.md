# P5 Sessionless / Explicit State Handles Spec Review

Date: 2026-06-21
Status: official-source review only; no runtime implementation in this checkpoint.

## Scope

This document verifies the operator direction for Sessionless MCP / explicit state handles against official MCP sources and records how the project should treat that direction.

No runtime behavior is changed in P5.

## Official sources reviewed

1. `https://modelcontextprotocol.io/specification/2025-11-25/index`
2. `https://modelcontextprotocol.io/specification/2025-11-25/basic/transports`
3. `https://modelcontextprotocol.io/specification/draft/basic/transports`
4. `https://modelcontextprotocol.io/specification/draft/basic/transports/streamable-http`
5. `https://modelcontextprotocol.io/seps/2567-sessionless-mcp`
6. `https://modelcontextprotocol.io/seps/2575-stateless-mcp`
7. `https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation`

## Verified facts

### Stable 2025-11-25 spec still describes stateful capability

The current stable specification page is version `2025-11-25 (latest)` and still lists base protocol details including JSON-RPC message format, stateful connections, and server/client capability negotiation.

The stable 2025-11-25 Streamable HTTP page still describes:

- POST and GET on a single MCP endpoint;
- optional server use of SSE;
- session management via `MCP-Session-Id` when a server assigns a session ID;
- clients including that session ID on subsequent requests;
- DELETE `/mcp` as a client-initiated session termination option, with servers allowed to respond 405.

Therefore, the current TEST MCP runtime remains compatible with the stable 2025-11-25-era Streamable HTTP model.

### Final SEP-2575 makes stateless MCP the future direction

SEP-2575 is Final Standards Track. It states that MCP is not stateless by default because the initialization handshake establishes session state, and it proposes removing the state-establishing initialization handshake and replacing it with stateless alternatives. It identifies scalability, resilience, and implementation complexity as problems of the stateful model.

SEP-2575 defines stateless-first design principles:

1. Prioritize statelessness.
2. Prefer state references when fully stateless exchange is not practical.
3. Treat statefulness as a last resort.

It also defines per-request version/capability metadata in `_meta` and `MCP-Protocol-Version`, and introduces `server/discover` for capability discovery.

### Final SEP-2567 removes protocol sessions and uses explicit state handles

SEP-2567 is Final Standards Track. It states that it removes the protocol-level session concept from MCP and replaces implicit session-scoped state with explicit server-minted state handles carried through subsequent calls.

It explicitly says that SEP-2575 removes the `initialize` handshake and SEP-2567 removes sessions and the `Mcp-Session-Id` header; together they make MCP stateless at the protocol layer.

SEP-2567 says application state should be represented by explicit IDs returned by tools and passed as ordinary tool arguments, e.g. `create_basket()` returning a `basket_id`, then later calls passing `basket_id`.

It also states that explicit state handles are not a new protocol construct or wire-level schema. They are a tool-design pattern.

### Draft Streamable HTTP reflects the post-SEP direction

The draft Streamable HTTP page states that revision `2026-07-28` changed Streamable HTTP behavior and included:

- removal of the GET stream endpoint;
- removal of protocol-level sessions.

It describes a single HTTP POST endpoint: each JSON-RPC request or notification is its own HTTP POST; responses are either a single JSON object or a request-scoped SSE stream. It also states that long-lived change notifications are delivered on a `subscriptions/listen` request response stream.

The draft page says that client-to-server notifications over Streamable HTTP are not defined in the core protocol; `notifications/cancelled` is used only on stdio, while on Streamable HTTP closing the SSE response stream is itself the cancellation signal.

## Project interpretation

### Current runtime status

The current TEST MCP runtime is still a 2025-11-25-compatible implementation with Streamable HTTP session machinery, GET SSE support, initialize lifecycle, and OAuth21 local AS integration.

That is acceptable for the current checkpoint because:

- Stage 6 and later P1-P4 are green;
- the live OAuth connector uses the current runtime surface;
- no P5 runtime migration was requested;
- the stable spec still documents sessions and GET SSE behavior.

### Strategic target

Future transport evolution should follow the official Final SEP direction:

- no new investment in protocol-level session semantics;
- no DELETE `/mcp` teardown implementation as a strategic feature;
- no custom multi-stream-in-session manager;
- prefer one POST request equals one independent tool/request execution;
- represent cross-call application state with explicit state handles in tool results and arguments;
- treat list endpoints as session-independent and cacheable by deployment/auth context, with TTL/list-changed invalidation where applicable;
- implement cancellation in the future according to transport-era semantics: current stable supports `notifications/cancelled`; draft Streamable HTTP treats closing the response stream as the cancellation signal.

## Consequences for existing decisions

### D3

Do not implement strict session enforcement as a strategic target. Current compatibility behavior may remain until a deliberate sessionless migration stage.

### D4

Do not implement DELETE `/mcp` teardown. In the stable spec it is optional and servers may return 405. In the draft/SEP direction protocol sessions are removed.

### D5

Do not build a custom session-based multi-stream manager. Future design should be request-scoped streams and subscription/listen style notification streams.

### D6

Cancellation should remain a separate implementation stage. The P3 plan should be refined when selecting the target protocol era:

- stable era: support `notifications/cancelled` semantics where relevant;
- draft/sessionless era: support response-stream close as cancellation signal.

### D9

Hotplug/list freshness should align with the list-independent/cacheable direction and TTL/list-changed invalidation model, not manual refresh as the strategic target.

## Proposed future stages

### S1 - Sessionless compatibility inventory

Inventory all current runtime/session touchpoints:

- initialize / initialized lifecycle;
- `MCP-Session-Id` and session store;
- GET SSE stream;
- pending request correlation;
- sampling/elicitation/root round trips;
- run_all tests that depend on sessions.

No behavior changes.

### S2 - Stable-vs-draft target selection

Choose one target for the next implementation phase:

- remain stable 2025-11-25-compatible for connector continuity;
- build a parallel draft/sessionless compatibility path;
- switch fully only after connector/client support is verified.

### S3 - Explicit state handle design rules

Define project-local rules for tool-created handles:

- opaque ID format;
- entropy/durability policy;
- auth binding: possession is not authorization;
- expiry/error semantics;
- optional destroy/list tools for handle-bearing state;
- audit/redaction handling for handles.

### S4 - Sessionless transport prototype

Prototype behind a separate non-default mode or route, not by mutating current live connector route.

Minimum prototype properties:

- POST-only MCP endpoint;
- per-request `_meta.io.modelcontextprotocol/*` fields;
- `MCP-Protocol-Version` validation;
- `server/discover` if targeting SEP-2575;
- no `MCP-Session-Id` dependency;
- no GET SSE endpoint in draft mode;
- request-scoped SSE only.

### S5 - Migration decision

Only after prototype and client compatibility evidence, decide whether to migrate the live OAuth connector.

## Non-goals for P5

- No runtime code patch.
- No connector refresh.
- No deletion of session code.
- No switch away from the currently validated OAuth21 connector.

## Acceptance for this review

P5 is complete if:

- official sources are recorded;
- stable-vs-draft distinction is explicit;
- operator decisions D3-D6/D9 are mapped to verified spec direction;
- next implementation is staged and gated.
