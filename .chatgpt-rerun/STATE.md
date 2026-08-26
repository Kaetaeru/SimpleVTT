# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T17:56:00+09:00`

## Durable execution checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`) and live GitHub state was treated as authoritative.

Preserved green work was not repeated: Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Paladin Devotion Holy Nimbus R1, and Open Hand Quivering Palm R1 remain source-complete/execution-validated.

Paladin Devotion Smite of Protection R1 source/install/focused coverage/build wiring already exists and must not be duplicated:

- `904ad145579425003d6a05c1edea6f881ac857d0` — production bridge.
- `fed1bd8404947f8401a66df902e89fa82127c3ce1` — offline installation.
- `e793e4312a99b686c29467b1c48796d1359802bf` — focused production coverage.
- `7bc0f9ae93da1583a40b7ea5ec08920506ce0fc1` — `test:devotion-smite-protection` build wiring.

Warlock Fiend Dark One's Own Luck mechanics already exist; do not add another bridge. Existing local-DM ability-check host fix `a51154f3a06a00122df12459e8465129123d6d41` is preserved.

## Smite Undo diagnosis and fix

Exact-SHA bisection proved the first Smite case green through action projection, committed Divine Smite execution, Smite detail/Activity, protection marker creation, expiry metadata, and half-cover eligibility. Important boundaries:

- `6038687ac4d74ffc6da1163d4224deb1cecc9c3a` — known-green Fiend diagnostic boundary; UI `32947158403` success.
- `013a02f8d7510a896c13091748a0333360d537ff` — first Smite case green through half-cover eligibility; UI `32948609647` success and Connected `32948609609` green when checked.
- `6ea5efbda2a56a8b1405043804b4f3ad4a8485cd` — enabling only generic Undo made the first Smite case red; UI `32948793586` failed at shared build.
- Direct `undoResolutionEvents(...)` validation was isolated and green at `ac1594e56eb451693346c501d7f1f70b0ba3a913`; therefore event-native runtime validation was not the failing layer.
- Direct inverse `persistCharacterResolutionEvents(...)` was isolated and red at `e12598f8b48d5723f47d40368df07b65ea6f07a4`.
- Direct `projectResolutionCharacterWriteBack(...)` was isolated and red at `9bdff768e992e52a462a6c918e73970f14f913bf`; therefore the failure was inside the pure Character durable projector, not SessionProjection registry/guard or TurnRuntime revision commit.
- Existing `productionFreshCharacterSpells` contract explicitly states slotted spell current counts are session-only TurnRuntime state and must not create parallel Character-library write-back; Character persistence stores spell-slot maxima/source facts, not current `spell-slot-*` resources.
- `d128fc0db9c58ca46b426c140faf6c726890bd74` (`fix: keep spell slots session-only in write-back`) added only the narrow projector exclusion for `spell-slot-<level>` resource changes. UI `32949969840` succeeded.
- `89cc64213032c016de053d6a88b51e23aa91209d` restored the real generic `undoLastResolution()` path for the first Smite case. UI `32950156016` succeeded, proving the production fix repairs generic Undo without changing already-green Smite behavior.

## Diagnostic restoration state

- `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` restored the full Smite of Protection focused gate, including expiry/below-level coverage.
- `5ecc2eb7d77a0c89b1444eac9032bd9ed0a7a574` restored full Fiend Dark One's Own Luck focused coverage; diagnostic early returns/skips are no longer intentionally retained.
- Exact-head workflows for `5ecc2eb7d77a0c89b1444eac9032bd9ed0a7a574` were still in progress at checkpoint: UI `32950308840`, Connected `32950308806`.
- `PLAN.md` is unchanged.
- Canonical handoff/checklist has not been advanced yet. Do not advance until exact-head full restored gates are green.

Inventory decisions to preserve:

- Life Domain `Preserve Life` requires player-selected per-target healing allocation; do not auto-allocate under the current `resolveAction(actionId,targetIds)` contract.
- Circle of the Land `Land's Aid` requires richer point/multi-result input; do not force it into a simple button.
- R2 remote-owner exactly-once/reconnect work remains excluded unless a direct R1 regression requires it.

## Next Exact Action

Reconcile live `work/v1-composite` first. Check exact-head UI `32950308840` and Connected `32950308806` for `5ecc2eb7d77a0c89b1444eac9032bd9ed0a7a574`. If both are green, verify `test:devotion-smite-protection` and `test:fiend-luck` are executed inside that exact-head `npm run build`, then advance `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` to the next R1 item. If either gate is red, inspect only the first newly exposed Smite/Fiend failure and make the smallest proven fix; do not repeat validated bisection work or reopen the spell-slot write-back seam. PLAN unchanged; update `STATE.md` then `control.json` last per protocol.