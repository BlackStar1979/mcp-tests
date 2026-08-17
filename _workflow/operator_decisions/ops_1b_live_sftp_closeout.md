# OPS-1B Live SFTP Closeout

Status: COMPLETE / LIVE READ-ONLY ACCEPTED
Date: 2026-08-17

## Scope

Close the final `OPS-1` external boundary with evidence from the connector-visible TEST MCP runtime itself. The acceptance is intentionally read-only and does not copy credentials or configuration into `mcp-tests`.

## External configuration boundary

The live configuration reference is:

```text
C:\Work\www\remote-site-tools-config.json
```

That file belongs to the separate `C:\Work\www` repository. `mcp-tests` records only the reference. Private-key material remains external to this repository and is not copied, embedded, or versioned here.

## Live acceptance evidence

On 2026-08-17 the connector-visible TEST MCP executed the existing remote-site tools against that configuration:

- `list_remote_site_files` on `.` returned `status=ok`, `count=2`, with remote file sizes of `283` and `41` bytes.
- `read_remote_site_file` on the retained `41`-byte smoke fixture returned `status=ok`, `bytes=41`, with the expected retained smoke content.
- `remote_site_runtime_status` returned `status=healthy`, `8` ops artifacts, `3` valid metadata records, `8` log lines, and `warnings=[]`.

No `write`, `edit`, `move`, `delete`, or `restore` remote-site operation was executed as part of this acceptance.

## Outcome

The earlier blocker was a discovery/reference failure, not missing SFTP infrastructure. The active TEST MCP process can read `C:\Work\www`, resolve the external configuration and its referenced credential material, connect to the real VPS, and read both the configured site root and operations root.

`OPS-1B` is therefore closed and `OPS-1` advances to `4/4`. No runtime restart, connector refresh, credential migration, or change to the `www` repository is required. The remaining event-gated project queue is `COMP-1A`; `COMP-1B` remains conditional on a material change in fresh `COMP-1A` evidence.
