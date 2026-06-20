"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      throw new Error(`unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireString(args, key) {
  if (typeof args[key] !== "string" || args[key].length === 0) {
    throw new Error(`missing required --${key}`);
  }
  return args[key];
}

function countOccurrences(text, needle) {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = text.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function patchSection({ filePath, startMarker, endMarker, replacement, expectedHash, dryRun = false }) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const before = fs.readFileSync(absolutePath, "utf8");

  const startCount = countOccurrences(before, startMarker);
  const endCount = countOccurrences(before, endMarker);
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(`markers must appear exactly once; start=${startCount}, end=${endCount}`);
  }

  const startIndex = before.indexOf(startMarker);
  const endIndex = before.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex < 0) {
    throw new Error("end marker occurs before start marker or is missing after start marker");
  }

  const sectionStart = startIndex + startMarker.length;
  const currentSection = before.slice(sectionStart, endIndex);
  const currentHash = sha256(currentSection);
  if (expectedHash && expectedHash !== currentHash) {
    throw new Error(`section hash mismatch; expected=${expectedHash}, actual=${currentHash}`);
  }

  const normalizedReplacement = replacement.startsWith("\n") ? replacement : `\n${replacement}`;
  const finalReplacement = normalizedReplacement.endsWith("\n") ? normalizedReplacement : `${normalizedReplacement}\n`;
  const after = before.slice(0, sectionStart) + finalReplacement + before.slice(endIndex);

  const result = {
    ok: true,
    path: filePath,
    dry_run: dryRun,
    bytes_before: Buffer.byteLength(before, "utf8"),
    bytes_after: Buffer.byteLength(after, "utf8"),
    delta_bytes: Buffer.byteLength(after, "utf8") - Buffer.byteLength(before, "utf8"),
    old_section_hash: currentHash,
    new_section_hash: sha256(finalReplacement),
  };

  if (!dryRun) {
    fs.writeFileSync(absolutePath, after);
  }

  return result;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const filePath = requireString(args, "path");
    const startMarker = requireString(args, "start");
    const endMarker = requireString(args, "end");
    let replacement = "";
    if (typeof args.replacement === "string") {
      replacement = args.replacement;
    } else if (typeof args.replacementFile === "string") {
      replacement = fs.readFileSync(path.resolve(process.cwd(), args.replacementFile), "utf8");
    } else {
      throw new Error("missing required --replacement or --replacementFile");
    }

    const result = patchSection({
      filePath,
      startMarker,
      endMarker,
      replacement,
      expectedHash: typeof args.expectedHash === "string" ? args.expectedHash : "",
      dryRun: Boolean(args.dryRun),
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  patchSection,
  sha256,
};
