# DIRECTORY

Status: active scripts directory map
Updated: 2026-08-01

- `audit-memory-embedding-runtime.ps1`
  Reads only allowlisted MEM-1 environment names from a live Windows process and emits secret-free activation booleans.
- `audit_directory_docs.js`
  Audits high-churn tracked directories for `DIRECTORY.md` coverage without modifying files.
- `backfill-memory-embeddings.js`
  Performs bounded, idempotent hydration of missing active-memory vectors and emits aggregate-only results.
- `provision-memory-embedding-token.ps1`
  Provisions or rotates the MEM-1 token file through a secure prompt or stdin with a restricted Windows ACL and secret-free output.
- `request-restart.js`
  Writes a bounded restart request for the supervisor-managed runtime path.
- `server.ps1`
  PowerShell helper for controlled local server startup/orchestration.
- `server.sh`
  Shell helper for controlled local server startup/orchestration.
- `generate_directory_docs.js`
  Regenerates selected `DIRECTORY.md` files from a bounded description map.
