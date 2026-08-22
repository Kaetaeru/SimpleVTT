# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T03:41:00+09:00`
- Product implementation head: `d66b26b`
- Canonical UI gate head: `477250b`
- Current handoff commit: `ef9f39a`

## Human summary

The current Rerun dispatch resumed from the durable V1 checkpoint without repeating Phase 13 or Ready work.

`V1-11 Campaign lifecycle` production gaps are now code-connected while preserving the current UI:

- archive requires explicit confirmation;
- Campaign migration/schema/corruption startup blockers are explicit and never auto-delete data;
- Campaign duplicate is available from the existing Campaign card and reuses the already-existing durable application service;
- the duplicate confirmation states exactly what Campaign-owned continuity is copied and that Player-owned Character files, installed-content ownership, Session history, and transient Session state are not copied;
- explicit Campaign delete is available with an irreversible confirmation and preserves external Character/installed-content stores;
- deleting a Campaign currently captured by a running Session is rejected;
- focused runtime/UI contracts were added;
- canonical `work/v1-composite` pushes now trigger the UI workflow, which includes Campaign lifecycle tests and the TypeScript/build gate.

No push-run success was visible through the available GitHub connector, so this status does not claim exact-head green validation. Comprehensive Codex audit remains deferred until all V1 implementation is present.

## Next implementation

Move to `V1-12` declarative Calendar/Ration provider support. Reuse the existing Content/RuleModule capability validation rather than inventing an executable plugin path. The current Campaign provider selector UI must remain structurally unchanged; compatible installed declarative profiles should become selectable, while missing/invalid providers fail open and do not block normal play.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
