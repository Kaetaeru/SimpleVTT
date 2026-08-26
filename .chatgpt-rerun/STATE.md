# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T20:36:00+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live state remained authoritative during concurrent branch movement. `PLAN.md` is unchanged.

R1 source/execution action matrix is canonically closed. Do not repeat validated R1 work without direct regression evidence: Rage + Berserker Mindless Rage, Druid Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge, Berserker Intimidating Presence, Open Hand Wholeness of Body/Fleet Step/Quivering Palm supported path, Devotion Holy Nimbus/Smite of Protection, Fiend Dark One's Own Luck, College of Lore Peerless Skill/Cutting Words, and earlier validated core actions.

Canonical closure commits:

- `.agents/V1_CURRENT_HANDOFF.md`: `d9e57cf7dd6a8df8d8c3de463f236fdcf07cc7b7` marks `R1. D&D Session Action Matrix` DONE for source/execution scope, records inventory exhaustion, and routes Next Exact Action to R2.
- `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`: `14824868d8d29b047f4b079f482ce2d861d84f66` routes release work to the R2 connected remote-owner matrix while keeping `V1-21`, `V1-31`, and `V1-32` PARTIAL until their release/human exits are satisfied.

R1 inventory conclusion: no additional honest standalone mechanics-complete subclass action remains for the current action surface. `Preserve Life`, `Land's Aid`, and `Retaliation` require richer explicit player input. Passive/rest-choice/item-runtime/automatic-trigger/reaction/progression-spell mechanics are not converted into dead or auto-selected buttons.

Berserker Mindless Rage was the passive production gap found during final reconciliation, not an action-bar requirement:

- source integration `8bbd21a0ff4b20bef4c0232f175785c5f7633312` atomically composes existing Rage and `compileBerserkerMindlessRageStart` operations into one authoritative resolution.
- focused checkpoint `b82e9048618ab3c105f2f99e148d2e5d2198c5dc` is green in UI run `32961779455` / frontend job `98155486715` and Phase 12 run `32961779556` / connected-protocol job `98155487334`.
- existing Rage lifecycle owns Charmed/Frightened cleanup, immunity marker lifetime, Activity, event-native Undo, and Rage-end removal. No fake action or new rules engine was added.
- `windows-connected-playable` is R3 packaging/acceptance work and is not an R1 closure gate.

## R2 progress: remote-owner Rage slice

Existing connected infrastructure was inventoried before editing. The generic connected router already forwards arbitrary projected `actionId` values through Host authority and rejects remote completions that do not emit canonical `ResolutionEvent`s. Existing generic tests already cover three-peer convergence, duplicate-safe event apply/request replay, reconnect/catch-up, owner write-back, and compensating Undo; feature-specific R2 tests should only prove that each custom feature enters that existing machinery.

Remote-owner Rage is now execution-validated without adding a new protocol or rules engine:

- `5585e6b3c329c3188baa60ba7c05d3a99d1ac1` adds `connectedProjectedCharacterRageResolution.test.ts`: host-unknown Barbarian Rage resolves on Host authority, mutates only the ephemeral Host projection, emits one ordered canonical event batch, owning Client persists the confirmed resource spend exactly once, and duplicate event/request delivery is idempotent.
- `d5552a086b32605dcfeab66b49147498900ef408` adds that focused test to the existing Phase 12 connected gate.
- `e5cfbe886d896f2f4add4ce39540fee46931ec6c` exposed the real remote Undo gap: Host compensating Undo ran after remote projection context restoration, so projected Rage remained spent.
- `0f17a4d5cb9319776b66fb9909b12808b165a13b` fixes only that seam by temporarily reactivating the matching projected Character resolution context around the existing event-native Undo path, then restoring Host local context.
- `dec4f22178b1256597c140170481025bb26f39e3` fixes the adjacent projected write-back target type narrowing. Exact-head Phase 12 run `32963492151` / connected-protocol job `98160810148` passed the connected suite and `npm run build`; remote Rage resolution + compensating Undo + owning-client durable restore are green.
- concurrent `cbbda07dd7c11ba126e79c26cba99586905e7dce` made Rogue Cunning Action Dash event-native using the existing canonical ResolutionEvent/economy path. Do not reimplement it.

## R2 progress: remote-owner Wild Shape projection proof

Wild Shape R1 mechanics remain unchanged. The connected-only gap was that host-unknown Druid SessionProjection lost `wildShapeKnownForms`, so the existing production Wild Shape adapter correctly refused to invent a form and therefore could not resolve the owner's requested form remotely.

- `657f7ea850350758bd5b0f5ac49977cd533d6df2` moves the optional known-form fact into the existing `source.progression` envelope; concurrent fix `b9a666c772820432bc024fa0b9fb503110111e15` aligns Character source serialization/materialization with `progression.wildShapeKnownForms` without a schema bump or new protocol.
- `a65cbd2926032d70f47495873996653c7622cb1e` adds `connectedProjectedCharacterWildShapeResolution.test.ts`: a host-unknown Druid retains the known Wolf form through projection reconstruction, resolves Wild Shape on Host authority, spends the ephemeral projected resource, gains Druid-level temporary HP, emits one ordered canonical event batch, and the owning Client durably applies the confirmed resource/temp-HP state exactly once.
- `6f25193d93ea8bc010b85239e56055905b62c974` wires that focused proof into the existing Phase 12 connected gate. Exact-head Phase 12 run `32964082295` / connected-protocol job `98162628731` passed the connected authority suite, Phase 11 offline walkthrough, and production `npm run build`. Duplicate Host event and duplicate ActionRequest are explicitly idempotent in the focused test.
- The Windows connected-playable job is not part of this R2 proof and remains R3 acceptance work.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer than this checkpoint.
2. Stay in `R2. Connected remote-owner matrix`; do not reopen R1 or wait for the Windows job, which belongs to R3 acceptance.
3. Use `cbbda07dd7c11ba126e79c26cba99586905e7dce` as existing product evidence that Cunning Action Dash is event-native. Inspect current branch first in case a concurrent watcher already added connected proof.
4. If still uncovered, add the smallest focused remote-owner **Cunning Action Dash** connected test only: Host-authoritative resolution, ordered event/economy projection, acting-owner durable apply/idempotency, and compensating Undo convergence. Reuse generic duplicate/reconnect/observer proofs rather than copying a new protocol harness unnecessarily.
5. Do not include Cunning Disengage/Hide in that slice unless direct evidence shows they are already event-native; snapshot-only paths are separate genuine R2 gaps.
6. Verify the changed exact SHA with the existing Phase 12 connected gate and production `npm run build`. Fix only the first direct regression.
7. Update canonical handoff/checklist only when the overall R2 pointer/status materially changes. Otherwise update this STATE and `control.json` last.
8. R3 Tauri durability/Windows two-instance acceptance, R4 rendered UX/accessibility, and R5 packaging remain separate.
