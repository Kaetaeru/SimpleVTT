# UI Reference Prototype — Work Order

Status: **PROTO-WO-002 EXECUTED TO STATIC REVIEW CANDIDATE — BROWSER / OWNER REVIEW PENDING**

This file preserves prior prototype execution history and records the current prototype-only rebuild result.

Runtime `src/` UI remains out of scope and is not authorized.

---

# 1. Historical execution

## PROTO-WO-001 — first and second candidates

### First candidate

```text
app/index.html
app/prototype.css
app/prototype.js
app/fixtures.js
app/review-patch.css
app/review-patch.js
```

Result: **REJECTED / HISTORICAL**

### Later `final-spec` candidate

```text
app/final-spec.html
app/final-spec.css
app/final-spec-coverage.css
app/final-spec.js
app/final-spec-fixtures.js
app/final-spec-stability.js
app/final-spec-coverage.js
```

Result: **INVALIDATED BY REPOSITORY-WIDE AUDIT**

Material reason:

- introduced synthetic Actor `sceneX/sceneY` coordinates;
- visually interpreted central Scene/Table as a battlemap-like field;
- did not start from the full repository Product/Domain/Owner baseline.

Neither historical candidate is eligible for Owner acceptance or runtime reference.

---

# 2. PROTO-WO-002 — Integrated Mapless Rebuild

**Objective:** Build a new, polished, complete Reference Prototype from the repository-wide integrated baseline so the owner can judge SimpleVTT's intended final Product/Play experience before runtime implementation.

**Authorization basis:** Owner explicitly requested a full-repository audit, a separate integrated plan, and continued work using that plan as the basis.

Mandatory sources:

1. `../INTEGRATED-PRODUCT-UX-PLAN.md`
2. applicable Domain/Architecture contracts
3. applicable `../decisions.md` Decision Cards
4. `../planning-gaps.md`
5. `PROTOTYPE-REBUILD-CONTRACT.md`
6. reconciled prototype catalogs/models/defaults

---

# 3. Active candidate

Current review entry:

```text
app/integrated-reference.html
```

Current support files:

```text
app/integrated-reference.css
app/integrated-reference-fixtures.js
app/integrated-reference-qa-fixtures.js
app/integrated-reference.js
app/integrated-reference-qa-fixes.js
```

Current verification:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
Static verification: PASS
Browser visual/interaction QA: PENDING
Owner acceptance: PENDING
```

The additional `qa-*` files remain prototype-only fixture/presentation hardening. They do not create runtime contracts.

---

# 4. Required default behavior

Fresh opening of the active candidate defaults to:

```text
PROTO-SCN-01 First launch Tutorial
```

Inside the product viewport, the first meaningful product panel is Tutorial/Onboarding.

Tutorial includes:

- Standalone vs Connected explanation;
- Official-style vs SimpleVTT initial Sheet presentation choice;
- Character / Host / Join orientation;
- completion -> Home;
- later Settings/Help reopen path.

Prototype Controls remain outside the product frame.

---

# 5. MAPLESS Core hard boundary

The candidate MUST NOT contain:

- Actor tactical x/y coordinates;
- Actor map tokens;
- square/hex grid;
- tactical terrain/floor plan;
- pathfinding/movement trace;
- collision UI;
- Fog of War;
- LoS/vision geometry;
- range circles;
- tactical AoE templates;
- minimap/map camera controls;
- Handout-as-battlemap interaction.

The central Connected Play region is a **Play Context / Tabletop Stage** used for current interaction, transient dice/result, notices and Handout presentation. `Mapless` is the internal product constraint, not a user-facing feature label that must be repeated throughout product UI.

Actor identity lives in Actor Boards/cards.

---

# 6. Standalone Character scope

Required:

- Character Library;
- Official-style Sheet;
- SimpleVTT Sheet;
- current accepted Character Create reference;
- current accepted Level Up reference;
- skill/save/Initiative/attack/damage/common-die review controls.

Ordinary Standalone roll contract:

```text
same mounted Sheet
-> transient physical dice over/within same viewport
-> compact result
-> transient layer clears
-> exact same Sheet remains
```

Forbidden:

- separate dice/result route;
- modal/drawer dice workflow;
- persistent layout-pushing dice stage;
- mandatory Close/Back merely to resume the Sheet.

---

# 7. Session entry scope

## Host

```text
Host Setup -> Open -> immediately live Host/DM Freeform
```

No Lobby / Ready / Start gate.

Zero Players valid.

## Join

```text
Join Setup -> Character Select -> sync if needed -> current live Client/Player state
```

No valid Character -> Create/Import recovery -> retry Join.

Safe Product-shell navigation during a live session must preserve the existing connected Host/DM or Client/Player identity when the user returns to Play.

---

# 8. Connected Play scope

Required skeleton:

```text
Compact Play chrome / status
Upper NPC / Neutral / Hostile Actor Board
Play Context / Tabletop Stage              [contextual side pane]
Lower Player / Allied Actor Board
Persistent Command Center
```

Freeform:

- no fake per-turn economy;
- capability/resource presentation remains truthful.

Initiative:

- same skeleton;
- compact top-edge Initiative Tracker;
- round/current turn;
- authoritative Action/Bonus/Reaction/Movement economy;
- End Turn where meaningful.

---

# 9. Hotbar / targeting scope

Required:

- persistent directly discoverable capabilities;
- Mixed / Action / Spell / Item / custom page examples;
- automatic discovery + customization concept;
- rich hover/focus explanation;
- selected-action targeting priority;
- explicit DM control mode above ordinary hostile-click behavior when no action is targeting;
- target validity on Actor Cards/manual target list;
- single valid target immediate submit;
- multi-target explicit Execute;
- area-like manual Actor set, not map template;
- Main Hand unavailable -> explicit reason, no smart fallback.

Historical intent-first UI may appear only as evidence in docs; it is not the primary prototype interaction.

---

# 10. Resolution / dice / privacy / Handout

Required review states:

- resolving/selective locking;
- Reaction/Interrupt;
- Concentration response;
- connected physical dice on the broad Tabletop Stage;
- Play-context result + Activity detail;
- DM Public/DM Only;
- Player authorized-only Activity projection;
- correction/reversal linkage;
- Handout Overlay / Upper / Full;
- Handout visibly not a battlemap.

Selective-locking review uses explicit QA fixture lists for conflicting/safe controls. The prototype must not infer conflict safety.

Open technical gaps remain mock-only inputs.

---

# 11. Contextual utilities

Required:

- Activity;
- Encounter / Combatants;
- Participants;
- Session Share / Player Session;
- Rules lookup;
- Quick Sheet / Full Sheet;
- advanced DM spatial **fact** editor;
- adjudication/correction reference;
- reconnect/recovery;
- confirmation/layer priority.

Advanced spatial UI uses Actor pair + distance/visibility/cover facts and contains no coordinates/map editor. It remains contextual rather than a routine primary Play control.

---

# 12. Product support surfaces

Required reference coverage:

- Home;
- Content / package import validation/lifecycle;
- Rules;
- Settings;
- Tutorial reopen;
- Reduced Motion;
- empty/loading/error/reconnect examples;
- Wide / Normal / Narrow Desktop;
- component/state gallery.

---

# 13. Prototype boundary

Allowed write scope:

```text
docs/design/ui-ux/prototype/app/
docs/design/ui-ux/prototype/
bounded docs/design/ui-ux routing/derived maintenance
```

Forbidden:

- production `src/` edits;
- production dependency changes;
- real backend/network/storage;
- authoritative rules calculation;
- privacy/network contract invention;
- production schema creation;
- copying rejected prototype fixtures/components as Product authority.

---

# 14. Verification result

Static verification is recorded in:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
```

Current result:

```text
active entry exists                         PASS
first-run Tutorial default                  PASS
no Core Actor tactical x/y fixture fields  PASS
no battlemap/grid/token central structure  PASS
Freeform fake turn economy absent           PASS
same-Sheet Standalone roll path             PASS
Actor-card/manual targeting                 PASS
Main Hand no-fallback                       PASS
selective locking explicit fixture          PASS
Player private-event placeholder absent     PASS
Handout/spatial map boundary                PASS
QA augmentation JS syntax                   PASS
browser visual/interaction execution        PENDING
```

The execution container could not resolve GitHub hosts for an exact local Chromium run, so static verification is intentionally not presented as browser acceptance.

---

# 15. Stop boundary

Do not move from this Work Order to production runtime implementation.

If review exposes:

- ordinary visual/layout problem -> fix prototype/default/catalog;
- material Product workflow/capability change -> reconcile Product Decision/integrated plan;
- rules/network/privacy/persistence truth -> route to Domain/Architecture contract.

---

# 16. Current result

```text
PROTO-WO-001: HISTORICAL / INVALIDATED CANDIDATES
PROTO-WO-002: STATIC REVIEW CANDIDATE BUILT
ACTIVE ENTRY: app/integrated-reference.html
STATIC VERIFICATION: PASS
BROWSER VISUAL / INTERACTION QA: PENDING
OWNER ACCEPTANCE: PENDING
RUNTIME src IMPLEMENTATION: NOT AUTHORIZED
```
