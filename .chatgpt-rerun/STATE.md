# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:23:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, Open Hand Quivering Palm R1, and the validated Smite of Protection boundaries remain preserved.

## Smite of Protection result — do not reopen

Paladin Devotion Smite of Protection R1 remains green at the focused UI/build gate.

- `d128fc0db9c58ca46b426c140faf6c726890bd74` fixed generic Undo by excluding TurnRuntime spell-slot current counts from Character durable write-back.
- `89cc64213032c016de053d6a88b51e23aa91209d` restored the real public `undoLastResolution()` assertion and passed UI `32950156016`.
- `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` restored complete Smite coverage including next-turn expiry and below-level behavior and passed UI `32950193461`.

Do not repeat the Smite bisection unless a direct regression proves it necessary.

## Fiend Dark One's Own Luck R1 — green; do not reopen

Warlock Fiend Dark One's Own Luck mechanics already existed in `src/app/warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts`; no second bridge was added and no Fiend production mechanics file was changed by the diagnostic bisection. Existing local-DM ability-check host fix `a51154f3a06a00122df12459e8465129123d6d41` remains preserved.

The bisection proved each boundary in order without reopening validated work:

- `c93a008a2cddc40152f3344293c59cff1a4d4d3b` enabled the Activity assertion. UI `32952038593` passed.
- `8ed1d603bcde874772c74879d1063368d7da0c19` enabled the ability-check Undo restore assertion. UI `32952247276` passed.
- `23019e79be5aed9ea327ab5c38dc1d987049a6e4` restored the saving-throw case. UI `32952426354` passed.
- `95042b2ef3c65aef3619334c0bec1ad243d165f2` restored the below-level guard, leaving all three Fiend cases active with no diagnostic returns/skips.
- Exact HEAD `95042b2` UI run `32952470669` / frontend job `98126755335` passed including `Typecheck and build`.
- Exact HEAD `95042b2` Phase 12 run `32952470663` / `connected-protocol` job `98126755397` passed connected authority protocol, offline walkthrough, and production frontend gate. The separate Windows packaging job was still running at checkpoint and is not used to claim R3/Tauri completion.
- `package.json` has both `test:fiend-luck` and `test:devotion-smite-protection` wired into `npm run build`.

Validated Fiend R1 boundaries now include failed ability-check interrupt offer/accept, deterministic d10 success fixture, resource spend, Activity, event-native Undo restore, failed saving-throw conversion, no-damage success continuation, saving-throw Undo restore, and below-level non-projection.

Do not repeat this Fiend bisection unless a direct regression proves it necessary.

## Canonical synchronization pending

`PLAN.md` is unchanged. `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` still point at the generic remaining-subclass inventory after Quivering Palm and must now be advanced with the Fiend `95042b2` exact execution evidence before selecting the next R1 inventory item.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## Next Exact Action

Reconcile live `work/v1-composite` first.

1. Confirm `95042b2` remains an ancestor/current checkpoint and do not rerun its already-green focused work.
2. Update `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` with Fiend Dark One's Own Luck R1 exact checkpoint `95042b2`, UI `32952470669`, and Phase 12 connected-protocol job `98126755397`.
3. Continue the existing remaining-subclass domain-resolver inventory and identify exactly one next mechanics-complete production projection gap. Do not choose Preserve Life or Land's Aid without the richer choice-input contract they require.
4. Prefer existing domain/runtime primitives; no speculative subsystem, no R2 expansion.

PLAN unchanged; update `STATE.md` then `control.json` last per protocol.
