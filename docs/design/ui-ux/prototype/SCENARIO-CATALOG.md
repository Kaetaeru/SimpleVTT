# UI Reference Prototype — Scenario Catalog

Status: **Required prototype review scenarios**

The future HTML Reference Prototype must allow the owner to load these named scenarios from Prototype Controls.

A scenario is a deterministic mock state used to review layout and interaction. It does not implement authoritative gameplay/network behavior.

Every future scenario trigger SHOULD use `data-proto-scenario="PROTO-SCN-*"`.

---

# Core product scenarios

## PROTO-SCN-01 — First launch

Start:

- fresh local product context;
- no tutorial preference stored.

Show:

1. first-run guide;
2. product purpose/orientation;
3. initial Character Sheet style choice: Official-style vs SimpleVTT;
4. dismiss into Home.

Review:

- does onboarding explain product without being a long wizard?
- can it be reopened later from Settings/help?

---

## PROTO-SCN-02 — Home with saved Characters

Show:

- normal global navigation;
- Characters summary/recent Character example;
- Host Session and Join Session direct actions;
- Content/Rules/Settings access.

No live session exists, so Return to Play is absent.

---

## PROTO-SCN-03 — Character Library and two Sheet styles

Flow:

1. Character Library;
2. open same mock Character in Official-style Sheet;
3. switch to SimpleVTT-optimized Sheet;
4. return to Library.

Review:

- both layouts feel first-class;
- same Character identity/data is recognizable;
- layout switch is obvious but not dominant.

---

## PROTO-SCN-04 — Standalone Character roll

Context: Offline/Standalone; no DM/Player role.

Flow:

1. Character Sheet;
2. activate mock roll control;
3. central/local dice presentation example;
4. result shown near Sheet interaction;
5. return to same Sheet.

No real dice rules are calculated.

---

# Session entry scenarios

## PROTO-SCN-05 — Host opens immediately-live session

Flow:

1. Home -> Host Setup;
2. valid mock setup;
3. Open Session;
4. transition directly to Host/DM Freeform Play.

Must NOT show:

- Host Lobby;
- Ready gate;
- Start Session button after hosting.

Show zero connected Players as valid.

Review:

- DM can understand that session is already live;
- preparation/edit tools feel available without leaving Play.

---

## PROTO-SCN-06 — Join blocked: no Character

Flow:

1. Home -> Join;
2. valid session target entered;
3. no valid saved Character;
4. Join blocked;
5. clear Create Character / Import Character recovery actions.

Must not show a Character-less session/lobby entry.

---

## PROTO-SCN-07 — Player joins mid-session

Flow:

1. live Host session already exists;
2. Client Join Setup;
3. Character Select;
4. connecting state;
5. enter current live Player Freeform Play.

Review:

- no all-player Ready ceremony;
- transition explains current live context;
- Player identity/controlled Actor is immediately understandable.

---

# Freeform Play scenarios

## PROTO-SCN-08 — DM Freeform baseline

Show:

- upper opposing Actor Board;
- central Scene/Table;
- lower allied Actor Board;
- bottom Command Center;
- DM Public visibility control;
- contextual utility launchers;
- no utility pane open.

Review overall composition at Wide/Normal/Narrow.

---

## PROTO-SCN-09 — Player Freeform baseline

Same core skeleton as DM view, but:

- no DM-only controls;
- controlled Character/Actor is clear;
- Player connection utility exists;
- only authorized information shown.

---

## PROTO-SCN-10 — DM Activity + DM Only

Context:

- DM Freeform;
- DM visibility = DM Only;
- Activity pane open.

Show:

- persistent `DM Only` indicator/NOTICE;
- Activity combined chronology;
- public and private events visibly distinct;
- filter controls.

Review whether Scene/Command Center remain usable while Activity is open.

---

## PROTO-SCN-11 — Same private event in Player view

Use the same underlying mock session fixture as `PROTO-SCN-10`, but render Client/Player view.

Player must see:

- public events only;
- **no placeholder or secret-event marker** for DM-only event.

This visually validates the intended privacy UX without implementing network delivery.

---

# Action / targeting scenarios

## PROTO-SCN-12 — Capability selected / valid and invalid targets

Context: Player Initiative.

Show:

- selected Hotbar capability;
- all Actor Cards visible;
- two valid targets;
- one invalid target with supplied reason;
- rich hover/focus explanation.

Review:

- valid vs invalid vs selected vs current-turn states are distinct;
- invalid reason is understandable;
- target mode does not hide unrelated Actors.

---

## PROTO-SCN-13 — Single-target execute

Flow:

1. single-target action selected;
2. click mock valid target;
3. transition directly to Resolving.

No extra confirmation.

---

## PROTO-SCN-14 — Multi-target execute

Flow:

1. multi-target action selected;
2. select several valid targets;
3. explicit Execute appears;
4. Execute -> Resolving.

---

## PROTO-SCN-15 — Default hostile click / Main Hand unavailable

Two toggle variants:

A. mock canonical Main Hand executable action exists;
B. mock says Main Hand action unavailable with explicit reason.

In B:

- show reason;
- do not choose offhand/unarmed/spell/cantrip fallback.

The prototype does not determine availability; the fixture supplies it.

---

# Resolution scenarios

## PROTO-SCN-16 — Resolving with selective locking

Show:

- Command Center skeleton remains;
- submitted capability visibly pending/resolving;
- fixture marks only a small set of controls as conflicting/disabled;
- unrelated mock-safe controls remain visually usable.

Explicitly label this as presentation fixture behavior because real safe-command semantics remain `GAP-RESOLUTION-SAFE-INTERACTIONS`.

---

## PROTO-SCN-17 — Reaction / Interrupt

Show:

- Initiative context still visible;
- reaction prompt gets attention priority;
- relevant responder Actor context remains visible;
- no invented countdown unless explicitly set as a visual-only fixture.

---

## PROTO-SCN-18 — Concentration response

Show resolution-embedded mock d20 response/result UI.

Review:

- required response is easy to find;
- Command Center/Scene orientation is preserved;
- failure/validation example is understandable.

---

## PROTO-SCN-19 — Dice and result

Flow:

1. authoritative mock result already exists;
2. dice visual starts far/back and moves near/front conceptually;
3. settles to fixture-provided final face;
4. scene-integrated result strip appears;
5. Activity detail available.

Toggle Reduced Motion and verify information/order remains understandable.

---

# Initiative scenarios

## PROTO-SCN-20 — Player own turn

Show:

- top Initiative Tracker;
- current turn;
- controlled Actor;
- Command Center economy/resources;
- End Turn.

Actor Boards remain visible.

---

## PROTO-SCN-21 — Player off turn

Show:

- current turn belongs to another Actor;
- Player-controlled Actor remains distinguishable;
- mock availability states are fixture-driven;
- no UI rule inference.

---

## PROTO-SCN-22 — DM Initiative / Actor control switch

Show DM switching current controlled Actor context without confusing:

- current turn;
- selected Actor;
- targeting state.

Exact authority is already DM-any-Actor at Product level; detailed command semantics remain external.

---

# Handout scenarios

## PROTO-SCN-23 — Handout Overlay

DM reveals Overlay.

Player:

- sees overlay;
- locally dismisses/minimizes;
- can reopen while mock shared mode remains active.

---

## PROTO-SCN-24 — Handout Upper Scene

Show how upper Scene presentation changes while Actor Boards/Command Center remain understandable.

Player cannot locally dismiss the shared mode.

---

## PROTO-SCN-25 — Handout Full Scene

Show dominant handout presentation with local zoom/pan and persistent live-session continuity.

Review at Narrow Desktop.

---

# DM utility scenarios

## PROTO-SCN-26 — Encounter + advanced spatial relation

Flow:

1. DM Freeform;
2. open Encounter pane;
3. open advanced spatial relation tool when needed;
4. select mock Actor pair;
5. show mock distance/visibility/cover fields;
6. close/return without losing Play context.

The tool is advanced/contextual, not a permanent Play anchor.

---

## PROTO-SCN-27 — Correction / reversal history

Activity contains:

1. original committed mock event;
2. later correction/reversal event referencing it.

Must demonstrate:

- original remains visible;
- correction is a new event;
- relation is understandable;
- no destructive deletion of history.

---

# Content scenarios

## PROTO-SCN-28 — Package import validation

Toggle:

- valid official SimpleVTT package;
- warning;
- blocking validation;
- unsupported file/package.

Prototype parses no real package semantics; fixtures provide validation results.

---

## PROTO-SCN-29 — Full add-on lifecycle

Show installed package controls:

- update;
- replace;
- disable/enable;
- delete/remove;
- dependency warning example.

Confirmation/detail defaults may be AI-designed; domain dependency semantics are fixture-provided.

---

## PROTO-SCN-30 — Live content snapshot

Context:

- session already live with snapshot `A`;
- local content library now has update `B`.

Show:

- current session remains on `A`;
- library may show updated/future state;
- NOTICE/Session Share explains changes apply to future sessions;
- no live mutation occurs.

---

# Recovery / responsive scenarios

## PROTO-SCN-31 — Reconnecting while Full Sheet is open

Show:

- Full Sheet remains visible;
- persistent reconnect NOTICE appears;
- session context is not wiped;
- recovery controls are understandable.

---

## PROTO-SCN-32 — Narrow desktop stress test

Viewport: 960×700.

Show:

- Player Initiative;
- many Actor Cards;
- Activity/utility pane open;
- Command Center visible;
- Actor Board horizontal paging/scroll;
- no generic mobile hamburger replacing core action access.

---

## PROTO-SCN-33 — Panel resize stress test

DM Freeform:

- resize Activity/utility pane;
- observe Scene/Table minimum;
- observe Actor Board/Command Center behavior;
- use Reset Layout.

---

## PROTO-SCN-34 — Component state gallery

Prototype-only scene showing common components in all relevant states side by side.

Required for fast visual consistency review.

---

# Scenario acceptance rule

A scenario passes only if:

- the intended hierarchy is obvious without reading design docs;
- relevant role differences are visible;
- applicable layer coexistence works;
- narrow desktop remains usable where required;
- mock technical truth is clearly fixture-driven rather than calculated;
- no current production implementation quirk silently overrides Reviewed planning;
- owner can point to a visible element and describe a change in plain language.