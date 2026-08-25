# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- active work branch: `codex/v1-barbarian-rage`
- active issue: `#124` — R1 Barbarian Rage lifecycle
- active draft PR: `#125`
- last reconciled product head before this coordination update: `af430394bc8d3312468c8aff3d477331e9911467`
- checkpointed_at: `2026-08-26T02:04:00+09:00`

## Resume source of truth

After the mandatory Rerun read order, follow the V1 planning authority declared in `PLAN.md`:

`.agents/README.md -> .agents/DEFERRED_FIXES.md -> .agents/V1_CURRENT_HANDOFF.md -> .agents/V1_RELEASE_EXECUTION_CHECKLIST.md -> .agents/CURRENT_WORK.md -> relevant docs/design contracts`

`.agents/V1_CURRENT_HANDOFF.md` is the active execution pointer. Actual GitHub branch/PR state supersedes stale SHA/branch prose inside documentation. Do not resume from the historical V1-13 Next Exact Action that previously lived in this file.

## Current Rage checkpoint

At product commit `af430394`:

- Base Rage atomic start/end lifecycle exists.
- Rage domain work includes resistance/status metadata, concentration termination, heavy-armor termination handling, duration/termination semantics, and Rage damage scaling.
- Production attack integration applies Rage damage to eligible Strength-based weapon/unarmed attacks without creating a parallel attack engine.
- UI, Rules Domain, Contract validation, Phase 11 Playable, and Phase 12 Connected Session workflow runs associated with `af430394` completed successfully.
- PR `#125` and issue `#124` prose may lag the actual implementation; inspect the head/diff before trusting their old "current exact task" wording.

Do not repeat the already-implemented Rage foundation or previously validated V1-13/Indomitable work.

## Next Exact Action

1. Fetch PR `#125` and its latest head; if GitHub advanced beyond `af430394`, reconcile from that newer state.
2. If not already present, add one minimal regression in the existing production snapshot/weapon runtime test surface proving real projected attacks carry the correct `attackAbility` and Rage damage metadata.
3. Continue the remaining Rage chain from `.agents/V1_CURRENT_HANDOFF.md`: Session player action/resource economy -> local/freeform/initiative Activity + event-native Undo -> connected remote-owner exactly-once/reconnect/Undo.
4. Keep the PR draft until the Rage slice and its focused/regression evidence satisfy the canonical R1 acceptance boundary.
