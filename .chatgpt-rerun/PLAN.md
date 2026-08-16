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

## Preserved Phase 13 completion

Phase 13 remains complete and must not be reset or rerun unless Phase 14 changes one of its validated boundaries.

- Preserved implementation head: `7c9440970753a370fec7830cfa691832552e1d05`
- Preserved exact-head workflows: Contract `31955742556`, Rules `31955742577`, Persistence `31955742563`, UI `31955742530`, Phase11 `31955742560`, Phase12 `31955742539`, Phase13 `31955742524` — all success.
- Preserved Windows artifact: `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

## Phase 14 product direction

SimpleVTT must become a genuinely playable desktop application rather than a reference-fixture shell with production subsystems attached around it. A normal user must be able to create/persist a Character, enter a real local or connected session with that Character, and use visible production UI for Actions, Skills, Spells, Inventory, targeting, combat, authoritative dice, Activity/Undo, DM adjudication, reconnect, and durable ownership write-back.

The normal product path must not depend on `char.aelar`, `char.mira`, fixed goblin ids, Ctrl+Shift+D, or reference scenario loading. Reference fixtures may remain only for explicit tests/debug.

## Required connected-session lifecycle

Phase 14 includes the complete visible lifecycle:

1. **Host/server startup:** DM starts the actual transport from visible UI, sees bind/listen success and a shareable address/port, receives actionable startup failure, and can stop/restart safely.
2. **DM preparation/lobby:** DM can hold the session before live play, see compatibility/content/participants, prepare the Scene/Combatants, and choose the intended play mode.
3. **Player entry:** player selects their persisted Character, enters Host address, performs real transport + compatibility handshake, and reaches lobby without debug controls.
4. **Projection/ownership:** Host-unknown Character becomes ephemeral host-authoritative SessionProjection; permanent Character ownership remains only with the player.
5. **Ready/start:** readiness is visible and Host starts the prepared participant set into Freeform or Initiative.
6. **Live play:** Actions, Skills, Spells, Inventory, targeting, turns, Combatants, correction, reactions, conditions/concentration, Activity/Undo, and authoritative dice share the same session state.
7. **Participant lifecycle:** late join, disconnect/reconnect, duplicate/replayed traffic, incompatibility, and invalid projections fail/recover explicitly without corrupting authority.
8. **Session end:** transient lobby/projection/turn/resolution state clears; already committed owner-side durable Character changes remain persisted.
9. **Release walkthrough:** Windows acceptance covers Host start -> preparation -> Character selection/join -> Ready/start -> play -> disconnect/reconnect -> explicit end -> clean restart.

## Architecture constraints

- Reuse existing `tauriSessionTransport`, `connectedSessionRuntimeAdapter`, Host ledger, compatibility handshake, SessionProjection acceptance, reconnect/catch-up, ActionRequest/ResolutionEvent routing, and owning-client durable write-back.
- Do not create a replacement transport or move shared-session authority into presentation code.
- Persisted/new Characters must materialize into real Scene/actions from canonical source/runtime facts.
- Reconciliation must remain safe after hydration, create/edit/level-up, connected write-back, and active Character switching.
- No tactical map/grid/token/pathfinding/LOS expansion in Phase 14.

## Acceptance summary

Task 1 is complete only when all are true:

1. A Character created through production authoring immediately enters play as the actual Scene actor.
2. Restarted persisted Characters re-enter with their own durable HP/resources/items/actions.
3. `행동`, `기술`, `주문`, `인벤토리` are usable in-session without debug tools.
4. Skill/item/action/spell flows use authoritative runtime and correct durable ownership semantics.
5. DM can Host, prepare lobby/Scene/Combatants, inspect participants/readiness, start Freeform/Initiative, adjudicate, Undo, and end/restart from visible UI.
6. Player selects a real persisted Character, joins by actual Host address, passes compatibility/SessionProjection, becomes ready, and enters the started session.
7. Two production desktop instances converge through Host-authoritative actions, disconnect/reconnect, and lifecycle transitions.
8. Product-critical paths do not require fixtures/reference scenarios.
9. Full relevant regression matrix, local/connected human walkthroughs, and exact-head Windows artifact verification pass.
10. Accepted implementation is on canonical `main` before final Rerun `complete`.

## Sequence 1 validated history

### PlaySessionDock repair

- `eaac9d7de499433f8f6da8e04f16100326facd57` removed the hydration-time conditional Hook-order risk and stopped clearing pending action context on play-tab switches.
- `41db6832cc0a95f085f8161bfed665dbcc71090d` added the focused regression and UI workflow gate.
- UI run `31965607635` succeeded at exact head `41db6832cc0a95f085f8161bfed665dbcc71090d`, including TypeScript/production build.
- This narrow evidence is not to be repeated unless that boundary changes.

### Host lifecycle checklist reconciliation

- `.agents/PHASE14_CHECKLIST.md` was expanded at `650c6fa5728d982cd58fd1de8d96549c002f66da` to explicitly retain Host bind/start/stop/restart, DM preparation/lobby, persisted Character join, Ready/start, participant lifecycle, session end/restart, connected automation, and Windows walkthrough gates while preserving the existing handshake/projection/authority gates.

### Host lifecycle runtime and visible preparation surface

Validated source head: `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.

- `productionSessionLifecycleAdapter` wraps existing connected Host runtime and enters explicit `preparing` state on successful Host setup.
- Host startup/bind rejection becomes actionable offline/incompatible state instead of fake success.
- `stopSession` stops transport, rejects unsafe pending contexts, unmounts ephemeral projections, clears transient connected state, and returns offline.
- Host restart creates fresh authority while reusing installed listeners.
- `ProductionSessionLifecycleBridge` exposes preparation state, shareable address and Host stop in visible UI.
- UI run `31967444715` succeeded at exact source head `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, including focused lifecycle/UI regression and final TypeScript/production build.

### Player Character selection / Join / compatible lobby

Validated source head: `a01221ac78827e3075c678c6e727a3ca4af695b5`.

- Client lifecycle distinguishes `connecting` from compatible `lobby`; lobby is entered only after accepted `hello-ack` establishes session identity.
- Production Join requires a saved non-reference Character and rejects Aelar/Mira fallback before transport.
- `ProductionPlayerLobbyBridge` exposes saved Character selection, Host address, lifecycle progress, compatibility result and selected identity.
- Existing SessionProjection, Host validation/authority, reconnect and owner-write-back boundaries remain unchanged.
- UI run `31967966233` succeeded at exact head `a01221ac78827e3075c678c6e727a3ca4af695b5`, including lifecycle regression and final TypeScript/production build.
- Persistence run `31967968226` succeeded at the same head for application contracts/build and Windows Tauri storage recovery.

### Regression-matrix debt investigation and production acceptance migration

Current work head: `8128fcb86d7a7d8ff935e1e322c8a9a495fdd036`.

Work completed in this continuation:

- `0eda3629fc750ffd0fce024fe804965e1e3a3d8e` migrated `phase11OfflineWalkthrough.test.ts` away from importing Phase09 fixture-specific assertions under the final Phase14 production composition. Dedicated Phase09 tests remain in the UI workflow; the Phase11 acceptance now creates a saved unique Character and exercises local production play.
- Phase11 run `31968377305` exposed a real product boundary rather than a mere test mismatch: fresh Character attacks had no pairwise spatial facts because `realSpatialRuntimeService` hard-coded Aelar/reference pairs.
- `b6cffefa11c64e2f7b206f449570fcc9bd9d5136` generalized the built-in theater-of-mind baseline to materialize pairwise spatial facts for every live Character against live Combatants using existing Scene distance labels, without adding coordinates/pathfinding/LOS computation.
- `2612a48604970c4fb4d83395ba29791efa55a9e4` immediately restored the existing `applyMovementSpatialPlan` return contract after the prior edit accidentally changed it.
- `d7759b50e9bbe4375139e940c638820a796f19bd` updated the Phase11 attack acceptance to choose a dynamically legal derived attack/target and assert live Character-id targeting provenance.
- Phase11 run `31968566259` then showed the created Fighter's default loadout had only melee attacks while built-in enemies were outside melee range. This was a legitimate legal-action state, not a spatial failure.
- SRD loadout data confirms Fighter loadout B contains a Longbow. `8128fcb86d7a7d8ff935e1e322c8a9a495fdd036` changed the production creation acceptance to choose loadout B and assert that the committed Character materializes its Longbow attack.
- Phase11 run `31968670109` failed that assertion before entering the play tests: final `CharacterSheet.attacks` does **not** materialize the Longbow selected through production starting equipment. This is now the first Phase11 product blocker: production starting loadout/item state is not feeding weapon-attack derivation for a fresh saved Character.

Independent Phase12 finding:

- At `d7759b50...`, Phase12 run `31968566206` passed 22/23 connected authority tests. The only failure was `tests/ui/connectedAttackEventCapture.test.ts`, where `takeCommittedResolutionEvents(snapshot.resolution.id)` returned no captured events after staged Shortbow completion.
- Handshake, wire protocol, reconnect, runtime adapter, corrections and event application all remained green in that run. Treat the event-capture failure as a separate narrow repair after the Phase11 attack-materialization blocker, not as a reason to replace connected authority architecture.

Current exact-head PR workflows for `8128fcb8...` were generated automatically. Phase11 is known failed as above; UI/Contract/Persistence/Phase12/Main were still running when this checkpoint began. Do not infer success until their concrete conclusions are fetched.

Draft PR #109 remains open/draft. No merge is authorized or attempted.

## Next Exact Action

Resume at the production Character **starting equipment -> weapon attack materialization** boundary before Ready/start work:

1. Trace production creation finalization and Character-sheet projection for selected class loadout items, beginning with Fighter loadout B / Longbow, and identify why the saved Character contains the loadout selection/items but does not expose the corresponding canonical attack in `CharacterSheet.attacks` / production play actions.
2. Fix the canonical derivation boundary, not the test: weapon attacks must derive from the actual saved Character/loadout and remain actor-id independent. Do not inject a test-only attack, fixed Aelar action, fake range or fixture fallback.
3. Re-run the smallest Phase11 production-composed gate. Once it is green, verify the UI/TypeScript gate because `realSpatialRuntimeService` changed a Phase09/movement boundary.
4. Then repair the single remaining Phase12 `connectedAttackEventCapture.test.ts` commit-event capture failure while preserving the existing Host-authoritative ResolutionEvent pipeline; do not disable the test/workflow.
5. Re-check Main Playable after Phase11 and Phase12 are independently green. Only after this regression matrix is repaired resume P14.8 Ready/unready and Host start gating into Freeform/Initiative.
6. Preserve exact-head Host lifecycle (`31967444715`) and player-lobby (`31967966233`) evidence unless code touching those boundaries changes.
