"use strict";

function assertObjectKeysExact(value, expectedKeys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys mismatch: got ${actual.join(",")} expected ${expected.join(",")}`);
  }
}

module.exports = {
  assertObjectKeysExact,
};
