"use strict";

function assertTextExcludesMarkers(text, markers, label) {
  for (const marker of markers) {
    if (String(text).includes(marker)) {
      throw new Error(`${label} contains forbidden marker: ${marker}`);
    }
  }
}

module.exports = {
  assertTextExcludesMarkers,
};
