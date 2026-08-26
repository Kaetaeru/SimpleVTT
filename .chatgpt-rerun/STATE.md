# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:52:00+09:00`

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

## College of Lore Cutting Words — deferred, staged timing blocker

Cutting Words remains mechanics-complete in `src/domain/bardCollegeLore.ts`, but the current production attack staging cannot support its damage-roll trigger without a broader attack-stage change. Do not ship a partial attack/check-only bridge.

- `resolveLoreCuttingWords` correctly owns successful ability-check, successful attack-roll, and damage-roll adjustment plus Bardic Inspiration/Reaction economy.
- `phase09RealRuntimeAttackAdapter` calls `resolveAtomicAttackTransaction` while the parent resolution is still at `attack-result`. That call already compiles/resolves the atomic attack transaction and stores the committed result in its private `pending` map.
- Only after that build completes does the adapter expose `damage-animation` and `transaction.damageFaces` to the parent resolution.
- `queueAtomicAttackDamageMultiplier` is consumed inside `resolveAtomicAttackTransaction`; therefore a post-roll Cutting Words decision at `damage-animation` is too late for that queue.
- Generalizing the queue from multiplier to flat reduction does **not** fix this timing problem: the damage total is not observable before the queue is consumed.
- Correct support would require an explicit staged post-roll/pre-commit adjustment seam or transaction rebuild contract. That is broader than this minimal R1 slice and must not be smuggled in as a private-`pending` hack.

Cutting Words is therefore deferred until that sanctioned seam exists. No Cutting Words product code or test gate was added, and no completion is claimed.

## Next selected R1 gap — Berserker Retaliation

The next mechanically complete, production-unprojected candidate is Path of the Berserker `Retaliation`.

- `src/domain/barbarianBerserker.ts` already owns `resolveBerserkerRetaliation` / `compileBerserkerRetaliation` at Barbarian level 10 + Berserker subclass.
- Domain mechanics already enforce melee weapon/Unarmed Strike, target = triggering damage source, 5-foot range, unseen-target disadvantage, and Reaction economy.
- `tests/domain/barbarianBerserker.test.ts` proves Reaction spend, attack against the triggering creature, unseen-target disadvantage, damage application, and invalid-trigger rejection.
- No Retaliation production bridge is present in current `src/app` inventory.
- Existing production primitives can be reused: completed attack ResolutionEvent/Activity identifies damaging actor/target; `resolveRuntimeTargetingFact` supplies current distance/visibility; existing off-turn prepared/reaction attack adapters demonstrate temporary off-turn execution and event-native Reaction/Undo handling.

## Next Exact Action

Reconcile live `work/v1-composite` first. Then verify the existing completed-damage -> off-turn reaction-attack seam for Retaliation without adding a new generic reaction engine.

If clean:
- add one thin Berserker Retaliation follow-up adapter using `resolveBerserkerRetaliation`;
- offer only when the active character is Berserker level 10+, has Reaction available in initiative, was actually damaged by the triggering creature, and that creature is currently within 5 feet;
- reuse an existing melee weapon/Unarmed Strike action and authoritative targeting/attack facts; do not duplicate attack mechanics;
- preserve Activity, Character write-back, ResolutionEvent history, and event-native Undo;
- add focused deterministic coverage for trigger eligibility, 5-foot boundary, visible/unseen attack, Reaction economy, Activity, Undo, and below-level/subclass gates;
- wire only that focused gate into `npm run build` and require exact-head UI frontend + Phase 12 connected-protocol green before canonical advancement.

If the existing reaction-attack seam cannot preserve the trigger source and event-native Undo cleanly, do not create a second attack engine; record the blocker and continue inventory.

Do not reopen Peerless or earlier validated R1 work without direct regression evidence. Do not expand into R2 unless a direct R1 regression requires it.

PLAN unchanged; `control.json` must be written last per protocol.
