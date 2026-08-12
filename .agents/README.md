# Agent Workspace

This directory is reserved for user/operator instructions and agent-only working coordination for this repository.

## Allowed here

- Agent-specific operating instructions and runbooks.
- Working checklists used to track current and upcoming agent work.
- Temporary coordination notes that help an agent continue work consistently.

## Boundary

- Do not place application source code, runtime configuration, or user-facing project documentation here.
- Treat files in `.agents/` as non-canonical working context. Formal product requirements, architecture decisions, and implementation history should be captured in GitHub Issues, pull requests, or project documentation when they become authoritative.
- Keep GitHub-specific configuration and automation under `.github/`.
- When a checklist item becomes active implementation work, connect it to a GitHub Issue and complete it through a dedicated branch and pull request.

This separation keeps agent context distinct from the SimpleVTT product while still allowing lightweight planning and continuity between development tasks.
