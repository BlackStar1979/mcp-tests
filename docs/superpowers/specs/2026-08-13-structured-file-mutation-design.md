# Structured File Mutation Design

Date: 2026-08-13
Status: operator-approved; architecture delegated to the agent

## Goal

Give weaker and stronger agents a predictable way to inspect and modify bounded parts of large text files without copying the whole file through model context. Support exact insertion, replacement, append, physical split, physical merge, and structure-aware Markdown edits through one durable mutation core.

## Current failure modes

- Runtime input validation rejects any individual string above 10,000 characters.
- `edit_file_patch` reads the complete target into memory and constructs a complete replacement string.
- `read_file_lines` and `read_file_chunk` scan to end-of-file to report global totals even after the requested result is complete.
- Workspace writes create backups but overwrite targets directly rather than using durable temporary-file replacement.
- Dry-run integrity binds request arguments but not the exact source file version, leaving a race between preview and commit.
- Physical split and merge are absent, forcing agents to write one-off scripts.
- Markdown tools do not expose headings and sections as stable selectors.

## Product vocabulary

- A `range` is a byte interval in one physical file.
- An `anchor` is exact UTF-8 text used to locate a unique range.
- A `section` is a Markdown heading and its body up to the next heading of equal or lower depth.
- A `stage` is owner-scoped temporary content uploaded in bounded chunks. It is transport state, not a project file or Markdown block.
- `split` and `merge` always mean physical project files.

## Tool surface

The authenticated surface adds seven tools:

- `file_inspect`: locate anchors, byte ranges, line ranges, and hashes while returning bounded context.
- `content_stage`: create, append, seal, inspect, and release owner-scoped staged UTF-8 content.
- `file_transform`: apply ordered insert, replace, or append operations to one text file.
- `file_split`: copy selected source ranges into multiple destination files.
- `file_merge`: concatenate ordered source files into one destination.
- `markdown_inspect`: return a bounded structural outline and stable section selectors.
- `markdown_transform`: apply section-oriented Markdown mutations through the shared file engine.

Existing `write_file`, `append_file`, `edit_file_patch`, and `code_apply_patch` remain compatibility facades. They migrate to the shared core before any retirement decision.

## Input budgets and staged content

The global 10,000-character input guard remains for ordinary strings. Content-bearing schemas use the standard JSON Schema `maxLength: 8192` keyword, so bounded chunks remain below the global guard without a custom validator extension. No global guard is weakened.

`content_stage` uses an `action` enum:

- `create`: create an empty stage and return `stage_id`.
- `append`: append one chunk with the expected next sequence number.
- `seal`: freeze the stage after validating expected total characters and SHA-256.
- `status`: return metadata only.
- `release`: delete the stage and its chunks.

Only sealed stages can be consumed. Stage metadata and chunks live in SQLite WAL storage. Every row is bound to a SHA-256 owner key derived from authenticated client identity. Raw content is never written to audit logs or returned by status calls. Defaults are 8 MiB per stage, 32 MiB per owner, 16 live stages per owner, and 24-hour retention, with fail-fast bounded environment overrides.

## Selector model

All mutation tools compile selectors to byte ranges before writing:

```json
{
  "kind": "anchor",
  "text": "## Current log",
  "occurrence": 1,
  "include_anchor": true,
  "expected_matches": 1
}
```

Supported selector kinds are:

- `bytes`: zero-based half-open byte range with UTF-8 boundary validation.
- `lines`: one-based inclusive line range.
- `anchor`: exact text match with occurrence and expected-match controls.
- `markdown_section`: heading path, optional occurrence, and expected section hash.
- `eof`: zero-length range at the end of the file.

Inspection returns `file_sha256`, `range_sha256`, byte offsets, line coordinates when known, match count, and bounded context. A transform requires either `expected_file_sha256` or an exact selector hash. Ambiguous anchors fail closed.

## Streaming mutation core

The core resolves and validates all operations before creating output. It then streams unchanged source ranges and replacement sources into a sibling temporary file while calculating the new SHA-256 and byte count. Replacement sources can be inline text, a sealed stage, or a range from another workspace file.

For one target, commit order is:

1. validate paths, source version, selectors, quotas, and non-overlap;
2. create a sibling temporary file with exclusive creation;
3. stream content and flush the temporary file;
4. create the existing bounded backup;
5. atomically rename the temporary file over the target;
6. flush the parent directory where the platform supports it;
7. record the terminal journal state.

Multi-file split and merge cannot be globally atomic on Windows. They use a durable SQLite transaction journal with prepared temporary files, per-target atomic replacement, and deterministic rollback or startup recovery. They never delete source files. Source deletion remains a separate explicit tool call after verification.

## Physical split and merge

`file_split` accepts one source and an ordered list of `{ destination, selector }` parts. Optional `require_full_coverage` rejects gaps or overlaps. It supports the specification/archive/current-log case without requiring the agent to transmit source content.

`file_merge` accepts ordered source paths and an optional bounded separator. It validates every source hash, prevents destination/source aliasing, streams sources without loading them together, and preserves source files. A repeated source is rejected unless `allow_repeated_sources=true` is explicit.

Both tools default to dry-run. Commit requires a preview receipt bound to all source hashes, selectors, destinations, and content references.

## Markdown structure

Markdown parsing uses the maintained unified/remark ecosystem with CommonMark, GFM, and frontmatter support. Parsing is used only to identify source positions and section relationships. Untouched Markdown is never serialized from an AST, avoiding formatting churn in tables, lists, code fences, and whitespace.

`markdown_inspect` returns bounded nodes with heading path, depth, byte range, line range, section hash, child count, and flags for frontmatter, GFM tables, task lists, code blocks, and HTML. Duplicate headings receive occurrence numbers.

`markdown_transform` supports:

- `replace_section_body`;
- `append_to_section`;
- `insert_section_before`;
- `insert_section_after`;
- `replace_section`.

It compiles the selected section to ordinary byte-range operations and delegates commit to the shared mutation core. Unsupported or malformed Markdown fails without changing the file.

## Tool-selection ergonomics

Descriptions use explicit decision language:

- use `file_transform` for one file and known text/ranges;
- use `file_split` only when one physical file must become several physical files;
- use `file_merge` only when several physical files must become one physical file;
- use Markdown tools when headings or document structure define the target;
- use `content_stage` only when generated replacement content does not fit one bounded call.

Schemas use closed objects, enums, examples in descriptions, and mutually exclusive source fields. Responses return compact receipts and hashes rather than full diffs. Read-only tools are annotated read-only. Transform tools are conservatively annotated destructive and closed-world. MCP annotations remain hints and are not treated as a mechanism for bypassing client safety controls.

## Compatibility and migration

- `edit_file_patch` becomes a single-operation compatibility wrapper over `file_transform`.
- `append_file` becomes an EOF insertion wrapper.
- `write_file` uses the same atomic writer and source-version precondition when overwriting.
- `code_apply_patch` receipts bind `expected_file_sha256`, closing the dry-run race.
- Existing response fields remain stable; additional hash and receipt fields are additive.
- The public profile remains unchanged.

## Testing

Tests cover ASCII, CRLF, BOM, multibyte UTF-8 boundaries, missing final newline, duplicate anchors, concurrent source changes, 122 KiB and multi-megabyte files, staged content across restart, owner isolation, stage quotas, crash recovery, split coverage, merge ordering, repeated sources, Markdown duplicate headings, GFM tables, frontmatter, fenced headings, and formatting preservation.

Acceptance requires targeted RED/GREEN smokes, the complete offline suite, dependency audit, isolated OAuth runtime on an unused port, controlled port-3008 restart, direct calls through the workbench connector, workflow-truth reconciliation, CBM reindex, clean git state, and pushed upstream branch.

## Non-goals

- No safety-classifier bypass, encoding trick, or base64 transport for ordinary text.
- No automatic deletion of split sources or merged inputs.
- No generic binary patching in this package.
- No network multi-fetch changes.
- No full-document Markdown reformatting.
