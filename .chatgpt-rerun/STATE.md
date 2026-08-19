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
Implementation remains paused. The complete UI scene map is now documented before any source implementation resumes.

Current UI planning documents:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`

Latest work-branch planning HEAD:
`afce5407d2a3b243f5b25d74dceb6257099d1ded`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## Product philosophy
SimpleVTT is an always-on tabletop companion. Once Session Mode starts, normal play work stays in one persistent Active Session Shell until Session end/leave.

Library Mode remains for out-of-session Character/content/rules/settings work and standalone Character Sheet use.

Active Session Mode owns conversation, exploration, rolls, combat, Rules lookup, Character reference and DM operation without routine route round-trips.

## Complete scene inventory checkpoint
The new complete plan defines:
- Library scenes: Home, Character Library, Character Create/Edit, Standalone Sheet, Content, Rules, Settings, Session Entry;
- Session entry: Open Session and Join Session;
- shared Session core: persistent Shell, Freeform, Intent, Detail, Target, Result, Initiative/Combat;
- shared Session utilities: Quick View, Full Sheet, Rules, Activity, reconnect, cinematic dice, handout viewer;
- DM tools: Session Share, Participants, Encounter, Combatant Picker, Actor Switcher, Initiative, Handout, Adjudication/Undo;
- Player tools: My Character session utilities, Leave/Reconnect;
- Session end confirmation/return.

## Locked scene-level UI contracts
- Session Shell stays mounted while in-session tools open/close.
- Freeform is low-noise and does not permanently show all Scene Actors, action category tabs or action economy.
- target list appears only when target selection is relevant.
- Rules, Full Sheet, Activity and DM tools are in-session panes/drawers/overlays rather than route replacements.
- Initiative expands the same Shell and collapses back to Freeform.
- no Lobby/Ready/Play Start gate.
- no optional spatial module => otherwise-valid targets are in range.
- cinematic dice are body-level and enter from screen depth; no embedded Sheet dice frame.

## Validation status
No source implementation or CI was run for this planning-only checkpoint. Existing `d942d58a...` automated evidence is historical only.

## Next Exact Action
1. Keep source implementation paused.
2. Review the complete scene map with the user.
3. If the scene map is accepted, detail `S-00 Persistent Active Session Shell` at implementation-ready fidelity.
4. Then detail `S-01 Freeform` and Intent → Detail → Target before coding.
5. Reauthorize this same sequence as `continue` only after the relevant UI contracts are approved.
6. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
