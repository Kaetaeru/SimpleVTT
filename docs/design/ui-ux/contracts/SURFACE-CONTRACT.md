# SimpleVTT Surface Contract

Status: **Derived from accepted integrated reference; runtime-preparation authority; not Frozen**

Accepted reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

This contract defines the required product surfaces and their coexistence rules. It intentionally avoids prescribing production component architecture or Domain/Network implementation.

---

# 1. Product surface taxonomy

Every user-facing surface belongs to one of four classes.

## A. Global Product destinations

Stable top-level Product Shell destinations:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

These are navigation destinations.

## B. Dedicated operational workspace

```text
Connected Play
```

Play is a specialized live workspace inside the same product identity. While a live session exists, safe Product destinations expose `Return to Play`.

## C. Contextual live-session surfaces

Examples:

- Activity;
- Encounter;
- Participants;
- Session utility;
- Rules lookup;
- advanced DM spatial facts;
- Quick Sheet;
- adjudication/correction tools.

These do not become global navigation destinations and should preserve live Play context.

## D. Transient presentation/layers

Examples:

- first-run Tutorial;
- Standalone dice/result presentation;
- Full Character Sheet layer in live Play;
- Handout Overlay/Upper/Full;
- reaction/concentration response;
- connected dice/result;
- confirmation;
- tooltip/context menu.

These are not independent product apps/routes unless another contract explicitly says otherwise.

---

# 2. First launch / Tutorial

## Required first-run flow

```text
App boot/hydration
-> first-use check
   -> tutorial incomplete: Tutorial / Onboarding first
   -> tutorial complete: Home
-> returning user: Home
```

The first meaningful panel on fresh use is the Tutorial.

## Tutorial content contract

Tutorial must contain:

1. SimpleVTT product identity as a tabletop companion;
2. Standalone Character use;
3. Connected Host/Join use;
4. initial Character Sheet presentation choice:
   - Official-style;
   - SimpleVTT;
5. explanation that Sheet presentation can be changed later;
6. short orientation to Character, Host and Join;
7. completion action leading to Home.

Tutorial must be reopenable later from Settings and/or Help/Info.

The normal Home surface must not substitute for first-run Tutorial.

---

# 3. Product Shell

## Navigation

Use one common top navigation model:

```text
Home
Characters
Session
Content
Rules
Settings
```

Do not implement a permanent left application sidebar as the primary global IA unless a later Owner decision changes this contract.

## Live-session continuity

When a live session exists:

- Product Shell destinations may still be inspected where safe;
- authoritative session/game state is preserved;
- a visible `Return to Play` control exists;
- returning to Play restores the same connected role and session context.

Navigation alone must not convert Host/DM to Player or reset the session mode/turn/resolution state.

---

# 4. Home

Home is an orientation and entry surface.

Primary actions:

- open Character Library;
- create Character;
- Host Session;
- Join Session.

Host and Join are separate first-class actions.

Secondary access:

- Content;
- Rules;
- Settings/Help/Tutorial.

Home may show recent Characters or bounded useful health/status, but it must not become a protocol/debug/status dashboard.

Do not lead with:

- raw session IDs;
- internal role/protocol state;
- package hashes;
- Activity feed;
- developer/debug information.

---

# 5. Character Library

Character Library is the Character-management hub.

Required capabilities:

- list/open Character;
- create;
- import;
- edit;
- level-up;
- portrait/identity presentation;
- enter Standalone Sheet.

Opening a Character must open the exact selected canonical Character.

Official-style and SimpleVTT Sheet layouts are presentation variants of the same Character, not separate Character data models.

---

# 6. Character Create / Edit / Level Up

These surfaces preserve the existing canonical Character authoring/progression workflows.

Broad UI work may harmonize visual design but must not replace the underlying product model with an invented UI-owned rules wizard.

Required behavioral family:

- dynamic Character creation plan/draft;
- autosaved/recoverable drafting where supported by canonical contracts;
- only real user choices requested;
- deterministic grants handled by authoritative logic;
- visible validation and recovery;
- Level Up uses preview/choice/validation/commit progression semantics.

The exact rules schema remains Domain authority.

---

# 7. Standalone Character Sheet

Two first-class presentation modes:

## Official-style

Uses paper-sheet-like information architecture while remaining original SimpleVTT UI.

## SimpleVTT

Uses a digital optimized hierarchy around identity, current state, direct rolls/actions and resources.

Both must work without a connected Session.

## Same-Sheet roll contract

Any ordinary roll launched from the Standalone Sheet stays on the current Sheet.

Examples:

- ability/skill check;
- save;
- Initiative;
- attack;
- damage/healing where supported;
- feature/resource roll;
- common dice.

Required presentation:

```text
Current Sheet remains mounted and visible
-> roll is invoked
-> transient physical dice appear over/within current Sheet viewport
-> dice settle to the local/authoritative result
-> compact result appears in the same Sheet context
-> transient presentation clears
-> exact same Sheet remains
```

Forbidden for routine Sheet rolls:

- new route;
- modal roll workflow;
- drawer;
- detached dice/result window;
- persistent layout-pushing dice tray;
- mandatory Close/Back just to continue the Sheet.

---

# 8. Session destination

The Session destination presents two separate flows.

## Host Session

Required flow:

```text
Host Setup
-> Open Session
-> Host = DM
-> immediately live Freeform Play
```

There is no normal long-lived:

- Lobby;
- Ready gate;
- Start Session gate;
- Host Preparing waiting screen.

Zero Players is a valid live DM session.

## Join Session

Required flow:

```text
Join Setup
-> Host connection information
-> choose valid local Character
-> required connection/content/Character synchronization
-> Client = Player
-> enter current live Session mode
```

If no valid Character exists:

- block Join;
- expose Create / Import recovery;
- require a new Join attempt after recovery.

Do not invent fake invite-code infrastructure unless the real transport contract supports it.

---

# 9. Connected Play — core composition

Connected Play is **mapless Core**.

Required stable structure:

```text
Compact Play chrome / connection/session status
──────────────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
──────────────────────────────────────────────
Shared Play Context / Tabletop Stage      [contextual utility pane]
──────────────────────────────────────────────
Lower Player / Allied Actor Board
──────────────────────────────────────────────
Persistent Command Center
```

The central Play Context is not a tactical map.

It may present:

- current interaction/focus;
- selected action/target guidance;
- PendingResolution;
- reaction/concentration response;
- NOTICE/reconnect state;
- dice;
- immediate result;
- Handout presentation;
- non-mechanical tabletop/atmospheric background.

It must not contain Core:

- Actor x/y positioning;
- draggable map tokens;
- square/hex grid;
- tactical floor plan/terrain;
- movement/path UI;
- Fog of War;
- LoS geometry;
- map-derived range/AoE visualization;
- minimap/camera control.

---

# 10. Actor Boards

## Upper board

Contains NPC / Neutral / Hostile Actor Cards.

## Lower board

Contains Player-controlled / Allied Actor Cards.

Actor Cards may show authorized/useful:

- portrait/identity;
- name;
- relation;
- HP/Temp HP;
- status/conditions;
- controlled state;
- current-turn state;
- selected/context state;
- target valid/invalid/selected state.

Actor Cards are list/board objects, not positioned tokens.

When density increases:

- preserve minimum usable card width;
- use horizontal overflow/paging/scroll before over-compressing the cards.

---

# 11. Freeform

Freeform uses the same Connected Play skeleton.

There is no active turn model by default.

Therefore do not present Action/Bonus/Reaction/Movement as though they are currently being consumed per turn.

Persistent Command Center remains because normal capabilities must remain directly discoverable.

Resource/cost information may still be shown truthfully where meaningful.

---

# 12. Initiative

Initiative is a state of the same Play workspace, not a separate combat screen.

Add:

- round/current-turn state;
- compact horizontal Initiative Tracker at the top edge of Play Context;
- authoritative Action / Bonus Action / Reaction / Movement economy;
- End Turn when appropriate;
- current-turn emphasis.

Retain:

- upper Actor Board;
- central Play Context;
- lower Actor Board;
- persistent Command Center;
- current contextual utility where compatible.

---

# 13. Command Center

The persistent bottom Command Center is co-primary with Scene/Actor context.

Required structure:

## Upper compact row

- meaningful Initiative economy when active;
- Resource Rail.

## Lower-left

- controlled Actor portrait/identity;
- HP/Temp HP;
- important status/concentration state.

## Larger action region

- Hotbar pages/slots;
- normal capability discovery;
- selected/unavailable/resolving presentation;
- contextual Execute / End Turn / Cancel controls.

Baseline page family:

- Mixed;
- Action;
- Spell;
- Item;
- custom pages where supported.

Historical intent-first taxonomy is not the normal primary capability entry.

---

# 14. Targeting / resolution states

Targeting occurs through Actor Cards/manual eligible Actor sets.

## Single target

- all Actor Cards remain visible;
- valid/invalid state appears from authoritative projection;
- invalid reason is supplied by authority;
- clicking one valid target submits immediately;
- no extra routine confirmation.

## Multi target

- eligible Actor Cards remain visible;
- selected targets remain distinct;
- explicit Execute submits the selected target set.

## Area-like capability without map

Use explicit/manual target set or checklist.

Do not create a tactical AoE template.

## Default hostile click

When no action is targeting, combat hostile-click may invoke only the canonical Main Hand executable relation supplied by authoritative application/domain state.

No smart fallback.

---

# 15. Resolution / response / result

Resolution remains inside the same Play workspace.

Preserve:

- Actor Boards;
- Play Context orientation;
- Command Center skeleton.

Only authoritative/contract-declared conflicting interactions may be locked.

Required response states such as Reaction/Interrupt or Concentration appear in the current context rather than replacing the application.

Connected dice use the broad Tabletop Stage as presentation space and settle to already-authoritative results.

Immediate result stays integrated into Play; durable detail lives in Activity.

---

# 16. Contextual utility surfaces

Common family:

- Activity;
- Encounter/Combatants;
- Participants;
- Session Share/Player Session;
- Rules lookup;
- Quick Sheet;
- advanced DM spatial facts;
- adjudication/correction.

Defaults:

- open as contextual pane/layer;
- preserve Play skeleton;
- one primary side utility per dock region;
- internal scrolling belongs to the pane;
- bounded resize may be local presentation state;
- focus returns sensibly when closed.

## Advanced spatial facts

This is a fact editor, not a map editor.

May contain:

- Actor A;
- Actor B;
- distance;
- visibility;
- cover;
- other contract-supplied relation facts.

Must not contain coordinate editing, token dragging, path editor, range rings or LoS drawing.

---

# 17. Quick Sheet / Full Sheet in live Play

## Quick Sheet

Lightweight contextual Character detail while Play remains visible.

## Full Sheet

Large live-session layer over preserved session context.

Required:

- connection/session remains alive;
- turn/resolution state is not reset;
- clear Return/Close restores prior Play context;
- if a higher-priority required response occurs, presentation must allow the response to become visible without losing the user’s Sheet context unnecessarily.

---

# 18. Handout

Handout is shared image presentation, never tactical map state.

Modes:

## Overlay

- overlays current Play context;
- Player may locally dismiss/minimize/reopen;
- shared mode may remain active.

## Upper

- shared DM-controlled presentation occupying the upper presentation region;
- no tactical interaction on image.

## Full

- image becomes dominant within live-session frame;
- DM controls shared mode;
- local zoom/pan is presentation only;
- no Actor placement/targeting/grid on image.

Runtime reconnect/shared semantics depend on `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 19. Activity / privacy

Activity is contextual durable history.

DM view may present:

- chronological public/private entries;
- filters;
- correction/reversal relation;
- disclosure relation;
- progressive detail.

Player view must contain only authorized projections.

For DM-only authoritative events, Player must not receive/render a placeholder, secret marker or existence row before authorized disclosure.

Runtime delivery semantics depend on `GAP-DM-ONLY-DELIVERY-PROTOCOL`.

---

# 20. Content / Rules / Settings

## Content

Represent the supported declarative SimpleVTT content/package model honestly.

Required lifecycle examples:

- installed;
- import/add;
- preview;
- warning;
- blocking/unsupported;
- update;
- replace;
- disable/enable;
- delete;
- live-session snapshot notice.

Do not imply arbitrary runtime executable plugins.

## Rules

Search/browse authoritative composed rules/content catalog.

During Play, contextual Rules lookup should avoid needless workspace abandonment.

## Settings

Own presentation/accessibility preferences such as:

- appearance/theme where supported;
- default Character Sheet presentation;
- Reduced Motion;
- Tutorial/help reopen;
- other real local preferences.

Do not expose prototype fixture/debug controls as product settings.

---

# 21. Responsive surface obligations

Desktop-first v1.

Review family:

```text
Wide       1600x1000
Normal     1366x768
Narrow     960x700
```

These are reference sizes, not necessarily production breakpoints.

At constrained desktop widths:

- preserve Product/Play hierarchy;
- Actor Cards use minimum width + horizontal overflow;
- Command Center remains directly reachable;
- contextual pane may narrow/overlay while remaining desktop-oriented;
- central Play Context may shrink but never becomes a tactical-map/minimap fallback;
- Full Sheet/Handout reflow safely;
- essential controls remain accessible.

Mobile/touch-first redesign is outside v1 scope.

---

# 22. Surface non-goals

This contract does not define:

- runtime React component names;
- exact route implementation;
- CSS architecture;
- exact breakpoints;
- exact pixel sizes;
- backend/network schema;
- target/rules calculations;
- persistence implementation;
- physical dice engine.

Those are separate implementation/domain decisions constrained by this surface behavior.
