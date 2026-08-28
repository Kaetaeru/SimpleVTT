# Phase 14 Checklist — Production Play Session to Final Playable Build

> Evidence ledger / historical detailed checklist. 작업 AI의 canonical gate 순서와 다음 작업 선택은 `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`를 따른다. 이 문서의 체크 수나 오래된 CI 증거만으로 V1 완료를 판정하지 않는다.

Tracking issue: #108
Canonical baseline: `main`
Work branch: `agent/108-production-play-session-ux`
Rerun run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
Rerun sequence: `1`
Rerun task_id: `phase14-production-play-session-ux`

## Final product target

SimpleVTT is complete for this phase only when a normal user can create or restore their own Character, enter a local or connected session, and play through the visible production UI without relying on Aelar/Mira/reference fixtures or hidden debug controls.

The in-session workspace must support the full normal play loop: `행동`, `기술`, `주문`, `인벤토리`, targeting, freeform/initiative, authoritative dice, ResolutionEvent/activity/undo, DM combatants/corrections, connected Host/Join, reconnect, and owning-client durable write-back.

This phase does **not** add a built-in tactical map/grid/token/pathfinding/LOS implementation. It does require the optional spatial-module seam and safe mapless fallback: absent/stale module facts cannot become range/visibility/cover blockers. Campaign-owned continuity, optional Session calendar/ration rules, Party Stash, and Campaign-scoped DM Library follow `docs/design/campaign-runtime.md`.

---

# Rerun execution contract

These rules are part of Phase 14 completion, not optional process notes.

## Side Panel / repository coordinates

- [x] Repository is `Kaetaeru/SimpleVTT`.
- [x] Chrome Side Panel watcher coordinate remains `main`.
- [x] `.chatgpt-rerun/control.json` on `main` is the dispatch-visible control record.
- [x] Actual Phase 14 implementation branch is recorded separately as `agent/108-production-play-session-ux`.
- [ ] Before final merge, verify the work branch is based on the then-current `main` or cleanly reconciled with it.
- [ ] After final merge, reconcile Rerun STATE/PLAN back to `main` as the only continuing development baseline.

## Mandatory dispatch preflight

Every Rerun invocation must read from the configured `main` in this exact order:

- [x] `.chatgpt-rerun/README.md`
- [x] `.chatgpt-rerun/control.json`
- [x] `.chatgpt-rerun/STATE.md`
- [x] `.chatgpt-rerun/PLAN.md`
- [ ] Reconcile `run_id`, `sequence`, and `task_id` before every implementation continuation.
- [ ] Re-fetch current `main` and the recorded work branch before every write batch.
- [ ] Never reset sequence 0 validation history or the existing run_id.
- [ ] Never infer completion from stale STATUS or old CI results after a relevant source change.

## Dispatch semantics

- [x] `continue` means authorized start/resume.
- [x] `complete`, `needs_user`, and `blocked` are watcher polling/waiting states, not watcher-off states.
- [x] `working` is forbidden.
- [ ] If the same sequence returns from a waiting state to `continue`, resume from STATE `Next Exact Action` without repeating verified work.
- [ ] If sequence changes, reconcile task identity and PLAN before touching code.

## Checkpoint discipline

- [ ] No active Rerun execution exceeds the 20 minute hard stop without first writing a durable checkpoint.
- [ ] At approximately 18 minutes, stop starting risky/long operations and write STATE.
- [ ] Long active execution updates STATUS roughly every 5 minutes and immediately on meaningful success/failure/blocker changes.
- [ ] Every checkpoint records: branch head, files/behavior changed, verification evidence, unresolved risks, and one concrete `Next Exact Action`.
- [ ] Authoritative coordination writes use `PLAN -> STATE -> control.json` order, with `control.json` last.

## Evidence rule

A feature checkbox below may be checked only when its behavior is verified at a concrete commit. Source presence alone is not completion evidence.

Current branch contains early Phase 14 implementation files (`productionPlayRuntimeAdapter`, `productionDiceRuntimeAdapter`, `PlaySessionDock`, and composition imports). These are **NOT completion credit until validation gates below pass**.

---

# P14.0 Planning and safe baseline

- [x] Root production gap documented: normal UI still derived from a fixture-backed `MockAdapter` base state.
- [x] Issue #108 defines the user-facing goal and authority constraints.
- [x] Phase 14 Rerun sequence 1 created without replacing the Phase 13 run history.
- [x] Work branch created from canonical `main`.
- [x] Final-completion checklist created.
- [x] Open/update a Draft PR to `main` once the first coherent validated slice is available. Draft PR #109 is open.
- [x] PR body references #108, this checklist, known fixture-removal risk, and exact validation evidence.

**Gate P14.0:** planning records agree; no hidden scope conflict; `main` remains canonical.

---

# P14.1 Production Character -> live Scene materialization

## Actor identity and lifecycle

- [x] A newly authored Character id is materialized into `SceneVm.entities` without any fixture id mapping.
- [x] The active persisted Character becomes the normal player actor in local play.
- [ ] HP, max HP, temp HP, AC, speed, conditions/life flags, resources, items, and source/runtime revisions are projected from the real Character/runtime state.
- [ ] Scene projection preserves session-only state and does not copy it back into Character source.
- [x] Reconciliation occurs after initial hydration.
- [ ] Reconciliation occurs after new Character finalization.
- [ ] Reconciliation occurs after Character edit/revision.
- [ ] Reconciliation occurs after level-up commit.
- [ ] Reconciliation occurs after authoritative durable write-back.
- [ ] Reconciliation is idempotent and does not duplicate the actor.
- [x] Switching active Character safely removes/replaces the local player projection without corrupting other Scene entities. Evidence: exact source `7f4486ab9520e0e4bb8dc813c6a4a3d967a71b31`; UI `31974455354` passed the focused `productionLocalCharacterSwitch.test.ts` ownership regression and final TypeScript/build; Main Playable `31974455339` playable-contract passed. The regression proves local A -> B removes only A while preserving a remote ephemeral SessionProjection actor/registry/actions/economy and preserving local ownership across a temporary remote resolution context.

Fresh Character actor evidence: exact source `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`, UI `31975560755`, Main Playable `31975560651`. `characterLibraryProductionPlayIntegration.test.ts` authors and saves a unique Character, proves Aelar/Mira are absent from the production Scene, verifies the real Character entity/identity/HP/max HP/temp HP/AC and derived actions, then rehydrates a new adapter from the same Character Library and re-enters local production play with the same actor id.

## Action derivation boundary

- [x] `actionsByActor[activeCharacter.id]` is produced for a fresh non-fixture Character.
- [x] Action derivation uses canonical Character/content/rules facts rather than copied presentation values.
- [x] Weapon attacks derive attack bonus, damage, range, and provenance from the actual Character/loadout.
- [ ] Basic/freeform actions exist even for Characters with no class-specific action.
- [ ] Feature/resource actions are derived from actual Character capabilities.
- [x] Item actions use actual ItemInstance ids.
- [x] Spell actions use actual Character spell availability.
- [x] Normal player path does not require `char.aelar`, `char.mira`, goblin fixture ids, or `loadReferenceScenario`.

Action-derivation evidence: fresh Character source `8b162dd3b45e77f5a742badcdd7f03d613321497`; Skills/attack source `c835963e918cce94bd535054a6553ead7e786262` with product repair through `5d48312289e2f01508b3860428ce98e2830d5f26`; Inventory `c61469c87f6343ff55601e60890d13a58b6a5536`; Spells `868b8e37127ea644444630cb45a84f36664912ed`. These regressions derive skill/check facts, runtime-backed weapon facts, exact persisted ItemInstance ids, and actual Character spell ids for non-fixture actors rather than copying fixture presentation state.

## Safe empty/setup states

- [ ] No Character -> explicit setup/empty state, no crash.
- [ ] Character exists but not yet materialized -> recover/reconcile or show actionable error.
- [ ] Scene has no valid targets -> action UI explains why rather than assuming an entity.
- [ ] Resolution references a removed actor/target -> rejects safely and preserves state.

**Gate P14.1:** a fresh Character with a unique id survives create/save -> play actor -> snapshot round trip.

---

# P14.2 Play entry and session workspace information architecture

## Entry points

- [ ] Character Library has an obvious Play/current-session entry for a saved Character.
- [ ] Character Sheet has an obvious `플레이` / `현재 세션` entry.
- [ ] Starting local play does not require visiting Debug Dock.
- [ ] Host/Join entry is discoverable from the same product navigation language.
- [ ] Returning from creation/edit/level-up preserves a clear route back to play.

## Session workspace

- [ ] One persistent play workspace contains the actor, targets/participants, turn/session status, and action surfaces.
- [ ] Primary tabs are exactly clear to users: `행동`, `기술`, `주문`, `인벤토리`.
- [ ] Switching tabs does not reset session mode, current actor, selected target, or pending legal context.
- [ ] Pending Resolution Drawer/visual dice remains visible regardless of active tab.
- [ ] Connection state and Host/Client/Offline role are visible without overwhelming routine play.
- [ ] Freeform vs Initiative mode is understandable at a glance.

**Gate P14.2:** a user can go from Character Sheet to usable play workspace in one obvious flow.

---

# P14.3 Skills tab and authoritative ability checks

## Skill model

- [x] Standard skills are derived from Character ability scores and proficiency data.
- [ ] Each tile shows Korean skill name, governing ability, total modifier, and proficiency state.
- [ ] Expertise or other multiplier, if present in current Character capabilities, is represented correctly.
- [ ] Hover/focus/detail shows provenance for ability modifier + proficiency contributions.
- [x] Skills not explicitly proficient still appear with the correct ability modifier.
- [ ] Pure ability checks are available when a specific skill is inappropriate.

## Resolution behavior

- [ ] Clicking a skill creates an authoritative ability-check Resolution.
- [x] Actual d20 face is generated by the production dice/runtime source, not the presentation component.
- [ ] VisualDice replays the authoritative face.
- [x] Result shows d20, modifier contributions, total, and provenance.
- [x] Result produces an Activity entry.
- [x] Freeform skill rolls do not consume Initiative Action economy.
- [ ] Initiative-mode skill action economy follows explicit rules/command context rather than accidental tab behavior.
- [ ] Undo behavior is defined for any skill roll state change; pure informational checks do not invent durable state.

Evidence: exact fresh-Skills source `c835963e918cce94bd535054a6553ead7e786262`; UI `31976028376`, Main Playable `31976028381`. `productionFreshCharacterSkills.test.ts` creates/saves a unique Fighter, derives one proficient and one untrained skill from actual ability/proficiency facts, injects authoritative adapter d20 faces, verifies totals/provenance/Activity for both, and proves Freeform economy is unchanged.

**Gate P14.3:** fresh non-fixture Character performs at least two different skill rolls with verified modifiers and authoritative dice.

---

# P14.4 Actions and feature actions

## Basic/action surface

- [ ] `행동` tab lists currently legal attacks and basic actions for the real actor.
- [ ] Weapon/action tiles show cost, target type, attack/save/check summary, and disabled reason where relevant.
- [ ] Target selection only enables eligible targets.
- [ ] Same action id on different actors never resolves through the wrong actor.
- [x] Freeform actions preserve persistent resources without consuming hidden Initiative economy.
- [ ] Initiative action/bonus action/reaction availability is enforced and displayed.

## Attacks

- [x] Real Character attack uses canonical runtime attack fact.
- [x] Hit/miss/critical uses authoritative d20 and target AC.
- [ ] Damage uses authoritative damage dice and typed defense.
- [ ] Temp HP -> HP application remains correct.
- [ ] Reactions/interrupts still function.
- [ ] Concentration/life-state interactions remain intact where triggered.
- [ ] ResolutionEvent activity and event-native Undo remain intact.

Evidence: fresh Character test source `c835963e918cce94bd535054a6553ead7e786262`, with the session-economy/runtime repair validated at product boundary `5d48312289e2f01508b3860428ce98e2830d5f26`; UI `31976479248`, Main Playable `31976479264`. The regression resolves a runtime-backed weapon action whose provenance names the actual Character id, proves an authoritative natural 20/critical against the selected target, commits target HP change and ResolutionEvent Activity, then commits Dash while preserving hidden Freeform Action economy.

## Class/feature actions

- [ ] Resource-backed class actions appear only when granted by the actual Character.
- [ ] Resource cost uses authoritative cost transaction.
- [ ] Exhausted resources disable the action with a human-readable reason.
- [ ] Level-up-added feature/action appears in play after reconciliation.

**Gate P14.4:** non-fixture Character performs an attack plus one non-weapon feature/basic action through visible UI.

---

# P14.5 In-session Inventory UX

## Inventory browsing

- [ ] `인벤토리` opens inside the session workspace without leaving play.
- [ ] Items are grouped or filterable by equipment/consumable/magic or equivalent clear UX.
- [ ] Item tile shows quantity, charges, equipped/wielded/attuned state, and key effects.
- [ ] Hover/focus/detail shows provenance and legal interaction state.
- [ ] Zero quantity/exhausted charges are visible and non-usable rather than disappearing ambiguously.

## Equipment and attunement

- [ ] Equip/unequip is available only where legal.
- [ ] Wield/equipment effects reconcile derived stats/actions.
- [ ] Attune/unattune is available only for applicable items.
- [ ] Stat/action changes from equipment or attunement update the play actor without leaving session.
- [ ] Durable Character state is persisted after legal persistent equipment/attunement changes.

## Item use

- [x] Consumable with supported mechanics exposes a `사용` action.
- [ ] Charged magic item exposes a `사용` action and current charge count.
- [ ] Item use requiring a target enters normal targeting flow.
- [x] Healing/damage/effect item uses the authoritative Resolution pipeline rather than direct UI mutation.
- [x] Quantity/charge cost and effect commit atomically where existing engine support requires atomicity.
- [ ] Failed/rejected resolution does not spend quantity/charge.
- [x] Owning Character durable write-back records persistent quantity/charge changes.
- [ ] Undo restores event-native reversible item/resource changes when rules permit.

Evidence: exact source `c61469c87f6343ff55601e60890d13a58b6a5536`; Persistence `31976901167`, UI `31976901162`, Main Playable `31976901170`. `productionFreshCharacterInventory.test.ts` hydrates a unique persisted Fighter with an exact healing-potion ItemInstance id, derives the production item action from that id, proves roll/effect preview does not spend quantity or HP, commits healing + quantity `2 -> 1` in one durable generation with ResolutionEvent Activity, and rehydrates the committed HP/quantity/action in a fresh adapter.

**Gate P14.5:** in-session inventory use demonstrably changes an actual Character ItemInstance and persists after restart.

---

# P14.6 Spells tab and real Character spellcasting

## Spell surface

- [ ] `주문` tab is derived from the active Character's cantrips/prepared/known/always-prepared sources.
- [ ] Spell tiles reuse the rich spell presentation/tooltip language already used in Character Creation where practical.
- [ ] Search/filter is usable for Characters with many spells.
- [ ] Spell level, cast time/economy, range/target, save/attack, concentration, and slot/resource cost are visible.
- [ ] Unsupported/partial mechanics are disabled with explicit reason rather than silently pretending support.

## Authoritative casting

- [x] Spell caster context is built for real Character ids, not only `char.mira`.
- [x] Slot resources are derived for the real caster.
- [x] Cantrips do not spend slots.
- [x] Slotted spells spend the correct slot/resource only on committed use.
- [x] Spell attack/save/healing/damage uses authoritative runtime services.
- [ ] Concentration state remains authoritative.
- [ ] Connected remote spell action follows Host resolution/event path.

Evidence: exact product head `868b8e37127ea644444630cb45a84f36664912ed`; UI `31977494408` / frontend `95239056759`, Main Playable `31977496228` / playable-contract `95239068920`. `productionFreshCharacterSpells.test.ts` hydrates a unique persisted Sorcerer, projects its Fire Bolt/Magic Missile caster HUD and `2/2` level-1 slots, commits Fire Bolt through authoritative spell attack/damage without slot cost, cycles the turn, commits Magic Missile projectile damage with slot `2 -> 1` plus Activity/provenance/slotted-turn marker, and proves session slot use does not create a Character Library generation.

**Gate P14.6:** at least one supported cantrip and one supported slotted spell work for a non-fixture Character where the Character build grants them.

---

# P14.7 Local session and DM live-session flow

## Campaign-based Host setup and continuity

- [ ] DM can create/open a Campaign and start a Session only from an explicit selected Campaign.
- [ ] Campaign roster tracks durable party references, ration participation, and stash policy without taking ownership of Player Character files.
- [ ] Session setup captures Campaign identity plus `세션 달력 사용` and `식량 규칙 사용` toggles.
- [ ] Session setup captures one exact content/capability loadout and does not hot-apply later Campaign/default package changes.
- [ ] Disabled calendar/ration capabilities hide or disable their UI/automation without deleting saved Campaign state or blocking ordinary play.
- [ ] Calendar advance and ration adjust/consume commands are authoritative, idempotent, provenance-visible, and durable to the owning Campaign.
- [ ] Calendar supports off, simple-day, Gregorian, and validated declarative profile providers without executing package code.
- [ ] Builtin ration behavior is tracking-only; shortage warns but does not invent Character damage/Exhaustion or block rest/session progression.
- [ ] Long Rest + optional calendar advance + optional ration consumption previews and commits as one compound transaction with no partial success.
- [ ] Party Stash is Campaign-owned durable state projected into the Session, not Session-owned transient state.
- [ ] DM Library search, custom items, recents, favorites, notes, and quick actions are scoped to the selected Campaign.
- [ ] Session end writes a bounded Campaign summary without persisting transient Ready/Initiative/projection/handout state or duplicating the ResolutionEvent ledger.
- [ ] Two Campaigns remain isolated across restart; no stash, calendar, ration, DM Library, or Session-summary leakage occurs.

## Optional spatial capability and mapless fallback

- [ ] Product play no longer materializes authoritative distance from presentation labels or fixture defaults in `realSpatialRuntimeService`.
- [ ] Default distance editors in `ProductionSessionWorkspaceBridge` / `ProductionSessionLifecycleBridge` are removed from ordinary mapless play or shown only as an explicit manual spatial-fact tool.
- [ ] `productionAcceptanceRuntimeAdapter` applies range/visibility/cover disabled reasons only to current facts from an active validated provider or an explicit current manual fact.
- [ ] With no provider/fact, target eligibility does not emit `거리 밖`, `시야 없음`, or cover blockers and does not require a fabricated distance.
- [ ] Provider unmount/failure invalidates facts with that provider provenance and recomputes target eligibility immediately.
- [ ] Regression covers no-provider valid target, provider-supplied out-of-range target, and provider removal restoring mapless eligibility.

## Local player flow

- [x] Fresh Character -> Play creates/joins a local scene with the actual Character.
- [x] Restarted persisted Character can re-enter local play.
- [ ] Freeform mode can run skills/actions/items/spells without debug setup.
- [ ] Initiative can start from the live participant set.
- [ ] Turn progression uses live actors, not fixture ordering assumptions.

Evidence for the first two local-player items: fresh Character source `8b162dd3b45e77f5a742badcdd7f03d613321497`; Persistence `31975560620`, UI `31975560755`, Main Playable `31975560651`. The test creates and saves a non-fixture Character, enters local production play, creates a new adapter against the same store, restores the same active id, and re-enters local play.

## DM preparation and lobby

- [x] DM can hold the session in an explicit preparation/lobby state before play begins. Evidence: `productionSessionLifecycleAdapter` + visible `ProductionSessionLifecycleBridge`, exact-head UI run `31967444715` at `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.
- [ ] Session name and current play mode intent are visible/editable in preparation without hidden debug controls.
- [ ] Rules/content compatibility and active session content are visible before start.
- [ ] DM can prepare the live Scene and instantiate/remove Combatants before start.
- [ ] Connected participants and their readiness are visible in the same preparation surface.
- [ ] Starting play uses the prepared participant/Combatant set rather than fixture ordering assumptions.
- [ ] DM can choose Freeform or Initiative start from the prepared state.
- [ ] Play-only controls do not silently activate while the session remains in preparation.

## DM live flow

- [ ] Host/DM role can open a live Scene without reference Characters being required.
- [ ] Combatant definitions can be instantiated into the live scene.
- [ ] Combatant actions use their actual definition/runtime action data.
- [ ] DM can select player projections and combatants safely.
- [ ] DM correction/adjudication remains available during live Resolution.
- [ ] Conditions, typed defenses, reactions, concentration, life state, activity, and Undo remain functional.

**Gate P14.7:** one human walkthrough covers DM preparation/lobby -> prepared participant set -> freeform or initiative start -> combatant action -> DM correction -> Undo without fixture/debug setup.

---

# P14.8 Connected Host/Join production flow

## Host/server lifecycle

- [x] DM starts the actual Host transport from visible production UI. Existing SessionScreen invokes production `hostSession`; lifecycle adapter preserves `tauriSessionTransport.startHost`. Exact-head UI run `31967444715` passed at `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.
- [x] Successful bind/listen state is explicit and displays the shareable address/port returned by the transport. Visible preparation bridge and focused regression passed in run `31967444715`.
- [ ] Bind/port/network failure is shown as an actionable Host startup error without pretending the session is open. Runtime snapshot handling is implemented/tested, but the final dedicated visible error surface is not yet credited.
- [x] Host stop is explicit, safe, and returns the app to a non-hosting preparation/offline state. `Host 중지` invokes tested `stopSession`; run `31967444715` passed.
- [x] Stopping a Host clears transient connected participants, pending-safe connected state, stale peer manifests, and ephemeral SessionProjection registry state without deleting permanent Characters. Focused lifecycle test passed in run `31967444715`.
- [x] Restarting Host after stop creates a fresh connected session/authority context and does not revive stale participants or projections. Focused lifecycle test passed in run `31967444715`.
- [x] Repeated stop/restart operations reuse installed listeners instead of duplicating connected listeners. Focused lifecycle test passed in run `31967444715`.

## Player Character selection, join, and lobby

- [ ] Player selects the persisted Character that will be projected before joining.
- [ ] Player enters an actual Host address and invokes the production transport without debug controls.
- [ ] Transport connect and compatibility handshake are presented as distinct progress/error states rather than immediate fake success.
- [ ] Compatible player reaches the lobby before live play begins.
- [ ] Player can see the selected Character identity, Host address, compatibility result, and readiness state in the lobby.
- [ ] Joining with no valid persisted Character produces an explicit setup requirement rather than fixture fallback.

## Ready and start lifecycle

- [x] Player can mark themselves ready/unready while in the lobby.
- [x] Host sees readiness for each compatible participant.
- [x] Host start is disabled or rejects explicitly when required preparation/readiness conditions are not satisfied.
- [x] Host can start the prepared participant set into Freeform mode.
- [x] Host can start the prepared participant set into Initiative mode with authoritative turn state.
- [x] Clients converge on the Host-selected started mode without presentation-only mutation.

Evidence for the six Ready/start items: exact source `bd1077b9bc61b86c2c0370543a16496c72f840c2`; Phase12 `31971618571` connected authority + Phase11 preservation + production build green; UI `31971618534` including production Host lifecycle and TypeScript/build green; Main Playable `31971618703` playable-contract green. Focused `productionReadyStartSafety.test.ts` proves Host peer-count drop resets stale Ready through Host-authoritative participant events and directly proves prepared Freeform start; `productionSessionLifecycleAdapter.test.ts` proves Ready gating and prepared Initiative start. Existing connected turn projection tests in the same Phase12 gate prove client convergence through Host `mode-transition` events.

## Handshake and projection

- [ ] Host and Client use the same production Character-to-play projection contract.
- [ ] Host-known Character follows the normal host path without duplicate permanent copies.
- [ ] Host-unknown Character sends declarative SessionProjection source/runtime identity.
- [ ] Host validates exact content ids and reconstructs authoritative mechanics.
- [ ] Host mounts an ephemeral actor visible in the actual DM Scene.
- [ ] New Host session clears stale ephemeral projections.
- [ ] Disconnect/reconnect preserves authoritative host runtime for the session.

## Participant lifecycle

- [x] Late join has an explicit policy for preparation and already-started sessions and never silently corrupts turn/session state.
- [x] Disconnect marks the participant unavailable without deleting authoritative session state required for reconnect.
- [x] Reconnect resumes from the last accepted event cursor and restores the participant/projection without duplication.
- [x] Duplicate/replayed hello/action/event traffic is idempotent according to the existing connected protocol guarantees.
- [x] Incompatible or invalid participant entry does not leave a ghost participant or stale projection behind.

Evidence for participant lifecycle: exact product behavior remains at the previously validated connected source boundary; test-only head `7ce39fe44b91009cb1fa660b5e45cb8cf54bfc6d` adds explicit incompatible-manifest and invalid-SessionProjection rejection regressions. Phase12 `31974996616` connected-protocol + Phase11 preservation + production frontend gate all passed. The new regressions prove rejected entry does not advance Host ledger cursor, create participant/peer bindings, mount SessionProjection registry state, or leave Scene/actions/economy ghosts. Earlier late-join/disconnect/reconnect/replay evidence remains at `cf520d35acd1e21a0247fdeb2d3664ae8a334345` and `84d1d39135c08a2094783fb336a606f294b1cf58`.

## Remote actions

- [ ] Remote player `행동` request resolves on Host.
- [ ] Remote player `기술` request resolves on Host when it has shared-session consequence or follows the defined connected check path.
- [ ] Remote supported spell resolves on Host.
- [ ] Remote supported inventory item action resolves on Host.
- [ ] Host emits committed event batch only after authoritative commit.
- [ ] Owning Client applies committed event exactly once.
- [ ] Duplicate/replayed event/request is idempotent.
- [ ] Durable Character write-back occurs only on owning Client.
- [ ] Host permanent Character library is never mutated by ephemeral remote Character projection.

## Session end and restart

- [x] Host can explicitly end the live session from visible UI.
- [x] Session end stops connected transport and clears transient lobby/readiness/turn/pending Resolution state that must not leak into a new session.
- [x] Host-side ephemeral remote Character projections are removed at session end.
- [x] Owning-player durable Character changes already committed through authoritative events remain persisted after session end.
- [x] Starting a new session after end begins from fresh lifecycle state while preserving permanent Character libraries and canonical content.

Evidence for session end/restart: exact session-end product source `240592cb646bfbbfe9466f94047bc1e2f544dcf9`; Phase12 `31973878162` and Main Playable `31973878165` prove explicit end, transient cleanup, projection removal, former-client ended UX, and fresh restart. Test-only head `b20ecf18015cec15ad3eb26aba5674e5c91013cb` adds owning-client storage durability: a saved non-fixture Client accepts a Host-authoritative durable ResolutionEvent, commits Character library generation before cursor advance, receives `session-ended`, and a fresh adapter using the same store rehydrates the same Character identity and resource value while session lifecycle remains offline. Phase12 `31975132450` and Main Playable `31975132458` playable-contract both passed at that exact test head.

## Error UX

- [ ] Incompatible rules/content produces actionable connection error.
- [ ] Invalid SessionProjection produces explicit rejection.
- [ ] Host startup/bind failure identifies that hosting never became active and allows correction/retry.
- [ ] Host busy/pending Resolution state is understandable.
- [ ] Reconnect state is visible without losing the play workspace.
- [x] Session ended/stopped state is explicit to former clients instead of looking like an unexplained transient disconnect. Evidence: `session-ended` drives explicit offline/ended client state without reconnect in `productionSessionEnd.test.ts`, exact source `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`.

**Gate P14.8:** two production desktop instances complete Host bind/start -> DM preparation/lobby -> persisted host-unknown Character selection/join -> compatibility/projection -> Ready -> Host Freeform/Initiative start -> visible Host-authoritative action -> Client convergence -> disconnect/reconnect -> explicit session end -> clean Host restart.

---

# P14.9 Persistence, restart, and data ownership

- [ ] Campaign aggregate has stable id, schema version, revision, migration/corruption recovery, and atomic persistence.
- [ ] Ending a Session persists authorized Campaign calendar/ration/stash changes exactly once while clearing participants, readiness, projections, Initiative, pending resolutions, and active handouts.
- [ ] Connected reconnect/retry cannot duplicate Campaign mutations.
- [ ] Player-owned Character durability and Host-owned Campaign durability remain separate write-back authorities.

- [x] Newly created Character is persisted before restart test.
- [x] Active Character identity restores correctly.
- [x] HP/resource/item durable changes from play restore correctly after restart.
- [ ] Session-only target/initiative/transient Resolution state is not incorrectly persisted as permanent Character source.
- [ ] Creation/edit/level-up draft recovery still works.
- [ ] Atomic Character library save failure still rolls back safely.
- [ ] Projection Characters remain excluded from host permanent library writes.
- [ ] No new duplicate source-of-truth document is introduced for Character mechanics.

Evidence: fresh create/save/restart source `8b162dd3b45e77f5a742badcdd7f03d613321497` (Persistence `31975560620`, UI `31975560755`, Main `31975560651`) proves a newly authored saved Character and active identity survive storage restart/re-entry. Inventory source `c61469c87f6343ff55601e60890d13a58b6a5536` (Persistence `31976901167`, UI `31976901162`, Main `31976901170`) proves committed play HP and ItemInstance quantity survive a fresh adapter/storage rehydrate.

**Gate P14.9:** restart regression proves the same non-fixture Character remains playable with correct durable state.

---

# P14.10 UX quality and accessibility pass

- [ ] Play workspace fits common desktop viewport without hiding essential controls.
- [ ] Long inventory/spell/action lists scroll inside the intended pane.
- [ ] Keyboard focus reaches tabs, tiles, targets, dialogs/drawers, and close controls.
- [ ] Selected/disabled/focus states are visually distinct.
- [ ] Hover-only information also has focus/selection access.
- [ ] Reduced Motion still presents authoritative results without long animation dependency.
- [ ] Dice animation never blocks result access indefinitely.
- [ ] Korean-first terminology is consistent with Character Creation/Level Up.
- [ ] Error/empty/loading/reconnecting states have explicit user guidance.
- [ ] Routine play never requires Ctrl+Shift+D.

**Gate P14.10:** UI structure tests plus a human viewport/interaction walkthrough are both recorded.

---

# P14.11 Automated product-realistic gates

## Fresh Character integration

- [x] Test authors a brand-new Character id not present in fixture source.
- [x] Finalizes/saves it.
- [x] Verifies Scene actor materialization.
- [x] Verifies derived Skills/Actions/Inventory/Spells surfaces as appropriate to build.
- [x] Executes a skill check.
- [x] Executes an attack or feature action.
- [x] Executes a supported item interaction.
- [x] Executes a supported spell for a spellcasting test Character.
- [x] Verifies Activity/provenance/state changes.

Evidence: `characterLibraryProductionPlayIntegration.test.ts`, `productionFreshCharacterSkills.test.ts`, `productionFreshCharacterInventory.test.ts`, and `productionFreshCharacterSpells.test.ts` together use unique non-fixture Character ids, derive the corresponding production actor/action surfaces, and execute authoritative skill, attack/basic, item, and spell paths with Activity/provenance/state assertions. Exact validated boundaries are `8b162dd3b45e77f5a742badcdd7f03d613321497`, `5d48312289e2f01508b3860428ce98e2830d5f26`, `c61469c87f6343ff55601e60890d13a58b6a5536`, and `868b8e37127ea644444630cb45a84f36664912ed`.

## Restart integration

- [x] Persists Character and runtime durable changes.
- [x] Rehydrates a new app/adapter instance.
- [x] Verifies the same Character can enter play and retains correct durable state/actions.

Evidence: fresh Character restart at `8b162dd3b45e77f5a742badcdd7f03d613321497` and Inventory durable restart at `c61469c87f6343ff55601e60890d13a58b6a5536` prove Character Library generations rehydrate into new adapters with the same identity plus committed HP/item state and re-derived production actions.

## UI structure/behavior

- [ ] Play entry exists without Debug Dock.
- [ ] Four primary play tabs exist and switch without losing context.
- [ ] No-actor/empty state is safe.
- [ ] Inventory legal/disabled actions render correctly.
- [ ] Skill modifier/proficiency display is tested.
- [ ] Spell disabled reason is tested for unsupported mechanics.

## Connected integration

- [ ] Host-unknown Character projection test uses non-fixture Character identity.
- [x] Host start/stop/restart test proves transient connected state is cleared without deleting permanent Character state. Exact-head UI run `31967444715` at `7d83f263609b5dc2cf18ec43ed617568fedff9ba`.
- [ ] Preparation/lobby/readiness test proves play does not start from an unprepared or unready state.
- [ ] Action request -> Host authoritative ResolutionEvent -> Client apply/write-back is tested.
- [ ] Reconnect/idempotency remains tested.
- [x] Session end/restart test proves stale projections/readiness/turn state do not leak into the next session. Evidence: canonical `productionSessionEnd.test.ts`, exact source `240592cb646bfbbfe9466f94047bc1e2f544dcf9`, Phase12 `31973878162`; latest Main Playable `31975132458` also preserves the Phase12 session-end regression at test head `b20ecf18015cec15ad3eb26aba5674e5c91013cb`.

**Gate P14.11:** product-realistic tests fail if the implementation falls back to Aelar/Mira/reference-only behavior or skips the required connected lifecycle.

---

# P14.12 Regression matrix

Run only the relevant older gates after each coherent slice; run the full matrix for release candidate.

- [ ] Contract validation green.
- [ ] Rules Domain green.
- [ ] Persistence green.
- [x] UI/TypeScript/production frontend green for the current Host lifecycle slice at `7d83f263609b5dc2cf18ec43ed617568fedff9ba`, UI run `31967444715`.
- [ ] Character Creation regressions green.
- [ ] Level Up/progression/subclass regressions green.
- [ ] Visual dice regressions green.
- [ ] Phase 11 offline playable regression green.
- [ ] Phase 12 connected authority regression green.
- [ ] Phase 13 SessionProjection regression green.
- [ ] Tauri Rust persistence tests green.
- [ ] Tauri connected-session transport tests green.

**Gate P14.12:** full release-candidate regression matrix is green at one exact source head.

---

# P14.13 Human acceptance walkthroughs

Automated tests are necessary but not sufficient for the claim “플레이 가능한 버전”.

## Local desktop walkthrough

- [ ] Launch clean Windows build.
- [ ] Create a Character through visible Character Creation UI.
- [ ] Save and enter Play.
- [ ] Verify the created Character is the actor shown in session.
- [ ] Roll a skill from `기술`.
- [ ] Perform an attack/feature action from `행동`.
- [ ] Open `인벤토리`, inspect an item, and perform a supported item interaction/use.
- [ ] Open `주문` on a spellcasting Character and cast a supported spell.
- [ ] Start Initiative, complete at least one turn transition, and return to Freeform.
- [ ] Inspect Activity/provenance and perform a safe Undo where applicable.
- [ ] Close/relaunch app and confirm durable Character state.

## Connected desktop walkthrough

- [ ] Launch two Windows app instances/machines.
- [ ] Host starts the actual server/transport and confirms successful bind plus shareable address/port.
- [ ] Host selects a persisted Campaign, reviews calendar/ration toggles, Party Stash and Campaign-scoped DM Library, then starts the Session.
- [ ] Host enters DM preparation/lobby, confirms rules/content state, and prepares Scene/Combatants.
- [ ] Client selects a persisted Character not permanently known to Host.
- [ ] Client joins by actual Host address and reaches the compatible lobby.
- [ ] Host sees the ephemeral projected Character and participant readiness.
- [ ] Client marks ready and Host starts Freeform or Initiative from the prepared participant set.
- [ ] Client performs a visible UI action.
- [ ] Host processes authoritative Resolution.
- [ ] Both sides converge on committed state.
- [ ] Client disconnect/reconnect succeeds without stale overwrite or duplicate projection.
- [ ] Host explicitly ends the session; transient projections/readiness/turn state clear.
- [ ] Host can start a fresh session without stale participants/projections.
- [ ] Owning Client durable Character state is correct after restart.
- [ ] Host Campaign calendar/ration/stash changes are correct after Session restart and entries from another Campaign were never visible.
- [ ] With no spatial module active, an otherwise valid target is not disabled for unknown distance/visibility/cover.
- [ ] If a test spatial provider is mounted then removed, only current provider facts affect legality and stale facts stop blocking immediately.

**Gate P14.13:** both walkthroughs are recorded against the exact release candidate head. A build is not called fully playable before this gate.

---

# P14.14 Exact-head Windows build and artifact verification

- [ ] Canonical Main Playable workflow is updated to include new Phase 14 product-realistic gates.
- [ ] Workflow explicitly checks out the intended exact source SHA.
- [ ] `npm run build` / full frontend production gate is green.
- [ ] Required offline/connected/SessionProjection tests are green in the same workflow or exact same head.
- [ ] Windows Tauri release executable builds successfully.
- [ ] Artifact contains `SimpleVTT.exe`.
- [ ] Artifact contains `BUILD.txt` with exact commit SHA and run id.
- [ ] Artifact contains updated `PLAYABLE-WALKTHROUGH.txt` covering local and connected flows.
- [ ] GitHub artifact metadata `head_sha` equals the release candidate SHA.
- [ ] Downloaded ZIP SHA-256 matches GitHub artifact digest.
- [ ] ZIP contents are inspected before delivery.
- [ ] Delivered download is the exact verified artifact, not an older Phase 11/13 or merge-ref build.

**Gate P14.14:** exact-head playable artifact verified and ready for user testing.

---

# P14.15 Merge, main validation, and Rerun closeout

- [ ] Draft PR diff is reviewed for accidental fixture/debug authority leakage.
- [ ] Issue #108 acceptance checklist is reconciled with concrete evidence.
- [ ] Work branch is not behind `main` at merge time, or conflict/rebase reconciliation is completed explicitly.
- [ ] User-requested merge strategy is followed; no merge occurs without authorization.
- [ ] After merge/fast-forward, verify `main` contains the exact accepted source.
- [ ] If merge itself changes source SHA, run/obtain required exact-main build evidence before calling `main` release-ready.
- [ ] `.agents/PHASE14_CHECKLIST.md` is marked CLOSED only with real evidence.
- [ ] `.chatgpt-rerun/PLAN.md` records final acceptance and artifact/run evidence.
- [ ] `.chatgpt-rerun/STATE.md` records final `main` head, issue/PR state, artifact digest, and no outstanding product blocker.
- [ ] `.chatgpt-rerun/STATUS.md` reflects human-readable completion.
- [ ] `.chatgpt-rerun/control.json` is written **last** with the preserved run_id, sequence 1, task_id, and `status: complete`.
- [ ] Watcher may continue polling; `complete` is not interpreted as Side Panel Stop.

**Gate P14.15:** canonical `main` + Rerun records + exact-head Windows artifact all agree.

---

# Release-blocking Definition of Done

Do **not** describe SimpleVTT as “모든 기능을 담은 플레이 가능한 버전” unless every statement below is true:

- [ ] The normal player path uses the user's real Character, not a reference Character fixture.
- [ ] Local session play works from visible UI.
- [ ] `행동`, `기술`, `주문`, `인벤토리` are usable in-session.
- [ ] Item use and skill rolls go through authoritative play resolution as appropriate.
- [ ] DM live-session flow works with real Combatants/players.
- [ ] Connected Host/Join works with a host-unknown Character through visible UI.
- [ ] Connected lifecycle covers Host bind/start, preparation/lobby, Character join, Ready/start, participant reconnect, explicit end, and clean restart.
- [ ] DM can create/open a Campaign and Host a Session from it with optional calendar/ration rules.
- [ ] Campaign Party Stash, calendar/ration state, Session summaries, and private DM Library are durable and isolated between Campaigns.
- [ ] Missing or stale spatial-module facts never become out-of-range/visibility/cover blockers.
- [ ] Durable write-back/restart behavior is proven.
- [ ] No critical flow requires Debug Dock/reference scenario controls.
- [ ] Full relevant regression matrix is green at the release candidate head.
- [ ] Local and connected human acceptance walkthroughs pass.
- [ ] Exact-head Windows artifact metadata and SHA-256 are verified.
- [ ] Accepted implementation is on canonical `main`.

---

# Rerun checkpoint template for future continuations

At each meaningful checkpoint, STATE should include at minimum:

- **Work branch/head:** exact SHA.
- **Checklist section:** e.g. `P14.3 Skills`.
- **Completed since previous checkpoint:** only evidence-backed items.
- **Validation:** test/workflow ids and conclusions.
- **Known failures/risks:** concrete, not generic.
- **Files/architecture boundaries changed:** especially outer adapter composition or authority boundary changes.
- **Next Exact Action:** one executable next step.
- **Dispatch recommendation:** `continue`, `needs_user`, `blocked`, or `complete`.

When a continuation begins, do not repeat a checked/evidence-backed gate unless a later commit changed the boundary that gate validates.
