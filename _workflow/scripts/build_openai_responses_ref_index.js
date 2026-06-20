const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..", "..");
const sourcePath = path.join(root, "OpenAI.API_Reference.Responses.md");
const outDir = path.resolve(__dirname, "..", "sources", "openai_responses_reference");
const metaPath = path.join(outDir, "meta.json");
const sectionsPath = path.join(outDir, "sections.jsonl");
const termsPath = path.join(outDir, "term_index.json");
const readmePath = path.join(outDir, "README.md");

const IMPORTANT_TERMS = [
  "JSON Schema",
  "json_schema",
  "strict",
  "parameters",
  "input_schema",
  "output_schema",
  "MCP",
  "mcp_list_tools",
  "mcp_call",
  "Function",
  "function_call",
  "tool_choice",
  "allowed_tools",
  "defer_loading",
  "ToolSearch",
  "tool_search",
  "response_format",
  "Structured Outputs",
  "additionalProperties",
  "required",
  "annotations",
  "read_only",
  "readOnlyHint",
];

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function lineColumnForOffset(lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lineStarts[mid] <= offset) lo = mid + 1;
    else hi = mid - 1;
  }
  const lineIndex = Math.max(0, hi);
  return { line: lineIndex + 1, column: offset - lineStarts[lineIndex] + 1 };
}

function collectLineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1);
  }
  return starts;
}

function previewAt(text, offset, maxChars = 260) {
  const start = Math.max(0, offset - Math.floor(maxChars / 3));
  const end = Math.min(text.length, offset + Math.floor((maxChars * 2) / 3));
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function findTermOccurrences(text, lineStarts, term, maxHits = 80) {
  const hits = [];
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  let pos = 0;
  while (hits.length < maxHits) {
    const found = lower.indexOf(needle, pos);
    if (found < 0) break;
    const lc = lineColumnForOffset(lineStarts, found);
    hits.push({
      line: lc.line,
      column: lc.column,
      preview: previewAt(text, found),
    });
    pos = found + Math.max(1, needle.length);
  }
  return hits;
}

function build() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file not found: ${sourcePath}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const text = fs.readFileSync(sourcePath, "utf8");
  const stat = fs.statSync(sourcePath);
  const sha256 = crypto.createHash("sha256").update(text).digest("hex");
  const lineStarts = collectLineStarts(text);
  const lines = text.split(/\r?\n/);

  const headings = [];
  let charOffset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const level = match[1].length;
      const title = match[2].trim();
      headings.push({
        id: `h${headings.length + 1}`,
        level,
        title,
        slug: slugify(title),
        line: i + 1,
        char_start: charOffset,
      });
    }
    charOffset += line.length + 1;
  }

  for (let i = 0; i < headings.length; i += 1) {
    headings[i].char_end = i + 1 < headings.length ? headings[i + 1].char_start : text.length;
    headings[i].char_length = headings[i].char_end - headings[i].char_start;
  }

  const terms = {};
  for (const term of IMPORTANT_TERMS) {
    const hits = findTermOccurrences(text, lineStarts, term);
    terms[term] = {
      hit_count_capped: hits.length,
      capped_at: 80,
      hits,
    };
  }

  fs.writeFileSync(sectionsPath, headings.map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
  fs.writeFileSync(termsPath, JSON.stringify({ source: sourcePath, source_sha256: sha256, terms }, null, 2), "utf8");
  fs.writeFileSync(metaPath, JSON.stringify({
    source_path: sourcePath,
    source_size_bytes: stat.size,
    source_mtime: stat.mtime.toISOString(),
    source_sha256: sha256,
    generated_at: new Date().toISOString(),
    line_count: lines.length,
    heading_count: headings.length,
    term_count: IMPORTANT_TERMS.length,
    files: {
      sections_jsonl: path.relative(outDir, sectionsPath),
      term_index_json: path.relative(outDir, termsPath),
      readme: path.relative(outDir, readmePath),
    },
  }, null, 2), "utf8");

  const topHeadings = headings.filter((h) => h.level <= 3).slice(0, 120);
  const readme = [
    "# OpenAI Responses API reference helper index",
    "",
    "Status: local auxiliary index for the user-supplied reference snapshot.",
    "",
    "Source:",
    "",
    "```text",
    sourcePath,
    "```",
    "",
    "Generated files:",
    "",
    "```text",
    "meta.json",
    "sections.jsonl",
    "term_index.json",
    "```",
    "",
    "Purpose:",
    "",
    "- quick navigation by heading/line/char offset",
    "- targeted lookup of schema-related terms",
    "- support Stage 8 / Step 21 schema/payload drift guard design without importing the full source into project specs",
    "",
    "Selected headings:",
    "",
    ...topHeadings.map((h) => `- L${h.line} H${h.level} ${h.title}`),
    "",
    "Notes:",
    "",
    "- This is a local snapshot, not a live-online verification.",
    "- Use targeted extraction/search for exact schema questions.",
    "- Do not paste the full source into _workflow/SERVER_SPEC.md or digest files.",
    "",
  ].join("\n");
  fs.writeFileSync(readmePath, readme, "utf8");

  console.log(JSON.stringify({
    status: "ok",
    source: sourcePath,
    out_dir: outDir,
    bytes: stat.size,
    lines: lines.length,
    headings: headings.length,
    terms: IMPORTANT_TERMS.length,
    sha256_prefix: sha256.slice(0, 16),
  }, null, 2));
}

build();
