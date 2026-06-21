"use strict";

function handleDocsRoute({
  res,
  pathname,
  textResponse,
  fetchDoc,
  documentRuntimeContext,
}) {
  let id;
  try {
    id = decodeURIComponent(pathname.slice("/docs/".length));
  } catch (error) {
    if (error instanceof URIError) {
      return textResponse(res, 400, "Bad request");
    }
    throw error;
  }
  const doc = fetchDoc(documentRuntimeContext(), id);

  if (!doc) {
    return textResponse(res, 404, "Not found");
  }

  return textResponse(res, 200, `${doc.title}\n\n${doc.text}`);
}

module.exports = {
  handleDocsRoute,
};
