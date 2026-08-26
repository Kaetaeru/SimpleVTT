# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T14:26:20+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in the required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live/canonical routing was reconciled. Run/sequence/task identity is unchanged.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, and Rogue Cunning Action/Uncanny Dodge R1 remain source-complete/execution-validated. Rogue exact checkpoint remains `5bb8bfbc4753dcc15f1198a04c0982817176c644` with UI run `32932781542` and Phase 12 run `32932781591` green.

Current R1 remains Berserker `Intimidating Presence` only. Concurrent workers briefly created equivalent adapters/tests on the same branch. Duplicate variants were reconciled in `95f471ce77d8f3c8fc295ba1213441c0a3f4998c`; do not recreate them.

Current coherent wiring:

- production adapter: `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts`
- canonical offline composition imports only that Berserker presence adapter
- focused gate: `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts`
- `package.json` runs it as `test:berserker-presence` inside canonical `npm run build`
- focused evidence covers initiative projection/resource/Bonus Action/frightened/Activity/generic Undo and freeform non-stranding

The first cleanup-head validation at `95f471ce77d8f3c8fc295ba1213441c0a3f4998c` failed only in the frontend/build portion after earlier regression steps passed:

- UI run `32933824963`, frontend job `98071125495`: `Typecheck and build` failed; steps 1-28 were green.
- Phase 12 run `32933825040`, connected-protocol job `98071125728`: connected authority + Phase 11 offline walkthrough were green; `Verify production frontend gate` failed from the same frontend/build path.

Minimal follow-up fixes already landed; do not repeat them:

- `ca4667662184a451107c1b2d5182b63706c8dfb7`: added `BerserkerIntimidatingPresenceRequest.useBonusActionEconomy?: boolean`, defaulting to prior domain behavior and allowing freeform to omit only the Bonus Action economy event.
- `3465010f6d9c31a636d0750bc20dbac606dea43e`: adapter now passes `useBonusActionEconomy: internal.sessionMode === "initiative"` directly to the existing domain resolver; removed the temporary app-side operation filtering.
- `ba409e19a7a4697490251a1b0997adabda2222ee`: renamed the adapter prototype method to avoid shadowing the imported `resolveBerserkerIntimidatingPresence` domain resolver. This is the latest observed source checkpoint.

Exact-head CI for source checkpoint `ba409e19a7a4697490251a1b0997adabda2222ee` was running at checkpoint time:

- UI run `32934018934`: in progress.
- Phase 12 Connected Session run `32934018931`: in progress.

No canonical completion claim was made. `PLAN.md` remains unchanged.

Do not expose College of Lore `Cutting Words` as a free-standing button. Keep `Preserve Life` / `Land's Aid` excluded until their allocation/point-AOE authoring inputs exist. Connected remote-owner exactly-once/reconnect remains R2.

## Next Exact Action

Reconcile the live branch first because concurrent commits may have advanced beyond `ba409e19a7a4697490251a1b0997adabda2222ee`. Do not repeat the duplicate cleanup, freeform economy seam, adapter dispatch, or resolver-shadowing fix. Inspect exact-head GitHub Actions for the latest source-equivalent head. If the Berserker build-gated focused test and canonical `npm run build` are green, record the exact UI/Phase 12 run+job evidence, update canonical V1 routing to the next suitable mechanics-complete subclass action candidate, then update this STATE and `control.json` last. If red, inspect and fix only the first Berserker-related failure. Keep R2 excluded.
