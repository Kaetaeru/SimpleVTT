# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:44:00+09:00`

## Durable execution checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). Live GitHub remained authoritative throughout concurrent branch movement.

Validated work was not repeated: Rage, Wild Shape, Monk Focus, Rogue R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Devotion Holy Nimbus R1, Open Hand Quivering Palm R1, Devotion Smite of Protection R1, Fiend Dark One's Own Luck R1, and College of Lore Peerless Skill R1 are preserved.

## College of Lore Peerless Skill R1 — execution-validated

- Exact product checkpoint: `88bb72dc3d725af049025728003ab6e6b8db1eb0` (`fix: record Peerless Skill attack activity`).
- Existing `resolveLorePeerlessSkill`, Bardic Inspiration resource/runtime state, interrupt/follow-up flow, ResolutionEvent persistence, Activity, and Undo primitives are reused; no duplicate resolver/subsystem was added.
- Focused `test:lore-peerless-skill` is part of `npm run build` and covers level-14 eligibility, failed ability-check conversion, failure-with-resource-preservation, missed attack conversion to hit/damage, Activity, Undo restoration, and below-level non-projection.
- UI run `32953773211` / frontend job `98130829740`: **success**, including `Typecheck and build` and `test:lore-peerless-skill`.
- Phase 12 run `32953773099` / connected-protocol job `98130829706`: **success**, including connected authority protocol, offline walkthrough, and production frontend gate.
- Windows connected-playable remains R3 packaging/acceptance debt and is not an R1 completion gate.

## Canonical synchronization — complete

- `.agents/V1_CURRENT_HANDOFF.md` records Peerless Skill exact checkpoint/evidence and the remaining-inventory pointer. Commit: `c9016dc1729fa1789d03c6aad8ab4ef430ab8edd`.
- `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` records the same R1 execution evidence and keeps the next step on the remaining subclass inventory. Commit: `8cd1be27d1afca578d84ccc6ce2407567580a3ff`.
- `PLAN.md` remains unchanged.

Inventory decisions to preserve:

- Life Domain `Preserve Life` needs player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` needs richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## Next selected R1 gap — College of Lore Cutting Words

The remaining subclass inventory identifies College of Lore `Cutting Words` as the next mechanics-complete domain resolver with no production runtime bridge at the reconciled `2a2061e26f25df6a5d0c03aa1bfe2046e4d6723f` head.

- `src/domain/bardCollegeLore.ts` already owns `resolveLoreCuttingWords` for successful ability checks, successful attack rolls, and damage rolls; it owns Bardic Inspiration spend, optional Reaction economy, fixed Inspiration die validation, 60-foot range, visibility, and result adjustment.
- `tests/domain/bardCollegeLore.test.ts` already proves attack/check reduction, damage reduction floor at zero, resource/Reaction spend, and 60-foot/visibility validation.
- Live `src/app` inventory has the Peerless Skill bridge but no Cutting Words production adapter; do not duplicate domain mechanics.
- `resolveRuntimeTargetingFact` already provides authoritative distance/visibility and the existing mapless fallback; do not invent spatial facts.
- `phase09RealRuntimeAttackAdapter` exposes a safe successful-attack interruption point at `attack-result` before the atomic attack transaction is committed. Existing interrupt/event/write-back/Undo primitives should be reused.
- Damage-roll support must remain mechanics-complete. Before writing a production bridge, verify a clean existing seam can adjust the staged authoritative damage transaction. If no such seam exists, do not ship attack/check-only partial Cutting Words; record the blocker and continue inventory instead of adding a dead/partial feature.

## Next Exact Action

Reconcile live `work/v1-composite` first. Then inspect the existing staged-damage adjustment seams used by current reactions/riders (especially atomic attack damage modifiers) and decide whether all three Cutting Words trigger families can reuse them without a new subsystem.

If the seam exists:
- add one thin Cutting Words follow-up adapter using `resolveLoreCuttingWords`;
- reuse `resolveRuntimeTargetingFact`, Bardic Inspiration/Reaction turn runtime, interrupt events, Character write-back, Activity, and event-native Undo;
- add focused deterministic coverage for ability-check, attack-roll, damage-roll, range/visibility/resource/reaction/Undo, and below-level/subclass gates;
- wire only that focused gate into `npm run build`;
- require exact-head UI frontend and Phase 12 connected-protocol production frontend green before canonical advancement.

If the seam does not exist cleanly, do not invent a broad attack subsystem just for Cutting Words; preserve the finding and select the next mechanics-complete inventory gap.

Do not reopen Peerless or earlier validated R1 work without direct regression evidence. Do not expand into R2 unless a direct R1 regression requires it.

PLAN unchanged; `control.json` must be written last per protocol.
