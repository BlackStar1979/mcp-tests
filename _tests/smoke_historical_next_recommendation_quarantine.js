"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "_workflow", "operator_decisions");

const files = fs.readdirSync(DIR).filter((name) => name.endsWith(".md"));
const offenders = [];

for (const name of files) {
  const rel = `_workflow/operator_decisions/${name}`;
  const text = fs.readFileSync(path.join(DIR, name), "utf8");
  if (!text.includes("Historical status note:")) continue;
  if (!/## Next recommendation\b/.test(text)) continue;

  const hasHistoricalMarker =
    text.includes("Historical next step at that time:") ||
    text.includes("Historical closeout at that time:");
  const hasQuarantineMarker =
    text.includes("This is no longer the active queue;") ||
    text.includes("This record is no longer an active instruction source;");
  const leaksActiveQueue =
    text.includes("Current next substantive queue item") ||
    text.includes("Current expected next substantive queue item");

  if (!hasHistoricalMarker || !hasQuarantineMarker || leaksActiveQueue) {
    offenders.push({
      file: rel,
      hasHistoricalMarker,
      hasQuarantineMarker,
      leaksActiveQueue,
    });
  }
}

assert.deepEqual(offenders, []);
console.log("smoke_historical_next_recommendation_quarantine ok");
