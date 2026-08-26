# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T14:32:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in the required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live/canonical routing was reconciled. Run/sequence/task identity is unchanged.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, and Rogue Cunning Action/Uncanny Dodge R1 remain source-complete/execution-validated. Rogue exact checkpoint remains `5bb8bfbc4753dcc15f1198a04c0982817176c644` with UI run `32932781542` and Phase 12 run `32932781591` green.

Berserker `Intimidating Presence` R1 is now source-complete + execution-validated. Duplicate variants were already reconciled in `95f471ce77d8f3c8fc295ba1213441c0a3f4998c`; do not recreate them.

Validated Berserker wiring:

- production adapter: `src/app/barbarianBerserkerIntimidatingPresenceRuntimeAdapter.ts`
- canonical offline composition imports only that Berserker presence adapter
- focused gate: `tests/ui/barbarianBerserkerIntimidatingPresenceRuntime.test.ts`
- `package.json` runs it as `test:berserker-presence` inside canonical `npm run build`
- initiative projection/resource/Bonus Action/frightened/Activity/generic Undo and freeform non-stranding are covered
- the 35 ft out-of-range fixture uses authoritative `module:test:` provenance so production targeting consumes the authored module fact rather than an ignored non-authoritative test relation

Do not repeat these landed fixes:

- `ca4667662184a451107c1b2d5182b63706c8dfb7`: optional `useBonusActionEconomy` domain seam for freeform compatibility.
- `3465010f6d9c31a636d0750bc20dbac606dea43e`: production adapter passes initiative/freeform economy intent through the existing domain resolver.
- `ba409e19a7a4697490251a1b0997adabda2222ee`: resolver-name shadowing fix.
- `2b361221f34cd0c17d01161d063e7667c849aef5`: explicit 35 ft focused spatial fact.
- `1df452fcd951525242631e2cb345e6ee390251fd`: authoritative `module:test:` provenance correction; no production-code change.

Exact execution evidence for source checkpoint `1df452fcd951525242631e2cb345e6ee390251fd`:

- UI run `32934223691`, frontend job `98072253329`: **success**; `Typecheck and build` and all preceding UI gates green.
- Phase 12 Connected Session run `32934223675`, connected-protocol job `98072253248`: **success**; connected-session authority protocol, Phase 11 offline walkthrough, and production frontend gate green.
- `npm run build` includes `npm run test:berserker-presence`, so the focused Berserker gate is part of the exact-head production build evidence.

Canonical execution routing was advanced in `.agents/V1_CURRENT_HANDOFF.md` at commit `dd71e88bce66f1039a08af69809b03230b21a87e`. The subclass-action umbrella remains intentionally incomplete: Berserker Intimidating Presence is one validated member, not evidence that every mechanics-complete subclass resolver is already projected. `V1_RELEASE_EXECUTION_CHECKLIST.md` already routes generically to the same remaining subclass-action inventory, so no semantic checklist rewrite was required. `PLAN.md` remains unchanged.

Do not expose College of Lore `Cutting Words` as a free-standing button. Keep `Preserve Life` / `Land's Aid` excluded until their allocation/point-AOE authoring inputs exist. Connected remote-owner exactly-once/reconnect remains R2.

## Next Exact Action

Reconcile the live branch first because concurrent commits may have advanced beyond this checkpoint. Do not repeat Rage, Wild Shape, Monk Focus, Rogue R1, Berserker Intimidating Presence, duplicate cleanup, freeform economy compatibility, resolver dispatch/shadowing, or the authoritative range-fixture correction.

Continue the R1 subclass inventory: compare existing subclass domain resolvers with production action projection, identify exactly one next mechanics-complete resolver that is still missing from the action bar, and prefer existing runtime/economy/Activity/Undo primitives. Do not expose partial/unsupported features as dead buttons. Add or reuse focused local/freeform/initiative evidence and gate through `npm run build`. Keep connected remote-owner exactly-once/reconnect work in R2 unless a direct R1 regression requires it.
