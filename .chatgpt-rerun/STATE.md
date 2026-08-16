# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch state: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical watcher/baseline branch: `main`
- active work branch: `agent/108-production-play-session-ux`
- tracking issue: #108
- draft PR: #109 — open/draft, not merged
- phase checklist: `.agents/PHASE14_CHECKLIST.md` on the work branch

## Preserved completion history

Sequence 0 / Phase 13 remains complete and is not reset.

- Preserved Phase 13 implementation head: `7c9440970753a370fec7830cfa691832552e1d05`.
- Preserved exact-head success: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524`.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

Preserved narrow Phase14 evidence unless its source boundary changes:

- PlaySessionDock: `41db6832cc0a95f085f8161bfed665dbcc71090d`, UI `31965607635` success.
- Host lifecycle: `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI `31967444715` success.
- Player saved-Character Join/compatible lobby: `a01221ac78827e3075c678c6e727a3ca4af695b5`, UI `31967966233` and Persistence `31967968226` success.

Do not rerun those focused gates unless the relevant source changes.

## Sequence 1 current work state

**Actual work branch/head:** `agent/108-production-play-session-ux` @ `d64e5bf679f1cde139b21e86f158bd05e3780742`.

**Newest verified production-play source boundary:** `c6d494cf26f081741da0fb3afca2230bcfde2eb1` for the Phase11 non-fixture offline production walkthrough and full frontend gate inside that workflow.

Current `d64e5bf...` is **not** a fully validated source head: Phase12 is still red and current matrix jobs must not be credited as complete.

### Completed in this continuation

1. Re-read `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, `PLAN.md` from `main` in the required order and reconciled the same run_id / sequence / task / `continue` state.
2. Confirmed initial actual state: `main=bb2b731c4fd0a50543560e92914a96247243fba8`, work=`8128fcb86d7a7d8ff935e1e322c8a9a495fdd036`, PR #109 open/draft/unmerged.
3. Traced production creation finalization and found all starting items were persisted but only `firstWeapon(loadout.items)` was projected into `CharacterSheet.attacks`.
4. Added `characterCreationWeaponAttackAdapter.ts` at `899247091af2423abd9b16e6ae1a7db2e882fb39` and installed it at `3ff77d51dff1db0302c89f497e6d40a4fa5094bb`:
   - derives every created weapon from the actual saved `ItemInstance.definitionId` and canonical `weapon-definition`;
   - computes ability/proficiency attack bonus;
   - preserves first `action.starter` compatibility and assigns stable ids to additional weapons;
   - does not inject fixture/test-only attacks.
5. Corrected the Phase11 production helper at `cd27406fadd6117ed7de780f1fed4283ae950bbb` to explicitly choose Fighter loadout B even if the equipment section was already complete.
6. Phase11 run `31969206005` then proved Longbow creation/materialization, create/save/restart, derived skill and DM correction were green; only Initiative legal-range targeting remained.
7. Traced the range failure to localization-dependent production name parsing: Korean Longbow `장궁` was assigned 5 ft despite canonical `ammunition:150/600`.
8. Added `productionWeaponRuntimeFactAdapter.ts` at `f8a234936966fd5338c16a916a7656056287eb80` and installed it at `9f56214a5ef8122e85887bec46faebd8f079d6fb` so runtime normal range comes from the actual saved weapon's canonical `ammunition`/`thrown` properties.
9. Phase11 run `31969285634` at `9f56214a...` passed all 30 production walkthrough tests. Its final build step exposed only a TypeScript optional-string error in the earlier spatial source.
10. Fixed only that narrowing at `c6d494cf26f081741da0fb3afca2230bcfde2eb1`.
11. Phase11 run `31969356422` at `c6d494cf...` completed the `offline-walkthrough` job successfully. Both `Verify production-composed offline walkthrough` and `Verify full production frontend gate` succeeded. This is the current load-bearing evidence that a fresh production Character can create/save/restart, materialize canonical equipment/actions, resolve a derived skill, make a legal Initiative attack with authoritative economy/Undo, and receive DM correction without fixture actor ids.

### Current spatial regression debt

UI push run `31969353057` at `c6d494cf...` passed the earlier lifecycle/creation/progression/spell gates, then failed `Verify Phase 09 real mechanics services`: 95 of 99 tests passed, 4 failed.

The four failures share one boundary:

- `phase09CombatantRuntimeActions.test.ts` expects old provenance `runtime:spatial:scene.ruined-gate:reference-fixture`; generalized source now emits `scene-distance-baseline`.
- `phase09RealAtomicAttackAdapter.test.ts` deliberately mutates presentation distance to `999 ft` after the reference structured pair should remain 22 ft. Current generalized `ensureReferenceSpatialRuntime` re-reads mutable `entity.distance`, producing 999 and causing two additional atomic-attack failures through out-of-range rejection.

This must be repaired as a structured-runtime contract, not silenced. Pairwise spatial facts must remain stable after presentation text changes while still supporting arbitrary live Character ids. Do not make mutable presentation strings authoritative after initialization, and do not reintroduce product dependency on Aelar/fixed goblins/reference fixture ids.

### Phase12 committed-event capture status

The connected protocol remains 22/23 green; only `tests/ui/connectedAttackEventCapture.test.ts` fails.

- A first temporary completion wrapper copied `runtimeResolutionEventHistory` into `resolutionEventCommitRegistry`; it had no effect and was removed.
- `5e7f35fbb188add204e9d3a87893a97f042b3386` moved the copy into `recordRuntimeResolutionEvents`, which appeared to be the domain event-history commit seam.
- `0066da15d983daeadd13474b2fda353da6fc8769` removed the wrapper import and current head `d64e5bf679f1cde139b21e86f158bd05e3780742` deleted the redundant wrapper file.
- Exact-head Phase12 run `31969502630` at `d64e5bf...` still fails the same assertion: staged Shortbow reaches completion, but `takeCommittedResolutionEvents(snapshot.resolution.id)` returns no events. The other 22 connected protocol/authority tests pass.

Therefore the actual fixture Shortbow completion path does not reach the assumed `recordRuntimeResolutionEvents` seam, or the product commit registry is consumed/cleared before the focused read. The next repair must trace the concrete adapter call chain rather than adding another speculative outer wrapper.

### Validation evidence and non-evidence

Verified:

- Phase11 production walkthrough + full frontend gate inside Phase11 at `c6d494cf...`: run `31969356422`, success.
- Earlier Host and player-lobby exact-head evidence remains valid as listed above.

Known red:

- UI push `31969353057` at `c6d494cf...`: Phase09 mechanics batch failed 4/99 due the structured spatial baseline regression; final standalone UI TypeScript/build was skipped in that workflow.
- Phase12 `31969502630` at current `d64e5bf...`: 22/23 pass; only committed-event capture fails. Later Phase11/frontend steps in that workflow are skipped because connected protocol fails first.

Do not mark current `d64e5bf...` regression matrix green until its UI/Phase11/Main results are concretely fetched and the known red boundaries are repaired.

## Architecture boundaries preserved

Unchanged intentionally:

- connected wire protocol;
- Tauri transport implementation;
- Host ledger/shared-session authority;
- SessionProjection schema and Host reconstruction;
- reconnect/catch-up and event cursor semantics;
- authoritative ActionRequest -> ResolutionEvent routing;
- owning-client-only durable Character write-back;
- persistence formats;
- no tactical map/grid/token/path/LOS expansion.

## Known remaining risks

1. Structured spatial baseline currently rehydrates from mutable presentation distance and breaks the pairwise-fact stability contract.
2. Phase12 committed-event capture remains one failing test at current head; previous bridge attempts did not reach the actual Shortbow commit path.
3. UI full regression matrix remains red until the Phase09 spatial failures are repaired.
4. Main Playable cannot receive completion credit until Phase09 UI/Phase11/Phase12 are independently green at the relevant final source head.
5. Ready/unready, Host readiness display and Host start gating into Freeform/Initiative remain unimplemented and must wait for regression repair.
6. `productionPlayRuntimeAdapter` still has a known active-Character-switch risk: switching between two non-fixture local Characters may leave the prior local projection; any fix must preserve remote ephemeral SessionProjection actors.
7. Two-instance Windows human acceptance and final exact-head release artifact remain future gates.
8. PR #109 remains draft; no merge is authorized.

## Next Exact Action

Do **not** proceed to Ready/start yet.

On `agent/108-production-play-session-ux` @ actual head:

1. Inspect Scene creation/spatial initialization plus `spatialRuntimeContracts` and repair `realSpatialRuntimeService` so initial theater-of-mind distance can seed a stable structured baseline once, but later presentation `entity.distance` mutations cannot overwrite an existing pair. Project that stable baseline to arbitrary live Character ids without hard-coded Character/fixed-combatant product dependencies.
2. Keep the test that changes presentation distance to 999 and expects the structured pair to remain 22. After semantics are restored, update only stale provenance text assertions if necessary.
3. Run the smallest Phase09 mechanics batch; then Phase11 because fresh Character targeting depends on the same service.
4. Independently trace `connectedAttackEventCapture.test.ts` through the concrete `action.shortbow` -> staged Phase09 runtime adapter -> history/registry call chain. Locate the actual point where committed events become available and record them under the product resolution id without changing Host ledger/wire/SessionProjection/reconnect/owner-write-back semantics.
5. Run Phase12's 23-test connected protocol after the narrow capture repair.
6. Re-check UI/TypeScript and Main Playable at the resulting exact head. Only after these regression gates are green resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.

## Dispatch recommendation

`continue`
