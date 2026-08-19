# SimpleVTT V0.9 Session UI Architecture Contract

## 0. Purpose

This document maps the approved continuous-session UX into component boundaries and UI state ownership.

It does not create a new game-state architecture. Existing `AppProvider` snapshots, runtime adapters, Host authority, owning-Client Character durability, ResolutionEvent flow, reconnect/idempotency and installed-content authority remain canonical.

The only new state allowed here is ephemeral Session UI state: which tool is open, which interaction step is visible, focus/scroll restoration metadata, and presentation-only layout state.

---

# 1. Root mode architecture

The application has two visible top-level modes.

```text
AppRoot
├─ LibraryModeRoot
│  ├─ Home
│  ├─ Character Library / Create / Edit
│  ├─ Standalone Character Sheet
│  ├─ Content
│  ├─ Rules Library
│  ├─ Settings
│  └─ Session Entry
└─ SessionModeRoot
   ├─ SessionBar
   ├─ MainFocus
   ├─ ActionDock
   ├─ UtilityRail
   └─ LayerHost
```

`AppRoot` chooses a mode from existing session/runtime facts. It must not maintain a second independent `isSessionActive` authority.

### Host
After the existing Host/session operation succeeds, the Host enters `SessionModeRoot` immediately. Player count, Ready state or a separate Play Start action do not gate the DM workspace.

### Client
A Client enters `SessionModeRoot` after the existing connection/content compatibility path has produced an accepted current session projection. Internal synchronization may still happen, but the visible flow has no Lobby/Ready/Start page.

### Exit
`SessionModeRoot` is left only when the existing session is stopped/left/ended or cannot be recovered and the user explicitly exits.

---

# 2. AppRoot responsibilities

`AppRoot` owns only app-mode selection and Library navigation.

It must not own:
- current actor;
- Character HP/resources;
- session participants;
- initiative/round/turn;
- eligible targets;
- authoritative resolution;
- handout current reveal;
- content parity state.

Those remain derived from the existing snapshot/runtime adapters.

When Session Mode is active, the old permanent Library sidebar is not the dominant shell and the Session UI is not merely a `scene` route inside it.

---

# 3. SessionModeRoot component tree

```text
<SessionModeRoot>
  <SessionUiStateProvider>
    <SessionBar />
    <SessionMainRegion>
      <MainFocus />
      <UtilityRail />
    </SessionMainRegion>
    <ActionDock />
    <LayerHost />
  </SessionUiStateProvider>
</SessionModeRoot>
```

## SessionBar
Reads:
- session name;
- Freeform/Initiative mode;
- Player active Character identity or DM selected Actor;
- connection warning when actionable;
- compact current-turn facts in Initiative.

Writes only through existing commands:
- DM Actor switch -> existing `selectDmActor`;
- low-frequency leave/end -> existing session stop/leave path.

## MainFocus
Owns no game authority. It renders a projection of current Session context.

Freeform:
- low-noise context;
- current meaningful result summary;
- contextual target chooser only when needed;
- DM empty Encounter CTA when relevant.

Initiative:
- compact current-turn context/economy;
- initiative strip is supplied by existing scene order/current actor facts.

## ActionDock
Reads actions from the existing actor `actionsByActor` projection.

Calls existing `resolveAction(actionId, targetIds)` only after the user has selected the required details/targets.

It must not contain a second action resolver or duplicate legality engine.

## UtilityRail
Owns only which Session tool the user wants to open.

It launches Sheet, Rules, Activity and role-specific tools as layers over the current Session.

## LayerHost
One ordered host for:
1. quick popovers;
2. utility pane/drawer;
3. large workspace such as Full Sheet;
4. transient dice/result/handout presentation;
5. blocking recovery/confirmation.

It must not create separate React roots for normal Session tools.

---

# 4. SessionUiStateProvider ownership

Allowed local UI state:

```text
activeUtility:
  none | quick-sheet | rules | activity |
  actor | encounter | participants | handout | session

workspaceLayer:
  none | full-sheet

interaction:
  idle |
  { intentId } |
  { intentId, actionId } |
  { intentId, actionId, selectedTargetIds[] }

presentation:
  panel/drawer layout preference for current viewport only

restoreContext:
  launcher focus id
  main-focus scroll position
  sheet internal page/scroll
  rules query/detail
```

This state is ephemeral and may be recreated after a full application restart.

Not allowed in SessionUiStateProvider:
- duplicate Character object;
- mutable HP/resource copy;
- duplicate Scene entity list;
- duplicate action availability/target legality;
- duplicate initiative order;
- duplicate participant/session truth;
- duplicate Resolution ledger or Undo history;
- duplicate handout authority;
- duplicate installed-content inventory.

---

# 5. Snapshot reconciliation rules

UI state is subordinate to authoritative snapshot changes.

On each meaningful snapshot change:

1. If the selected DM Actor still exists, preserve it. Otherwise show the runtime-selected valid Actor.
2. If selected intent/action remains present and `available`, preserve the flow.
3. If the chosen action disappears or becomes unavailable, clear only the invalid action step and explain why.
4. If selected targets remain in `eligibleTargetIds`, preserve them; remove only targets that became invalid.
5. If Session mode changes Freeform <-> Initiative, preserve open Sheet/Rules panes where safe.
6. If the Session ends, clear Session UI state as the root leaves Session Mode.
7. Reconnect does not by itself clear local open-tool state; reconcile it against the recovered authoritative snapshot.

The default is preservation, not reset.

---

# 6. Command routing contract

All mechanics/session commands continue through `useSimpleVtt()` / existing adapters.

Examples:
- action -> `resolveAction`;
- DM actor -> `selectDmActor`;
- initiative -> `startInitiative`, `endInitiative`, `endTurn`;
- combatant -> `instantiateCombatant`, `removeCombatant`;
- adjudication/Undo -> existing adjudication/Undo commands;
- item operations -> existing item commands;
- Host/Join/Stop -> existing session commands.

The Session Shell may coordinate these commands but may not bypass them with direct domain mutation.

---

# 7. Presentation routing contract

Presentation-only effects are app/session-level layers.

### Dice
All Sheet/Action rolls use one body/app-level presentation path. A Sheet does not allocate a dice layout region.

### Combat VFX
Existing VFX remains presentation-only and cannot replace authoritative results.

### Handout
Existing handout state/transport remains the source for reveal/dismiss/reopen/reconnect presentation. The new UI changes launch/view surfaces, not protocol authority.

### Resolution
`AppSnapshot.resolution` remains the mechanics projection. The new Result layer may replace the visual drawer but not the data source or progression commands.

---

# 8. Routing migration

Library routes remain valid only for out-of-session work.

During Session Mode:
- `character` route -> replaced by Quick/Full Sheet layers;
- `catalog` route -> replaced by in-session Rules pane;
- `activity` route -> replaced by Activity drawer;
- `combatants`/Encounter page -> replaced by DM Encounter pane;
- `session` route -> replaced by Session share/settings drawer;
- `scene` is no longer conceptually one peer route among Library pages; SessionModeRoot is the app-level shell.

Deep Library management such as Character build edit, Content management or global Settings may require an explicit Session-exit or clearly marked advanced flow; they are not normal Session navigation.

---

# 9. Focus/back contract

`LayerHost` owns global Session Escape/back behavior.

Priority:
1. blocking confirmation/recovery;
2. transient detail if dismissible;
3. Rules opened over Full Sheet;
4. Full Sheet;
5. utility pane;
6. quick popover;
7. current Action Dock step.

One Escape closes/backtracks one step only.

Session end/leave is never an ordinary Escape effect.

On close, focus returns to the launcher that opened the layer where possible.

---

# 10. Component acceptance checklist

Before S-00 implementation is accepted:

- SessionModeRoot replaces route-centric Play while a session is active.
- Host enters active DM Session UI immediately after Host succeeds.
- AppProvider/runtime adapters remain the only game/session command authority.
- Session UI state contains no duplicated Character/Scene/Resolution/session truth.
- SessionBar/MainFocus/ActionDock/UtilityRail/LayerHost are separable components with explicit responsibilities.
- Sheet/Rules/Activity/Encounter open without unmounting SessionModeRoot.
- snapshot change invalidates only UI selections that actually became invalid.
- reconnect does not force Lobby/Ready/Start or blanket UI reset.
- Escape closes one top layer/interaction step.
- body-level presentation layers do not resize Sheet/MainFocus.

---

# 11. First implementation walking skeleton

The first source slice after planning approval should contain only:

1. AppRoot Library vs Session mode selection;
2. mounted SessionModeRoot frame;
3. SessionBar identity;
4. empty/low-noise MainFocus placeholder backed by real snapshot;
5. minimal UtilityRail;
6. LayerHost;
7. one-click Quick Sheet open/close with context preservation.

Do not add full Action Dock mechanics, Initiative redesign, Encounter redesign or Handout redesign to this first slice. The first acceptance question is whether the persistent Session architecture is correct.