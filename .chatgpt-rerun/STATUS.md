# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T04:14:00+09:00`
- Provider production UI/gate head: `a285f2f`
- Current handoff commit: `8c79b9f`

## Human summary

V1-12 declarative Calendar/Ration providers are now connected through the real Campaign UI without redesigning it.

- existing Calendar/Ration selects now list compatible installed declarative profiles from `snapshot.catalog`;
- only the latest installed version of each provider is offered as the normal choice, while Campaigns pinned to an older installed version keep that exact state visible;
- selecting a custom provider pins both providerId and providerVersion;
- missing pinned providers are shown as unavailable but do not block the Campaign screen, Session, Rest, or unrelated actions;
- custom Calendar profiles feed their month definitions into the existing year/month/day editor;
- custom Ration profiles drive the daily preview through the existing authoritative calculation;
- shortage consequences are shown only as DM adjudication suggestions and never auto-apply damage or Exhaustion;
- focused provider profile/import/runtime/UI tests are now wired into the canonical UI workflow.

Exact-head green validation has not been observed. The GitHub connector did not expose a push-triggered workflow result, and an independent temporary clone could not start because the execution environment could not resolve github.com. No pass or failure is inferred from that network limitation.

## Next implementation

Continue V1-12 with the remaining authoritative compound behavior: Long Rest plus optional Campaign time advance plus optional ration consumption, with no partial Character/Campaign success if either durable write fails. Reuse the existing Long Rest authority and preserve the current Rest UI.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
