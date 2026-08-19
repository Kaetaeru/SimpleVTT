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
Implementation remains paused while the UI contract is rebuilt before source work resumes.

Current planning documents on the work branch:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`

Latest planning HEAD:
`afce5407d2a3b243f5b25d74dceb6257099d1ded`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Existing automated evidence is historical regression evidence only. New UI scenes must be accepted against the new product contract.

## Core product philosophy
SimpleVTT is an always-on tabletop companion. Once a D&D session is active, the app should stay open for conversation, exploration, rules lookup, Character reference, rolls, combat and DM operation without repeated route transitions.

Consequences:
- active session is app-level `Session Mode`;
- one persistent Active Session Shell remains mounted until Session end/leave;
- Freeform is the low-noise default;
- Initiative expands the same Shell;
- Sheet, Rules, Activity and DM Encounter/Participants/Handout/Session tools open as pane/drawer/overlay layers rather than replacing Play;
- no mandatory Host Preparing / Player Lobby / Ready / Play Start flow;
- without an optional spatial/range module, otherwise-valid targets are treated as in range;
- Character Sheet rolls use body-level cinematic dice entering from screen depth toward the user, not an embedded dice frame.

## Complete UI scene plan now documented
`.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md` defines the whole product UI as two major modes.

### Library Mode
- Home / Launch
- Character Library
- Character Create / Edit
- Standalone Character Sheet
- Content / Add-on Management
- Rules Library
- Settings
- Session Entry / Open / Join

### Active Session Mode — shared core
- Persistent Active Session Shell
- Freeform Baseline
- Intent Choice
- Action Detail Choice
- Target Selection
- Resolution Result
- Initiative / Combat Expansion
- Character / Actor Quick View
- Full Character Sheet in Session
- Rules Lookup pane
- Activity / Result History
- Connection / Recovery
- Cinematic Dice
- Handout Viewer

### DM-only tools
- Session Share / Settings
- Participants
- Encounter Editor
- Combatant Picker
- DM Actor Switcher
- Initiative Controls
- Handout Control
- Adjudication / Undo
- End Session confirmation

### Player-only tools
- My Character Session Tools
- Leave / Reconnect Choice

### Session end
- End confirmation
- Session ended / return to Library Mode

## Layout contract for S-00 Persistent Session Shell
The complete plan reserves five persistent regions:
1. compact Session Bar;
2. low-noise Main Focus Area;
3. intent-first Action Dock;
4. in-session Utility Rail;
5. transient Overlay Stack.

Normal Freeform must not permanently show the whole Scene Actor board, full action category hotbar, Initiative order or action economy.

## Next Exact Action
1. Do not resume implementation or CI yet.
2. Review `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md` with the user at the whole-scene level.
3. After the scene map is accepted, detail and approve `S-00 Persistent Active Session Shell` at implementation-ready fidelity: exact region placement, desktop/narrow-window behavior, information density, DM/Player controls and overlay/pane behavior.
4. Then detail `S-01 Freeform`, followed by Intent → Detail → Target before coding.
5. Only after the relevant screen contract is approved should the same sequence return to `continue` for source implementation.
6. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
