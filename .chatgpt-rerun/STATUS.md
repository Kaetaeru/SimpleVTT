# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control: `continue`
- Exact product-code checkpoint: `78e829bdfa5b5c8a1de0f8b89c8493e09d7aacc0`

## Current result

Connected Long Rest distributed durability is now **source-complete for the normal durable-storage path / validation pending**.

- visible DM remote Rest offer and Player preview/accept/decline remain inside the existing Session Campaign pane;
- owner Character generation is durably prepared but invisible before global commit;
- a Tauri write barrier prevents unrelated Character generation drift while prepared;
- Host durable coordinator is written before Campaign global commit;
- Campaign commit identity is stable/idempotent;
- Host and Player post-global process restart recover by replay/materialization;
- Host and Player pre-global double restart recover by exact abort identity;
- restarted owner abort cleanup does not materialize Character state;
- abort replay remains idempotent even after a prior cleanup unlocked later legitimate Character writes;
- Player sends `long-rest-owner-aborted`; Host deletes durable abort coordinator state only after exact owner acknowledgement;
- duplicate owner abort acknowledgements are idempotent and completed aborts are no longer replayed.

Focused source contracts for Host restart and restart durability are included in `npm run test:campaign-rest`.

## Validation

**NO GREEN CLAIM.** Exact head `78e829b` has no combined statuses and no commit-associated workflow runs. No observed `tsx`, TypeScript/build, Rust, Tauri Windows build, or Windows two-instance execution exists for this head.

V1-12 remains release-checklist `PARTIAL` because executable/release evidence is missing, even though its current distributed Long Rest implementation boundary is source-complete.

Next implementation step: audit the actual current V1-13 Party Stash / Campaign DM Library source and implement only real remaining gaps. Do not follow the stale TODO label blindly and do not begin the comprehensive Codex audit yet.

`STATUS.md` is human-facing only. Reconciliation remains README -> control -> STATE -> PLAN.
