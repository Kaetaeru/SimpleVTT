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

Do not rerun preserved Phase 13 history merely because the current Phase14 branch has unfinished production-composition work.

## Sequence 1 current work state

**Work branch/head:** `agent/108-production-play-session-ux` @ `8128fcb86d7a7d8ff935e1e322c8a9a495fdd036`.

**Current validated source boundary remains:** player Character selection / Join / compatible lobby at `a01221ac78827e3075c678c6e727a3ca4af695b5`.

The previous Host lifecycle source boundary remains `7d83f263609b5dc2cf18ec43ed617568fedff9ba`. The new Phase11/spatial changes at `8128fcb8...` are **not yet completion evidence** because Phase11 is red and exact-head UI/TypeScript conclusions were still pending when this checkpoint began.

### Completed in this continuation

1. Re-read `.chatgpt-rerun/README.md`, `control.json`, `STATE.md`, and `PLAN.md` from `main` in the required order and reconciled the same run_id / sequence / task / `continue` state before implementation.
2. Confirmed initial actual repo state: `main=55f97a14f37eada80d5f3f1b66ad0dc835afe91b`, work `a01221ac78827e3075c678c6e727a3ca4af695b5`, PR #109 open/draft/unmerged.
3. Inspected the first Phase11 PR failure and found that `phase11OfflineWalkthrough.test.ts` imported final `offlineRuntimeAdapters` and then re-imported numerous Phase09 fixture-oriented tests. That made Aelar/Mira subsystem assumptions accidentally part of the Phase14 final production acceptance.
4. At `0eda3629fc750ffd0fce024fe804965e1e3a3d8e`, migrated Phase11 production acceptance away from those fixture imports while leaving the dedicated Phase09 regressions in the UI workflow. The new Phase11 path creates/finalizes a saved unique Character, restarts it, enters local production play, exercises a derived skill, Initiative attack/Undo, and DM correction with actor/target ids derived from live state.
5. Phase11 run `31968377305` then exposed a real production defect rather than a test-composition mismatch: arbitrary Character attacks had no pairwise spatial facts because the built-in spatial baseline was bound to reference Character ids.
6. At `b6cffefa11c64e2f7b206f449570fcc9bd9d5136`, generalized `realSpatialRuntimeService` so the built-in theater-of-mind Scene materializes existing Scene-distance state into pairwise facts for every live Character -> live Combatant pair. This remains ID-independent and does not add coordinates, pathfinding, LOS or tactical-map scope.
7. At `2612a48604970c4fb4d83395ba29791efa55a9e4`, immediately restored the existing `applyMovementSpatialPlan` return contract after the spatial edit accidentally changed it.
8. At `d7759b50e9bbe4375139e940c638820a796f19bd`, Phase11 attack acceptance was changed to choose a genuinely legal derived attack/target pair and assert targeting provenance with the actual fresh Character id.
9. Phase11 run `31968566259` showed the default created Fighter legitimately had only melee attacks while the built-in enemies were outside melee range. The failure was no longer missing spatial facts.
10. Canonical SRD starting-loadout data was inspected. Fighter loadout B contains studded leather, scimitar, shortsword, **Longbow**, arrows, quiver and pack.
11. At current work head `8128fcb86d7a7d8ff935e1e322c8a9a495fdd036`, the production creation acceptance chooses Fighter loadout B and asserts the committed Character exposes the selected Longbow attack.
12. Phase11 exact-head run `31968670109` failed that assertion before the play tests: the finalized saved Character does **not** materialize a Longbow attack from the production-selected starting loadout. This is now the first production blocker, not a test-only mismatch.

### Independent Phase12 finding

At `d7759b50e9bbe4375139e940c638820a796f19bd`, Phase12 run `31968566206` passed 22 of 23 connected authority tests. The only failure was `tests/ui/connectedAttackEventCapture.test.ts`: after staged Shortbow completion, `takeCommittedResolutionEvents(snapshot.resolution.id)` had no captured event batch.

The same run kept handshake, wire protocol, reconnect, runtime adapter, corrections, event application and other connected authority tests green. Treat this as a separate narrow event-capture repair after the Phase11 attack-materialization blocker. Do not replace Host authority, wire protocol, SessionProjection or owner-write-back architecture to solve it.

### Validation status at checkpoint

- Preserved Host lifecycle evidence: UI `31967444715` at `7d83f263...` — success; not repeated as a separate task.
- Preserved player Join/lobby evidence: UI `31967966233` and Persistence `31967968226` at `a01221ac...` — success; not repeated as a separate task.
- Phase11 `31968670109` at current work head `8128fcb8...` — failure in the new production assertion that Fighter loadout B must materialize its Longbow attack.
- Automatic exact-head PR workflows were generated for `8128fcb8...`: UI push `31968667669`, PR UI `31968670203`, Contract `31968670101`, Phase12 `31968670135`, Persistence `31968670252`, Main Playable `31968670151`. Their concrete final conclusions were not all fetched before checkpoint; do not infer them from in-progress state.
- No new Phase14 checklist feature box is credited from these unverified/red changes.

## Current architecture boundaries preserved

Unchanged intentionally:

- connected wire protocol;
- Tauri transport implementation;
- Host ledger/shared-session authority;
- SessionProjection schema and Host reconstruction;
- reconnect/catch-up and event cursor semantics;
- owning-client-only durable Character write-back;
- persistence format;
- no tactical map/grid/token/path/LOS scope expansion.

The spatial change only generalizes the existing built-in theater-of-mind Scene distance baseline from reference actor ids to all live Character ids.

## Known failures / risks

1. **Primary current blocker:** production Character creation accepts Fighter starting loadout B, but the finalized/saved `CharacterSheet.attacks` does not expose its Longbow. Starting equipment/item state is not feeding canonical weapon-attack materialization for a fresh arbitrary Character.
2. Phase12 has one independent commit-event capture failure in `connectedAttackEventCapture.test.ts`; 22/23 connected authority tests passed at `d7759b50...`.
3. Exact-head UI/TypeScript regression evidence for the new spatial source at current `8128fcb8...` is not yet recorded; current automatic runs must be fetched before credit.
4. Main Playable remains blocked until Phase11 and Phase12 are independently green.
5. Ready/unready, Host readiness display, and Host start gating into Freeform/Initiative remain unimplemented and must wait until the regression matrix is repaired.
6. `productionPlayRuntimeAdapter` still needs targeted active-Character-switch cleanup protection for two non-fixture local Characters without disturbing remote ephemeral projections.
7. Two-instance Windows human acceptance and final exact-head release artifact remain future gates.
8. PR #109 remains draft; no merge is authorized.

## Next Exact Action

Do **not** proceed to Ready/start yet.

On `agent/108-production-play-session-ux` @ current actual head:

1. Trace production creation finalization and Character-sheet projection for selected class starting-loadout items, beginning with Fighter loadout B / Longbow. Determine why the saved Character records the production creation path but does not expose the selected canonical weapon in `CharacterSheet.attacks` / production play actions.
2. Fix the canonical derivation boundary, not the test. Weapon attacks must derive from actual saved Character/loadout/item state for arbitrary Character ids. Do not inject test-only attacks, fixed Aelar actions, fake range, or fixture fallback.
3. Run the smallest Phase11 production-composed gate. When it is green, verify the exact-head UI/TypeScript gate because `realSpatialRuntimeService` changed a Phase09/movement boundary.
4. Then repair the single remaining Phase12 `connectedAttackEventCapture.test.ts` committed-event capture failure while preserving the existing Host-authoritative ResolutionEvent pipeline.
5. Re-check Main Playable after Phase11 and Phase12 are independently green. Only then resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.
6. Preserve earlier exact-head Host lifecycle and player-lobby evidence unless their code boundaries are changed.

## Dispatch recommendation

`continue`
