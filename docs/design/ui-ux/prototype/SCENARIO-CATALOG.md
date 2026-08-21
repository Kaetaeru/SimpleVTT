# UI Reference Prototype — Scenario Catalog

Status: **Required prototype review scenarios — reconciled to Integrated Product / UX baseline**

Baseline: [`../INTEGRATED-PRODUCT-UX-PLAN.md`](../INTEGRATED-PRODUCT-UX-PLAN.md)

Rebuild contract: [`PROTOTYPE-REBUILD-CONTRACT.md`](PROTOTYPE-REBUILD-CONTRACT.md)

A scenario is a deterministic mock state used to review layout and interaction. It does not implement authoritative gameplay/network behavior.

Every future scenario trigger SHOULD use `data-proto-scenario="PROTO-SCN-*"`.

Global rules for every Connected Play scenario:

```text
MAPLESS CORE
NO Actor x/y coordinates
NO map tokens
NO square/hex grid
NO path / movement trace / Fog of War / LoS geometry
NO tactical range/AoE template
Actor targeting uses Actor Cards/manual target sets
Handout is presentation, not battlemap
```

---

# Core product scenarios

## PROTO-SCN-01 — First launch Tutorial

This is the **default fresh-run scenario and the first meaningful product panel**.

Start:

- fresh local product context;
- Tutorial incomplete;
- initial Sheet presentation unset.

Show:

1. dedicated Tutorial / Onboarding window;
2. SimpleVTT identity and two valid use modes:
   - Standalone Character Sheet at a physical table;
   - Connected Host/Join Session;
3. initial Character Sheet presentation choice:
   - Official-style;
   - SimpleVTT;
4. brief Character / Host / Join orientation;
5. secondary Content / Rules orientation;
6. clear explanation that Sheet presentation can be changed later;
7. Complete -> Home.

Review:

- does the product explain itself before normal Home use?
- is the Sheet choice unmistakably part of first-run onboarding?
- is it short enough not to become a long wizard?
- can Tutorial be reopened later from Settings/Help?

A Home guide card alone does not satisfy this scenario.

---

## PROTO-SCN-02 — Returning Home

Start:

- Tutorial already complete;
- no live Session.

Show:

- top global navigation;
- recent/saved Character summary where useful;
- distinct Host Session action;
- distinct Join Session action;
- Content / Rules / Settings access;
- Tutorial/Help reopen path.

Return to Play is absent because no live Session exists.

---

## PROTO-SCN-03 — Character Library and two Sheet presentations

Flow:

1. Character Library;
2. select an exact mock Character card;
3. open that same canonical Character in Official-style Sheet;
4. switch to SimpleVTT Sheet;
5. return to Library.

Review:

- exact selected Character opens;
- both layouts feel first-class;
- both clearly represent the same Character;
- layout switch is easy to find but not mechanically meaningful.

---

## PROTO-SCN-04 — Standalone Character roll on the current Sheet

Context: Offline/Standalone; no DM/Player role.

Flow:

1. Character Sheet is mounted and visible;
2. activate a skill/save/Initiative/attack/damage/common-die mock control;
3. temporary cinematic dice appear over/within the **same Sheet viewport**;
4. dice move from visual depth/back toward the user and settle;
5. fixture/local result becomes readable in the same Sheet context;
6. transient dice/result clears automatically;
7. exact same Sheet remains mounted and usable.

Must NOT:

- navigate to a Resolution page;
- open a detached dice/result modal, drawer or window;
- insert a persistent dice stage that pushes Sheet layout;
- require Close/Back merely to resume the Sheet.

No real rules are calculated by prototype JavaScript.

---

# Session entry scenarios

## PROTO-SCN-05 — Host opens immediately-live Session

Flow:

1. Home / Session -> Host Setup;
2. valid mock setup;
3. Open Session;
4. transition directly to Host/DM Freeform Play.

Must NOT show:

- Host Preparing waiting state;
- Player Ready dependency;
- Start Session gate after hosting.

Show zero connected Players as valid.

Review:

- Session is clearly already live;
- DM can prepare/edit/play from the same live context.

---

## PROTO-SCN-06 — Join blocked: no Character

Flow:

1. Home / Session -> Join;
2. valid connection target entered;
3. no valid local Character;
4. Join blocked;
5. Create Character / Import Character recovery actions;
6. after recovery, user must retry Join.

Must not enter a Character-less Lobby or live session.

---

## PROTO-SCN-07 — Player joins an already-live Session

Flow:

1. live Host session already exists;
2. Client Join Setup;
3. Character Select;
4. connection/content/Character synchronization state when needed;
5. enter the current live Client/Player state.

Review:

- no Ready ceremony;
- no Start gate;
- current Session mode/context is understandable;
- Player-controlled Character is immediately clear.

---

# Mapless Freeform scenarios

## PROTO-SCN-08 — DM Freeform baseline

Show:

- compact Play chrome/status;
- upper NPC/Neutral/Hostile Actor Board;
- central **Mapless Play Context / Tabletop Stage**;
- lower Player/Allied Actor Board;
- persistent bottom Command Center;
- DM Public/DM Only control where applicable;
- contextual utility launchers;
- no utility pane open;
- zero Players variant.

Central context may show subtle tabletop depth/texture, current focus copy or immediate interaction state, but contains:

- no tactical map;
- no Actor tokens;
- no Actor positions;
- no grid/terrain/path/LoS/fog.

Freeform must not show fake per-turn Action/Bonus/Reaction/Movement spend state.

Review at Wide / Normal / Narrow Desktop.

---

## PROTO-SCN-09 — Player Freeform baseline

Same core mapless skeleton as DM view, but:

- no DM-only controls;
- Player-controlled Character is clear;
- Player connection/session utility exists;
- only authorized information shown;
- no fake Freeform turn economy.

---

## PROTO-SCN-10 — DM Activity + DM Only

Context:

- DM Freeform;
- DM visibility = DM Only;
- Activity pane open.

Show:

- persistent DM Only indicator/NOTICE;
- one Activity chronology;
- public/private events visibly distinct;
- visibility filters;
- core Actor Boards / mapless context / Command Center remain usable.

---

## PROTO-SCN-11 — Same private event in Player projection

Render Client/Player authorized fixture projection.

Player sees:

- authorized public chronology only;
- no placeholder row;
- no blank secret marker;
- no existence hint for undelivered DM-only event.

This validates presentation intent only; real delivery remains an Architecture Gap.

---

# Mapless targeting scenarios

## PROTO-SCN-12 — Capability selected / valid and invalid Actor Cards

Context: Player Initiative.

Show:

- selected Hotbar capability;
- all Actor Cards remain visible;
- two valid targets;
- one invalid target with fixture-provided reason;
- rich hover/focus explanation;
- no map-position targeting.

Review:

- valid / invalid / selected / current-turn states are distinct;
- invalid reason is understandable;
- target mode does not hide unrelated Actors.

---

## PROTO-SCN-13 — Single-target immediate submit

Flow:

1. single-target capability selected;
2. click a valid Actor Card;
3. transition directly to Resolving.

No extra confirmation.

---

## PROTO-SCN-14 — Multi-target / area-like manual target set

Flow:

1. multi-target or area-like capability selected;
2. eligible Actors are represented by Actor Cards/checklist;
3. select several valid Actors;
4. explicit Execute appears;
5. Execute -> Resolving.

Must NOT show:

- AoE map template;
- radius/cone placement;
- grid-cell selection;
- token-position calculation.

---

## PROTO-SCN-15 — Default hostile click / Main Hand unavailable

Two fixture variants:

A. canonical Main Hand executable relation supplied;
B. Main Hand action unavailable with explicit supplied reason.

In B:

- show reason;
- do not select offhand/unarmed/spell/cantrip fallback.

Prototype does not infer availability.

---

# Resolution scenarios

## PROTO-SCN-16 — Resolving with selective locking

Show:

- upper/lower Actor Boards remain;
- mapless context remains recognizable;
- Command Center skeleton remains;
- submitted capability visibly pending/resolving;
- fixture marks only declared conflicting controls unavailable;
- unrelated fixture-safe controls remain visually usable.

Real conflict semantics remain `GAP-RESOLUTION-SAFE-INTERACTIONS`.

---

## PROTO-SCN-17 — Reaction / Interrupt

Show:

- Initiative context remains visible;
- reaction/interrupt response receives focus priority;
- relevant Actor context remains clear;
- Command Center/boards remain recognizable;
- no invented countdown unless explicitly provided as presentation-only fixture.

---

## PROTO-SCN-18 — Concentration response

Show:

- resolution-embedded response/input/result presentation;
- mapless Play orientation retained;
- no UI-derived DC/modifier/legality;
- fixture-provided result/reason.

---

## PROTO-SCN-19 — Connected dice and scene-integrated result

Flow:

1. authoritative mock result already exists;
2. physical dice appear in the broad **mapless Tabletop Stage**;
3. dice travel from depth/back toward user/front and settle;
4. final face/total matches fixture-authoritative result;
5. immediate result appears in current Play context;
6. Activity detail path remains available;
7. Actor Boards and Command Center remain.

Must NOT use Actor positions/map collision as dice gameplay meaning.

Toggle Reduced Motion and verify information/order remains understandable.

---

# Initiative scenarios

## PROTO-SCN-20 — Player own turn

Show:

- compact horizontal Initiative Tracker at mapless context top edge;
- round/current turn;
- controlled Actor distinction;
- authoritative Action/Bonus/Reaction/Movement economy;
- Resource Rail;
- End Turn;
- Actor Boards remain.

---

## PROTO-SCN-21 — Player off turn

Show:

- current turn belongs to another Actor;
- Player-controlled Actor remains distinguishable;
- fixture-driven capability availability;
- no UI rule inference;
- same Play skeleton.

---

## PROTO-SCN-22 — DM Initiative / Actor control mode

Show DM control-change behavior without confusing:

- current turn;
- selected/context Actor;
- targeting state;
- controlled Actor.

Use explicit DM control mode/fixture authority; do not infer map possession/control from token position.

---

# Handout scenarios — presentation, never battlemap

## PROTO-SCN-23 — Handout Overlay

DM reveals a synthetic letter/portrait/illustration.

Player:

- sees Overlay;
- locally dismisses/minimizes;
- can reopen while mock shared mode remains active.

No token/grid/targeting interaction on the Handout.

---

## PROTO-SCN-24 — Handout Upper

Show reviewed upper presentation mode.

- shared DM-controlled presence;
- required Play anchors remain understandable;
- Player cannot locally dismiss shared mode unless the reviewed mode allows only local presentation controls;
- image remains presentation only.

No tactical floor plan/grid filler.

---

## PROTO-SCN-25 — Handout Full

Show dominant shared image presentation within the live Session frame.

- local zoom/pan;
- DM-controlled shared presence;
- no Actor/token placement;
- no tactical targeting;
- required Session/Command continuity retained.

Review at Narrow Desktop.

---

# DM utility scenarios

## PROTO-SCN-26 — Encounter + advanced spatial **fact** tool

Flow:

1. DM Freeform;
2. open Encounter pane;
3. open advanced spatial fact tool when needed;
4. choose mock Actor A / Actor B;
5. show fixture distance / visibility / cover / manual note;
6. close/return without losing Play context.

The tool is a form/list fact editor.

Must NOT include:

- x/y coordinates;
- map/token editor;
- line drawing;
- range rings;
- path/LoS geometry.

---

## PROTO-SCN-27 — Correction / reversal history

Activity contains:

1. original committed mock event;
2. later correction/reversal event referencing it.

Show:

- original remains visible;
- correction is a new linked event;
- relationship is understandable;
- history is not destructively rewritten.

---

# Content scenarios

## PROTO-SCN-28 — Package import validation

Toggle fixture outcomes:

- valid supported SimpleVTT declarative package;
- warning;
- blocking validation;
- unsupported package.

Prototype parses no real package semantics; fixtures provide validation state.

---

## PROTO-SCN-29 — Add-on lifecycle

Show installed package controls:

- update;
- replace;
- disable/enable;
- delete/remove;
- dependency/conflict warning example.

Metadata/provenance stays progressive detail rather than primary card content.

---

## PROTO-SCN-30 — Live content snapshot

Context:

- Session already live with snapshot A;
- local library now has update B.

Show:

- current live Session remains on A;
- local library may show B;
- NOTICE/Session detail explains change applies to future Session;
- no live mutation occurs.

---

# Recovery / responsive scenarios

## PROTO-SCN-31 — Reconnecting while Full Sheet is open

Show:

- Full Sheet remains visible;
- reconnect NOTICE appears;
- Session context is not wiped;
- recovery/leave controls understandable;
- reconnect does not return to a Lobby/Ready state.

---

## PROTO-SCN-32 — Narrow Desktop mapless stress

Viewport: 960x700.

Show:

- Player Initiative;
- many Actor Cards;
- contextual utility pane open;
- Command Center visible;
- Actor Board horizontal scroll/paging;
- central mapless context remains useful;
- no mobile hamburger hiding core capability access;
- no tactical-map fallback.

---

## PROTO-SCN-33 — Utility panel resize stress

DM Freeform:

- resize Activity/utility pane;
- preserve minimum useful **mapless Play Context**, not a minimum battlemap size;
- preserve Actor Board minimum card width/overflow;
- preserve Command Center usability;
- Reset Layout.

---

## PROTO-SCN-34 — Component / state gallery

Prototype-only gallery showing common components/states side by side:

- buttons;
- Actor Card states;
- Hotbar slots;
- economy/resource states;
- NOTICE/error/reconnect;
- tooltip/rich hover;
- result/dice visual primitives;
- Tutorial choice controls;
- Handout controls.

No component sample may imply map/token functionality.

---

# Scenario acceptance rule

A scenario passes only if:

- intended hierarchy is obvious without reading design docs;
- first-run Tutorial requirement is honored where applicable;
- mapless Core is visually obvious in Connected Play;
- no Actor tactical coordinates/tokens are required;
- relevant role differences are visible;
- applicable layer coexistence works;
- narrow desktop remains usable where required;
- mock technical truth is clearly fixture-driven rather than calculated;
- Standalone dice never detach the user from the current Sheet;
- historical `.agents` plans, old demos, current code or stale tests do not silently override current Domain/Decision truth;
- owner can point to a visible element and describe a change in normal language.
