# SimpleVTT Integrated Product / UI / UX Plan

Status: **ACTIVE CROSS-SOURCE BASELINE — not Frozen**

Purpose: This document is the repository-wide integration layer for broad SimpleVTT UI/UX planning, prototype work, QA and later runtime preparation.

It exists because prior prototype work read fragmented UI documents without consistently reconciling them against the mapless Core product boundary, direct Owner decisions, historical agent planning and current runtime evidence. That produced prototype drift: a tactical/battlemap-like Scene was invented even though SimpleVTT Core explicitly does not own a battle map.

This document does **not** replace canonical authority sources. It tells future AI/implementers how those sources must be read together.

---

# 1. Authority and precedence

When sources conflict, use this order for the relevant authority domain.

## 1.1 Domain / architecture truth

These own rules, state, networking, persistence, authority and map/spatial boundaries:

- `docs/design/README.md`
- `docs/design/session-runtime.md`
- `docs/design/movement-modules.md`
- `docs/design/persistence.md`
- `docs/design/character-lifecycle.md`
- `docs/design/character-session-projection.md`
- `docs/design/content-modules-items.md`
- `docs/design/declarative-module-validation.md`
- `docs/design/installed-content-catalog.md`
- `docs/rules/*`
- other applicable canonical `docs/design/*` contracts

Product/UI planning may present this truth but may not override it.

## 1.2 Made Product / UX decisions

`docs/design/ui-ux/decisions.md` is the canonical ledger for made Product/UX decisions.

Reviewed/Selected decisions are planning truth. They are **not automatically Frozen runtime implementation dependencies**.

## 1.3 Direct Owner provenance

`docs/design/ui-ux/owner-review/*` preserves direct Owner answers and notes. When a corresponding Decision Card exists, the Decision Card is the normalized current record and the worksheet is provenance.

A later explicit Owner correction may refine presentation, but must not silently override Domain/Architecture truth.

## 1.4 This integrated plan

This file is the required cross-source interpretation for broad UI work. It:

- resolves terminology;
- distinguishes retained vs superseded historical directions;
- makes mapless constraints impossible to miss;
- lists the whole product flow in one place;
- identifies known implementation/prototype drift;
- defines the next prototype rebuild contract.

It is not a second decision store and must not be used to invent missing rules/network/privacy contracts.

## 1.5 Historical / evidence sources

The following are useful evidence but are not canonical Product authority by themselves:

- `.agents/*` — explicitly non-canonical agent working context;
- `docs/design/v1-desktop-demo/*` — historical demo evidence;
- current `src/*` — implementation evidence;
- `tests/ui/*` — implementation-contract evidence, some of which may be stale after newer Reviewed decisions;
- rejected prototype files under `docs/design/ui-ux/prototype/app/`.

When these conflict with canonical Domain or current Reviewed Product decisions, classify the lower source as historical/drift rather than restoring it.

---

# 2. Repository-wide audit scope

The integrated baseline was assembled after inventorying and cross-checking the UI-relevant repository across:

- root product documentation and package structure;
- `docs/design/*` product/domain contracts;
- `docs/rules/*` declarative rules boundaries;
- `docs/guides/*` user/import workflows;
- `docs/design/v1-desktop-demo/*` historical product demo;
- `docs/design/ui-ux/*` decisions, flow, registry, matrices, gaps and governance;
- `docs/design/ui-ux/owner-review/*` direct Owner choices;
- `docs/design/ui-ux/prototype/*` prototype specification and rejected candidates;
- `.agents/*` historical product/UX plans and acceptance notes;
- current production `src/*` composition relevant to Product Shell, Session, Play, Character Sheets, dice and contracts;
- `tests/ui/*` inventory and material structural tests.

The audit deliberately treats code/tests as evidence, not as automatic product truth.

---

# 3. Product identity — what SimpleVTT actually is

SimpleVTT is a **local-first D&D play assistant / tabletop companion** with two co-equal first-class uses:

1. **Standalone Character / physical-table use** — a complete digital Character Sheet and dice/reference tool without any connected session.
2. **Connected Session use** — Host/DM-authoritative shared Character/Actor/action/resolution/session assistance over the existing connected runtime.

SimpleVTT is **not** a general-purpose tactical-map VTT.

The product name does not imply a battle map.

## 3.1 Core v1 non-goals

Core does not own or provide:

- battle maps;
- draggable map tokens;
- Actor x/y coordinates;
- square/hex grids;
- pathfinding;
- collision;
- movement traces;
- tactical movement UI;
- Fog of War;
- line-of-sight rays/visualization;
- range rings/templates based on a map;
- 3D battlefield/scene geometry;
- minimap/map camera controls.

Optional future map modules may exist outside Core, but **Core UI must remain fully usable without them**.

## 3.2 What Core may own instead

Core may present:

- Actor identity/cards;
- selected/controlled/current-turn Actor state;
- target eligibility supplied by authoritative application/domain state;
- explicit manual target sets;
- action/resource/effect/resolution state;
- DM-entered or authoritative spatial facts such as distance, visibility or cover when a capability actually needs them;
- image Handouts as presentation assets;
- physical dice animation on a visually tabletop-like surface.

None of these imply a tactical map.

---

# 4. Terminology normalization

Historical and current documents use `Scene`, `Scene/Table`, `stage`, `canvas` and `tabletop plane`. Future UI work must interpret these terms under the mapless Core boundary.

## 4.1 `Scene` / `Scene Context`

Means the current **mapless shared play context**:

- who/what Actors are relevant;
- current selection/control/targeting;
- current action or PendingResolution;
- current mode (Freeform / Initiative);
- current shared Handout when any;
- immediate result/NOTICE;
- dice presentation space.

It does **not** mean a map with positions.

## 4.2 `Tabletop Stage` / `Roll Area`

Means visual free space used for focus, dice, result and transient presentation.

It may have tabletop texture/depth purely for visual grounding.

It must not display grid cells, token coordinates, tactical terrain, movement/path indicators or spatial geometry unless a future explicitly installed map module owns that separate experience.

## 4.3 Actor Card vs Token

Core uses **Actor Cards / Actor entries / portraits**.

Do not render Actors as freely positioned map tokens in the central area.

## 4.4 Handout

A DM-shared image is a **Handout / shared presentation**, not a battlemap.

No grid, token placement, AoE template or movement interaction is layered onto a Handout in Core.

---

# 5. First launch and tutorial — the first meaningful interaction

This was direct Owner planning and must not be omitted again.

## 5.1 First-launch sequence

```text
App boot / hydration
    -> first-use state check
        -> if tutorial incomplete: dedicated Tutorial / Onboarding window first
        -> tutorial complete: Home
    -> returning user: Home
```

The underlying app may already be hydrated, but the **first meaningful user-facing panel on first run is the Tutorial**, not the normal Home dashboard.

## 5.2 Tutorial minimum content

The tutorial must explain, briefly and visually:

1. SimpleVTT has two valid use modes:
   - Standalone Character Sheet at a physical table;
   - Connected Host/Join Session.
2. **Choose initial Character Sheet presentation:**
   - Official-style;
   - SimpleVTT.
3. Explain that this Sheet preference is presentation only and can be changed later.
4. Show where to:
   - create/open a Character;
   - Host a Session;
   - Join a Session;
   - add Content / search Rules at a high level.

Tutorial completion proceeds to Home.

## 5.3 Reopen

Tutorial/help is reopenable from Settings and/or Help/Info.

## 5.4 Restart behavior

Closing the app disconnects the connected session. Relaunch starts from Home after normal boot; it does not silently restore a live network session.

---

# 6. Product Shell and global navigation

## 6.1 Stable global destinations

Top-level order:

```text
Home -> Characters -> Session -> Content -> Rules -> Settings
```

The common Product Shell uses a **top navigation model**, not a permanent left sidebar.

## 6.2 Contextual, not global

These are not permanent top-level destinations:

- Play;
- Activity;
- Encounter;
- adjudication/correction;
- participant/session utilities;
- Handout management;
- DM advanced spatial facts.

## 6.3 Live-session continuity

When a live connected session exists and the user is viewing a safe Product Shell destination, provide a visible `Return to Play` path.

Leaving Play to inspect a Product destination must not mutate authoritative session/game state merely because of navigation.

Normal session-reference tasks should prefer contextual panes/layers where that avoids needless route churn.

---

# 7. Home

Home is an orientation and entry surface, not a status dashboard.

Primary entries when offline:

- Create Character;
- Open Character Library;
- **Host Session**;
- **Join Session**.

Host and Join are distinct first-class actions; they are not hidden behind one ambiguous combined entry.

Secondary:

- Content/Add-on management;
- Rules lookup;
- Settings / tutorial/help.

Useful returning context may include recent Character/content health, but Home must not lead with:

- raw role/protocol state;
- internal IDs;
- package hashes;
- debug information;
- Activity history;
- fixture/reference session content.

---

# 8. Character Library

The Character Library is the Character-management hub.

It supports:

- open/select the exact canonical Character represented by a card;
- create;
- import;
- edit;
- level-up;
- portrait presentation;
- open Standalone Sheet.

Character Sheet layout preference is presentation state, not Character rules data.

Both Official-style and SimpleVTT layouts read/write the same canonical Character.

---

# 9. Character Create / Edit / Level Up

The Owner explicitly accepted the already-designed Character creation and Level Up experience; broad UI redesign must not casually replace it.

Interpret “keep the existing creation/level-up UX” through the canonical Character authoring contracts:

- Guided and Quick creation share one autosaved draft/plan;
- creation uses a dynamic `CharacterCreationPlan`, not a React-owned hard-coded rules wizard;
- Species, Background, Class, abilities, proficiencies, class choices, equipment and conditional spell choices remain distinct rule-driven sections;
- deterministic grants are automatic;
- only actual choices are asked;
- validation is visible and recoverable;
- Level Up uses ProgressionDraft / preview / validation / commit;
- import/duplicate converge on the same canonical Character model.

Do not restore stale labels/steps such as a hard-coded `Core Build` concept if they conflict with the current Character lifecycle contract.

---

# 10. Standalone Character Sheet

Two first-class layouts:

1. **Official-style** — follows standard paper-sheet information architecture with original SimpleVTT rendering/assets.
2. **SimpleVTT** — optimized digital layout designed around quick reading, current state and direct use.

Both must support the Character information and operations needed for physical-table play without requiring a Session.

## 10.1 Direct rolls

Any ordinary Standalone roll initiated from the Sheet follows one presentation contract:

- ability check;
- saving throw;
- skill check;
- Initiative;
- attack;
- damage/healing where supported;
- feature/resource roll;
- common d4/d6/d8/d10/d12/d20;
- other supported Sheet-local rolls.

### Hard behavior

The current Character Sheet **remains mounted, visible and spatially stable**.

The roll does not open a new product route, modal workflow, drawer, detached dice panel or separate result window.

The dice appear as a transient cinematic layer **over/within the current Sheet viewport**:

```text
Current Sheet remains visible
    -> trigger roll
    -> physical die/dice enter from visual depth/back
    -> travel toward user / contact tabletop-like visual plane
    -> short bounce/roll/settle
    -> compact result appears near the current Sheet interaction / upper-middle reading area
    -> transient dice/result clears
    -> user continues on the exact same Sheet
```

No `Close` or `Back` interaction is required merely to return to the Sheet because the user never left it.

A local roll history may exist as normal Sheet information, but reopening history must not create a permanent separate dice stage.

## 10.2 Dice authority

Standalone Sheet rolls may generate local results.

Physics/animation is presentation; it must not become a second rules engine.

Connected authoritative rolls use the same visual language but present the already-authoritative result.

---

# 11. Session entry and lifecycle

## 11.1 Offline Session entry

One Session destination exposes two distinct flows:

### Host Session

- Session name;
- required connection/listen information as appropriate to the real transport;
- `Open Session`.

### Join Session

- real Host address/connection information;
- local saved Character selection;
- `Join`.

Do not invent fake invite-code infrastructure when it does not exist.

## 11.2 Host flow — immediately live

Current Reviewed product behavior supersedes historical Lobby/Ready plans.

```text
Open Session
    -> connected Host = DM
    -> live Freeform session immediately
```

There is no normal long-lived:

- Host Preparing gate;
- Player Lobby;
- Ready requirement;
- `Start Session` activation gate.

Player count zero is valid. The DM can immediately prepare and play in the same live workspace.

## 11.3 Join flow

```text
Join
    -> choose valid local Character
    -> connection/content/Character synchronization as needed
    -> connected Client = Player
    -> enter the current live Session mode
```

Handshake/content parity may have short progress/recovery states but must not become a Lobby/Ready product stage.

If no valid Character exists, block Join and provide Create / Import recovery, then require a new Join attempt.

## 11.4 Reconnect

Reconnect returns to the current authoritative live session context. It does not send the user back through a fake Ready/Start lifecycle.

---

# 12. Connected Play — mapless core composition

Connected Play keeps the reviewed Dual-Anchor structure but the central region is explicitly **mapless**.

```text
Compact Play chrome / Session status
────────────────────────────────────────────────
Upper NPC / Neutral / Hostile Actor Board
────────────────────────────────────────────────
Mapless Play Context / Tabletop Stage       [contextual side utility]
  - current focus / interaction state
  - target-selection explanation as needed
  - PendingResolution / reaction / concentration
  - NOTICE / immediate result
  - physical dice Roll Area
  - active Handout presentation when applicable
  - NO battlemap / tokens / coordinates / grid
────────────────────────────────────────────────
Lower Player / Allied Actor Board
────────────────────────────────────────────────
Persistent bottom Command Center
```

Scene/Actor Context and Command Center are co-primary.

## 12.1 Actor Boards

Upper board:

- NPC;
- Neutral;
- Hostile.

Lower board:

- Player-controlled Characters;
- allied Actors.

Actor Cards expose bounded useful presentation state:

- portrait/identity;
- name;
- relation/side;
- HP/status when authorized/useful;
- controlled/current-turn/selected/target-valid/target-invalid/target-selected states.

Cards are not positioned tokens.

If horizontal space becomes insufficient, stop shrinking at a usable minimum and use horizontal overflow/paging.

## 12.2 Central Mapless Play Context

This region is deliberately **not filled with a fake grid or decorative battlefield** just because visual space exists.

Its visual purpose is to give breathing room to:

- current task;
- selected action/target context;
- cinematic dice;
- immediate result;
- reaction/interrupt/concentration response;
- NOTICE/reconnect state;
- Handout;
- optional atmospheric/tabletop texture that carries no mechanics meaning.

Actor Cards remain in their boards rather than being duplicated as x/y-positioned tokens in this space.

---

# 13. Freeform and Initiative

Freeform and Initiative are states of the same Session runtime/Play workspace.

## 13.1 Freeform

No fake turn model.

Do not show:

- round/current-turn banner as if a turn exists;
- spent Action/Bonus/Reaction/Movement as if Freeform had per-turn economy.

The Command Center remains structurally present because current Reviewed UX makes capabilities directly discoverable, but economy presentation must be truthful:

- show capability/resource costs where relevant;
- do not pretend turn resources are currently being spent unless the authoritative RulesProfile/context actually constrains them.

## 13.2 Initiative

Initiative adds combat information without creating another screen:

- round;
- current turn;
- compact horizontal Initiative Tracker at the top edge of the Mapless Play Context;
- authoritative Action / Bonus Action / Reaction / Movement economy;
- End Turn when applicable;
- current-turn/target/status emphasis.

Upper/lower Actor Boards and Command Center remain.

This supersedes historical plans in which Initiative replaced the Actor stage entirely.

---

# 14. Command Center / Hotbar

The bottom Command Center uses BG3-family information architecture only; it does not copy BG3 pixels/assets and does not import tactical-map features.

## 14.1 Structure

Small upper row:

- Initiative economy when meaningful;
- dynamic Resource Rail.

Lower-left:

- controlled Actor portrait/name;
- HP/temp HP;
- major status/concentration;
- relevant compact identity state.

Larger lower/right area:

- persistent Hotbar/capabilities;
- contextual Execute / End Turn / Cancel / other current controls.

## 14.2 Capability discovery

Current Reviewed direction supersedes the historical primary intent-first funnel.

Normal capabilities must be directly discoverable.

Baseline Hotbar organization:

- Mixed;
- Action;
- Spell;
- Item;
- user-custom pages/slots where supported.

Automatic capability discovery and user Hotbar customization coexist.

The UI may use contextual choice panels after a capability is selected when the rules require a variant/slot/target/other decision, but it must not hide ordinary available actions behind a generic intent taxonomy.

## 14.3 Hover/focus explanation

Dense controls should use rich hover/focus explanations for:

- name;
- cost/resource;
- public targeting/range facts;
- formula/effect summary;
- source/provenance where useful;
- unavailable reason.

Essential current state must not be hover-only.

---

# 15. Actor interaction and targeting — mapless

## 15.1 Click priority

1. selected-action targeting;
2. explicit DM control mode;
3. ordinary Actor selection/context.

## 15.2 Targeting presentation

Targeting happens on Actor Cards/manual target lists, not by clicking map positions.

All Actor Cards remain visible.

Represent:

- valid target;
- invalid target with supplied reason;
- selected target.

UI consumes authoritative/mock-provided target eligibility. It does not derive range, cover, LoS or legality from visual layout.

## 15.3 Single vs multi

- valid single-target click: submit immediately;
- multi-target: select the target set, then explicit `Execute`.

Area-like actions without a map use an explicit manual target set/checklist.

No AoE template is required in Core.

## 15.4 Default hostile click / Main Hand

When no targeting action is selected, the reviewed default hostile-click behavior may use the canonical Main Hand executable relation only when the Domain/Application contract supplies it.

No heuristic/smart fallback is allowed.

`GAP-MAIN-HAND-CANONICAL-RELATION` remains open.

---

# 16. Resolution, reaction, dice and result

## 16.1 Resolution continuity

Submitting an action must not replace Play with a separate resolution application/screen.

Preserve:

- Actor Boards;
- Mapless Play Context orientation;
- Command Center skeleton.

Only interactions that conflict with the active authoritative resolution should be locked. The exact safe/conflicting command contract remains `GAP-RESOLUTION-SAFE-INTERACTIONS`.

## 16.2 Reaction / interrupt / concentration

Required response presentation stays anchored to the current Play context and explains:

- why the response is requested;
- cost/resource if public;
- available response(s);
- decline/cancel where legal;
- supplied authority/reason state.

Do not invent timing/legality in UI.

## 16.3 Connected dice

The broad central **mapless Tabletop Stage** is the dice Roll Area.

The visual surface may read as a physical tabletop/floor for dice contact, but it must not read as a battle map.

Connected dice:

- start from the authoritative result;
- present the authoritative die/count/final face/total;
- use client-local trajectories/physics only as presentation;
- settle to the authoritative face;
- never change mechanics state.

## 16.4 Result

Immediate result is integrated into the current Play context.

Durable detail/history is available through Activity.

Do not open a detached full result screen for routine resolution.

---

# 17. Activity, visibility, correction

## 17.1 Activity

Activity is contextual, not permanently occupying routine Play.

DM view:

- one chronological history;
- public/private indicators;
- visibility filters;
- correction/Undo linkage;
- progressive detail.

Player view receives only authorized projections.

## 17.2 DM-only privacy

DM-only authoritative data/event existence must not be delivered to Players merely to hide it in CSS/UI.

Before disclosure, Player has no placeholder/existence marker.

Later disclosure may project full detail or result-only without rerolling.

`GAP-DM-ONLY-DELIVERY-PROTOCOL` remains a Critical architecture blocker for runtime implementation.

## 17.3 Correction

Correction/reversal appends a linked event; it does not erase the original history.

---

# 18. DM contextual tools

DM uses the same core Play skeleton as Player with additional authorized controls.

Contextual side panes/layers may provide:

- Encounter / Combatant management;
- Participants;
- Session sharing/settings;
- Activity / correction / Undo;
- Rules lookup;
- Handout preparation;
- advanced spatial facts;
- acting Actor/control change.

These tools do not replace the core Play skeleton during normal operation.

## 18.1 Advanced spatial fact tool

This is **not a map editor**.

When needed, it may expose fact-oriented inputs such as:

- Actor A;
- Actor B;
- distance;
- visibility;
- cover;
- declared movement/reaction fact where the runtime contract supports it.

No coordinate canvas, token dragging, pathfinding or geometry inference is introduced.

---

# 19. Handout / shared image

The DM can show a local/reference image as shared presentation.

Reviewed modes:

- Overlay;
- Upper presentation region;
- Full presentation region.

Rules:

- Overlay can be locally dismissed/reopened by Player;
- Upper/Full are DM-controlled shared presentation;
- zoom/pan is local presentation state;
- reconnect should restore active reveal after the network contract exists;
- Handout is not ResolutionEvent/combat state;
- Handout is not a tactical map.

`GAP-HANDOUT-NETWORK-CONTRACT` remains open.

---

# 20. Content / Add-ons / Rules

## 20.1 Content

v1 exposes one official SimpleVTT declarative package flow built on the existing supported RuleModule/content architecture.

Content management supports:

- installed content;
- import/add;
- preview;
- structural/semantic/dependency/conflict/capability validation;
- install/update/replace/disable/delete;
- recoverable errors;
- source/provenance as progressive detail.

Unsupported executable mechanics remain explicit; the UI must not imply arbitrary third-party JavaScript/native plugins work.

A live Session keeps its captured content snapshot stable.

## 20.2 Rules

Rules is search/browse of the composed authoritative catalog, separate from installation management.

During live Play, quick Rules lookup should be available contextually without requiring normal Play to be abandoned.

UI never treats display order/text as rules authority.

---

# 21. Settings / appearance / accessibility

Settings owns real user preferences such as:

- dark/light appearance mode where supported;
- accent preference;
- Character Sheet default presentation;
- Reduced Motion;
- other real accessibility/presentation preferences.

Do not put fixture/debug/reference controls in routine Settings.

Accessibility expectations:

- keyboard-reachable common controls;
- visible focus distinct from hover/selection;
- Escape/cancel behavior follows current interaction stack;
- color is not the only state channel;
- hover explanation has keyboard/focus access where required;
- constrained Windows desktop viewports are first-class;
- mobile/touch-first design is out of v1 scope.

---

# 22. Feedback and layer hierarchy

Use the smallest channel that matches the information lifetime.

- immediate result: near current task / Play Context;
- persistent problem: NOTICE/banner;
- field/local failure: inline;
- durable event/history: Activity;
- brief acknowledgement: toast;
- decision requiring focus: modal/response layer.

Do not duplicate every state in every channel.

Normal action targeting must not add unnecessary confirmation.

Destructive Session end or genuinely irreversible/high-impact actions may use confirmation according to the normal confirmation policy.

---

# 23. Hard AI / prototype prohibitions

Any broad UI prototype or implementation proposal fails preflight if it does any of the following without a new authoritative contract:

1. draws a Core battle map;
2. assigns Actor x/y coordinates for routine Core Play;
3. renders Actor cards as draggable map tokens;
4. adds a tactical grid/hex layer;
5. adds path/range/LoS/fog visualization;
6. treats a Handout as a battle map;
7. invents range/target legality from visual positions;
8. hides normal capabilities behind a primary intent-first funnel despite current Reviewed Hotbar direction;
9. restores Lobby/Ready/Start as the default Session lifecycle;
10. omits the first-run Tutorial + initial Sheet layout choice;
11. makes Standalone dice open a detached panel/window/route or pushes the Sheet layout aside;
12. removes Actor Boards or Command Center from current Reviewed Play skeleton without an explicit Owner decision;
13. lets Initiative replace the whole Play IA;
14. presents fake turn economy in Freeform;
15. exposes DM-only event existence to Player through UI-only hiding;
16. copies fixture/prototype data models into production authority;
17. treats `.agents`, historical demos, current code or old tests as higher authority than canonical contracts/current decisions.

---

# 24. Repository reconciliation / drift table

| Source / artifact | Observed state | Classification | Required treatment |
| --- | --- | --- | --- |
| `docs/design/README.md` | explicitly excludes battle maps/tokens/fog | Canonical Domain/Product boundary | Retain; highest mapless constraint |
| `docs/design/movement-modules.md` | Core owns no movement/map/token/grid/path/LOS/3D scene | Canonical Domain boundary | Retain; all UI must comply |
| `docs/design/session-runtime.md` / `docs/rules/*` | manual multi-targeting works without tactical map | Canonical Domain | Retain; target by Actor/list |
| `docs/design/ui-ux/decisions.md` | upper/lower Actor Boards + fixed Command Center + central Scene/Table | Canonical Product planning | Retain, but interpret Scene/Table as mapless under Domain authority |
| Owner `NAV-01-07` | first run uses a separate tutorial window | Direct Owner provenance -> normalized Decision | Must appear first on first run |
| Owner `UI-01-07` | Official/SVTT initial choice in first tutorial | Direct Owner provenance -> normalized Decision | Must be in tutorial |
| `.agents/*` | large body of historical UX plans | Non-canonical working context | Extract retained principles; supersede conflicting details |
| `.agents/V1_PRODUCT_EXPERIENCE.md` | mapless/tabletop-first but old nonblocking Home guide, Lobby/Ready, intent-first | Historical mixed | Retain mapless/tabletop principles; supersede current-flow conflicts |
| `.agents/V1_PLAY_SURFACE_REVISION.md` | mapless Actor stage but Initiative stage replacement + intent console | Historical mixed | Retain actor-card/mapless evidence; supersede replaced IA/action details |
| `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md` | persistent session philosophy; hides Actor lists/Hotbar in Freeform | Historical mixed | Retain continuity/contextual tool principle; supersede Actor Board/Hotbar conflict |
| `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md` | immediate live session + cinematic Sheet dice + no map assumptions | Historical useful evidence | Retain where consistent; Domain owns spatial legality |
| `docs/design/v1-desktop-demo/*` | historical lifecycle/layout | Historical demo evidence | Do not copy as current product truth |
| `src/App.tsx` | permanent left sidebar | Implementation drift vs `UI-01-01` | Later replace only under authorized runtime Work Order |
| `src/ProductRoot.tsx` | connected session bypasses common Product Shell | Implementation drift | Later reconcile with common-shell continuity |
| `src/V1HomeScreen.tsx` | guide is Home content; combined Host/Join | Implementation drift | Tutorial-first + distinct Host/Join in future runtime |
| `src/app/sheetLayoutPreferences.ts` | default chooses SimpleVTT without first-run choice | Implementation drift | First-run preference state required before runtime redesign |
| current Standalone Sheet components | separate roll-result section/close + embedded tray | Presentation drift | Rework to transient same-Sheet cinematic roll presentation |
| `src/ProductionPlayScreen.tsx` | mapless Actor rows and HUD; intent-first action model | Mixed evidence | Reuse mapless structural evidence; action UX superseded by current Hotbar decisions |
| `src/SessionModeRoot.tsx` / `SessionMainFocus.tsx` | mapless, but current connected composition differs from Reviewed Actor Boards/Command Center | Implementation drift | Rebuild later from accepted prototype/contracts |
| historical intent-first UI tests | assert old action model | Stale implementation contract relative to newer Reviewed decisions | Update only with authorized runtime implementation |
| `prototype/app/index.html` candidate | previously rejected | Rejected historical prototype | Never use as active reference |
| `prototype/app/final-spec*.{html,css,js}` current candidate | includes synthetic `sceneX/sceneY` and battlemap-like central area | **Prototype drift / invalid** | Invalidate active review candidate; rebuild from this integrated plan |
| `prototype/SURFACE-CATALOG.md` / `DESIGN-DEFAULTS.md` | uses `Scene/Table` without explicit mapless guard | Prototype-spec ambiguity | Amend before rebuild |
| `master-flow.md` | first-run tutorial not in main start flow; Standalone roll reads like separate Resolution | Derived-document drift | Refresh from integrated plan |
| `registry.md` | first-use exists; Standalone roll contract under-specified | Derived/contract gap | Tighten basis and mapless labels |
| `planning-gaps.md` reconciliation gap | points to legacy files without `.agents/` path and was Deferred | Stale reconciliation record | Activate and correct source paths |

---

# 25. Current prototype disposition

The currently named Final-Spec prototype is **not accepted and is no longer a valid review candidate** after this audit.

Reason:

- it introduced `sceneX/sceneY` fixture coordinates;
- it visually interpreted the central Scene/Table as a battlemap-like field;
- therefore it violates canonical mapless Core boundaries.

Do not patch that candidate incrementally into acceptance.

The next prototype must be rebuilt/rebased from this integrated plan and updated prototype catalogs.

---

# 26. Next Reference Prototype rebuild contract

The next complete prototype must demonstrate, at minimum:

## First run

- Tutorial is the first meaningful panel.
- Official/SimpleVTT Sheet choice is part of it.
- Tutorial completion enters Home.

## Product shell

- top navigation;
- Home with distinct Host and Join;
- Characters / Session / Content / Rules / Settings;
- live Return to Play continuity.

## Standalone

- both Sheet layouts;
- accepted Character creation/Level Up flows represented without redesigning rules workflow;
- all ordinary rolls use same-Sheet transient cinematic dice;
- no detached dice/result window.

## Connected Play

- **no battle map**;
- no Actor coordinates/tokens/grid;
- upper opposing Actor Board;
- central Mapless Play Context/Tabletop Stage;
- lower allied Actor Board;
- fixed Command Center;
- truthful Freeform economy presentation;
- Initiative adds compact tracker/economy without replacing boards;
- targeting entirely through Actor Cards/manual target list;
- single/multi target behavior;
- reaction/concentration/resolution continuity;
- connected dice on mapless tabletop presentation space;
- immediate result + Activity detail;
- DM/Player same skeleton with role-specific tools.

## Session utilities

- immediate-live Host;
- mid-session Join;
- no-Character recovery;
- reconnect;
- Activity/privacy;
- Encounter/Participants/Session contextual panes;
- advanced fact-based spatial tool, not map editor;
- Handout modes, explicitly non-map.

## Product support surfaces

- Content lifecycle/import validation;
- Rules browse/lookup;
- Settings/accessibility;
- errors/loading/empty/reconnect;
- wide/normal/narrow desktop;
- hover/focus/accessibility;
- layer priority and confirmation policy.

Prototype fixtures must contain **no spatial x/y coordinates for Core Actors**.

---

# 27. Remaining technical gaps

This integrated plan intentionally does not invent unresolved technical contracts.

Still open:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`
- `GAP-CANONICAL-UX-DOC-RECONCILIATION` until conflicting legacy/derived guidance has been fully routed/superseded.

Prototype may use explicit non-authoritative fixtures to show affected presentation, but runtime implementation stays blocked where the real contract is required.

---

# 28. Traceability summary

| Topic | Integrated rule | Primary source class |
| --- | --- | --- |
| Product identity | Standalone + Connected are co-equal | Reviewed Product + canonical design |
| Battle map | Core is mapless; no tokens/grid/path/LoS | Domain canon |
| First run | dedicated tutorial first | Reviewed Owner Decision |
| Initial Sheet | Official vs SimpleVTT chosen in tutorial | Direct Owner + Reviewed Decision |
| Product shell | top nav | Reviewed Owner Decision |
| Global nav | Home / Characters / Session / Content / Rules / Settings | Reviewed Owner Decision |
| Host | Open -> immediately live Freeform | Reviewed Session Decision |
| Join | Character select -> sync -> current live session | Reviewed Session Decision |
| Play core | upper opposing board + mapless central context + lower allied board + Command Center | Reviewed Product interpreted under Domain mapless constraint |
| Hotbar | persistent/direct capability discovery + customization | Reviewed Product |
| Freeform | no fake turn economy | Domain/rules + evidence |
| Initiative | same Play + compact tracker/economy | Reviewed Product |
| Targeting | Actor Cards/manual list, no map | Domain + Reviewed Product |
| Dice | physical presentation; authoritative connected result | Domain + Reviewed Product |
| Standalone dice | current Sheet never left/replaced | Owner correction + historical accepted interaction principle |
| Handout | shared image presentation, not map | Reviewed Product + Domain boundary |
| DM spatial | advanced fact editor, not coordinates | Reviewed Product + mapless Domain |
| Privacy | DM-only existence not delivered to Player | Reviewed Product; architecture contract pending |
| Content | one official declarative SimpleVTT package UX | Reviewed Product + content contracts |
| Create/Level Up | preserve accepted canonical authoring UX | Owner Decision + Character contracts |

---

# 29. Mandatory reading rule for future broad UI work

Before broad prototype, Product UI redesign, QA or runtime-preparation work, AI must read:

1. `AI-READING-GUIDE.md`
2. `MANIFEST.yaml`
3. `PREFLIGHT.md`
4. **`INTEGRATED-PRODUCT-UX-PLAN.md`**
5. exact applicable Decision Cards
6. exact applicable Domain/Architecture contracts and Planning Gaps
7. prototype contracts only after the above
8. implementation/tests only as evidence

If any prototype/code/test implies a tactical map, Lobby/Ready default, missing first-run tutorial, detached Standalone roll window, or historical intent-first primary funnel, do not copy it. Classify the conflict and follow this integrated reading order.

---

# 30. Current gate

```text
REPOSITORY-WIDE UI/PRODUCT AUDIT: COMPLETE ENOUGH TO REBASE PLANNING
INTEGRATED CROSS-SOURCE BASELINE: CREATED
CURRENT FINAL-SPEC PROTOTYPE: INVALIDATED BY MAPLESS-CONTRACT DRIFT
PROTOTYPE REBUILD: REQUIRED
PROTOTYPE OWNER ACCEPTANCE: NOT PASSED
RUNTIME PREPARATION: BLOCKED
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
FROZEN PRODUCT DECISIONS: NONE
```

The next UI artifact must be derived from this integrated baseline, not from either rejected prototype or historical `.agents` planning in isolation.
