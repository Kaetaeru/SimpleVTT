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
Implementation remains paused. The whole scene map and detailed continuous-session interaction contract are now documented before source work resumes.

Current UI planning documents:
- `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`
- `.agents/V0_9_PLAY_SURFACE_INVENTORY.md`
- `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`
- `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`
- `.agents/V0_9_SESSION_INTERACTION_SPEC.md`

Latest work-branch planning HEAD:
`34477c78c1e85cd24433b578c0f4a405a4b7a824`

Previous automated-green implementation HEAD:
`d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## Locked UX philosophy
SimpleVTT is an always-on tabletop companion. Once Session Mode starts, normal play work stays in one persistent Active Session Shell until Session end/leave.

Player Character access is now explicitly first-class Session UI:
- Character identity is always available in the Session Bar;
- one action opens Quick Sheet;
- one explicit expand action opens Full Sheet;
- Sheet/Rules/Activity tools do not replace the Session route/context;
- closing a tool restores the prior play context where still valid.

## Detailed interaction decisions
### Persistent shell
- compact Session Bar
- low-noise Main Focus
- compact intent-first Action Dock
- in-session Utility Rail
- ordered pane/drawer/overlay stack

### Interaction budget
Common Player tasks begin in one explicit action: Quick Sheet, Full Sheet, Rules, actions, recent results.

Common DM tasks begin in one explicit action: Actor switch, Encounter, Combatant add, Participants, Initiative, Handout, Rules, Activity/Undo, Session share/settings.

### Layer/back behavior
- `Escape` closes/backtracks one top layer or interaction step only.
- Session leave/end is never bound to ordinary Escape.
- tools open without unmounting Session Shell.
- valid actor/intent/detail/target/scroll context is preserved across tool open/close when authoritative game state still permits it.

### Freeform
- no permanent Scene Actor board
- no permanent action-category hotbar
- no action economy outside Initiative
- target list appears only when an action needs targets
- Action Dock remains compact until intent/detail selection

### Sheet
- Quick Sheet contains core AC/HP/resources/status/attacks/spells/features access.
- Full Sheet is a large in-session layer/split workspace.
- SimpleVTT/Official layout remains presentation-only over the same Character.
- Sheet rolls use body-level cinematic dice; no embedded dice frame.

### Rules
- Rules opens as in-session pane/drawer.
- action/spell/feature can deep-link to its Rules detail.
- closing Rules returns to the prior action/spell context.

### Range/spatial
- no optional spatial/range module => otherwise-valid targets are in range.
- missing distance is not out-of-range.

### Accessibility / responsive
- critical controls are not hover-only.
- focus enters opened tools and returns to launcher on close.
- important targets use large click/focus areas where possible.
- narrow Windows layouts convert panes to drawers/full overlays without losing close controls or core Session context.

## Human acceptance planned
The interaction spec includes Windows scenarios A~J for:
- Quick Sheet during Freeform
- Full Sheet + cinematic roll
- Rules lookup while preserving an action/spell flow
- DM Combatant addition during active Freeform
- Initiative expand/collapse
- nested Sheet/Rules close behavior
- reconnect without Lobby/Ready
- zero-player DM operation
- no-spatial-module melee targeting
- constrained viewport usability

## Validation status
No source implementation or CI was run for this planning-only checkpoint. Existing `d942d58a...` automated evidence is historical only.

## Next Exact Action
1. Keep source implementation paused.
2. Review/refine `.agents/V0_9_SESSION_INTERACTION_SPEC.md` with the user.
3. If accepted, derive visual/layout contracts for S-00, Quick Sheet and Full Sheet without changing the locked interaction semantics.
4. Only then return the same sequence to `continue` for implementation.
5. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`needs_user`
