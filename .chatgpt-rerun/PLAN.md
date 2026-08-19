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

Latest planning HEAD:
`72220a90e851a74b8cbf66c7038529d283957efc`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Existing automated evidence remains historical regression evidence only. Any behavior that conflicts with the new UI contract must be reworked and reaccepted later.

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
`.agents/V0_9_PLAY_SURFACE_INVENTORY.md` now classifies the full play experience into:

### Shared route-level surfaces
- Active Session Play Shell
- Freeform Play Workspace
- Initiative / Combat Workspace
- Actor / Character Quick View
- Intent -> Detail Choice flow
- Target Selection
- Resolution Result

### Shared transient layers
- Cinematic Dice Overlay
- Handout Viewer
- Connection/Reconnect layer
- Error/Recovery layer

### DM-only surfaces/tools
- Open Session
- Active DM Play Workspace composition
- Session Share & Settings
- Participant drawer
- Encounter editor
- Combatant library picker
- DM actor control
- Initiative control
- Handout control
- Activity / Undo detail

### Player-only surfaces/tools
- Join Session
- Active Player Play Workspace composition
- My Character Quick Sheet
- Leave / Reconnect choice

### Session-independent play surfaces
- SimpleVTT Character Sheet
- Official-Style Character Sheet

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
2. Review and refine the play-surface inventory with the user.
3. Then define each screen one-by-one at implementation-ready fidelity: layout regions, visible data, primary/secondary actions, role differences, state transitions, empty/loading/error, keyboard/responsive, human acceptance.
4. Start with `C-01 Active Session Play Shell`, then `C-02 Freeform`, then intent/detail/target flow before coding.
5. Only after the relevant screen contracts are approved should the same sequence return to `continue` for source implementation.
6. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
