# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T14:18:53+09:00`

## Durable execution checkpoint

Mandatory preflight was repeated in order: `README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`, then live branch and canonical V1 routing were reconciled. Run/sequence/task identity remains unchanged.

Validated Rage, Druid Wild Shape, Monk Focus, and earlier green work was not repeated.

Rogue R1 is source-complete and execution-validated:

- `5bb8bfbc4753dcc15f1198a04c0982817176c644` is the exact Rogue execution checkpoint.
- Cunning Action reuses existing Dash/Disengage/Hide mechanics with Rogue Bonus Action projection.
- Uncanny Dodge reuses the atomic attack transaction with a `0.5` damage multiplier and `floor` rounding; it no longer treats display average as mechanics authority.
- `07c68ab43404c590a408d3673439fe0ea147d289` preserves Uncanny Dodge on the existing event-native Undo path.
- UI run `32932781542` / frontend job `98068084958` is green at the exact Rogue checkpoint.
- Phase 12 Connected Session run `32932781591` / connected-protocol job `98068085017` is green, including the production frontend gate that runs `npm run build`.
- `npm run build` includes `npm run test:rogue-core`, so focused Rogue coverage and the canonical production build are green on the exact checkpoint.

Canonical execution routing advanced in `502eb753fb81e061195da63622c0e3325fb170dd` (`docs: advance V1 handoff past Rogue R1`). `.agents/V1_CURRENT_HANDOFF.md` marks Rogue R1 complete and points to subclass action projection inventory.

Subclass inventory found the first high-confidence production projection gap without creating speculative buttons:

- `src/domain/bardCollegeLore.ts` College of Lore `Cutting Words` is trigger-driven Reaction mechanics. Do not expose it as an always-clickable action-bar button.
- `src/domain/barbarianBerserker.ts` implements `Intimidating Presence` as a complete Bonus Action resolver: its own resource spend, targeting, Wisdom saves, frightened effect, and economy semantics.
- No Berserker production runtime/action adapter exists in `src/app`; `Intimidating Presence` remains the first suitable subclass action projection target.
- Wider inventory also found mechanics-complete but later candidates such as Open Hand `Wholeness of Body` and Devotion `Holy Nimbus`; do not jump to them before the current Berserker pointer is completed. `Preserve Life` and `Land's Aid` require additional allocation/point-AOE input and must not be surfaced as dead/incomplete action buttons.

Live production conventions for the Berserker implementation are now verified:

- `src/app/clericTurnUndeadActionRuntimeAdapter.ts` is the closest production pattern: seed the Character resource into TurnRuntime, resolve the existing domain transaction, apply/persist ResolutionEvents, commit TurnRuntime, project Activity, and record the same events for generic event-native Undo.
- `tests/ui/clericTurnUndeadActionRuntime.test.ts` shows the focused deterministic pattern: `setQueuedD20(...)`, explicit initiative/current actor selection, resource/economy/effect assertions, then `undoLastResolution()` restoration.
- `src/app/productionPlayRuntimeAdapter.ts` confirms `ActionVm.target` supports `any`; a Berserker action can project creature targets without inventing a new target kind. Self remains excluded by the domain feature contract.
- `resolveRuntimeTargetingFact(...)` treats a missing authoritative spatial-module fact as unconstrained/in-range, so a projected 30-foot action can preserve the mapless fallback while rejecting explicit provider facts beyond 30 feet.
- Important freeform seam: `compileBerserkerIntimidatingPresence(...)` currently always emits a `use-economy` Bonus Action operation. Existing production patterns such as Abjure Foes and Rage omit turn-economy consumption in freeform. The production adapter must not strand freeform Bonus Action state. Add only the smallest compatibility seam, preferably optional `useBonusActionEconomy?: boolean` with the existing domain behavior as the default, and pass `false` only for freeform. This is plumbing, not a new mechanic.
- No product source patch was started after this verification because the Rerun hard-stop boundary was reached.

`PLAN.md` remains intentionally unchanged because run identity and routing mechanism did not change.

## Preserved verified state

- Rage, Druid Wild Shape, Monk Focus, and Rogue R1 remain source-complete/execution-validated; do not repeat them.
- Connected remote-owner exactly-once/reconnect matrices remain R2 unless a direct R1 regression requires them.
- Do not rerun the historical full 1303/1303 matrix merely because execution resumed.
- Do not expose `Cutting Words` as a dead/free-standing action button; it is trigger-driven Reaction mechanics.
- Do not expose subclass mechanics requiring product inputs the current action path cannot author (for example Preserve Life allocations or Land's Aid point/AOE composition).

## Next Exact Action

Create the smallest dedicated Berserker `Intimidating Presence` production adapter, following the existing Turn Undead event-native action pattern. Reuse `barbarianRuntimeResourceDefinitions`, `berserkerIntimidatingPresenceDc`, and `resolveBerserkerIntimidatingPresence`; do not duplicate their mechanics. Add the minimal optional economy-plumbing seam needed so initiative spends Bonus Action while freeform does not strand turn economy, preserving the current domain default behavior. Project one Bonus Action with `target: "any"`, excluding self; use `resolveRuntimeTargetingFact(...)` so explicit facts beyond 30 feet are ineligible while missing spatial facts remain unconstrained. Add focused deterministic UI/runtime evidence using `setQueuedD20(...)` for projection, initiative Bonus Action/resource consumption, failed-save frightened effect, Activity, generic event-native Undo restoration, and freeform non-stranding. Wire only that adapter/test into canonical offline/build composition, run exact-head `npm run build`, and advance canonical routing only after green evidence. Do not touch passive Berserker features or R2 remote/reconnect behavior.

Keep the same run/sequence/task identity. `control.json` must be written last.
