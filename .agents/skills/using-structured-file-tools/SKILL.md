---
name: using-structured-file-tools
description: Use when inspecting or changing large UTF-8 files, editing exact blocks without full-file transfer, staging generated text, splitting or merging physical files, or making heading-aware Markdown changes through the authenticated workbench tools.
---

# Using Structured File Tools

## Selection Rules

- Use `file_inspect` to obtain the file hash, exact selector range, range hash, and bounded context. Do not read the entire file when a selector can identify the target.
- Use `file_transform` for insertion, replacement, deletion, or append within one physical file. Select by bytes, lines, anchor, Markdown section, or EOF.
- Use `markdown_inspect` and `markdown_transform` when heading structure defines the target. Select duplicate sections with exact `heading_path` plus `occurrence`.
- Use `file_split` only when one physical file must become several physical files. Set full coverage when every source byte must appear exactly once.
- Use `file_merge` when several physical files must become one destination in explicit order. Both split and merge copy data; sources are preserved.
- Use `content_stage` only for generated replacement content that exceeds the inline limit of 8,192 characters. Existing source content can be referenced from a file range without moving it through model context.

## Safe Workflow

1. Inspect the target and retain `file_sha256` or `expected_source_sha256`.
2. Choose the narrowest stable selector. Prefer a unique anchor or Markdown path over guessed line numbers.
3. If content is large, create a stage, append numbered chunks, then seal with expected character count and SHA-256.
4. Call the mutation with `action=preview`. Review paths, byte counts, hashes, selectors, warnings, and the receipt.
5. Call the same tool with `action=commit` and the returned receipt. Do not reconstruct or modify the receipt.
6. Verify the result with `file_inspect` or `markdown_inspect`; inspect destination hashes after split or merge.
7. Release a content stage when it is no longer needed.

For `file_transform`, batch non-overlapping operations into one preview and commit so one source hash governs the complete edit. For physical split and merge, never delete sources as part of the same operation; archive or delete them only in a separately verified step.

## Failure Recovery

- A source-changed or destination-changed error means the evidence is stale. Inspect again and create a new preview; never replay a stale receipt.
- An anchor ambiguity means the selector is weak. Add surrounding anchor text, use an occurrence only when stable, or switch to a structural selector.
- A stage sequence conflict means the caller lost its cursor. Read stage status and continue only from `next_sequence`.
- A split coverage error means ranges overlap or leave gaps. Re-inspect boundaries rather than weakening full-coverage validation.
- After interruption, retrying commit is safe only with current hashes and a fresh preview. The durable composition journal rolls incomplete multi-file commits back before another composition executes.
