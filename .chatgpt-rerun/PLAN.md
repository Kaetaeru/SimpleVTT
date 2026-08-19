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
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`

Latest planning HEAD:
`34477c78c1e85cd24433b578c0f4a405a4b7a824`

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

## Detailed interaction contract now documented
`.agents/V0_9_SESSION_INTERACTION_SPEC.md` defines implementation-level UX rules.

### Interaction budget
Player session tasks that start in one explicit action:
- Quick Sheet
- Full Character Sheet
- Rules search
- action/intention selection
- recent result/history

DM session tasks that start in one explicit action:
- acting Actor switch
- Encounter edit
- Combatant add flow
- Participants
- Initiative controls
- Handout
- Rules
- Activity/Undo
- Session share/settings

### Character Sheet as first-class Session UI
- Character identity chip is always visible for Player.
- chip click opens Quick Sheet.
- explicit adjacent expand action opens Full Sheet.
- Full Sheet is an in-session workspace layer, not a Character route transition.
- Quick/Full Sheet open/close preserves Session mode, actor, valid intent/detail/target context and play position where possible.
- `Escape` closes only the top layer; it never leaves/ends Session.
- Sheet rolls use the shared body-level cinematic dice overlay.

### Persistent Session Shell regions
1. compact Session Bar;
2. low-noise Main Focus;
3. intent-first Action Dock;
4. in-session Utility Rail;
5. pane/drawer/overlay stack.

### Utility Rail
Player: Sheet, Rules, Activity, active Handout reopen, Session/connection.
DM: Actor, Rules, Encounter, Participants, Handout, Activity/Undo, Session share/settings.

These are tool launchers over the current Session, not route navigation.

### Layer stack and back behavior
Order:
1. Session Shell
2. quick popover
3. utility pane/drawer
4. large workspace layer such as Full Sheet
5. transient dice/result/handout presentation
6. blocking recovery/confirmation

`Escape` closes/backtracks one top layer/interaction step only.

### Freeform and action interaction
- no permanent Scene Actor board;
- no permanent category hotbar;
- no Freeform action economy;
- Action Dock rests compactly and expands after intent selection;
- all official intents remain reachable within at most one additional step;
- target UI appears only when target is required;
- no spatial module => missing distance never filters otherwise-valid targets.

### Feedback and accessibility
- click/action always produces visible selected/pending/result/error feedback;
- disabled action shows a domain-language reason instead of silently doing nothing;
- focus moves into opened tools and returns to launcher on close;
- critical actions are not hover-only;
- major click/touch targets target roughly 40~44px minimum;
- narrow Windows viewports convert panes to drawers/full overlays while preserving context.

### Human usability acceptance scenarios
The detailed spec defines Windows scenarios A~J covering:
- Quick Sheet during Freeform;
- Full Sheet + cinematic roll;
- Rules lookup during a spell/action flow;
- DM Combatant addition during active Freeform;
- Initiative expand/collapse;
- Sheet/Rules layering and Escape behavior;
- reconnect without Lobby/Ready;
- DM zero-player operation;
- no-spatial-module melee target availability;
- constrained viewport usability.

## Implementation slice order after UI approval
1. Persistent Session Shell frame + layer host
2. Session Bar + Player Character / DM Actor identity control
3. Quick Sheet one-click access
4. Full Sheet in-session layer + state preservation
5. Utility Rail + Rules pane + Activity drawer
6. low-noise Freeform Main Focus
7. intent-first Action Dock
8. Detail / Target flow
9. Cinematic Dice / Result feedback
10. DM Encounter / Actor / Participant / Session tools
11. Player session utilities / reconnect
12. Initiative expansion
13. Handout workflow
14. responsive + keyboard/focus pass
15. Windows human usability acceptance A~J

## Next Exact Action
1. Do not resume source implementation or CI yet.
2. Review `.agents/V0_9_SESSION_INTERACTION_SPEC.md` with the user as the detailed interaction authority.
3. If accepted, turn S-00/Quick Sheet/Full Sheet into implementation-ready visual contracts without changing product principles.
4. Then reauthorize this same sequence as `continue` and implement the slices in the order above, validating each slice before advancing.
5. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
