# Stage 14.5 live validation correction

Status: CORRECTED / PORT-SPECIFIC TRUTH
Date: 2026-06-25

The prior closeout mixed two runtimes. Port 3009 is public auth:none. It was stopped and replaced by test_mcp_restart.ps1 as pid 22804. Port 3008 is OAuth21/internal. It was not restarted and remains pid 3852 with server.js --profile tests --auth oauth21 --oauth-secret-file. TESTS_MCP.test_mcp_runtime_status observes 3008, not 3009. Correct status: Stage14.5 is committed in repo; public 3009 is restarted and health/tools-list validated; OAuth21 3008 is healthy by read-only observation but still requires an OAuth-aware restart to load Stage14.5 runtime code.
