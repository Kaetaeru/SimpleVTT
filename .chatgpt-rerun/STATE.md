# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T19:09:00+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live state remained authoritative during concurrent branch movement. `PLAN.md` is unchanged.

Do not repeat validated R1 work without direct regression evidence: Rage, Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge, Berserker Intimidating Presence, Open Hand Wholeness of Body, Open Hand Fleet Step, Devotion Holy Nimbus, Open Hand Quivering Palm supported path, Devotion Smite of Protection, Fiend Dark One's Own Luck, College of Lore Peerless Skill, and College of Lore Cutting Words.

Peerless Skill exact product checkpoint remains `88bb72dc3d725af049025728003ab6e6b8db1eb0`; its recorded UI/Phase12 evidence remains green and must not be rerun merely because this checkpoint advanced.

## College of Lore Cutting Words — R1 execution-validated

Cutting Words now has a mechanics-complete production path for the R1 scope: failed ability checks, attack rolls, and staged attack damage; Bardic Inspiration/Reaction economy; Activity; level gate; queued damage modifier preservation; and event-native Undo. The implementation reuses the existing Bardic Inspiration/domain/atomic attack machinery instead of adding a parallel resolution engine.

Important live commits in the final reconciliation chain:

- `aaa23862dc1d90b438d98e5722ad273f55900eb7`: stages Cutting Words before authoritative atomic damage build and reuses the sanctioned staged preview/rebuild seam.
- `d39d599c60d8499028e0cff25ab34358f15ca6aa`: production spell router now delegates already-present non-spell runtime actions before taking a snapshot, preventing transient non-spell ability checks from being erased.
- `90514e44a21840070bb77ea17561036a86b2e5ca`: removes the concurrent current-actor action-priority regression that broke connected projected Character inventory actions while preserving the spell-router fix.
- `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`: removes temporary Cutting Words diagnostic workflow steps only; no product code change from `90514e4`.

Exact execution evidence:

- Product checkpoint `90514e44a21840070bb77ea17561036a86b2e5ca`:
  - UI run `32960806646` / frontend job `98152495174`: **success**. Cutting Words ability-check, attack-roll, staged-damage, below-level diagnostics and `Typecheck and build` all green.
  - Phase 12 Connected Session run `32960806633` / connected-protocol job `98152494916`: **success**. Connected authority protocol, Phase 11 offline walkthrough, and production frontend gate green.
- Workflow-cleanup head `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`:
  - UI run `32961013657`: **success**. This commit only removes temporary diagnostic workflow steps, so the R1 product checkpoint remains `90514e4`.

The earlier `d39d599` Phase12 red was a concurrent `standardActionReactionAdapter` regression, not a Cutting Words mechanics failure: duplicated `action.healing-potion` IDs selected Aelar instead of the staged remote projected Character. `90514e4` reverted that special-case priority and restored connected protocol green. Do not reapply it.

Shared-seam invariant remains: Cutting Words staged damage adjustment must preserve existing queued attack modifiers (especially Uncanny Dodge multiplier), authoritative dice faces, single Character write-back/event history, and event-native Undo.

Windows `windows-connected-playable` / Tauri artifact work is R3 packaging/acceptance debt and is not required to reopen this R1 checkpoint.

## Canonical sync status

At this checkpoint `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` still describe Lore Peerless Skill as the latest recorded subclass checkpoint and therefore are stale relative to the validated Cutting Words product state. Do not treat that stale text as evidence that Cutting Words needs implementation again.

The next safe canonical write must record Cutting Words exact checkpoint `90514e4`, UI run/job `32960806646` / `98152495174`, Phase12 run/job `32960806633` / `98152494916`, mark the Cutting Words R1 slice source-complete/execution-validated, and then leave the R1 umbrella on remaining subclass domain-resolver inventory.

## Inventory exclusions / backup

- Life Domain `Preserve Life`: requires explicit per-target allocation; no auto-allocation.
- Circle of the Land `Land's Aid`: requires richer point/multi-result input; no fake simple button.
- Berserker `Retaliation`: requires player choice of melee weapon/Unarmed Strike; do not auto-select an attack.
- `Berserker Mindless Rage` may be inspected as a smaller inventory slice only if live source confirms a real mechanics-complete production projection gap; do not assume it is missing.
- R2 remote-owner exactly-once/reconnect/event-native Undo matrix stays excluded absent direct R1 regression.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer than this checkpoint.
2. Do not rerun Cutting Words or earlier validated R1 mechanics without direct regression evidence.
3. Update `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` with the exact Cutting Words R1 evidence above, using the current full files so no concurrent content is lost.
4. Continue the canonical R1 subclass resolver inventory and identify exactly one remaining mechanics-complete domain resolver that is genuinely absent from production action projection. Do not expose partial/richer-choice features as dead or auto-selected buttons.
5. Reuse existing local/freeform/initiative/economy/Activity/Undo primitives; add only focused deterministic evidence for the selected gap and use `npm run build` as the related gate.
6. Update `STATE.md` and `control.json` last after the next safe checkpoint. `control.json` remains `continue` until the sequence itself reaches a waiting status.
