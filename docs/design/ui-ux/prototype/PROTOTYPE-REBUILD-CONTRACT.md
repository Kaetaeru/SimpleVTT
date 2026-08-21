# SimpleVTT Reference Prototype — Rebuild Contract

Status: **ACTIVE DERIVED REBUILD CONTRACT — implementation/prototype detail only**

Source baseline:

- `../INTEGRATED-PRODUCT-UX-PLAN.md`
- exact applicable `../decisions.md` Decision Cards
- exact applicable Domain/Architecture contracts

This file is a prototype execution contract. It does not create new Product decisions or rules/network authority.

---

# 1. Why a rebuild is required

The prior candidate is invalid because it introduced tactical-map semantics into mapless Core.

The replacement must be built from zero/rebased structure, not accepted by incremental cosmetic repair.

No fixture or product component may depend on Actor x/y coordinates for ordinary Core Play.

---

# 2. Required review entry behavior

On fresh first-run load, the first meaningful product panel inside the review viewport is the **Tutorial / Onboarding window**.

Prototype-only controls remain outside the product viewport and may switch scenarios for review.

The default scenario must not begin in DM Play or Home.

Default fresh-run sequence:

```text
Tutorial
  -> choose Official-style or SimpleVTT Sheet
  -> product orientation
  -> Complete
  -> Home
```

A returning-user scenario may start directly at Home.

---

# 3. Tutorial

Required contents:

- SimpleVTT identity: Standalone tabletop Character Sheet + Connected Session;
- Official-style vs SimpleVTT Sheet choice;
- Character Create/Open orientation;
- Host Session orientation;
- Join Session orientation;
- Content / Rules secondary orientation;
- `can change later` explanation for Sheet presentation;
- reopen-from-Settings/Help affordance in later scenarios.

The Tutorial may be a focused overlay/window within Product Shell, but it is not a permanent Home card pretending to satisfy first-run behavior.

---

# 4. Product Shell / Library mode

Top navigation only:

```text
Home | Characters | Session | Content | Rules | Settings
```

No permanent left sidebar in the intended product frame.

Home offline primary actions:

- Create Character;
- Open Characters;
- Host Session;
- Join Session.

Host and Join are distinct.

When a live Session context is represented outside Play, show Return to Play.

---

# 5. Character surfaces

Required:

- Character Library;
- existing/canonical Character Create reference;
- existing/canonical Level Up reference;
- Official-style Sheet;
- SimpleVTT Sheet.

Create/Level Up prototype presentation must follow current canonical Character flow and must not invent a replacement rules wizard.

---

# 6. Standalone dice contract

Every supported Sheet roll uses one visual behavior family.

The Sheet remains mounted and visible.

Prototype presentation:

```text
Sheet
  -> trigger roll
  -> temporary cinematic dice layer over/within same viewport
  -> depth/back -> user/front -> contact/roll/settle
  -> compact result
  -> layer clears automatically
  -> exact same Sheet remains
```

Forbidden:

- route to Resolution;
- modal dice workflow;
- drawer dice workflow;
- separate dice stage/card that reads as a window;
- persistent `VisualDiceTray` region inserted as layout content;
- mandatory Close/Back to resume Sheet;
- Sheet remount/replacement solely for roll presentation.

Result/history may exist as Sheet information after the transient animation.

---

# 7. Connected Session entry

## Host

```text
Host Session setup
  -> Open
  -> immediately live Host/DM Freeform Play
```

No Lobby/Ready/Start gate.

Zero Players is valid.

## Join

```text
Join setup
  -> local Character selection
  -> connection/content/Character sync states if needed
  -> current live Client/Player Play
```

No valid Character -> block + Create/Import -> retry Join.

No Ready lobby.

---

# 8. Connected Play core layout — MAPLESS

Required visual skeleton:

```text
Compact Play chrome / status
────────────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
────────────────────────────────────────────
Mapless Play Context / Tabletop Stage    [contextual utility pane]
────────────────────────────────────────────
Lower Player / Allied Actor Board
────────────────────────────────────────────
Persistent Command Center
```

The central region must **not** look or behave like a battle map.

Forbidden visual/mechanical cues:

- square/hex grid;
- map terrain/floor plan;
- room walls as tactical collision geometry;
- Actor token placement inside the central region;
- Actor x/y positions in fixture data;
- movement/path arrows;
- range circles;
- AoE map templates;
- fog/vision cones/LoS lines;
- minimap/camera-map controls.

Allowed central content:

- subtle non-semantic tabletop texture/background;
- current action/target summary;
- PendingResolution;
- reaction/concentration prompt;
- NOTICE;
- immediate result;
- cinematic physical dice;
- Handout presentation;
- tasteful atmospheric empty space.

Actor identity is represented by Actor Boards/cards, not map tokens.

---

# 9. Actor Board contract

Upper:

- NPC;
- Neutral;
- Hostile.

Lower:

- Player Character Actors;
- Allied Actors.

Card states:

- normal;
- controlled;
- selected/context focus;
- current turn;
- target valid;
- target invalid + reason;
- target selected;
- unavailable/hidden information according to role projection.

Minimum usable width first; horizontal overflow/paging when needed.

No permanent left party portrait rail.

---

# 10. Freeform

Freeform keeps the same structure but no fake turn state.

The Command Center remains present because current Product planning prioritizes direct capability discovery.

However:

- no round/current-turn banner;
- no Action/Bonus/Reaction/Movement shown as spent/free per-turn state unless authoritative context says it is meaningful;
- capability costs/resources may still be shown truthfully.

This differs from historical intent-only Freeform plans and is intentional because current Reviewed decisions supersede them.

---

# 11. Initiative

Initiative does not create a new page or replace Actor Boards.

Add:

- compact horizontal Initiative Tracker at top edge of central mapless context;
- round/current turn;
- authoritative economy;
- End Turn where meaningful;
- current-turn emphasis.

Keep:

- upper board;
- lower board;
- central mapless context;
- Command Center.

---

# 12. Command Center

BG3-family structure, not BG3 copy.

Small upper row:

- Initiative economy when meaningful;
- resources.

Lower-left:

- controlled Actor identity/status/HP/temp HP/concentration when applicable.

Larger lower/right:

- persistent directly discoverable capability Hotbar;
- Mixed / Action / Spell / Item / custom pages/slots;
- contextual Execute / End Turn / Cancel.

Do not make the primary interaction a historical intent-first funnel.

Rich hover/focus descriptions are required for dense capability UI.

---

# 13. Targeting — mapless

Targeting occurs on Actor Cards/manual target selection.

Required:

- selected-action targeting click priority;
- all cards remain visible;
- valid/invalid/selected states;
- invalid reason from fixture/authority;
- single valid target -> immediate submit;
- multi target -> explicit Execute;
- area-like action -> manual multi-target set/checklist;
- no AoE map template.

No selected action + hostile default Main Hand example may be shown only through explicit fixture relation; no smart fallback.

---

# 14. Resolution / dice / result

Keep the Play skeleton visible.

Resolution may overlay/focus central mapless context but must not replace Play.

Required review states:

- resolving;
- Reaction/Interrupt;
- Concentration response;
- physical dice;
- result;
- corrected result/Activity relation.

Connected dice use the broad central **mapless** Tabletop Stage as physical presentation space.

No Actor token positions are involved.

Result remains in current Play context; Activity is the durable detail path.

---

# 15. Right-click / Actor context

Right-click menu is supplementary UI/context management:

- Inspect/Details;
- focus/selection/control context when authorized;
- role-appropriate UI actions.

It does not duplicate Attack/Spell/Item Hotbar actions.

Essential information has another reachable path.

---

# 16. DM utilities

Contextual side panes/layers:

- Encounter / Combatants;
- Participants;
- Session share/settings;
- Activity / correction / Undo;
- Rules lookup;
- Handout control;
- advanced spatial facts;
- acting Actor/control tools.

Core Play skeleton remains.

## Advanced spatial facts

Use forms/rows, never a map editor.

Example fields:

```text
Actor A
Actor B
Distance
Visibility
Cover
Manual note / declared event where supported
```

No x/y coordinates.

---

# 17. Activity / privacy

DM:

- one chronology;
- Public / DM Only markers;
- filters;
- correction linkage.

Player:

- only authorized projected events;
- no blank/private placeholder for undelivered DM-only events.

Architecture semantics remain fixtures until the real contract exists.

---

# 18. Handout

Three review modes:

- Overlay;
- Upper;
- Full.

Overlay supports local Player dismiss/reopen.

Upper/Full represent DM-controlled shared presentation.

The image is not tactical terrain.

No token/grid/map overlay on it.

---

# 19. Content / Rules / Settings

Reference surfaces must include:

- installed Content;
- Add/Import supported declarative package;
- preview + warning/blocking/unsupported validation;
- install/update/replace/disable/delete;
- live snapshot note;
- Rules search/detail;
- Settings appearance/accessibility;
- initial/default Sheet presentation preference;
- tutorial reopen;
- Reduced Motion.

---

# 20. Responsive / accessibility

Prototype desktop presets:

- 1600x1000;
- 1366x768;
- 960x700.

Requirements:

- Command Center reachable;
- Actor Boards scroll horizontally at minimum width;
- central mapless context remains useful;
- utilities do not permanently destroy Play;
- long names/resources handled;
- visible focus;
- keyboard access for common controls;
- hover explanations available by focus where needed;
- Escape follows targeting/layer/navigation priority;
- Reduced Motion preserves result semantics.

Mobile/touch-first is outside v1.

---

# 21. Required prototype scenario families

A new candidate must cover at least:

```text
First Run Tutorial
Tutorial Sheet choice: Official
Tutorial Sheet choice: SimpleVTT
Returning Home
Character Library
Character Create reference
Level Up reference
Official Standalone Sheet
SimpleVTT Standalone Sheet
Standalone skill/save/attack/damage/common-die roll
Host entry -> live DM Freeform
Join entry -> live Player Freeform
Join no Character
DM Freeform mapless
Player Freeform mapless
Initiative mapless
Single-target targeting
Invalid target
Multi-target Execute
Main Hand unavailable/no fallback
Resolving
Reaction/Interrupt
Concentration
Connected dice
Result
DM Activity Public/DM Only
Player Activity privacy
Encounter utility
Participants utility
Session utility
Advanced spatial fact utility
Handout Overlay
Handout Upper
Handout Full
Reconnect
Content import review
Rules
Settings / tutorial reopen
Wide/Normal/Narrow stress
Component/state gallery
```

Scenario names/IDs may be refined, but coverage may not silently disappear.

---

# 22. Fixture rules

Fixture may provide:

- Actor IDs/names/sides/HP/status;
- controlled/current-turn/selection states;
- target eligibility + reason;
- canonical Main Hand relation example;
- economy/resources;
- roll faces/totals;
- public/private event projection examples;
- handout state;
- manual distance/visibility/cover facts.

Fixture MUST NOT provide for normal Core Play:

- Actor sceneX/sceneY;
- token coordinates;
- grid cell positions;
- pathing/LoS geometry;
- physics-derived authoritative result;
- hidden privacy data to a Player fixture merely for CSS hiding.

---

# 23. Build gate

Before new HTML authoring:

```text
[ ] Integrated plan read
[ ] This rebuild contract read
[ ] Surface Catalog mapless wording reconciled
[ ] Design Defaults mapless wording reconciled
[ ] Layer Model mapless wording reconciled
[ ] Scenario Catalog first-run/mapless/same-Sheet roll wording reconciled
[ ] Mock Data Contract forbids Actor x/y tactical coordinates
[ ] Work Order points to a NEW candidate entry, not final-spec.html
```

Until these are true, prototype HTML authoring remains blocked.
