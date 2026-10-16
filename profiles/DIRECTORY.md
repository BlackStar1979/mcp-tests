# DIRECTORY

Status: active profiles directory map
Updated: 2026-07-17

- `public.json`
  Runtime profile for the public unauthenticated surface.
- `tests.json`
  Runtime profile for the authorized/internal test surface.
- `production.json`
  LocalNodeMCP production profile: tests minus tests-only and memory_* tools via auth_mode_exclusions.oauth21 (see _workflow/SURFACE_CLASSIFICATION.md).
