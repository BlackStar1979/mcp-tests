# RETR-1 Quality Regression Closeout

Status: repo applied and live validated
Date: 2026-08-01

## Trigger

Live dogfooding disproved the earlier 4/4 claim in three ways:

- a long `READINESS.md` row crossed the persisted 12,000-character prefix and produced blank structured fields;
- an index built before source changes had no explicit stale signal;
- natural `MEM-1` and maturity questions returned less authoritative documents before the direct proof or readiness report.

## Applied package

- Index format v3 records bounded file-content and visited-directory-entry freshness fingerprints. Metadata checks stay cheap; hashes are recomputed only after an `mtime` change, preventing generator rewrites and transient create/delete cycles from producing false staleness.
- Read tools expose structured `freshness` metadata and old v2 indexes fail visibly as `unknown` plus `snapshot_unavailable_rebuild_required`.
- Canonical workflow documents use a bounded head/tail retrieval sample and a full bounded transient extraction sample; the full text is not persisted in every document record.
- Markdown table splitting preserves escaped and inline-code pipes.
- Ranking filters bounded English/Polish stop words and adds explicit component-ID, proof/evidence, and maturity intent scoring.
- Freshness filesystem checks use bounded concurrency to remain practical for larger source indexes.

## Verification

- Targeted regression: `_tests/smoke_build_index_tool.js` GREEN.
- Output schemas and schema compatibility: GREEN.
- Full offline suite: `7 public + 270 authenticated`, exit `0`.
- Initial controlled restart: request `manual-1785612565055`, reason `retr1-quality-regression`.
- Final live load: automated request `manual-1785613618354` exposed a standalone process incorrectly bound to the supervisor-reserved port `3008`; the operator completed the supervisor takeover. Independent instances are valid only on another port with hermetic control paths. Live `server_start_id = 2026-08-01T19:48:43.083Z`, 84 tools.
- Live knowledge build: 259 documents, 1,122 visited files, 50 visited directories, `truncated=false`, freshness `fresh`.
- Live ranking: active-workflow query returns `ACTIVE_WORKFLOW_INDEX`, `READINESS`, `ROADMAP`; maturity query returns `READINESS` first; `MEM-1` query returns `mem_1_live_provider_quality_proof.md` first with score 355 versus 290 for the config-presence audit.
- Live structured extraction returns all 11 readiness components and non-empty blocker, next-package, and done-signal fields for `RETR-1`.
- Identical file rewrites and transient create/delete cycles remain `fresh`; a real indexed-content mutation becomes `stale` and reports the changed path.

## Surface delta

- Tool count and names remain unchanged at 84 and `7b5bfc1bd21386d3`.
- Input schema fingerprint remains `f835e87d9899b3fa`.
- Output schema fingerprint changes from `fdb0ceeae9e3c68d` to `d836b83b3151b65d`.
- Descriptor fingerprint changes from `26f35b84a92470b8` to `fb2ee514c19cd02e`.
- Combined fingerprint changes from `673f28e12afea85c` to `73c0bc08dad53e8c`.

No OAuth relogin was required. The existing Codex workbench connector executed the new output contract immediately after the controlled restart.
