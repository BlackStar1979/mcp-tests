"use strict";

const { truncateText } = require("./text_utils");
const { docUrl } = require("./url_helpers");

function searchDocs(context, query) {
  const docs = Array.isArray(context?.docs) ? context.docs : [];
  const publicBaseUrl = context?.publicBaseUrl || "";
  const q = String(query || "").trim().toLowerCase();

  if (!q) {
    return [];
  }

  const terms = q.split(/\s+/).filter(Boolean);
  const scored = [];

  for (const doc of docs) {
    const haystack = `${doc.id}\n${doc.title}\n${doc.text}`.toLowerCase();
    let score = 0;

    for (const term of terms) {
      if (haystack.includes(term)) {
        score += 1;
      }
    }

    if (score > 0) {
      scored.push({ doc, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    if (a.doc.id === "test-mcp-health-canary") {
      return -1;
    }

    if (b.doc.id === "test-mcp-health-canary") {
      return 1;
    }

    return a.doc.title.localeCompare(b.doc.title);
  });

  return scored.slice(0, 10).map(({ doc }) => ({
    id: doc.id,
    title: doc.title,
    url: docUrl(publicBaseUrl, doc.id),
  }));
}

function fetchDoc(context, id) {
  const docs = Array.isArray(context?.docs) ? context.docs : [];
  const publicBaseUrl = context?.publicBaseUrl || "";
  const maxFetchTextChars = context?.maxFetchTextChars;
  const connectorShapeVersion = context?.connectorShapeVersion;
  const requested = String(id || "").trim();
  const doc = docs.find((item) => item.id === requested);

  if (!doc) {
    return null;
  }

  const capped = truncateText(doc.text, maxFetchTextChars);

  return {
    id: doc.id,
    title: doc.title,
    text: capped.text,
    url: docUrl(publicBaseUrl, doc.id),
    metadata: {
      ...doc.metadata,
      connectorShapeVersion,
      truncated: capped.truncated,
      original_chars: capped.original_chars,
      cap_chars: maxFetchTextChars,
    },
  };
}

module.exports = {
  fetchDoc,
  searchDocs,
};
