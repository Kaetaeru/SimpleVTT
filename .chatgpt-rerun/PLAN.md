# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical watcher/baseline branch: `main`
- Active implementation branch: `agent/108-production-play-session-ux`
- Phase 14 tracking issue: #108 — Production play session composition and in-session UX
- Phase 14 execution checklist: `.agents/PHASE14_CHECKLIST.md` on the active implementation branch
- Preserved Phase 13 issue: #104 — completed
- Preserved Phase 13 implementation checkpoint: `7c9440970753a370fec7830cfa691832552e1d05`

## Product direction

SimpleVTT must become a genuinely playable desktop application rather than a reference-fixture shell with production subsystems attached around it. A user must be able to author/persist a Character, enter a real local or connected session with that Character, and use visible production UI for skills, actions, spells, inventory, combat, authoritative dice, activity/undo, and connected host resolution.

`main` remains the canonical Rerun watcher coordinate and development baseline. Phase 14 implementation is isolated on `agent/108-production-play-session-ux` until accepted. Rerun dispatch/control remains on `main`; STATE tells each continuation which implementation branch/head to operate on.

## Preserved completed work — Task 0

**task_id:** `phase13-closeout-ui-dice-regression`

**status:** COMPLETE

Phase 13 arbitrary Character SessionProjection, connected host authority, reconnect/write-back, creation/level-up UX convergence, and shared visual dice were closed with exact-head green Contract/Rules/Persistence/UI/Phase11/Phase12/Phase13 workflows. The exact Phase 13 artifact was `SimpleVTT-Phase13-Windows-7c9440970753a370fec7830cfa691832552e1d05`, artifact id `9266043327`, SHA-256 `242f65162d35df3c0ceb9a0bee138427835a000b5f3272e358d16239c12fadd8`.

This history is preserved and must not be rerun unless Phase 14 changes a relevant boundary.

## Task 1 — Phase 14 production play composition

**task_id:** `phase14-production-play-session-ux`

**status:** ACTIVE — USER AUTHORIZED

### Root cause being corrected

The production React entrypoint installs many real runtime adapters, but `AppProvider` operates through a `MockAdapter` whose base state contains Aelar/Mira/reference Combatants and fixed `actionsByActor` fixtures. Character creation/persistence can replace `activeCharacter`, but the normal production play path did not prove materialization of a newly authored Character into the live Scene/action surface. Existing Phase 11 tests primarily exercised reference fixtures directly, so green CI did not prove the actual user journey.

### Goal

Build a production-composed session/play layer where the source of playable actor state is the real persisted Character and session state while preserving the proven rules/resolution/network subsystems.

The in-session workspace must expose first-class `행동`, `기술`, `주문`, and `인벤토리` surfaces while preserving target, turn, session, Resolution, and connection context.

### End-to-end session lifecycle requirement

Phase 14 includes the complete user-visible lifecycle, not only the mechanics after a session already exists:

1. **Host/server startup:** DM starts hosting from visible UI; actual listen/bind success is shown; address/port is available to share; bind/port/network failures are actionable; stop/restart is safe.
2. **DM preparation/lobby:** DM names/prepares the session, confirms rules/content compatibility, selects or prepares the live Scene, instantiates/removes Combatants as needed, sees connected participants, and can hold the session in a preparation state before play begins.
3. **Player entry:** player selects their persisted Character, enters the Host address, completes transport + compatibility handshake, and reaches the session lobby without debug controls.
4. **Projection/ownership:** a Host-unknown Character is reconstructed as an ephemeral host-authoritative SessionProjection; the player's permanent Character remains owned and persisted only by the player.
5. **Ready/start:** DM can distinguish connected/ready participants and start actual Freeform or Initiative play from the prepared participant set.
6. **Live play:** Actions, Skills, Spells, Inventory, targeting, turns, Combatants, DM correction, reactions, conditions/concentration, activity, Undo, and authoritative dice all operate on the same session state.
7. **Participant lifecycle:** late join, disconnect, reconnect, duplicate/replayed requests/events, and invalid/incompatible entry fail or recover explicitly without corrupting authoritative state.
8. **Session end:** transient session/projection state is cleared safely while player-owned durable Character changes remain persisted to the owning Character library.
9. **Release walkthrough:** Windows acceptance must exercise DM app launch -> Host start -> DM preparation -> Player app launch -> Character selection -> Join -> Ready/start -> play -> disconnect/reconnect -> session end/restart.

### Architecture constraints

1. Persisted/newly created Character materializes into `SceneEntity` plus derived actions from canonical source/runtime facts.
2. Reconciliation occurs after hydration, creation, edit, level-up, and owning-client connected write-back.
3. Product-critical paths do not depend on `char.aelar`, `char.mira`, fixed goblin ids, Ctrl+Shift+D, or reference scenario loading.
4. Reference fixtures may remain only for explicit tests/debug.
5. Connected Host/Join retains host-trusted canonical reconstruction and ephemeral SessionProjection for host-unknown Characters.
6. Permanent Character ownership remains with the player; shared-session ResolutionEvents remain Host-authoritative.
7. No tactical map/grid/token/path/LOS expansion in Phase 14.

### Authoritative completion checklist

The detailed implementation, UX, validation, Rerun, Windows build, human acceptance, merge, and closeout gates are maintained in:

`.agents/PHASE14_CHECKLIST.md` on `agent/108-production-play-session-ux`.

A checkbox receives completion credit only with evidence at a concrete commit. Source presence alone is not completion. The checklist explicitly blocks the phrase “모든 기능을 담은 플레이 가능한 버전” until fresh-Character local play, in-session Actions/Skills/Spells/Inventory, connected two-instance play, restart/durable state, full regressions, human walkthroughs, and exact-head Windows artifact verification all pass.

The user additionally confirmed that server/Host startup, DM preparation/lobby, player Character selection/join/readiness, participant lifecycle, and session shutdown are part of the release-blocking product flow even where an earlier checklist item was phrased more broadly.

### Acceptance summary

Task 1 is complete only when all are true:

1. A Character created through production authoring can immediately enter play as the actual Scene actor.
2. Restarted persisted Characters re-enter play with their own durable HP/resources/items/actions.
3. `행동`, `기술`, `주문`, `인벤토리` are accessible in the session workspace without debug tools.
4. Skill rolls use the real Character modifier and authoritative dice/provenance/activity.
5. Legal inventory item use follows authoritative Resolution/cost and durable ownership rules.
6. Real Character attacks/features/spells work without fixture actor ids.
7. DM can start the Host/server, prepare the live session/lobby, add/use Combatants, inspect participants, start play, run freeform/initiative/corrections/Undo, and end/restart the session from visible UI.
8. A player can select a real persisted Character, join by actual Host address, pass compatibility/SessionProjection, become ready/visible to the DM, and enter the started session.
9. Two production desktop instances can Host/Join with a host-unknown Character and converge after visible UI actions, disconnect/reconnect, and session lifecycle transitions.
10. No product-critical flow requires Ctrl+Shift+D/reference scenarios.
11. Full relevant Phase 11/12/13 and rules/persistence/UI/Tauri regressions are green at the release candidate head.
12. Local and connected human acceptance walkthroughs pass at that exact head, including server startup, DM preparation, player entry, Ready/start, play, reconnect, and session end.
13. Windows playable artifact from that exact head has verified build metadata and SHA-256.
14. Accepted implementation is present on canonical `main` before final Rerun `complete`.

## Current authorization

The user reviewed the completion scope and explicitly authorized Rerun to resume. The same run_id, sequence `1`, and task_id are preserved; this is a waiting-state-to-`continue` transition, not a new task.

The active work branch already contains early implementation files from the interrupted prior execution, including production play/dice adapters and an in-session play dock. These remain **implemented but unverified** until evidence-backed gates pass.

On continuation, read README -> control -> STATE -> PLAN, fetch `.agents/PHASE14_CHECKLIST.md` and the active work branch, then resume from STATE `Next Exact Action`. The first implementation action is to validate the already-present work-branch changes before adding further code. Do not repeat Phase 13 or already evidence-backed work unless a Phase 14 change touches that boundary.
