function truncateText(text, maxChars) {
  const value = String(text || "");

  if (value.length <= maxChars) {
    return {
      text: value,
      truncated: false,
      original_chars: value.length,
    };
  }

  return {
    text: value.slice(0, maxChars),
    truncated: true,
    original_chars: value.length,
  };
}

module.exports = {
  truncateText,
};
