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
Implementation remains paused while the visible Session UI contract is finalized before source work resumes.

Current planning documents on the work branch:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`

Latest planning HEAD:
`df1da3582f0a43d1ed573eee9d5e40de72874365`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Existing automated evidence is historical regression evidence only. New Session UI must be accepted against the new planning contracts.

## Core product philosophy
SimpleVTT is an always-on tabletop companion. Once a D&D session is active, the app should stay open for conversation, exploration, rules lookup, Character reference, rolls, combat and DM operation without repeated route transitions.

Consequences:
- active session is app-level `Session Mode`;
- one persistent Active Session Shell remains mounted until Session end/leave;
- Freeform is the low-noise default;
- Initiative expands the same Shell;
- Sheet, Rules, Activity and DM Encounter/Participants/Handout/Session tools open as pane/drawer/overlay layers rather than replacing Play;
- Player Character Sheet is first-class Session UI and begins in one explicit action;
- no mandatory Host Preparing / Player Lobby / Ready / Play Start flow;
- without an optional spatial/range module, otherwise-valid targets are treated as in range;
- Character Sheet rolls use body-level cinematic dice entering from screen depth toward the user, not an embedded dice frame.

## Visual layout contract now documented
`.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md` turns the interaction specification into a low-fidelity implementation-ready wireframe contract.

### Baseline shell geometry
Desktop reference viewport: `1440 x 900`.

Persistent regions:
1. Session Bar — compact top bar, target about 52px;
2. Main Focus — largest available area;
3. Action Dock — resting about 64~72px, expands contextually;
4. Utility Rail — right side, target about 48~56px;
5. Layer Host — panes/drawers/Full Sheet/dice/result/handout/recovery.

The Main Focus must remain the dominant visual region. Tool chrome must not turn the product into a permanent game HUD.

### Player Session Bar
- Session name and Freeform/Initiative state remain compact.
- Character Identity Chip is always visible on the right.
- Character chip click -> Quick Sheet.
- adjacent explicit expand affordance -> Full Sheet.
- normal connection health is not a dominant badge; reconnect/disconnected is shown only when actionable.

### DM Session Bar
- current acting Actor identity chip is always available.
- actor click -> Actor Quick View.
- explicit switch affordance -> Actor Switcher.
- DM tools are not hidden behind a generic menu.

### Utility Rail placement
Default desktop rail is on the right.

Player order:
1. Sheet
2. Rules
3. Activity
4. active Handout reopen when relevant
5. Session/connection/leave

DM order:
1. Actor
2. Rules
3. Encounter
4. Participants
5. Handout
6. Activity/Undo
7. Session share/settings

Initiative start/next-turn/end are contextual controls near play/initiative state, not deep rail actions.

### Freeform visual state
Player and DM Freeform both keep the center intentionally quiet.

Do not permanently render:
- full Scene Actor/Party board;
- Initiative order;
- Action/Bonus/Reaction/Movement economy;
- all spell/item/class lists;
- permanent Activity/Inspector/Encounter panels.

Player resting Action Dock default candidates:
- Attack
- Magic
- Search
- Influence
- Help
- `모든 행동`

DM uses the same intent-first concept while adapting available intents to the selected Actor.

### Action Dock expansion
- resting height about 64~72px;
- intent selection expands to contextual choices about 120~180px when needed;
- all official intents remain reachable through `모든 행동`;
- no permanent `공통/클래스/주문/아이템/패시브/커스텀` category hotbar;
- Rules deep-link from action/spell/feature detail preserves the selected action context.

### Target selection
Target chooser appears only when the chosen action requires a target.

Without a spatial module:
- no invented distance values;
- otherwise-valid targets remain selectable;
- missing distance never produces `5 ft 내 대상 없음`.

### Initiative expansion
Initiative adds a compact strip under the Session Bar, roughly 64~88px:
- round;
- compact order;
- current-turn emphasis;
- current actor economy;
- turn end/next turn control.

It does not replace the Session Shell with a separate combat page or permanent Actor grid.

### Quick Sheet visual contract
Desktop:
- right anchored pane, target width ~360px, allowed ~320~420px;
- opens between Session Bar and Action Dock;
- Main Focus remains mounted behind it.

Priority order:
1. Character identity;
2. HP/AC;
3. Speed/Initiative/Proficiency/Passive Perception;
4. Conditions;
5. key resources;
6. frequent attacks;
7. spells/features quick access;
8. layout switch + Full Sheet.

Quick Sheet roll actions use the shared body-level cinematic dice and never create a local dice stage.

### Full Sheet visual contract
Wide desktop default:
- large centered workspace overlay over the mounted Session Shell;
- target width about 88~94% of viewport;
- Session identity remains visible where practical;
- toolbar exposes `SimpleVTT | 공식 시트 스타일`, Rules, and close.

Medium/narrow:
- full workspace overlay with always-visible close/back control.

Closing returns directly to the previous Session context. The control is `시트 닫기`, not `플레이로 돌아가기`, because the user never left play.

### Rules / Activity / DM tool panes
Rules:
- right pane ~400~460px desktop;
- search first, recent rules, results, detail;
- do not stack multiple narrow panes side-by-side and squeeze Main Focus.

Activity:
- drawer with recent human-readable outcomes;
- DM may expose Undo where valid;
- not a permanent feed.

Encounter:
- larger right pane ~420~520px;
- Combatant Picker nested inside the Encounter workflow;
- editing is governed by operation safety, not a Host `preparing` lifecycle screen.

Participants:
- compact rows with Character/name and connected/reconnecting/disconnected;
- no Ready checkbox.

### Responsive contract
`>=1200px`:
- fixed right rail;
- side panes;
- Full Sheet large overlay.

`900~1199px`:
- rail may remain;
- panes behave more like overlay drawers;
- Action Dock may use two rows.

`<900px` / constrained windows:
- rail becomes compact/bottom utility strip as needed;
- Quick Sheet/Rules become full-height drawers;
- Full Sheet becomes full workspace overlay;
- Action Dock contextual expansion may become bottom-sheet style;
- primary and close/back controls must remain inside viewport.

### Layer priority
1. base Session Shell
2. quick popover
3. utility pane/drawer
4. Full Sheet/large workspace layer
5. dice/result/handout transient presentation
6. blocking recovery/confirmation

`Escape` closes/backtracks one top layer or action step only. It never leaves or ends Session.

## Explicit layout anti-patterns
Do not implement:
- Library sidebar remaining as the dominant shell while Play is merely one route;
- routine `플레이로 돌아가기` navigation;
- Sheet hidden two menu levels deep;
- permanent Actor card wall in Freeform;
- permanent Freeform action economy;
- permanent action-category hotbar;
- side-by-side Quick Sheet + Rules that crush the Main Focus;
- Full Sheet unmounting Session state;
- Rules opening resetting intent/action state;
- narrow-window close/back controls outside the viewport;
- Sheet-local dice layout region.

## Next planning step before code
Do not create another broad product-plan layer.

The remaining planning should map directly to implementation slices:
1. `S-00 Session Shell component contract` — component boundaries, UI state ownership, layer host and preservation semantics;
2. `Quick Sheet information architecture` — exact fields, sections, roll/actions and ordering;
3. `Full Sheet in-session reuse contract` — reuse of standalone SimpleVTT/Official sheet components and presentation switching;
4. `Freeform Action Dock behavior table` — per-intent detail source, target requirements and Rules deep-links.

After those four implementation-facing contracts are accepted, return this same sequence to `continue` and start source work slice-by-slice.

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
2. Review `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md` with the user.
3. If accepted, write the four implementation-facing contracts listed above, beginning with the S-00 component/state contract and Quick Sheet information architecture.
4. Then reauthorize this same sequence as `continue` and implement in the approved slice order.
5. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
