# DIRECTORY

Status: active CBM live fixture source map
Updated: 2026-08-01

- `index.js`
  Fixture entrypoint that composes the sample service and math modules for indexing tests.
- `math.js`
  Small deterministic arithmetic functions used for symbol, snippet, and graph assertions.
- `service.js`
  Fixture service layer used for call-path and dependency analysis assertions.
- `DIRECTORY.md`
  Functional map of this fixture source directory.

This directory is test data. Its files must remain small, deterministic, and safe to index repeatedly.
