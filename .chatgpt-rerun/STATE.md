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
Implementation remains paused. The product is being replanned from the visible UI/interaction boundary before any further source work.

Current UI planning documents:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`

Latest work-branch planning HEAD:
`4c4c07fdbd41ea14f30f00f51f33cec73f4cf482`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## Newly locked core UX philosophy
SimpleVTT is an always-on tabletop companion during a D&D session.

Once a session is active, normal session work should remain inside one persistent Active Session Play Shell rather than forcing repeated route transitions.

This means:
- active session is an app-level Session Mode, not just a `scene` route;
- Rules lookup, Character Sheet reference, Activity and DM Encounter/Participants/Handout/Session tools must open inside the Session Shell through drawer/pane/overlay patterns;
- Freeform is the low-noise default state;
- Initiative expands the same shell and collapses back to Freeform;
- Player join/leave/reconnect and utility-tool open/close do not reset DM/Player play context.

## Existing locked product decisions
### Dice
- Character Sheet rolls do not create a sheet-local dice frame.
- Dice use a body-level cinematic overlay, entering from screen depth/behind and moving toward the user.

### Multiplayer
- Host open immediately enters an active DM workspace.
- DM can edit and operate with zero players.
- no mandatory lobby/Ready/Play Start gate.
- players join the already-active session after internal connection/content synchronization.

### Range/spatial
- no optional spatial/range module => all otherwise-valid targets are treated in range.
- missing spatial data is not an out-of-range result.
- range/reach/LOS/cover constraints only apply when a module supplies authoritative spatial facts.

## Continuous-session UI audit findings
Current production UI still conflicts with the new philosophy:
1. route-centric app shell navigates away from Play and offers `플레이로 돌아가기`;
2. permanent Scene Actor rows dominate Freeform;
3. permanent category hotbar (`공통/클래스/주문/아이템/패시브/커스텀`) behaves like a game HUD;
4. action economy is still shown as `FREE` during Freeform;
5. Encounter editing is gated by offline/preparing lifecycle state instead of per-operation safety;
6. full Character Sheet and Rules are route-level destinations rather than in-session reference tools.

These are planning defects. No source fix was attempted in this planning-only turn.

## Validation status
No implementation or CI was run for this checkpoint. Existing `d942d58a...` automated evidence remains historical regression evidence and does not supersede the new UI contract.

## Next Exact Action
1. Keep source implementation paused.
2. Use `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md` as the upper UX contract.
3. Detail `C-01 Active Session Play Shell` first: persistent session bar, low-noise main focus, intent-first action dock, in-session utility rail, overlay stack.
4. Explicitly define in-session Sheet, Rules, Activity, and DM Encounter/Participants/Handout/Session utilities so they do not replace the Session Shell.
5. Then define C-02 Freeform and intent/detail/target interaction.
6. Reauthorize source work only after the relevant screen contract is approved.
7. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`