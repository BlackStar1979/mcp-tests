# Upstream Repo Pattern Lab

Status: active upstream extraction report
Generated: 2026-07-29T17:11:47.091Z

## Purpose

Keep a small, local, auditable corpus of high-value upstream repositories and extract engineering patterns before transplanting ideas into `mcp-tests`.

This report is not a vendor recommendation list. It records observable repository structure, implementation signals, and bounded transplant candidates.

## Corpus Summary

- Corpus root: `C:/Work/mcp-tests/_repos_with_code_samples`
- Repositories tracked: `7`
- Present locally: `7`
- Missing locally: `0`

## Repositories

### codebase-memory-mcp

- Upstream: https://github.com/DeusData/codebase-memory-mcp
- Local path: `codebase-memory-mcp-main`
- Role: structural code memory baseline
- Present: `true`
- File count sampled: `1773`
- Top extensions: `.c:747`, `.h:631`, `(none):189`, `.sh:41`, `.tsx:32`, `.yml:28`, `.json:18`, `.md:16`, `.ts:13`, `.py:11`, `.txt:10`, `.js:4`
- Role counts: `other:952`, `source:686`, `tests:101`, `docs:23`, `manifest:6`, `readme:5`
- Signals: `retrieval:146`, `graph:622`, `parser:1039`, `storage:260`, `updates:74`, `mcp:83`
- Evidence samples:
  - `retrieval` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
  - `graph` -> `CONTRIBUTING.md`, `install.sh`, `MAINTAINERS.md`
  - `parser` -> `CONTRIBUTING.md`, `README.md`, `THIRD_PARTY.md`
  - `storage` -> `CONTRIBUTING.md`, `glama.json`, `MAINTAINERS.md`
  - `updates` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
  - `mcp` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### doctree-mcp

- Upstream: https://github.com/joesaby/doctree-mcp
- Local path: `joesaby-doctree-mcp`
- Role: BM25 plus document tree navigation
- Present: `true`
- File count sampled: `62`
- Top extensions: `.ts:27`, `.md:17`, `.json:8`, `(none):5`, `.example:1`, `.lock:1`, `.toml:1`, `.yaml:1`, `.yml:1`
- Role counts: `source:27`, `other:16`, `docs:14`, `tests:3`, `manifest:1`, `readme:1`
- Signals: `retrieval:42`, `graph:44`, `parser:56`, `storage:28`, `updates:23`, `mcp:26`
- Package scripts: `serve`, `serve:http`, `index`, `test`
- Evidence samples:
  - `retrieval` -> `CLAUDE.md`, `package.json`, `README.md`
  - `graph` -> `CLAUDE.md`, `package-lock.json`, `README.md`
  - `parser` -> `claude_desktop_config.json`, `CLAUDE.md`, `package.json`
  - `storage` -> `CLAUDE.md`, `package-lock.json`, `railway.json`
  - `updates` -> `CLAUDE.md`, `README.md`, `tests/curator.test.ts`
  - `mcp` -> `bin.ts`, `CLAUDE.md`, `package.json`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### repo-graphrag-mcp

- Upstream: https://github.com/yumeiriowl/repo-graphrag-mcp
- Local path: `yumeiriowl-repo-graphrag-mcp`
- Role: code and docs graph retrieval
- Present: `true`
- File count sampled: `33`
- Top extensions: `.py:25`, `.md:3`, `(none):2`, `.example:1`, `.lock:1`, `.toml:1`
- Role counts: `source:24`, `other:4`, `docs:3`, `manifest:1`, `readme:1`
- Signals: `retrieval:4`, `graph:39`, `parser:9`, `storage:2`, `updates:2`, `mcp:9`
- Evidence samples:
  - `retrieval` -> `AGENTS.md`, `README.md`
  - `graph` -> `AGENTS.md`, `CHANGELOG.md`, `pyproject.toml`
  - `parser` -> `CHANGELOG.md`, `pyproject.toml`, `README.md`
  - `storage` -> `README.md`, `repo_graphrag/graph_storage_creator.py`
  - `updates` -> `AGENTS.md`, `README.md`
  - `mcp` -> `AGENTS.md`, `CHANGELOG.md`, `pyproject.toml`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### docs-mcp-server

- Upstream: https://github.com/arabold/docs-mcp-server
- Local path: `arabold-docs-mcp-server`
- Role: grounded documentation indexing
- Present: `true`
- File count sampled: `717`
- Top extensions: `.ts:339`, `.md:236`, `.tsx:32`, `.png:25`, `.yaml:18`, `.sql:15`, `.json:10`, `(none):9`, `.cjs:6`, `.toml:4`, `.txt:4`, `.yml:4`
- Role counts: `source:329`, `docs:176`, `other:138`, `tests:69`, `readme:3`, `manifest:2`
- Signals: `retrieval:166`, `graph:180`, `parser:181`, `storage:244`, `updates:84`, `mcp:86`
- Package scripts: `prepare`, `build`, `start`, `cli`, `server`, `web`, `dev`, `dev:server`, `dev:web`, `test`, `test:watch`, `test:coverage`, `test:unit`, `pretest:e2e`, `test:e2e`, `test:docker`, `evaluate:search`, `evaluate:search:baseline`, `evaluate:search:preflight`, `test:live`
- Evidence samples:
  - `retrieval` -> `.releaserc.json`, `AGENTS.md`, `ARCHITECTURE.md`
  - `graph` -> `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`
  - `parser` -> `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`
  - `storage` -> `.releaserc.json`, `AGENTS.md`, `ARCHITECTURE.md`
  - `updates` -> `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`
  - `mcp` -> `AGENTS.md`, `ARCHITECTURE.md`, `CHANGELOG.md`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### graph-mem-mcp

- Upstream: https://github.com/arnokamphuis/graph-mem-mcp
- Local path: `arnokamphuis-graph-mem-mcp`
- Role: agent memory graph
- Present: `true`
- File count sampled: `104`
- Top extensions: `.py:59`, `.md:36`, `.bat:2`, `.sh:2`, `(none):2`, `.code-workspace:1`, `.html:1`, `.txt:1`
- Role counts: `docs:35`, `source:35`, `tests:24`, `other:8`, `readme:2`
- Signals: `retrieval:21`, `graph:167`, `parser:3`, `storage:38`, `updates:7`, `mcp:36`
- Evidence samples:
  - `retrieval` -> `tests/test_coreference_resolver_direct.py`, `tests/test_modern_kg.py`, `mcp_server/enhanced_knowledge_processor.py`
  - `graph` -> `tests/assess_phase_4_3_2_performance.py`, `tests/enhanced_phase_2_1_analysis.py`, `tests/test_cleaned_main.py`
  - `parser` -> `docs/CODING_STANDARDS.md`, `docs/README.md`, `.github/copilot-instructions.md`
  - `storage` -> `tests/assess_phase_4_3_2_performance.py`, `tests/test_phase_4_3_2_performance.py`, `tests/test_phase_4_3_3_memory.py`
  - `updates` -> `docs/BANK_SWITCHING_FEATURE.md`, `docs/DEMO_KNOWLEDGE_GRAPH.md`, `docs/ENHANCED_KG_CONSTRUCTION.md`
  - `mcp` -> `tests/test_phase_4_3_integration.py`, `tests/validate_phase_4_1.py`, `mcp_server/main.py`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### obsidian-mcp-server

- Upstream: https://github.com/cyanheads/obsidian-mcp-server
- Local path: `obsidian-mcp-server-master`
- Role: markdown link and vault structure
- Present: `true`
- File count sampled: `32`
- Top extensions: `.ts:20`, `.md:5`, `.json:4`, `.js:1`, `.yml:1`, `(none):1`
- Role counts: `source:21`, `other:4`, `docs:3`, `tests:2`, `manifest:1`, `readme:1`
- Signals: `retrieval:1`, `graph:29`, `parser:23`, `storage:12`, `updates:6`, `mcp:10`
- Package scripts: `build`, `watch`, `start`, `dev`, `test`, `test:watch`, `test:coverage`, `lint`
- Evidence samples:
  - `retrieval` -> `docs/README.md`
  - `graph` -> `jest.config.js`, `package-lock.json`, `package.json`
  - `parser` -> `src/index.ts`, `src/utils/markdown.ts`, `src/utils/__tests__/markdown.test.ts`
  - `storage` -> `package-lock.json`, `src/index.ts`, `src/utils/config.ts`
  - `updates` -> `package-lock.json`, `package.json`, `src/connectors/LocalConnector.ts`
  - `mcp` -> `package.json`, `src/index.ts`, `src/utils/config.ts`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

### markdown-rag-mcp

- Upstream: https://github.com/mohllal/markdown-rag-mcp
- Local path: `mohllal-markdown-rag-mcp`
- Role: markdown RAG pipeline
- Present: `true`
- File count sampled: `111`
- Top extensions: `.py:65`, `.md:29`, `.sh:5`, `(none):5`, `.dev:1`, `.example:1`, `.json:1`, `.lock:1`, `.toml:1`, `.yaml:1`, `.yml:1`
- Role counts: `source:49`, `tests:25`, `docs:19`, `other:14`, `readme:3`, `manifest:1`
- Signals: `retrieval:71`, `graph:22`, `parser:86`, `storage:55`, `updates:42`, `mcp:19`
- Evidence samples:
  - `retrieval` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `graph` -> `ARCHITECTURE.md`, `tests/parsers/test_frontmatter_parser.py`, `src/markdown_rag_mcp/cli/commands/generate_docs_cmd.py`
  - `parser` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `storage` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `updates` -> `ARCHITECTURE.md`, `CLI.md`, `README.md`
  - `mcp` -> `ARCHITECTURE.md`, `pyproject.toml`, `README.md`
- Transplant candidates:
  - `bounded_tree_navigation`: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
  - `doc_code_entity_merge`: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
  - `version_grounded_docs`: Keep external-doc ingestion version-scoped and source-attributed; avoid one undifferentiated global docs cache.
  - `local_graph_memory`: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
  - `watcher_as_optional_projection`: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.

## Next Transplant Queue

- `P0` Keep workbench knowledge index dependency-free until a measured retrieval blocker appears.
  Evidence: Current local corpus shows useful structural patterns can be extracted from files without adding vector infrastructure.
- `P1` Extend document_graph toward doc-to-code edges only after deterministic doc-only topology stops answering workflow questions.
  Evidence: repo-graphrag and codebase-memory patterns both support entity merging, but mcp-tests currently needs stable workflow/document retrieval first.
- `P2` Use corpus extraction reports as the default upstream-memory substrate before manually porting behavior.
  Evidence: The extractor makes repo dissection repeatable and keeps transplant candidates auditable.

## Operating Rule

Before adding retrieval or memory behavior to `mcp-tests`, run this extractor, inspect the relevant upstream repo locally, and save only distilled lessons or adopted decisions to persistent memory.
