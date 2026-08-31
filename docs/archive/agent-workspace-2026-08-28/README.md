# Agent Workspace

This directory is reserved for user/operator instructions and agent-only working coordination for this repository.

## Continuation order

When resuming work on a branch, inspect the agent workspace before choosing the next implementation slice.

1. Read `DEFERRED_FIXES.md` first when it exists. Active owner-playtest regressions and explicit blocking queues there take priority over planned work in `CURRENT_WORK.md`.
2. Read `V1_CURRENT_HANDOFF.md` for the exact canonical head, active implementation slice, immediate next task, validation commands, and known limitations.
3. Use `V1_RELEASE_EXECUTION_CHECKLIST.md` as the full V1 dependency and release-gate router.
4. Read `UX_STRUCTURE_GATES.md` when the task touches a previously deferred owner walkthrough, UX acceptance, or structure gate.

`CURRENT_WORK.md` and `SHORT_TERM_CHECKLIST.md` retain historical Phase 09 context. Do not treat their old `NEXT` sections as the current implementation pointer when `V1_CURRENT_HANDOFF.md` exists.

Do not resume a later feature slice merely because automated CI is green when `DEFERRED_FIXES.md` records an unresolved owner-playtest gate.

## Allowed here

- Agent-specific operating instructions and runbooks.
- Working checklists used to track current and upcoming agent work.
- Temporary coordination notes that help an agent continue work consistently.
- Consolidated owner-playtest regression queues that must survive across development sessions.

## Boundary

- Do not place application source code, runtime configuration, or user-facing project documentation here.
- Treat files in `.agents/` as non-canonical working context. Formal product requirements, architecture decisions, and implementation history should be captured in GitHub Issues, pull requests, or project documentation when they become authoritative.
- Keep GitHub-specific configuration and automation under `.github/`.
- When a checklist item becomes active implementation work, connect it to a GitHub Issue and complete it through a dedicated branch and pull request.

This separation keeps agent context distinct from the SimpleVTT product while still allowing lightweight planning and continuity between development tasks.
