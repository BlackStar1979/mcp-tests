"use strict";

function handleDocsRoute({
  res,
  pathname,
  textResponse,
  fetchDoc,
  documentRuntimeContext,
}) {
  const id = decodeURIComponent(pathname.slice("/docs/".length));
  const doc = fetchDoc(documentRuntimeContext(), id);

  if (!doc) {
    return textResponse(res, 404, "Not found");
  }

  return textResponse(res, 200, `${doc.title}\n\n${doc.text}`);
}

module.exports = {
  handleDocsRoute,
};
