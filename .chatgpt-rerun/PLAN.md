# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical baseline: `main`
- Active work branch: `agent/108-production-play-session-ux` (to be created from current `main` after Rerun authorization is published)
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Preserved Phase 13 issue: #104 — completed
- Preserved Phase 13 implementation checkpoint: `7c9440970753a370fec7830cfa691832552e1d05`

## Product direction

SimpleVTT must be a genuinely playable desktop application, not a reference fixture shell with production subsystems attached around it. The user must be able to author/persist a Character, enter a real local or connected session with that Character, and use the visible play UI for skills, actions, spells, inventory, combat, authoritative dice, activity history, undo, and connected host resolution.

`main` remains the canonical baseline. Feature branches start from current `main`; completed work is not stacked on historical Phase branches.

## Preserved completed work — Task 0

**task_id:** `phase13-closeout-ui-dice-regression`

**status:** COMPLETE

Phase 13 arbitrary Character SessionProjection, connected host authority, reconnect/write-back, creation/level-up UX convergence, and shared visual dice were closed with exact-head green Contract/Rules/Persistence/UI/Phase11/Phase12/Phase13 workflows. The exact Phase 13 artifact was `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

This history is preserved and must not be rerun unless Phase 14 changes a relevant boundary.

## Task 1 — Phase 14 production play composition

**task_id:** `phase14-production-play-session-ux`

**status:** ACTIVE

### Root cause being corrected

The current production React entrypoint installs many real runtime adapters, but `AppProvider` still operates through a `MockAdapter` whose base state contains Aelar/Mira/reference Combatants and fixed `actionsByActor` fixtures. Character creation/persistence can replace `activeCharacter`, but the production scene path does not reliably materialize a newly authored Character into `SceneVm` or derive a complete playable action surface for that Character. Existing Phase 11 tests primarily exercise the reference fixtures directly, so green CI did not prove the real user journey.

### Goal

Build a production-composed session/play layer where the source of playable actor state is the real persisted Character and session state, while preserving the proven rules/resolution/network subsystems underneath it.

### UX contract

The play workspace must keep the user in one session context. The central play console provides first-class `행동`, `기술`, `주문`, and `인벤토리` tabs/panels. Switching these panels must not discard current session, turn, selected actor, or target context.

- **행동:** attacks, class/feature actions, basic/freeform actions, and other legal actions derived from the active actor.
- **기술:** rollable ability/skill checks with visible modifier/proficiency/source and authoritative dice resolution.
- **주문:** available spells with availability/cost/target information and the existing rich presentation where applicable.
- **인벤토리:** inspect, equip/unequip, attune/unattune, and use legal consumables/charged items during play. Item use stays in session and feeds the authoritative resolution/state-change path.
- Disabled actions expose a useful reason instead of silently disappearing.
- The Character Sheet exposes an obvious `플레이` / current-session entry.
- Missing session/actor state renders a deliberate empty/setup state instead of assuming reference entities exist.
- DM session UX continues to support Combatant instantiation and actor selection without requiring reference fixtures.

### Architecture constraints

1. A persisted/newly created Character must materialize to a `SceneEntity` and derived action set from Character source/runtime state.
2. Reconciliation must occur after creation, edit, level-up, durable hydration, and owning-client connected write-back.
3. Production-critical paths must not depend on `char.aelar`, `char.mira`, fixed goblin IDs, Ctrl+Shift+D, or reference scenario loading.
4. Reference fixtures may remain available only as explicit developer/test fixtures, not the default production authority for user play.
5. Connected Host/Join continues to use host-trusted canonical rules/content and ephemeral SessionProjection for host-unknown remote Characters.
6. Player permanent Character ownership and host-authoritative shared-session ResolutionEvents remain unchanged.
7. No tactical map/grid/token/path/LOS expansion in this phase.

### Delivery slices

#### P14.1 — Production actor materialization

- Add a deterministic Character -> Scene actor/action projection boundary.
- Reconcile active Character into the local scene after hydration/create/edit/level-up/write-back.
- Make Player Scene robust when no actor/session exists.
- Remove reference-character identity assumptions from the normal player route.

#### P14.2 — In-session action/skill UX

- Add play-console tabs with `행동` and `기술` as first-class surfaces.
- Derive skill checks from Character abilities/proficiencies and route rolls through authoritative resolution/visual dice/activity provenance.
- Keep targeting and turn economy context stable across tabs.

#### P14.3 — In-session inventory and spells

- Add `인벤토리` panel/drawer available during play.
- Route item use through existing authoritative item cost/healing/damage/resource mechanisms; equipment/attunement controls update derived state legally.
- Add `주문` play surface based on the actor's real spell availability rather than reference actor IDs.

#### P14.4 — Real local session flow

- Character Library/Sheet -> play entry -> local session/scene with the selected real Character.
- Support DM Combatant instantiation into that live scene.
- Preserve activity, undo, initiative/freeform, conditions/concentration/reactions, DM correction, and visual dice.

#### P14.5 — Connected production flow

- Host/Join uses the same production actor projection.
- Host-unknown player Character mounts ephemerally and is visible/selectable in the real DM scene.
- Remote player actions resolve on host and converge through committed events; owning client durable state persists.

#### P14.6 — Product-realistic gates and Windows build

- Add a fresh-Character production integration gate: create -> save -> enter play -> skill roll -> action/item/spell/feature -> state/activity update.
- Add restart/hydration -> play gate.
- Add in-session inventory and skills UI structure/behavior gates.
- Keep relevant Phase 11/12/13 regressions green.
- Main Playable workflow must build the exact validated head and package `SimpleVTT.exe`, `BUILD.txt`, and an updated local+connected human walkthrough.

### Acceptance criteria

Task 1 is complete only when all are true:

1. A Character created through production authoring can immediately enter play and appears as the actual scene actor.
2. Restarted persisted Characters re-enter play with their own HP/resources/items/actions.
3. `행동`, `기술`, `주문`, `인벤토리` are accessible inside the session workspace without debug tools.
4. A skill roll uses the real Character modifier and produces authoritative dice/provenance/activity.
5. A legal inventory item can be used in session and its quantity/charges/state changes follow authoritative event and durable write-back rules.
6. Real Character attacks/features/spells are derived and usable without fixture actor IDs.
7. DM can add/use Combatants in the live session and run freeform/initiative flow.
8. Two production app instances can Host/Join with a host-unknown Character and converge after a real UI-triggered action.
9. No product-critical flow requires Ctrl+Shift+D/reference scenario fixtures.
10. Exact-head production build and relevant Phase 11/12/13 regression gates are green.
11. A Windows playable artifact from that exact head is produced and its digest/build metadata is verified.

### Verification method

- New integration tests centered on newly authored/persisted Character identities rather than Aelar/Mira fixtures.
- UI structure tests for the session tabs, inventory interaction, empty/setup states, and Play entry.
- Existing rules/domain and production build gates.
- Phase 11 offline regression where relevant, Phase 12 connected authority, Phase 13 SessionProjection regression.
- Windows Tauri library tests and exact-head `Main Playable` artifact.

### Current authorization

The user's latest instruction explicitly authorizes planning through implementation and playable build completion, with special emphasis on session inventory/item use and comprehensive skill/action tabs. Sequence 1 is therefore authorized to proceed once `STATE.md` is reconciled and `control.json` is published last with `status: continue`.
