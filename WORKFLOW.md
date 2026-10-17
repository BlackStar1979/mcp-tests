# LocalNodeMCP -- Workflow

> Machine spec: [`SPEC.json`](./SPEC.json). Portfolio: `C:\Work\PORTFOLIO.json`.
> **Update rule:** on any change, bump `SPEC.json` `meta.spec_version` + `meta.last_verified` and log it
> under `## Changelog`, in the SAME commit. Detailed engineering state stays in `_workflow/`
> (`STATE.md`, `PRODUCTION_CONVERSION_PLAN.md`); this file is the portfolio-level changelog.

## Changelog

- **2026-10-17 -- localnode-r3 deployed (e7599eb, CI green on Windows from the new path). SPEC v2.**
  `deploy-localnode.ps1 -Ref localnode-r3 -ExpectedTools 76`: npm ci in the release tree, new listener pid,
  76 tools; public `/healthz` 200, unauthenticated `/mcp` 401; release worktree clean at the tag.
  Production now carries the derived `SELF_DIR` in the workspace index and skips tool caches (r2 still had
  the literal directory name, i.e. the silent no-ops, for under 19 minutes: restart from the new path 18:20:45, r3 deploy done before 18:39:38 -- both read from logs/clock).

- **2026-10-17 -- directory and repo renamed mcp-tests -> LocalNodeMCP (P7); adopted into portfolio governance. SPEC v1.**
  The server had been production as LocalNodeMCP since 2026-10-16 while PORTFOLIO.json still listed
  `mcp-tests` under `not_owned` ("CODEX, out of scope, do NOT govern") -- a canonical document stating
  the opposite of the truth. It is now a governed project with this SPEC and WORKFLOW.
  Rename, done live: task tree stopped -> `Rename-Item` (atomic, 7388/7388 files) -> the release
  worktree's `.git` link repaired (`git worktree repair`; the old path's `safe.directory` entry moved,
  the directory's owner SID predates the reinstall) -> `state_dir` updated -> task re-registered ->
  up again in ~1.5 min: 76 tools, public `/healthz` 200, unauthenticated `/mcp` 401.
  Three classes of reference, handled differently:
  - **absolute paths** (`C:\Work\mcp-tests`, every spelling) in live files: rewritten (38 + 3 the first
    regex missed -- its lookahead rejected a sentence-final period); historical records
    (`_workflow/operator_decisions`, inventories, dated docs, archive, fixtures) left as written.
  - **the bare directory name as a path segment**: in `src` it was a silent no-op after the rename
    (`workspace_index.js`: the `.codebase-memory` exclusion, the active entrypoints and a score bonus
    stopped matching), so it is now DERIVED (`SELF_DIR = basename(repo root)`); `path_policy.js` also
    refuses `localnodemcp` as a public FS root. In tests the literal was replaced (66), because a test
    fails loudly on the next rename where src code degraded silently.
  - **protocol `_meta` keys** (`mcp-tests/...`) and the bearer realm: a contract with clients, NOT
    renamed. The public tunnel host keeps its name for the same reason (OAuth resource identity).
  Found on the way: `build_index` returned 0 documents under a 200-file budget because the walker
  descended into `C:\Work\.cache` (mypy tree); tool caches are now skipped (56 documents).
  The tests-profile surface fingerprints moved (one tool description changed); every LIVE copy moved
  with them, the historical MRTR closeout keeps the value it recorded.
  Suite from the new path: 7 public + 316 authenticated, ok.
