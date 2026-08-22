# Rerun Status

**Connection:** `work/v1-composite` · existing run · V1 completion continuing

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `1`
- Task: `phase14-production-play-session-ux`
- Control status: `continue`
- Checkpoint: `2026-08-23T05:02:00+09:00`
- Long Rest coordinator/preview: `c1664db`
- Production runtime bridge/preview: `7e0e5ce`
- Session Campaign pane integration: `b99bb4c`
- Focused build wiring: `7e85dc1`

## Human summary

The local active-Character Long Rest path is now source-connected end-to-end through the existing Session Campaign pane.

The implementation reuses the existing canonical Character Rest rules rather than calculating recovery in React. Calendar advance and Ration consumption are separate opt-in side effects, default OFF, and are computed through Campaign application authority. Preview and commit use the same candidate calculation.

Character and Campaign candidates are prepared without first mutating their production repositories. Tauri commits both through the existing recoverable Character+Campaign compound writer; volatile browser/test mode uses the Memory compound writer. Runtime Character/Campaign contexts and the existing Scene Character projection are refreshed only after that compound writer succeeds.

The DM now has one minimal Long Rest block inside the existing `SessionCampaignPane`: authoritative HP/Temporary HP preview, optional +8-hour Campaign time, optional daily Ration consumption, resulting Calendar/Ration preview, warnings, and one apply action. Existing Party, Advancement, Calendar, and Ration layout was preserved.

Focused deterministic tests were authored for Rest-only/options/disabled or missing provider/idempotency/writer failure/preview parity/runtime rehydrate. `npm run test:campaign-rest` now groups them, and `npm run build` includes that suite.

This is **not reported green yet**. The GitHub connector exposed no commit statuses or workflow runs for the current direct-push head, and no TypeScript/Rust/Tauri/Windows execution result was observed in this dispatch.

The remaining V1-12 question is connected Character ownership: the Campaign design contract mentions per-Character preview and DM/owner decisions, while the new bridge correctly operates on the locally persisted active Character and does not copy host-unknown remote Characters into the host library. The next dispatch should reconcile that requirement against the existing connected projection/reconnect/write-back authority before adding any connected Rest scope.

After V1-12 scope reconciliation, inspect V1-13 Party Stash / DM Library against current source before coding; substantial implementation already exists despite the stale checklist label.

`STATUS.md` is human-facing only. Reconciliation source order remains README -> control -> STATE -> PLAN.
