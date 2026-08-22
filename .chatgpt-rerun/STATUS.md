# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T04:03:00+09:00`
- Current provider runtime/test head: `dacb1fd`
- Current handoff commit: `0cce695`

## Human summary

This dispatch resumed from V1-11 without repeating previously implemented or verified work and moved into `V1-12` declarative Calendar/Ration providers.

The provider core/runtime is now code-connected through the existing architecture rather than a new plugin subsystem:

- RuleModule entries may carry strictly validated data-only Campaign Calendar/Ration profiles.
- unexpected executable-style fields are rejected;
- modules must declare the matching Campaign provider capability;
- installed provider data is persisted and revalidated on restart;
- provider metadata flows through the existing Catalog projection;
- custom calendars round-trip authoritative absolute minutes with declared months/leap cycles;
- Campaign capabilities pin provider version;
- ration profiles can provide roster-kind/default daily units while explicit member overrides remain authoritative;
- shortage remains a warning/proposed consequence only and never auto-applies damage/exhaustion;
- removing a custom provider does not break Campaign hydration; only commands that require that provider fail explicitly.

Focused profile/import/runtime tests were added. Exact-head CI/build results have not yet been observed, so no green/DONE claim is made. The comprehensive Codex audit is still deferred until all V1 implementation is complete.

## Next implementation

Finish the provider **production UI path** without redesigning Campaign UI: populate the existing Calendar/Ration selectors from installed catalog profiles, use custom Calendar months in the existing date editor, apply custom ration defaults to the preview, show unavailable/shortage guidance without blocking unrelated play, and wire the new focused tests into the canonical UI workflow.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
