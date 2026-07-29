# Upstream Repo Pattern Lab

Status: active upstream extraction report
Generated: 2026-07-29T17:55:18.903Z

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
- Upstream pin: `unavailable`
- Manifest: `unavailable`; package `unknown@unknown`; license `unknown`
- Runtime dependencies: `0`
- Top extensions: `.c:747`, `.h:631`, `(none):189`, `.sh:41`, `.tsx:32`, `.yml:28`, `.json:18`, `.md:16`, `.ts:13`, `.py:11`, `.txt:10`, `.js:4`
- Role counts: `other:947`, `source:633`, `tests:159`, `docs:23`, `manifest:6`, `readme:5`
- Signals: `retrieval:146`, `graph:622`, `parser:1039`, `storage:260`, `updates:74`, `mcp:83`
- Evidence samples:
  - `retrieval` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
  - `graph` -> `CONTRIBUTING.md`, `install.sh`, `MAINTAINERS.md`
  - `parser` -> `CONTRIBUTING.md`, `README.md`, `THIRD_PARTY.md`
  - `storage` -> `CONTRIBUTING.md`, `glama.json`, `MAINTAINERS.md`
  - `updates` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
  - `mcp` -> `CONTRIBUTING.md`, `MAINTAINERS.md`, `README.md`
- Transplant candidates:
  - `local_graph_memory` [status=`evaluate`, dependency_cost=`medium`]: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
    - Evidence: `src/cli/cli.c:454` -> `"description: Use the codebase knowledge graph for structural code queries. "`
    - Evidence: `src/cli/cli.c:462` -> `"# Codebase Memory — Knowledge Graph Tools\n"`
    - Evidence: `src/cli/cli.c:528` -> `"# Codebase Knowledge Graph\n"`
    - Evidence: `src/cli/cli.c:530` -> `"This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.\n"`
  - `watcher_as_optional_projection` [status=`adopt_as_guardrail`, dependency_cost=`low`]: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.
    - Evidence: `src/cli/progress_sink.c:107` -> `if (path && strcmp(path, "incremental") == 0) {`
    - Evidence: `src/cli/progress_sink.c:108` -> `(void)fprintf(s_out, "  Starting incremental index\n");`
    - Evidence: `src/foundation/system_info.c:303` -> `/* Incremental: leave headroom for user's apps */`
    - Evidence: `src/main.c:18` -> `#include "watcher/watcher.h"`

### doctree-mcp

- Upstream: https://github.com/joesaby/doctree-mcp
- Local path: `joesaby-doctree-mcp`
- Role: BM25 plus document tree navigation
- Present: `true`
- File count sampled: `62`
- Upstream pin: `1755742e78e5e5c80dca43dc76b52ee2a270b96e` on `main`
- Manifest: `package.json`; package `doctree-mcp@1.1.1`; license `MIT`
- Runtime dependencies: `2` (@modelcontextprotocol/sdk, zod)
- Top extensions: `.ts:27`, `.md:17`, `.json:8`, `(none):5`, `.example:1`, `.lock:1`, `.toml:1`, `.yaml:1`, `.yml:1`
- Role counts: `other:16`, `source:15`, `tests:15`, `docs:14`, `manifest:1`, `readme:1`
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
  - `bounded_tree_navigation` [status=`evaluate`, dependency_cost=`low`]: Add navigation primitives before semantic expansion: tree/list/glossary facets should reduce prompt load without adding embeddings.
    - Evidence: `src/indexer.ts:116` -> `export function buildTree(markdown: string, doc_id: string): TreeNode[] {`
    - Evidence: `src/cli-index.ts:72` -> `const results = store.searchDocuments(query, { limit: 10 });`
    - Evidence: `src/curator.ts:109` -> `const searchResults = store.searchDocuments(queryTerms, { limit: 20 });`
    - Evidence: `src/indexer.ts:574` -> `const tree = buildTree(body, doc_id);`

### repo-graphrag-mcp

- Upstream: https://github.com/yumeiriowl/repo-graphrag-mcp
- Local path: `yumeiriowl-repo-graphrag-mcp`
- Role: code and docs graph retrieval
- Present: `true`
- File count sampled: `33`
- Upstream pin: `5bafeaeeaa248daab7386f3b7308418786076bf0` on `main`
- Manifest: `pyproject.toml`; package `repo-graphrag-mcp@0.2.5`; license `MIT`
- Runtime dependencies: `26` (anthropic, faiss-cpu, fastmcp, google-genai, lightrag-hku, numpy, openai, python-dotenv, sentence-transformers, tokenizers, torch, transformers)
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
  - `doc_code_entity_merge` [status=`defer`, dependency_cost=`high`]: Extend deterministic document_graph toward doc-to-code edges only after current doc graph quality becomes a blocker.
    - Evidence: `repo_graphrag/processors/entity_merger.py:110` -> `async def merge_doc_and_code(rag: LightRAG, current_code_dict: Optional[Dict[str, Any]] = None) -> None:`
    - Evidence: `repo_graphrag/config/settings.py:426` -> `# Entity Merge Settings`
    - Evidence: `repo_graphrag/config/settings.py:428` -> `# Enable/disable entity merge`
    - Evidence: `repo_graphrag/graph_storage_creator.py:54` -> `await merge_doc_and_code(rag, current_process_code_dict)`
  - `dependency_cost_gate` [status=`adopt_as_guardrail`, dependency_cost=`avoid_until_blocked`]: Require a reproduced retrieval-quality or scale blocker before adding Qdrant, Milvus, FalkorDB, Chroma, LanceDB, or external embeddings.
    - Evidence: `pyproject.toml` -> `anthropic`
    - Evidence: `pyproject.toml` -> `faiss-cpu`
    - Evidence: `pyproject.toml` -> `google-genai`
    - Evidence: `pyproject.toml` -> `lightrag-hku`

### docs-mcp-server

- Upstream: https://github.com/arabold/docs-mcp-server
- Local path: `arabold-docs-mcp-server`
- Role: grounded documentation indexing
- Present: `true`
- File count sampled: `717`
- Upstream pin: `dfb49478f8853c2807885cba5aa957496048c9ff` on `main`
- Manifest: `package.json`; package `@arabold/docs-mcp-server@2.4.5`; license `MIT`
- Runtime dependencies: `64` (@alpinejs/collapse, @fastify/formbody, @fastify/static, @joplin/turndown-plugin-gfm, @kitajs/html, @kitajs/ts-html-plugin, @kreuzberg/node, @langchain/aws, @langchain/core, @langchain/google-genai, @langchain/google-vertexai, @langchain/openai)
- Top extensions: `.ts:339`, `.md:236`, `.tsx:32`, `.png:25`, `.yaml:18`, `.sql:15`, `.json:10`, `(none):9`, `.cjs:6`, `.toml:4`, `.txt:4`, `.yml:4`
- Role counts: `source:297`, `docs:175`, `tests:130`, `other:110`, `readme:3`, `manifest:2`
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
  - `watcher_as_optional_projection` [status=`adopt_as_guardrail`, dependency_cost=`low`]: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.
    - Evidence: `src/cli/main.ts:219` -> `// Handle HMR for vite-node --watch`
    - Evidence: `src/pipeline/PipelineManager.ts:161` -> `// - Completed versions: incremental refresh with ETags`
    - Evidence: `src/tools/search-provider.ts:175` -> `// a dangling watcher = a 60-minute hang.`
  - `dependency_cost_gate` [status=`adopt_as_guardrail`, dependency_cost=`avoid_until_blocked`]: Require a reproduced retrieval-quality or scale blocker before adding Qdrant, Milvus, FalkorDB, Chroma, LanceDB, or external embeddings.
    - Evidence: `package.json` -> `@langchain/google-genai`
    - Evidence: `package.json` -> `@langchain/openai`

### graph-mem-mcp

- Upstream: https://github.com/arnokamphuis/graph-mem-mcp
- Local path: `arnokamphuis-graph-mem-mcp`
- Role: agent memory graph
- Present: `true`
- File count sampled: `104`
- Upstream pin: `4b4c495cd9b4e20dd97841c800a75e1e066aecd4` on `master`
- Manifest: `unavailable`; package `unknown@unknown`; license `unknown`
- Runtime dependencies: `0`
- Top extensions: `.py:59`, `.md:36`, `.bat:2`, `.sh:2`, `(none):2`, `.code-workspace:1`, `.html:1`, `.txt:1`
- Role counts: `docs:35`, `tests:35`, `source:24`, `other:8`, `readme:2`
- Signals: `retrieval:21`, `graph:167`, `parser:3`, `storage:38`, `updates:7`, `mcp:36`
- Evidence samples:
  - `retrieval` -> `tests/test_coreference_resolver_direct.py`, `tests/test_modern_kg.py`, `mcp_server/enhanced_knowledge_processor.py`
  - `graph` -> `tests/assess_phase_4_3_2_performance.py`, `tests/enhanced_phase_2_1_analysis.py`, `tests/test_cleaned_main.py`
  - `parser` -> `docs/CODING_STANDARDS.md`, `docs/README.md`, `.github/copilot-instructions.md`
  - `storage` -> `tests/assess_phase_4_3_2_performance.py`, `tests/test_phase_4_3_2_performance.py`, `tests/test_phase_4_3_3_memory.py`
  - `updates` -> `docs/BANK_SWITCHING_FEATURE.md`, `docs/DEMO_KNOWLEDGE_GRAPH.md`, `docs/ENHANCED_KG_CONSTRUCTION.md`
  - `mcp` -> `tests/test_phase_4_3_integration.py`, `tests/validate_phase_4_1.py`, `mcp_server/main.py`
- Transplant candidates:
  - `local_graph_memory` [status=`evaluate`, dependency_cost=`medium`]: Prefer scoped graph records with explicit source and supersession over free-form extracted memory blobs.
    - Evidence: `mcp_server/quality/validators.py:186` -> `def __init__(self, graph_store=None, schema_manager: Optional[SchemaManager] = None):`
    - Evidence: `mcp_server/quality/validators.py:742` -> `def create_graph_quality_assessor(graph_store=None, schema_manager: Optional[SchemaManager] = None) -> GraphQualityAssessment:`
    - Evidence: `mcp_server/storage/__init__.py:29` -> `def create_graph_store(storage_type: str = "memory", **config) -> GraphStore:`
    - Evidence: `mcp_server/storage/__init__.py:31` -> `Factory function to create appropriate graph store instance.`

### obsidian-mcp-server

- Upstream: https://github.com/cyanheads/obsidian-mcp-server
- Local path: `obsidian-mcp-server-master`
- Role: markdown link and vault structure
- Present: `true`
- File count sampled: `32`
- Upstream pin: `unavailable`
- Manifest: `package.json`; package `obsidian-mcp-server@1.0.0`; license `MIT`
- Runtime dependencies: `7` (@modelcontextprotocol/sdk, axios, chokidar, glob, gray-matter, ws, zod)
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
  - `watcher_as_optional_projection` [status=`adopt_as_guardrail`, dependency_cost=`low`]: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.
    - Evidence: `src/connectors/LocalConnector.ts:14` -> `private watcher?: FSWatcher;`
    - Evidence: `src/connectors/LocalConnector.ts:35` -> `// Setup file watcher for changes`
    - Evidence: `src/connectors/LocalConnector.ts:36` -> `this.watcher = chokidar.watch(path.join(this.config.path!, '**/*.md'), {`
    - Evidence: `src/connectors/LocalConnector.ts:41` -> `this.watcher.on('change', (filePath: string) => this.handleFileChange(filePath));`

### markdown-rag-mcp

- Upstream: https://github.com/mohllal/markdown-rag-mcp
- Local path: `mohllal-markdown-rag-mcp`
- Role: markdown RAG pipeline
- Present: `true`
- File count sampled: `111`
- Upstream pin: `baed5849f4b3df468bab4e822b5845373fc494ad` on `main`
- Manifest: `pyproject.toml`; package `markdown-rag-mcp@1.0.0`; license `unknown`
- Runtime dependencies: `17` (aiofiles, asyncio-mqtt, click, langchain, langchain-huggingface, langchain-milvus, markdown-it-py, nest-asyncio, pydantic, pydantic-settings, pymilvus, python-dotenv)
- Top extensions: `.py:65`, `.md:29`, `.sh:5`, `(none):5`, `.dev:1`, `.example:1`, `.json:1`, `.lock:1`, `.toml:1`, `.yaml:1`, `.yml:1`
- Role counts: `source:41`, `tests:41`, `other:14`, `docs:11`, `readme:3`, `manifest:1`
- Signals: `retrieval:71`, `graph:22`, `parser:86`, `storage:55`, `updates:42`, `mcp:19`
- Evidence samples:
  - `retrieval` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `graph` -> `ARCHITECTURE.md`, `tests/parsers/test_frontmatter_parser.py`, `src/markdown_rag_mcp/cli/commands/generate_docs_cmd.py`
  - `parser` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `storage` -> `ARCHITECTURE.md`, `CLAUDE.md`, `CLI.md`
  - `updates` -> `ARCHITECTURE.md`, `CLI.md`, `README.md`
  - `mcp` -> `ARCHITECTURE.md`, `pyproject.toml`, `README.md`
- Transplant candidates:
  - `watcher_as_optional_projection` [status=`adopt_as_guardrail`, dependency_cost=`low`]: Treat live watchers as optional projections; primary truth should remain rebuildable from files and specs.
    - Evidence: `src/markdown_rag_mcp/cli/commands/index_cmd.py:43` -> `def index(_ctx, index_dir, recursive, force, watch, output_format):`
    - Evidence: `src/markdown_rag_mcp/__init__.py:11` -> `- Incremental file monitoring and index updates`
    - Evidence: `src/markdown_rag_mcp/__init__.py:41` -> `markdown-rag-mcp index ./docs --watch`
    - Evidence: `src/markdown_rag_mcp/cli/commands/index_cmd.py:34` -> `@click.option('--watch', is_flag=True, help='Start monitoring for file changes after indexing')`
  - `dependency_cost_gate` [status=`adopt_as_guardrail`, dependency_cost=`avoid_until_blocked`]: Require a reproduced retrieval-quality or scale blocker before adding Qdrant, Milvus, FalkorDB, Chroma, LanceDB, or external embeddings.
    - Evidence: `pyproject.toml` -> `langchain-milvus`
    - Evidence: `pyproject.toml` -> `pymilvus`
    - Evidence: `pyproject.toml` -> `sentence-transformers`

## Next Transplant Queue

- `P0` Keep workbench knowledge index dependency-free until a measured retrieval blocker appears.
  Evidence: Current local corpus shows useful structural patterns can be extracted from files without adding vector infrastructure.
- `P1` Extend document_graph toward doc-to-code edges only after deterministic doc-only topology stops answering workflow questions.
  Evidence: repo-graphrag and codebase-memory patterns both support entity merging, but mcp-tests currently needs stable workflow/document retrieval first.
- `P2` Use corpus extraction reports as the default upstream-memory substrate before manually porting behavior.
  Evidence: The extractor makes repo dissection repeatable and keeps transplant candidates auditable.

## Second-Pass Decisions

### doctree-mcp

- Verdict: `adopt_patterns_only`
- Patterns: `heading hierarchy with stable section identity and source line spans`, `glossary-assisted query expansion and facet prefiltering`, `bounded match positions and density-oriented snippets`
- Rationale: The implementation is dependency-light, but its monolithic search routine should be decomposed before any local adaptation.
- Reopen when: A benchmark reproduces navigation or snippet-quality loss in the current deterministic knowledge index.

### repo-graphrag-mcp

- Verdict: `defer`
- Patterns: `documentation-to-code entity reconciliation`, `batched graph enrichment`
- Rationale: The current pin carries 26 runtime dependencies, including embedding, model-provider, Torch, Transformers, and FAISS layers. That cost is unjustified while deterministic document links answer current workflow questions.
- Reopen when: Exact path, symbol, and document-link joins fail a measured retrieval-quality criterion.

### all tracked repositories

- Verdict: `adopt_guardrail`
- Patterns: `pin every inspected upstream revision`, `require source-level implementation evidence`, `record dependency cost before transplanting behavior`
- Rationale: Repository names, README claims, and keyword counts are discovery signals, not implementation evidence.
- Reopen when: Always active for future upstream reviews.

## Operating Rule

Before adding retrieval or memory behavior to `mcp-tests`, run this extractor, inspect the relevant upstream repo locally, and save only distilled lessons or adopted decisions to persistent memory.
