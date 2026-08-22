# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T04:29:00+09:00`
- Long Rest durable projection head: `aeb65c1`
- Memory compound persistence head: `b4056e5`
- Current handoff commit: `0ba4aeb`

## Human summary

V1-12 Long Rest compound work has started without reopening completed provider work.

Source reconciliation found that the repository already has the canonical **domain** Long Rest resolver, but not a generic production Long Rest command. The existing Wizard/Pact Tome/Circle Land rest methods are configuration flows rather than full Rest resolution.

This dispatch therefore built the prerequisites instead of inventing new Rest rules:

- Character Long Rest projection now delegates to the existing domain resolver for HP, Temporary HP, durable life flags, and declared long-rest resources;
- Campaign time/rations remain separate optional effects and are not implied by Rest;
- Character and Campaign immutable generation payloads can now be prepared without writing;
- memory Character/Campaign stores support a two-participant preflight/apply protocol;
- deterministic compound persistence contracts require the second participant failure to leave neither new generation visible.

The production Windows/Tauri stores are still independently atomic, so the Long Rest UI/runtime must **not** be connected to sequential Character/Campaign commits yet. Next work is a Tauri cross-store transaction with durable staging/commit recovery, followed by the production Long Rest coordinator and minimal existing-UI preview controls.

Focused tests were authored but no exact-head execution result was observed, so no green/DONE claim is made. Final Codex audit remains deferred until all V1 implementation is complete.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
