# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T18:47:00+09:00`

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

Live GitHub selected College of Lore `Cutting Words` as the next mechanics-complete domain resolver with no production runtime bridge. A concurrent checkpoint at `ae19764aa8dfa045c1ce032acaa1b0a75b93d13a` is authoritative over the earlier local inventory candidate.

- `src/domain/bardCollegeLore.ts` already owns `resolveLoreCuttingWords` for successful ability checks, successful attack rolls, and damage rolls; it owns Bardic Inspiration spend, optional Reaction economy, fixed Inspiration die validation, 60-foot range, visibility, and result adjustment.
- `tests/domain/bardCollegeLore.test.ts` already proves attack/check reduction, damage reduction floor at zero, resource/Reaction spend, and 60-foot/visibility validation.
- Live `src/app` inventory has the Peerless Skill bridge but no Cutting Words production adapter; do not duplicate domain mechanics.
- `resolveRuntimeTargetingFact` already provides authoritative distance/visibility and the existing mapless fallback; do not invent spatial facts.

### Staged damage seam — verified

The required damage-roll seam exists without a new subsystem:

- `src/app/rogueCoreRuntimeAdapter.ts` already queues Uncanny Dodge at the hit interrupt through `queueAtomicAttackDamageMultiplier(resolutionId,0.5,source)`.
- `src/app/realAttackTransactionService.ts` consumes that queued adjustment immediately before the authoritative atomic attack commit, then applies it to compiled `compound-damage` operations.
- Cutting Words can reuse the same queue/commit location by minimally generalizing the pending atomic damage adjustment to support an additive flat reduction alongside the existing multiplier. No parallel attack engine or duplicate transaction path is needed.
- Successful attack-roll reduction can reuse the existing follow-up pattern used by Bardic Inspiration/Peerless Skill: adjust the staged attack total/temporary attack modifier before the atomic transaction validates preview parity.
- Successful ability-check reduction can reuse the existing completed-check follow-up/activity/event-history pattern used by Dark One's Own Luck.
- Reaction/resource spend remains owned by `resolveLoreCuttingWords`; append its ResolutionEvents to the parent resolution so current Character write-back, Activity projection, and event-native Undo stay authoritative.

## Next Exact Action

Reconcile live `work/v1-composite` first. Then implement one thin Cutting Words follow-up adapter using the existing seams above.

- Generalize the existing queued atomic attack damage adjustment minimally: preserve current multiplier behavior and add only the flat-reduction capability needed by Cutting Words.
- Offer Cutting Words only for a qualifying visible target within 60 feet, College of Lore level 3+, Bardic Inspiration available, and Reaction available when initiative economy applies.
- Support all three existing domain trigger families: successful ability check, successful attack roll, and damage roll. Do not ship attack/check-only partial support.
- Use `resolveLoreCuttingWords`; do not reproduce its range/resource/economy/die/result rules in a second mechanics implementation beyond projection eligibility needed to render the interrupt.
- Reuse `resolveRuntimeTargetingFact`, turn-runtime resource/economy state, interrupt events, Character write-back, Activity projection, and event-native Undo.
- Add focused deterministic coverage for ability-check, attack-roll, damage-roll, range/visibility/resource/reaction/Undo, and below-level/subclass gates.
- Wire only that focused gate into `npm run build`.
- Require exact-head UI frontend and Phase 12 connected-protocol production frontend green before canonical advancement.

Do not reopen Peerless or earlier validated R1 work without direct regression evidence. Do not expand into R2 unless a direct R1 regression requires it.

PLAN unchanged; `control.json` must be written last per protocol.
