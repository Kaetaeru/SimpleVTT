# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `needs_user`
- current milestone: **V0.9 UI-first product replanning**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current planning checkpoint
Implementation remains paused. The Session UI is now specified from product philosophy through full scene inventory, interaction contract and low-fidelity visual layout.

Current planning documents:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`

Latest work-branch planning HEAD:
`df1da3582f0a43d1ed573eee9d5e40de72874365`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## Locked UX philosophy
SimpleVTT is an always-on tabletop companion. Once Session Mode starts, the user should remain in one persistent Session Shell for Character reference, Rules, rolls, exploration, combat and DM operation.

Player Character access is first-class:
- Character Identity Chip always visible in Session Bar;
- one click -> Quick Sheet;
- one explicit expand action -> Full Sheet;
- closing restores the previous Session context where still valid.

## New visual layout decisions
### Baseline shell
Desktop reference: `1440 x 900`.

Persistent regions:
- Session Bar ~52px top;
- Main Focus takes the majority of remaining area;
- Action Dock ~64~72px resting at bottom;
- Utility Rail ~48~56px on the right;
- Layer Host over the mounted Shell.

### Freeform
Freeform remains visually quiet.

Not permanent:
- full Scene Actor/Party board;
- Initiative order;
- action economy;
- full spell/item/class category hotbar;
- Activity/Inspector/Encounter panels.

Player resting Action Dock default candidates are Attack, Magic, Search, Influence, Help plus `모든 행동`, with compact contextual/recent additions only when useful.

### Player Session identity
Right side Character Chip contains portrait/name/compact HP.
- chip click -> Quick Sheet;
- adjacent expand -> Full Sheet.

### DM Session identity
Right side acting Actor chip.
- actor click -> Quick View;
- switch affordance -> Actor Switcher.

### Utility Rail
Desktop default is right-side rail.

Player order:
Sheet, Rules, Activity, active Handout when relevant, Session/connection.

DM order:
Actor, Rules, Encounter, Participants, Handout, Activity/Undo, Session.

### Quick Sheet
Desktop right pane target width ~360px, allowed ~320~420px.

Priority:
1. identity;
2. HP/AC;
3. Speed/Initiative/Proficiency/Passive Perception;
4. conditions;
5. resources;
6. frequent attacks;
7. spells/features;
8. layout switch / Full Sheet.

No embedded dice frame.

### Full Sheet
Wide desktop default is large centered workspace overlay over the mounted Session Shell, target width ~88~94% viewport.

Toolbar includes:
- `SimpleVTT | 공식 시트 스타일`;
- Rules;
- close.

Close means `시트 닫기`, not `플레이로 돌아가기`.

### Initiative
Same Session Shell expands with a compact Initiative Strip (~64~88px) and current-actor economy/turn controls.

No separate combat page or permanent Actor grid.

### Target selection
Only appears when needed.
Without spatial module, otherwise-valid targets remain selectable and no fake distance is invented.

### Responsive
- >=1200px: fixed rail + side panes;
- 900~1199px: drawer-like panes, two-row Action Dock allowed;
- <900px/constrained: utility strip, full-height Quick Sheet/Rules drawers, Full Sheet full workspace overlay.

Close/back and primary controls must remain visible in constrained Windows viewports.

### Layer order
1. Session Shell
2. quick popover
3. utility pane/drawer
4. Full Sheet/large workspace layer
5. dice/result/handout presentation
6. blocking recovery/confirmation

Escape closes one top layer/action step only and never exits Session.

## Planning remaining before implementation
Do not add another broad product-planning layer.

Remaining documents should map 1:1 to implementation:
1. S-00 Session Shell component/state ownership contract;
2. Quick Sheet exact information architecture;
3. Full Sheet in-session component reuse contract;
4. Freeform Action Dock per-intent behavior table.

After those are accepted, the same sequence may return to `continue` for source work.

## Validation status
No source implementation or CI was run for this planning-only checkpoint. Existing `d942d58a...` validation remains historical evidence only.

## Next Exact Action
1. Keep source implementation paused.
2. Review `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md` with the user.
3. If accepted, document S-00 component/state ownership and Quick Sheet information architecture first, then Full Sheet reuse and Action Dock behavior.
4. Only after those contracts are approved return sequence 3 to `continue` and implement slice-by-slice.
5. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
