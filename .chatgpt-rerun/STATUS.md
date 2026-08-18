# Rerun Status

**Connection:** `main` coordination · dead-legacy cleanup CI diagnosis blocked

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher branch: `main`
- Active work branch: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control target: `blocked`
- Issue: #108
- PR: #109 open/draft/unmerged
- Current source HEAD: `5c70b3028aed70b0fc5ddafafe119f40174df833`

## Human summary

The remaining old local-only `App.tsx` Sheet/Create/Scene surfaces were audited against the current production router and removed in `5c70b302...`. Current Sheet, V10 Character creation, ProductionPlay, LevelUp, Resolution/DM, Content/Rules and Session authorities were retained. The related structure test now checks the real production play surface and guards against those legacy functions returning.

The three Windows jobs previously pending at validated head `04d8af30...` are now all confirmed **success** without rerun: Persistence `95877878039`, Phase 12 Windows connected `95878210229`, and Main Windows playable `95878131296`.

The new legacy-removal head is **not validated**. Main Playable run `32189591188`, job `95880814298`, failed at `Verify full UI, rules, TypeScript, and production frontend`. No source fix was guessed.

The required `gh-fix-ci` workflow was invoked, but this execution environment has no GitHub CLI: `gh: not found` (exit 127). That workflow requires authenticated `gh` for Actions log inspection and does not permit the connector to substitute for it, so exact root-cause diagnosis is blocked until a gh-capable authenticated execution environment is available.

Validated boundaries 1–9 remain closed unless touched. Next work is only: inspect the exact Main Playable failure log with `gh`, fix the observed failure, then validate the affected exact head. PR #109 remains draft and must not be merged without explicit user authorization.

`STATUS.md` is human-facing only. Authoritative reconciliation remains README -> control -> STATE -> PLAN.
