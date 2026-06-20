function docUrl(publicBaseUrl, id) {
  return `${publicBaseUrl}/docs/${encodeURIComponent(id)}`;
}

function isPublicHttpsUrl(value) {
  const text = String(value || "");
  return (
    text.startsWith("https://") &&
    !text.startsWith("http://") &&
    !text.startsWith("file://") &&
    !text.includes("127.0.0.1") &&
    !text.toLowerCase().includes("localhost")
  );
}

module.exports = {
  docUrl,
  isPublicHttpsUrl,
};
