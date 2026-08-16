# Phase 14 Checklist — Production Play Session to Final Playable Build

Tracking issue: #108
Canonical baseline: `main`
Work branch: `agent/108-production-play-session-ux`
Rerun run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
Rerun sequence: `1`
Rerun task_id: `phase14-production-play-session-ux`

## Final product target

SimpleVTT is complete for this phase only when a normal user can create or restore their own Character, enter a local or connected session, and play through the visible production UI without relying on Aelar/Mira/reference fixtures or hidden debug controls.

The in-session workspace must support the full normal play loop: `행동`, `기술`, `주문`, `인벤토리`, targeting, freeform/initiative, authoritative dice, ResolutionEvent/activity/undo, DM combatants/corrections, connected Host/Join, reconnect, and owning-client durable write-back.

This phase does **not** add tactical map/grid/token/pathfinding/LOS. Existing host-authority, Character ownership, canonical rules/content validation, creation/level-up UX, and visual-dice invariants remain mandatory.

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

- [ ] A newly authored Character id is materialized into `SceneVm.entities` without any fixture id mapping.
- [ ] The active persisted Character becomes the normal player actor in local play.
- [ ] HP, max HP, temp HP, AC, speed, conditions/life flags, resources, items, and source/runtime revisions are projected from the real Character/runtime state.
- [ ] Scene projection preserves session-only state and does not copy it back into Character source.
- [ ] Reconciliation occurs after initial hydration.
- [ ] Reconciliation occurs after new Character finalization.
- [ ] Reconciliation occurs after Character edit/revision.
- [ ] Reconciliation occurs after level-up commit.
- [ ] Reconciliation occurs after authoritative durable write-back.
- [ ] Reconciliation is idempotent and does not duplicate the actor.
- [ ] Switching active Character safely removes/replaces the local player projection without corrupting other Scene entities.

## Action derivation boundary

- [ ] `actionsByActor[activeCharacter.id]` is produced for a fresh non-fixture Character.
- [ ] Action derivation uses canonical Character/content/rules facts rather than copied presentation values.
- [ ] Weapon attacks derive attack bonus, damage, range, and provenance from the actual Character/loadout.
- [ ] Basic/freeform actions exist even for Characters with no class-specific action.
- [ ] Feature/resource actions are derived from actual Character capabilities.
- [ ] Item actions use actual ItemInstance ids.
- [ ] Spell actions use actual Character spell availability.
- [ ] Normal player path does not require `char.aelar`, `char.mira`, goblin fixture ids, or `loadReferenceScenario`.

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

- [ ] Standard skills are derived from Character ability scores and proficiency data.
- [ ] Each tile shows Korean skill name, governing ability, total modifier, and proficiency state.
- [ ] Expertise or other multiplier, if present in current Character capabilities, is represented correctly.
- [ ] Hover/focus/detail shows provenance for ability modifier + proficiency contributions.
- [ ] Skills not explicitly proficient still appear with the correct ability modifier.
- [ ] Pure ability checks are available when a specific skill is inappropriate.

## Resolution behavior

- [ ] Clicking a skill creates an authoritative ability-check Resolution.
- [ ] Actual d20 face is generated by the production dice/runtime source, not the presentation component.
- [ ] VisualDice replays the authoritative face.
- [ ] Result shows d20, modifier contributions, total, and provenance.
- [ ] Result produces an Activity entry.
- [ ] Freeform skill rolls do not consume Initiative Action economy.
- [ ] Initiative-mode skill action economy follows explicit rules/command context rather than accidental tab behavior.
- [ ] Undo behavior is defined for any skill roll state change; pure informational checks do not invent durable state.

**Gate P14.3:** fresh non-fixture Character performs at least two different skill rolls with verified modifiers and authoritative dice.

---

# P14.4 Actions and feature actions

## Basic/action surface

- [ ] `행동` tab lists currently legal attacks and basic actions for the real actor.
- [ ] Weapon/action tiles show cost, target type, attack/save/check summary, and disabled reason where relevant.
- [ ] Target selection only enables eligible targets.
- [ ] Same action id on different actors never resolves through the wrong actor.
- [ ] Freeform actions preserve persistent resources without consuming hidden Initiative economy.
- [ ] Initiative action/bonus action/reaction availability is enforced and displayed.

## Attacks

- [ ] Real Character attack uses canonical runtime attack fact.
- [ ] Hit/miss/critical uses authoritative d20 and target AC.
- [ ] Damage uses authoritative damage dice and typed defense.
- [ ] Temp HP -> HP application remains correct.
- [ ] Reactions/interrupts still function.
- [ ] Concentration/life-state interactions remain intact where triggered.
- [ ] ResolutionEvent activity and event-native Undo remain intact.

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

- [ ] Consumable with supported mechanics exposes a `사용` action.
- [ ] Charged magic item exposes a `사용` action and current charge count.
- [ ] Item use requiring a target enters normal targeting flow.
- [ ] Healing/damage/effect item uses the authoritative Resolution pipeline rather than direct UI mutation.
- [ ] Quantity/charge cost and effect commit atomically where existing engine support requires atomicity.
- [ ] Failed/rejected resolution does not spend quantity/charge.
- [ ] Owning Character durable write-back records persistent quantity/charge changes.
- [ ] Undo restores event-native reversible item/resource changes when rules permit.

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

- [ ] Spell caster context is built for real Character ids, not only `char.mira`.
- [ ] Slot resources are derived for the real caster.
- [ ] Cantrips do not spend slots.
- [ ] Slotted spells spend the correct slot/resource only on committed use.
- [ ] Spell attack/save/healing/damage uses authoritative runtime services.
- [ ] Concentration state remains authoritative.
- [ ] Connected remote spell action follows Host resolution/event path.

**Gate P14.6:** at least one supported cantrip and one supported slotted spell work for a non-fixture Character where the Character build grants them.

---

# P14.7 Local session and DM live-session flow

## Local player flow

- [ ] Fresh Character -> Play creates/joins a local scene with the actual Character.
- [ ] Restarted persisted Character can re-enter local play.
- [ ] Freeform mode can run skills/actions/items/spells without debug setup.
- [ ] Initiative can start from the live participant set.
- [ ] Turn progression uses live actors, not fixture ordering assumptions.

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

- [ ] Player can mark themselves ready/unready while in the lobby.
- [ ] Host sees readiness for each compatible participant.
- [ ] Host start is disabled or rejects explicitly when required preparation/readiness conditions are not satisfied.
- [ ] Host can start the prepared participant set into Freeform mode.
- [ ] Host can start the prepared participant set into Initiative mode with authoritative turn state.
- [ ] Clients converge on the Host-selected started mode without presentation-only mutation.

## Handshake and projection

- [ ] Host and Client use the same production Character-to-play projection contract.
- [ ] Host-known Character follows the normal host path without duplicate permanent copies.
- [ ] Host-unknown Character sends declarative SessionProjection source/runtime identity.
- [ ] Host validates exact content ids and reconstructs authoritative mechanics.
- [ ] Host mounts an ephemeral actor visible in the actual DM Scene.
- [ ] New Host session clears stale ephemeral projections.
- [ ] Disconnect/reconnect preserves authoritative host runtime for the session.

## Participant lifecycle

- [ ] Late join has an explicit policy for preparation and already-started sessions and never silently corrupts turn/session state.
- [ ] Disconnect marks the participant unavailable without deleting authoritative session state required for reconnect.
- [ ] Reconnect resumes from the last accepted event cursor and restores the participant/projection without duplication.
- [ ] Duplicate/replayed hello/action/event traffic is idempotent according to the existing connected protocol guarantees.
- [ ] Incompatible or invalid participant entry does not leave a ghost participant or stale projection behind.

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

- [ ] Host can explicitly end the live session from visible UI.
- [ ] Session end stops connected transport and clears transient lobby/readiness/turn/pending Resolution state that must not leak into a new session.
- [ ] Host-side ephemeral remote Character projections are removed at session end.
- [ ] Owning-player durable Character changes already committed through authoritative events remain persisted after session end.
- [ ] Starting a new session after end begins from fresh lifecycle state while preserving permanent Character libraries and canonical content.

## Error UX

- [ ] Incompatible rules/content produces actionable connection error.
- [ ] Invalid SessionProjection produces explicit rejection.
- [ ] Host startup/bind failure identifies that hosting never became active and allows correction/retry.
- [ ] Host busy/pending Resolution state is understandable.
- [ ] Reconnect state is visible without losing the play workspace.
- [ ] Session ended/stopped state is explicit to former clients instead of looking like an unexplained transient disconnect.

**Gate P14.8:** two production desktop instances complete Host bind/start -> DM preparation/lobby -> persisted host-unknown Character selection/join -> compatibility/projection -> Ready -> Host Freeform/Initiative start -> visible Host-authoritative action -> Client convergence -> disconnect/reconnect -> explicit session end -> clean Host restart.

---

# P14.9 Persistence, restart, and data ownership

- [ ] Newly created Character is persisted before restart test.
- [ ] Active Character identity restores correctly.
- [ ] HP/resource/item durable changes from play restore correctly after restart.
- [ ] Session-only target/initiative/transient Resolution state is not incorrectly persisted as permanent Character source.
- [ ] Creation/edit/level-up draft recovery still works.
- [ ] Atomic Character library save failure still rolls back safely.
- [ ] Projection Characters remain excluded from host permanent library writes.
- [ ] No new duplicate source-of-truth document is introduced for Character mechanics.

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

- [ ] Test authors a brand-new Character id not present in fixture source.
- [ ] Finalizes/saves it.
- [ ] Verifies Scene actor materialization.
- [ ] Verifies derived Skills/Actions/Inventory/Spells surfaces as appropriate to build.
- [ ] Executes a skill check.
- [ ] Executes an attack or feature action.
- [ ] Executes a supported item interaction.
- [ ] Executes a supported spell for a spellcasting test Character.
- [ ] Verifies Activity/provenance/state changes.

## Restart integration

- [ ] Persists Character and runtime durable changes.
- [ ] Rehydrates a new app/adapter instance.
- [ ] Verifies the same Character can enter play and retains correct durable state/actions.

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
- [ ] Session end/restart test proves stale projections/readiness/turn state do not leak into the next session.

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
