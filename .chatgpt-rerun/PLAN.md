# Rerun Plan — SimpleVTT V0.9 UI-first replanning

## Coordinates
- Repository: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue #108; PR #109 remains open/draft/unmerged
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task_id `v1-product-experience-overhaul`
- current milestone: **V0.9 UI-first product replanning — implementation-facing contracts complete**
- dispatch recommendation: `needs_user`

## Planning authority
Source implementation remains paused. The UI plan is now specified from product philosophy through implementation-facing component/reuse/interaction contracts.

Current planning documents on the work branch:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`
- `.agents/V0_9_SESSION_VISUAL_LAYOUT_CONTRACT.md`
- `.agents/V0_9_SESSION_UI_ARCHITECTURE_CONTRACT.md`
- `.agents/V0_9_EXISTING_UI_REUSE_MAP.md`
- `.agents/V0_9_QUICK_SHEET_INFORMATION_ARCHITECTURE.md`
- `.agents/V0_9_FULL_SHEET_IN_SESSION_REUSE_CONTRACT.md`
- `.agents/V0_9_ACTION_DOCK_BEHAVIOR_MATRIX.md`

Latest planning HEAD:
`a1ee400d1bcb7b8db3f72d793e7bdefb7782c8e9`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

Existing automated evidence remains historical only. The new Session UI requires fresh slice-by-slice validation after implementation starts.

## Locked product philosophy
SimpleVTT is an always-on tabletop companion.

Once a D&D Session is active:
- Session Mode is app-level, not one route among Library pages;
- one persistent Session Shell remains mounted until Session end/leave;
- Freeform is the low-noise baseline;
- Initiative expands the same Shell;
- Character Sheet, Rules, Activity and DM tools open as in-session layers;
- Player Character Sheet begins in one explicit action;
- Host opens directly into active DM workspace with zero-player operation allowed;
- no Player Lobby / Ready / Play Start gate;
- no optional spatial module => otherwise-valid targets are treated in range;
- Character Sheet dice use body/app-level cinematic presentation, not a Sheet-local dice frame.

## New implementation-facing architecture contract
`.agents/V0_9_SESSION_UI_ARCHITECTURE_CONTRACT.md` defines:
- `AppRoot -> LibraryModeRoot | SessionModeRoot`;
- `SessionModeRoot -> SessionBar / MainFocus / ActionDock / UtilityRail / LayerHost`;
- Session UI state may own only pane/layer/intent/focus/scroll presentation state;
- Character, Scene, Actions, Economy, Activity, Resolution, Session and transport truth remain existing `AppSnapshot` / AppProvider / runtime adapter authority;
- snapshot reconciliation preserves valid UI state and invalidates only selections made illegal by authoritative changes;
- Sheet/Rules/Activity/Encounter do not unmount SessionModeRoot;
- first implementation walking skeleton is intentionally narrow: persistent shell + identity + minimal rail/layer host + one-click Quick Sheet.

## Existing UI reuse/replacement map
`.agents/V0_9_EXISTING_UI_REUSE_MAP.md` classifies current code.

Keep authority:
- `AppProvider` and existing commands;
- runtime/network/content/Character/Resolution authorities;
- `playerExperienceModel` intent grouping over canonical actions;
- handout/portrait persistence authorities.

Reuse/refactor:
- Production play action/target command wiring and helpers;
- SimpleVTT Character Sheet content/projections;
- `OfficialCharacterSheetPage` and `OfficialSpellcastingSheetPage`;
- sheet layout preference;
- app-level dice/VFX/handout presentation paths.

Replace presentation in normal Session flow:
- route-centric Library sidebar around Play;
- routine `플레이로 돌아가기`;
- permanent Actor card wall;
- permanent common/class/spell/item/passive/custom hotbar;
- Freeform action economy;
- lifecycle-based Encounter edit gating;
- Sheet-local `VisualDiceTray` result frame.

## Quick Sheet information architecture
`.agents/V0_9_QUICK_SHEET_INFORMATION_ARCHITECTURE.md` locks:
- one-click open from Character Identity Chip;
- canonical sources: `activeCharacter`, matching Scene Character entity, current `ActionVm[]`, existing spellcasting/resource projections;
- first viewport priority: identity -> HP/AC -> Speed/Initiative/Proficiency/Passive Perception -> conditions -> key resources -> frequent attacks;
- spells/features/items below as compact quick access;
- no local duplicate HP/resource store and no invented generic setters;
- routine attack/spell use enters the shared authoritative action flow;
- connected Session rolls cannot silently become local `crypto` rolls presented as authoritative;
- if an authoritative Sheet roll is required but no canonical command exists, extend the existing mechanics/Resolution authority rather than creating a Sheet-only resolver.

## Full Sheet reuse contract
`.agents/V0_9_FULL_SHEET_IN_SESSION_REUSE_CONTRACT.md` locks:
- one shared Character Sheet content family with Standalone and Session hosts;
- extract/refactor SimpleVTT Sheet content rather than duplicate it;
- reuse Official Character/Spellcasting leaf pages;
- Session Full Sheet is a large LayerHost workspace, not a Character route;
- layout switch remains presentation-only over the same canonical Character;
- route toolbar / `기기로 플레이` is absent from Session host;
- roll generation is separated from presentation;
- Standalone may perform local tabletop rolls;
- Session roll interactions must use canonical authoritative actions/commands when they affect connected mechanics;
- Rules may layer over Full Sheet and close independently;
- body-level cinematic dice replace embedded Sheet dice stage.

## Action Dock behavior matrix
`.agents/V0_9_ACTION_DOCK_BEHAVIOR_MATRIX.md` locks the state machine:
`Resting -> Intent -> Action Detail -> Target if needed -> Pending -> Resolution`.

Canonical sources:
- `OFFICIAL_PLAY_INTENTS` / `intentOptions` for grouping;
- current actor `ActionVm[]` for legality/details;
- `eligibleTargetIds` for target candidates;
- `resolveAction` for execution;
- existing Resolution projection for outcome.

Per-intent behavior is specified for Attack, Dash, Disengage, Dodge, Help, Hide, Influence, Magic, Ready, Search, Study and Utilize.

Important boundaries:
- no permanent action category hotbar;
- all official intents reachable through `모든 행동` within one additional step;
- Freeform hides permanent economy; Initiative shows compact current-actor economy;
- no-roll actions do not force dice;
- opening Rules/Sheet preserves valid action context;
- DM Actor switch resets only actor-specific interaction state;
- no-spatial-module range fallback must be enforced in canonical target eligibility, not by a second UI target engine.

## Implementation slice order after source authorization
1. Persistent Session Shell frame + LayerHost
2. Session Bar + Player Character / DM Actor identity
3. Quick Sheet one-click access using canonical snapshot
4. Full Sheet Session host + shared Sheet extraction/state preservation
5. Utility Rail + Rules pane + Activity drawer
6. low-noise Freeform Main Focus
7. intent-first Action Dock
8. Detail / Target flow and canonical no-spatial fallback repair if still needed
9. Cinematic Dice / Result presentation convergence
10. DM Encounter / Actor / Participant / Session tools
11. Player session utilities / reconnect
12. Initiative expansion
13. Handout workflow integration
14. responsive + keyboard/focus pass
15. fresh exact-head automated validation
16. Windows human usability acceptance A-J

Each slice must remove or disconnect the conflicting old normal-Session surface it replaces; merely adding the new UI alongside the old UI is not completion.

## Next Exact Action
1. Keep source implementation and CI paused while `control=needs_user`.
2. Treat the five new implementation-facing documents as the final pre-code planning authority.
3. On explicit source-work authorization, return this same sequence to `continue` and implement only slice 1-3 first as a walking skeleton: persistent Session Mode, identity, minimal LayerHost/rail, one-click Quick Sheet.
4. Validate that walking skeleton before adding Full Sheet/Rules/Action Dock complexity.
5. Keep PR #109 draft/unmerged; never merge without explicit user authorization.

## Dispatch recommendation
`needs_user`
