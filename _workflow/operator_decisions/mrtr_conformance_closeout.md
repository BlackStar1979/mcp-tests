# MRTR conformance closeout

Status: repo-validated, fixture-only, runtime-nonapplicableDate: 2026-08-16
Package: `MRTR`

## Decision

MRTR is accepted as hermetic protocol-conformance evidence only. It does not change production runtime dispatch, create another task/session store, or add a public tool.

## Accepted contract

- The fixture pins the official `@modelcontextprotocol/client` v2 path to protocol `2026-07-28`.
- The initial `tools/call` returns `resultType: "input_required"` with one embedded `elicitation/create` request and opaque `requestState`.
- The official client executes the elicitation and performs exactly one retry.
- The retry uses a fresh JSON-RPC request id, preserves the original tool name and arguments, echoes `requestState` byte-exact, and supplies keyed `inputResponses` for the original input request.
- The completing wire response uses `resultType: "complete"`; the high-level client API consumes that discriminator before returning the final `CallToolResult`.
- No production `src/` file is modified by this package.
- No second execution architecture, task registry, session registry, or durable MRTR state is introduced.

## Regression evidence

Functional source commit: `a80f9e63b064d22717b5bdfa0bcb4f50c0811414`, directly based on P3 final truth-guard commit `960b78dae651bd569aeeb90be7aadee152ec8439`.

Canonical run-all includes `_tests/smoke_mrtr_conformance_fixture.js` and the helper `_tests/helpers/mrtr_conformance_fixture.js`.

Clean-history validation run `31963602072` passed:

```text
ok=true, version=0.40.0, public=7, tests_authenticated=305
```

The same run passed exact ancestry/source checks, targeted MRTR and official-SDK guards, baseline/matrix/hygiene/documentation guards, and pre/post full-suite clean-tree checks.

## Runtime boundary

MRTR has no production runtime dispatch, tool, resource, durable store, or server capability to load, so runtime acceptance is non-applicable rather than pending. The later controlled restart `manual-1786907075795` loaded surrounding final source `737cdc8b97ec1e966823dc2566eb7d5cd221e9b6` at `server_start_id = 2026-08-16T19:04:37.288Z`; the connector remained at `98` tools and fingerprint `ec7d3af5b4ea17f5`, confirming that MRTR did not introduce a runtime surface.

## Compatibility follow-up

A fresh `COMP-1A` evidence probe was run after MRTR validation. Operational `codex-mcp-client 0.147.0-alpha.6.6` remains `initialize_only` in the selected current entry window (`4` matching `initialize`, `0` `server/discover`), while independent `openai-mcp 1.0.0` traffic successfully uses `server/discover` with protocol `2026-07-28`.

`COMP-1A` refresh remains blocked from retirement: modern entry is operational, but the Codex client family still requires the legacy compatibility path. The next compatibility evidence gate is client traffic newer than the August 14 Codex sample. The operator-driven OAuth reconnect/recovery half of `OPS-1B` is now accepted; only recovered live SFTP remains open. The current `DOC-2A` top25/churn>=5 audit reports `missing: 0`.