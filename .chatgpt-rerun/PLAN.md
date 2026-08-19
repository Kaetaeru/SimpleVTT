# Rerun Plan — SimpleVTT V0.9 UI-first replanning

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9 UI-first product replanning**
- dispatch recommendation: `needs_user`

## Planning authority
Implementation remains paused while the user-facing UI contract is rebuilt screen-by-screen.

Current planning documents on the work branch:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`

Latest planning HEAD:
`4c4c07fdbd41ea14f30f00f51f33cec73f4cf482`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Existing automated evidence remains historical regression evidence only. Any behavior that conflicts with the new UI contract must be reworked and reaccepted later.

## Core product philosophy — continuous tabletop companion
The primary UX philosophy is now explicit:

**Once a D&D session is active, the user should be able to keep SimpleVTT open for the entire session and move through conversation, exploration, rules lookup, Character reference, rolls, combat and DM operation without repeatedly leaving the active play context.**

Consequences:
- an active session is an app-level `Session Mode`, not merely one route among Home/Rules/Character/etc.;
- normal session tasks should happen inside the persistent Active Session Play Shell through drawers, split panes, overlays or contextual layers;
- Rules lookup, Character Sheet reference, Encounter/Combatant work and Activity/Undo must not require routine `Play -> other page -> Play로 돌아가기` navigation;
- Freeform is the low-noise default state in which users spend most of the session;
- Initiative is a temporary expansion of the same Session Shell, not another page;
- DM and Player session context must survive utility-tool open/close and reconnect transitions.

## Locked cross-surface decisions
### Dice
- no sheet-local permanent/temporary dice stage as the primary roll presentation;
- body/app-level cinematic overlay;
- dice begin deep/behind the screen and travel toward the user while tumbling in 3D;
- connected authoritative results remain authoritative; standalone rolls use the same visual language.

### Multiplayer lifecycle
- opening a Host immediately creates an active DM session and enters the DM play workspace;
- DM can edit/operate the session with zero players connected;
- no mandatory Host Preparing -> Player Lobby -> Ready -> Play Start user flow;
- players join an already-active session after internal connection/content synchronization;
- reconnect returns to the current active session rather than a lobby/start gate.

### Range/spatial fallback
- base SimpleVTT does not provide tactical grid/token position/exact persistent distance/LOS;
- without an optional spatial/range module, all otherwise-valid targets are treated as in range;
- missing spatial data is not out-of-range;
- exact range/reach/LOS/cover constraints apply only when an installed module supplies authoritative spatial facts.

## Play surface inventory completed
`.agents/V0_9_PLAY_SURFACE_INVENTORY.md` classifies shared play shell/freeform/combat/action-target-result surfaces, transient dice/handout/reconnect/error layers, DM-only session/encounter/initiative/handout/Undo tools, Player-only join/my-character/reconnect tools, and standalone SimpleVTT/Official Character Sheets.

## Continuous-session audit of current production UI
The current implementation conflicts with the new philosophy in several concrete ways:
1. App navigation is route-centric and provides `플레이로 돌아가기`, treating Play as one page rather than a persistent mode.
2. Freeform permanently renders Scene Actor rows, making the actor board rather than conversation/current intent the center of the screen.
3. A permanent `공통 / 클래스 / 주문 / 아이템 / 패시브 / 커스텀` hotbar dominates the normal play surface.
4. Freeform continues showing action/bonus/reaction/movement economy as `FREE` even when combat economy is irrelevant.
5. Encounter editing is gated by offline/preparing lifecycle state rather than by the safety of the specific edit operation.
6. Full Character Sheet and Rules are route-level destinations instead of in-session reference tools.

These are planning defects to correct before source implementation resumes.

## Explicitly forbidden standalone play pages
Do not reintroduce these as permanent routes/pages:
- Host Preparing
- Player Lobby
- Ready
- Play Start gate
- permanent dice tray/window
- standalone target-distance editor
- tactical map/grid/token page
- permanent Inspector
- permanent Activity panel
- permanent Handout manager
- protocol/debug dashboard
- healthy content-parity confirmation page

## Next Exact Action
1. Do not resume implementation or CI yet.
2. Treat `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md` as the upper UX contract when refining the existing surface inventory.
3. Define `C-01 Active Session Play Shell` at implementation-ready fidelity around a persistent Session Mode: session bar, low-noise main focus area, intent-first action dock, in-session utility rail and transient overlay stack.
4. Ensure Sheet, Rules, Activity and DM Encounter/Participants/Handout/Session utilities open without replacing the active Session Shell.
5. Then define `C-02 Freeform` and intent/detail/target flow before coding.
6. Only after the relevant screen contracts are approved should the same sequence return to `continue` for source implementation.
7. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`