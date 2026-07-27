# DIRECTORY

Status: active project-local agent directory map
Updated: 2026-07-17

- `skills/`
  Cross-runtime project-local skills discovered from `.agents/skills/<skill-name>/SKILL.md`.
- `DIRECTORY.md`
  Functional map of the `.agents` directory.

Keep skills in a flat namespace. Each skill must contain `SKILL.md`; load supporting references only when their `Load when:` condition matches the task.
