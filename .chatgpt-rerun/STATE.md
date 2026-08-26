# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T20:44:00+09:00`

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

## R2 progress: remote-owner Cunning Action Dash proof

Cunning Action Dash now has focused remote-owner proof without adding protocol or duplicating the existing event-native execution path:

- `ea96509ee0c01922d0f23926445b5a7271a45ae1` adds the focused connected test for Host authority, ordered session-economy events, duplicate-safe Client apply/request replay, and compensating Undo. A duplicate concurrently-created test was removed by `f91bf9f4ca22220f3f3e71be51f327bca113a27d`; the retained canonical test is `connectedProjectedCharacterCunningDashResolution.test.ts`.
- `922cfd1f9b53ba4c14e4fe957b5bcc0e397cdce6` fixes the direct host-unknown projection gap by reconstructing the already-supported level-2 Cunning Action Dash action from canonical Rogue level/source facts; it does not add a new rules engine or network schema.
- `04afe3e7eadb33f965a70fb59206909ee3c3d1dc` wires the retained focused test into the existing Phase 12 connected gate.
- The first exact gate exposed a test-contract mistake rather than a product gap: Cunning Dash is a staged `effect-preview` resolution, so remote Host resolution must advance once before commit. `1e7b21df54a74252c3eb91bd255edbd7a0006311` aligns the focused test with that existing staged lifecycle.
- Exact-head Phase 12 run `32964728723` / connected-protocol job `98164631534` passed the connected authority suite (75/75), Phase 11 offline walkthrough, and production `npm run build` on `1e7b21df54a74252c3eb91bd255edbd7a0006311`.
- The focused proof confirms Host-authoritative Cunning Dash, normal Action preservation, Bonus Action spend, movement/movementMaximum projection, exactly-once Client session-economy apply, duplicate event/request safety, and compensating Undo. These economy changes are `writeBack:"session"`; no durable Character-library write is expected or invented.
- The Windows connected-playable job remains R3 acceptance and is not an R2 closure gate.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer than this checkpoint.
2. Stay in `R2. Connected remote-owner matrix`; do not reopen R1 and do not wait for the Windows job, which belongs to R3 acceptance.
3. Treat remote-owner Rage, Wild Shape, and Cunning Action Dash as validated slices. Do not rerun or reimplement them without direct regression evidence.
4. Inspect the remaining Rogue Cunning Action seams against canonical `ResolutionEvent` output, starting with **Cunning Action Disengage** only. Current source suggests its local status/Undo path may still be snapshot-oriented; confirm live evidence before changing anything.
5. If Disengage is not event-native, make only the smallest existing-event-path change needed for Host-authoritative connected resolution + compensating Undo, then add one focused remote-owner proof. Keep Hide separate unless the same direct evidence proves it already shares the canonical event path.
6. Reuse generic duplicate/reconnect/observer machinery; do not create a new protocol, schema, or broad class-feature abstraction.
7. Verify the changed exact SHA with the existing Phase 12 connected gate and production `npm run build`. Fix only the first direct regression.
8. Update canonical handoff/checklist only when the overall R2 pointer/status materially changes. Otherwise update this STATE and `control.json` last.
9. R3 Tauri durability/Windows two-instance acceptance, R4 rendered UX/accessibility, and R5 packaging remain separate.
