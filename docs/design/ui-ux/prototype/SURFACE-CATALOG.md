# UI Reference Prototype — Surface Catalog

Status: **Prototype inventory — reconciled to Integrated Product / UX baseline**

Baseline: [`../INTEGRATED-PRODUCT-UX-PLAN.md`](../INTEGRATED-PRODUCT-UX-PLAN.md)

Rebuild contract: [`PROTOTYPE-REBUILD-CONTRACT.md`](PROTOTYPE-REBUILD-CONTRACT.md)

This catalog defines which product screens, mapless Play contexts, layers and contextual tools the next standalone HTML Reference Prototype must show.

A row here does not create Domain/rules/network truth.

Every prototype surface SHOULD render a stable `data-proto-id` matching the IDs below.

---

# 0. Global surface rule — MAPLESS CORE

No surface in this catalog authorizes a battlemap.

`Scene`, `Tabletop Stage`, `Canvas`, `Play Context` and `Roll Area` mean visual/context space only.

Core surface catalog forbids:

- Actor x/y tactical placement;
- draggable map tokens;
- square/hex grids;
- terrain/path/collision UI;
- movement traces;
- Fog of War;
- LoS rays/cones;
- range circles;
- tactical AoE templates;
- Handout-as-map interaction.

Actors are represented by Actor Boards/cards and manual/authoritative state.

---

# 1. Prototype-only harness

## PROTO-SURF-HARNESS — Prototype Controls

**Product UI:** No.

Purpose:

- switch named scenarios;
- switch Host/DM, Client/Player and Offline review contexts;
- switch Freeform / Initiative / targeting / resolving / interrupt / result states;
- switch Wide / Normal / Narrow Desktop presets;
- toggle connection/Handout/privacy/reduced-motion/error states;
- reset review state.

The harness MUST be outside the intended product viewport and labeled clearly as prototype-only.

The prototype default fresh-run scenario still shows the Product Tutorial first inside the product frame.

---

# 2. First run / Product Shell

| ID | Surface | Required variants | Basis |
| --- | --- | --- | --- |
| `PROTO-SURF-FIRST-RUN` | **Tutorial / Onboarding window** | fresh first run; Official choice; SimpleVTT choice; complete; reopen | NAV-01-07, UI-01-07 |
| `PROTO-SURF-HOME` | Home | returning user; recent Character; offline Host/Join; live Return to Play | NAV-01, UX-03, ORIGIN-FLOW-01 |
| `PROTO-SURF-CHAR-LIBRARY` | Character Library | populated; empty; search/filter; exact selected Character | NAV-01-03, UI-01-07 |
| `PROTO-SURF-HOST-SETUP` | Host Session Setup | normal; validation/open error | ORIGIN-FLOW-01, SES-01-02 |
| `PROTO-SURF-JOIN-SETUP` | Join Setup + Character Select | valid; no-Character block; connection/sync error | ORIGIN-FLOW-02, SES-01-04 |
| `PROTO-SURF-CONTENT` | Content / Add-ons | installed; empty; update; disabled; live-snapshot note | CONTENT-02-04, CONTENT-02-09, CONTENT-02-11 |
| `PROTO-SURF-CONTENT-IMPORT` | Package Import Review | valid; warning; blocking; unsupported | CONTENT-02-04 + content contracts |
| `PROTO-SURF-RULES` | Rules Browser | search; results; detail; no results | NAV-01-04 + rules contracts |
| `PROTO-SURF-SETTINGS` | Settings | appearance; Sheet default; Reduced Motion; tutorial reopen | NAV-01-04, NAV-01-07 |

## PROTO-SURF-FIRST-RUN hard behavior

The first-run Tutorial is the **first meaningful product panel** on fresh state.

It must include:

- Standalone vs Connected explanation;
- Official-style vs SimpleVTT initial Sheet choice;
- Character Create/Open orientation;
- Host Session orientation;
- Join Session orientation;
- secondary Content / Rules orientation;
- clear completion into Home;
- later reopen path.

A Home guide card by itself does not satisfy this surface.

---

# 3. Character surfaces

| ID | Surface | Required variants | Basis |
| --- | --- | --- | --- |
| `PROTO-SURF-CHAR-SHEET-OFFICIAL` | Official-style Standalone Character Sheet | normal; same-Sheet roll; long content; narrow | UX-03-05, UI-01-07, Character Sheet contract |
| `PROTO-SURF-CHAR-SHEET-SVTT` | SimpleVTT Standalone Character Sheet | normal; same-Sheet roll; resource-heavy; narrow | UX-03-05, UI-01-07 |
| `PROTO-SURF-CHAR-BUILDER` | Character Create/Edit | current accepted canonical authoring flow; validation; preview | UI-01-08 + Character authoring contracts |
| `PROTO-SURF-LEVEL-UP` | Level Up | current accepted canonical progression flow; choice; validation; commit | UI-01-08 + Character lifecycle |

## Standalone roll state is not a destination

`PROTO-SURF-STANDALONE-ROLL` is a **transient state of the current Character Sheet**, not a separate page/window.

Required:

- current Sheet stays mounted/visible/stable;
- dice animate over/within current Sheet viewport;
- result stays in current Sheet context;
- transient presentation clears automatically;
- no routine Close/Back-to-Sheet action.

---

# 4. Connected Play surfaces — MAPLESS

The next prototype MUST treat Play as a mapless Actor/action/resolution workspace.

## Shared structural skeleton

```text
Compact Play chrome / Session status
Upper NPC / Neutral / Hostile Actor Board
Mapless Play Context / Tabletop Stage      [contextual utility when open]
Lower Player / Allied Actor Board
Persistent Command Center
```

The central area contains no tactical Actor placement.

## PROTO-SURF-PLAY-DM-FREEFORM — Host/DM Freeform

Required:

- same shared Play skeleton;
- Host=DM presentation;
- upper opposing Actor Board;
- central **Mapless Play Context / Tabletop Stage**;
- lower allied Actor Board;
- persistent Command Center;
- zero Players valid;
- immediate-live session state;
- contextual DM utilities;
- persistent DM roll visibility control when applicable;
- no fake turn economy;
- no Lobby/Ready UI.

## PROTO-SURF-PLAY-PLAYER-FREEFORM — Client/Player Freeform

Required:

- same core skeleton;
- Player-controlled Character identity;
- no DM-only controls/data;
- mapless Actor targeting/context;
- truthful Freeform capability/resource presentation;
- session/reconnect utility.

## PROTO-SURF-PLAY-DM-INITIATIVE — Host/DM Initiative

Adds to the same mapless Play skeleton:

- compact horizontal Initiative Tracker at central context top edge;
- round/current turn;
- DM Actor-control context;
- authoritative turn economy;
- End/Next Turn controls where applicable.

Actor Boards and Command Center remain.

## PROTO-SURF-PLAY-PLAYER-INITIATIVE — Client/Player Initiative

Adds:

- current-turn/off-turn distinction;
- controlled Actor distinction;
- authoritative economy when relevant;
- End Turn where appropriate;
- target/selected-action/reaction examples.

Actor Boards and Command Center remain.

---

# 5. Mapless action / targeting / resolution variants

These are states of Play, not destinations.

| ID | Variant | Must demonstrate | Basis / blocker |
| --- | --- | --- | --- |
| `PROTO-SURF-PLAY-TARGET-SINGLE` | selected single-target capability | all Actor Cards visible; valid/invalid reason; valid click -> immediate submit | ORIGIN-UX-01-19, ORIGIN-UX-01-20 |
| `PROTO-SURF-PLAY-TARGET-MULTI` | multi-target capability | manual Actor-card target set; explicit Execute | ORIGIN-UX-01-20, mapless Domain targeting |
| `PROTO-SURF-PLAY-AREA-MANUAL` | area-like capability without map | checklist/manual eligible Actor set; no AoE shape/template | session-runtime + rules targeting |
| `PROTO-SURF-PLAY-DEFAULT-ATTACK` | hostile Actor default click | fixture-provided canonical Main Hand relation; unavailable reason; no fallback | ORIGIN-UX-01-17, ORIGIN-UX-01-18, GAP-MAIN-HAND-CANONICAL-RELATION |
| `PROTO-SURF-PLAY-RESOLVING` | active authoritative resolution | same Play skeleton; only fixture-declared conflicts locked | ORIGIN-UX-01-21, GAP-RESOLUTION-SAFE-INTERACTIONS |
| `PROTO-SURF-PLAY-INTERRUPT` | reaction/interrupt pending | focused response + surrounding Play orientation | Domain Resolution contract |
| `PROTO-SURF-CONCENTRATION` | concentration response | response input/result example; no UI-derived rules values | R4-CONCENTRATION-SAVE |
| `PROTO-SURF-PLAY-DICE` | connected physical dice | broad **mapless** central tabletop presentation space; authoritative face/total | ORIGIN-UX-01-22A through ORIGIN-UX-01-25 |
| `PROTO-SURF-PLAY-RESULT` | immediate result | in-context result + Activity detail path | ORIGIN-UX-01-22 |

No targeting variant uses Actor map positions.

---

# 6. Actor Board / Command Center surfaces

## PROTO-SURF-ACTOR-BOARDS

Must demonstrate:

- upper opposing/neutral cards;
- lower allied/player cards;
- controlled/current-turn/selected/valid/invalid/target-selected state distinctions;
- long names;
- many Actors;
- minimum usable width;
- horizontal overflow/paging.

Cards are not map tokens.

## PROTO-SURF-COMMAND-CENTER

Must demonstrate:

- compact resource/economy upper row;
- controlled Actor status lower-left;
- larger Hotbar/action area lower/right;
- Mixed / Action / Spell / Item / custom page examples;
- direct capability discoverability;
- unavailable reason via hover/focus;
- contextual Execute / End Turn / Cancel;
- Freeform vs Initiative truthful economy difference.

Historical intent-first funnel is not the primary normal capability access model.

---

# 7. Contextual live-session surfaces

| ID | Surface | Presentation role | Required variants |
| --- | --- | --- | --- |
| `PROTO-SURF-QUICK-SHEET` | Quick Sheet | lightweight Character detail over preserved Play | normal; narrow |
| `PROTO-SURF-FULL-SHEET` | Full Character Sheet layer | large live-session Sheet layer | Official/SVTT; return to exact Play context |
| `PROTO-SURF-RULES-LOOKUP` | Session Rules lookup | contextual search/detail | DM; Player |
| `PROTO-SURF-ACTIVITY` | Activity / Play Record | contextual durable chronology | DM public/private/filter; Player authorized-only; correction chain |
| `PROTO-SURF-ENCOUNTER` | Encounter Manager | contextual DM management | empty; populated; Initiative relationship |
| `PROTO-SURF-PARTICIPANTS` | Participants | contextual DM session utility | zero; joined; late join |
| `PROTO-SURF-SESSION-SHARE` | Session Share | Host utility | address/info; snapshot status |
| `PROTO-SURF-PLAYER-SESSION` | Player Session utility | connection/rejoin/leave | connected; reconnecting; disconnected |
| `PROTO-SURF-DM-SPATIAL` | Advanced spatial **fact** editor | DM-only contextual facts | Actor pair; distance; visibility; cover; validation |
| `PROTO-SURF-ADJUDICATION` | DM adjudication/correction | resolution/history correction | preview; correction/reversal; prior event remains |

## `PROTO-SURF-DM-SPATIAL` hard rule

This is a form/list fact editor.

It must not render:

- map coordinates;
- token dragging;
- line drawing;
- LoS geometry;
- range circles;
- path editor.

---

# 8. Handout modes — image presentation only

Handout is explicitly **not a battlemap**.

## PROTO-SURF-HANDOUT-OVERLAY

- shared image overlays current Play context;
- Actor/Command context remains available according to reviewed mode;
- Player local dismiss/minimize/reopen.

## PROTO-SURF-HANDOUT-UPPER

- shared image occupies upper presentation region according to reviewed mode;
- DM-controlled state;
- no grid/token interaction.

## PROTO-SURF-HANDOUT-FULL

- image becomes dominant presentation within live-session frame;
- DM-controlled shared mode;
- local zoom/pan only;
- no Actor placement/targeting on image;
- Command Center remains according to reviewed presentation contract.

Network/reconnect semantics remain blocked by `GAP-HANDOUT-NETWORK-CONTRACT`.

---

# 9. Overlay / feedback examples

| ID | Surface |
| --- | --- |
| `PROTO-SURF-ACTOR-CONTEXT` | Actor right-click UI/context menu |
| `PROTO-SURF-HOVER-EXPLAIN` | rich hover/focus explanation frame |
| `PROTO-SURF-TOOLTIP` | small tooltip |
| `PROTO-SURF-CONFIRM` | ordinary confirmation dialog |
| `PROTO-SURF-DESTRUCTIVE-CONFIRM` | destructive confirmation dialog |
| `PROTO-SURF-UNSAVED` | unsaved-change dialog |
| `PROTO-SURF-TOAST` | brief acknowledgement |
| `PROTO-SURF-BANNER` | persistent banner |
| `PROTO-SURF-NOTICE` | persistent NOTICE UI |
| `PROTO-SURF-ERROR-BLOCK` | local blocking error |
| `PROTO-SURF-RECONNECT` | reconnect/recovery strip/layer |

Normal single-target action execution does not add an unnecessary confirmation layer.

---

# 10. Responsive review

Prototype presets:

- Wide 1600x1000
- Normal 1366x768
- Narrow Desktop 960x700

Explicitly test:

- Tutorial;
- Home;
- both Character Sheets + transient roll;
- DM Freeform;
- Player Initiative;
- Actor Boards overflow;
- Command Center;
- Activity side pane;
- Quick/Full Sheet;
- Handout Full;
- Content page.

The central mapless context may shrink/reflow, but it never turns into a mobile/tactical-map UI.

---

# 11. Surface completion rule

A surface counts as represented only when the prototype shows:

1. intended product hierarchy;
2. normal state;
3. material role difference;
4. applicable narrow-desktop behavior;
5. important non-happy-path state where relevant;
6. coexistence with persistent Play anchors/layers;
7. mapless compliance where Play/target/Handout/spatial UI is involved.

A static screenshot without interaction/state demonstration does not complete the Reference Prototype.
