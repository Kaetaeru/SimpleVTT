# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Draft PR: #109 — `Phase 14: production play session UX`
- Phase 14 execution checklist: `.agents/PHASE14_CHECKLIST.md` on the active implementation branch
- Rerun run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Rerun sequence: `1`
- Rerun task_id: `phase14-production-play-session-ux`

## Preserved completion

Phase 13 remains complete and must not be reset merely because Phase 14 has unfinished production-composition work.

- Preserved implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.
- Preserved exact-head workflows: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` — all success.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Narrow Phase 14 evidence also remains reusable unless its source boundary changes:

- PlaySessionDock source `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
- Host lifecycle source `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
- Player saved-Character Join / compatible lobby source `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233` and Persistence `31967968226` success.

Do not repeat those focused gates unless their relevant source changes.

## Phase 14 product direction

SimpleVTT must be a genuinely playable desktop application rather than a reference-fixture shell. A normal user must be able to create/persist a Character, enter local or connected play with it, and use visible production UI for Actions, Skills, Spells, Inventory, targeting, combat, authoritative dice, Activity/Undo, DM adjudication, reconnect and durable ownership write-back.

The normal product path must not depend on `char.aelar`, `char.mira`, fixed goblin ids, Ctrl+Shift+D or reference scenario loading. Fixtures may remain only for explicit subsystem tests/debug.

Required lifecycle remains Host start -> DM preparation/lobby -> persisted Character selection/Join -> compatible SessionProjection -> Ready/start -> Freeform/Initiative live play -> disconnect/reconnect/late join -> explicit end -> clean restart.

## Architecture constraints

- Reuse `tauriSessionTransport`, `connectedSessionRuntimeAdapter`, Host ledger, compatibility handshake, SessionProjection, reconnect/catch-up, ActionRequest/ResolutionEvent routing and owning-client write-back.
- Shared session authority remains Host-authoritative; permanent Character ownership remains with the owning player.
- Persisted/new Characters must derive Scene entities/actions/runtime facts from canonical saved source/item state.
- Reconciliation must remain safe after hydration, create/edit/level-up, connected write-back and active Character switching.
- Do not add tactical map/grid/token/pathfinding/LOS scope.

## Sequence 1 current regression-repair history

Current work head: `d64e5bf679f1cde139b21e86f158bd05e3780742`.

### Phase11 production acceptance migration

- `0eda3629fc750ffd0fce024fe804965e1e3a3d8e` separated the final Phase11 production-composed acceptance from Phase09 fixture-specific test imports. Dedicated Phase09 subsystem regressions remain in the UI workflow.
- `b6cffefa11c64e2f7b206f449570fcc9bd9d5136` generalized built-in pairwise spatial materialization to arbitrary live Character ids; `2612a48604970c4fb4d83395ba29791efa55a9e4` restored the existing movement-plan return contract.
- `d7759b50e9bbe4375139e940c638820a796f19bd` made the production acceptance choose a live derived attack/target rather than fixed fixture ids.

### Starting equipment -> canonical attacks

The previous blocker was real: production creation persisted all starting items but `characterCreationV10Adapter` projected only `firstWeapon(loadout.items)` into `CharacterSheet.attacks`.

- `899247091af2423abd9b16e6ae1a7db2e882fb39` added `characterCreationWeaponAttackAdapter.ts`, deriving all successful creation weapons from persisted `ItemInstance.definitionId` + canonical `weapon-definition`, preserving the first legacy `action.starter` id and giving later weapons stable unique ids.
- `3ff77d51dff1db0302c89f497e6d40a4fa5094bb` installed that layer in the offline production composition.
- `cd27406fadd6117ed7de780f1fed4283ae950bbb` corrected the Phase11 helper to explicitly choose Fighter loadout B even when the creation section was already complete. At Phase11 run `31969206005`, Longbow materialization, create/save/restart, skill and DM correction passed; only legal Initiative range remained.

### Canonical weapon range

The next defect was localization-dependent: production play inferred range from attack names and Korean `장궁` fell through to 5 ft even though canonical Longbow has `ammunition:150/600`.

- `f8a234936966fd5338c16a916a7656056287eb80` added `productionWeaponRuntimeFactAdapter.ts`, deriving runtime range from the actual saved weapon's canonical `weapon-definition` properties rather than localized name regex.
- `9f56214a5ef8122e85887bec46faebd8f079d6fb` installed it after production Scene/action materialization.
- Phase11 `31969285634` then passed the complete 30-test production walkthrough; the remaining job failure was only a TypeScript optional-string narrowing in the earlier spatial edit.
- `c6d494cf26f081741da0fb3afca2230bcfde2eb1` fixed that static narrowing without changing spatial meaning.
- Phase11 run `31969356422` at `c6d494cf...` completed `offline-walkthrough` successfully, including `Verify production-composed offline walkthrough` and `Verify full production frontend gate`.

This is reusable evidence that fresh production Character create/save/restart, derived skill, canonical ranged attack in Initiative, authoritative economy/Undo and DM correction work through the production composition at `c6d494cf...`.

### Phase12 committed-event capture investigation

At the prior exact heads, connected authority remained 22/23 green; the only failing test is `connectedAttackEventCapture.test.ts`, where `takeCommittedResolutionEvents(productResolutionId)` returns no batch after staged Shortbow completion.

Two bridge attempts were made without replacing Host authority:

1. `6ef4ac1056470d0e43c59345da15a07153e3cedb` temporarily wrapped resolution advance/interrupt completion and copied `runtimeResolutionEventHistory` into `resolutionEventCommitRegistry`. It did not affect the failing test and was removed.
2. `5e7f35fbb188add204e9d3a87893a97f042b3386` moved the copy into `recordRuntimeResolutionEvents`, the apparent domain-event history commit seam; `0066da15d983daeadd13474b2fda353da6fc8769` removed the wrapper import and `d64e5bf679f1cde139b21e86f158bd05e3780742` deleted the redundant wrapper file.

Exact-head Phase12 run `31969502630` at `d64e5bf...` still fails exactly the same single assertion: 22/23 connected tests pass and `connectedAttackEventCapture.test.ts` still sees no committed batch. Therefore the actual Shortbow commit path is not reaching that registry seam, or another lifecycle step consumes/clears it before the focused test reads it. Do not claim this bridge fixed Phase12.

### Spatial structured-fact regression exposed by UI matrix

UI push run `31969353057` at `c6d494cf...` passed all earlier lifecycle/creation/progression/spell gates, then failed `Verify Phase 09 real mechanics services`: 95/99 passed, 4 failed.

All four failures trace to the spatial generalization boundary:

- `phase09CombatantRuntimeActions.test.ts` still expects old provenance `runtime:spatial:scene.ruined-gate:reference-fixture`, while the generalized service emits `scene-distance-baseline`.
- More importantly, `phase09RealAtomicAttackAdapter.test.ts` deliberately changes presentation distance text to `999 ft` after the structured pair should already be 22 ft. The generalized service re-reads mutable presentation `entity.distance`, producing 999 instead of the stable pairwise runtime fact; two later atomic-attack assertions then cascade into range rejection.

This is a substantive contract regression, not merely a stale test: structured pairwise spatial runtime facts must not be recomputed from mutable presentation strings after initialization. Preserve arbitrary Character-id support while restoring stable structured state. Do not make 999 authoritative and do not reintroduce product dependence on reference Character/fixed combatant ids.

## Next Exact Action

Do **not** resume Ready/start until the regression matrix is repaired.

On `agent/108-production-play-session-ux` at the actual head:

1. Repair the structured spatial baseline first. Inspect Scene/spatial initialization and `spatialRuntimeContracts` to establish stable pairwise baseline facts once, then clone/project that stable baseline to arbitrary live Character ids. Presentation `entity.distance` may seed initial theater-of-mind state but must not overwrite an existing structured pair after later presentation mutation. Preserve movement-module replacement semantics and no tactical-map scope.
2. After the structured contract is restored, update only the stale provenance assertion if necessary; do not weaken the 999-vs-22 structured-fact test.
3. Run the smallest affected Phase09 UI mechanics batch, then Phase11 because the fresh production Character targeting path depends on the same spatial service.
4. Independently trace the actual Shortbow domain-commit path used by `connectedAttackEventCapture.test.ts`. Find where `runtimeResolutionEventHistories.set`/equivalent is actually invoked and whether the product registry is consumed or cleared before the focused test. Fix the single committed-event capture seam without changing Host ledger, wire protocol, SessionProjection, reconnect or owner-write-back authority.
5. Run Phase12 23-test connected protocol after that narrow fix; then re-check UI/TypeScript and Main Playable at the resulting exact head.
6. Once Phase09 UI, Phase11, Phase12 and Main are independently green at the relevant final source head, resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.
7. Keep the known active-Character-switch risk in `productionPlayRuntimeAdapter` in scope: switching two non-fixture local Characters must remove only the previous local projection without disturbing remote ephemeral SessionProjection actors.

Draft PR #109 remains open/draft. No merge is authorized or attempted.
