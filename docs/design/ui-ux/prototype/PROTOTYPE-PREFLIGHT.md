# UI Reference Prototype — Preflight

Status: **REBUILD PRE-FLIGHT — current candidates invalidated**

Run this before any new prototype specification work or HTML authoring.

There is currently **no active review candidate**.

---

# 1. Mandatory read order

```text
1. ../AI-READING-GUIDE.md
2. ../MANIFEST.yaml
3. ../PREFLIGHT.md
4. ../INTEGRATED-PRODUCT-UX-PLAN.md
5. applicable Domain/Architecture contracts
   - ../../README.md
   - ../../movement-modules.md
   - ../../session-runtime.md
   - applicable Character/Content/Rules contracts
6. exact applicable ../decisions.md Decision Cards
7. ../planning-gaps.md
8. README.md
9. MANIFEST.yaml
10. PROTOTYPE-REBUILD-CONTRACT.md
11. DESIGN-DEFAULTS.md
12. SURFACE-CATALOG.md
13. COMPONENT-CATALOG.md
14. LAYER-MODEL.md
15. STATE-MODEL.md
16. SCENARIO-CATALOG.md
17. MOCK-DATA-CONTRACT.md
18. PROTOTYPE-ACCEPTANCE.md
19. PROTOTYPE-WORK-ORDER.md
```

Do not read rejected HTML as the design source before this order.

`.agents/*`, old demos, `src/*` and tests may be inspected only as historical/implementation evidence after formal requirements are known.

---

# 2. Current candidate state

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED / HISTORICAL
ACTIVE ENTRY        -> NONE
```

The next prototype must be a new/rebased candidate.

Do not patch either invalidated entry toward acceptance.

---

# 3. Mapless Core gate

Before prototype specification or HTML work:

```text
[ ] Core contains no battlemap requirement.
[ ] `Scene/Table/Stage/Canvas` has been interpreted as mapless context/presentation space.
[ ] Actor fixture data will contain no tactical x/y coordinates.
[ ] Actor cards will not become draggable map tokens.
[ ] no square/hex grid is proposed.
[ ] no pathfinding/movement trace/collision/fog/LoS map visualization is proposed.
[ ] Handout is presentation, not tactical terrain.
[ ] target selection is Actor-card/manual-list based.
[ ] advanced DM spatial UI is fact-oriented, not coordinate editing.
```

Any failure blocks prototype work.

---

# 4. First-run gate

```text
[ ] Fresh first-run default scenario starts with dedicated Tutorial/Onboarding.
[ ] Tutorial contains Official-style vs SimpleVTT Sheet selection.
[ ] Tutorial explains Standalone vs Connected use.
[ ] Tutorial or immediate orientation exposes Character / Host / Join.
[ ] Tutorial has a later Settings/Help reopen path.
[ ] Tutorial completion proceeds to Home.
```

A Home card alone does not satisfy the first-run Tutorial contract.

---

# 5. Standalone Sheet/dice gate

```text
[ ] both Official-style and SimpleVTT Sheet references exist.
[ ] ordinary Sheet rolls leave the current Sheet mounted/visible/stable.
[ ] dice are transient cinematic presentation over/within the same Sheet viewport.
[ ] no separate dice/result route/window/modal/drawer/persistent tray is proposed.
[ ] no Close/Back is required merely to return from a routine roll.
[ ] fixture/local result authority is separate from physics presentation.
```

---

# 6. Connected Play gate

```text
[ ] Host=DM and Client=Player.
[ ] Host opens directly into live Freeform; no Lobby/Ready/Start gate.
[ ] no-Character Join recovery is represented.
[ ] upper NPC/Neutral/Hostile Actor Board retained.
[ ] central region is Mapless Play Context/Tabletop Stage.
[ ] lower Player/Allied Actor Board retained.
[ ] persistent Command Center retained.
[ ] Freeform has no fake turn economy.
[ ] Initiative adds tracker/economy without replacing Actor Boards.
[ ] DM/Player share the same core skeleton.
```

---

# 7. Interaction gate

```text
[ ] normal capabilities are directly discoverable per current Hotbar decisions.
[ ] historical intent-first funnel is not restored as the primary capability access model.
[ ] selected-action targeting has click priority.
[ ] all Actor Cards remain visible while targeting.
[ ] valid/invalid/selected target states come from fixtures.
[ ] single valid target submits immediately.
[ ] multi-target uses explicit Execute.
[ ] area-like targeting is a manual target set, not a map template.
[ ] Main Hand unavailable selects no fallback.
[ ] right-click Actor menu is UI/context only.
```

---

# 8. Resolution / privacy / Handout gate

```text
[ ] resolution preserves Play skeleton.
[ ] reaction/concentration stays in context.
[ ] connected dice use mapless central presentation space.
[ ] immediate result stays in Play; Activity holds durable detail.
[ ] Player fixture receives no DM-only placeholder/existence row.
[ ] Handout modes are presentation-only and contain no map/token interaction.
```

Open technical gaps may use explicit mock fixtures only; runtime implementation remains blocked.

---

# 9. Catalog reconciliation gate

Before new HTML authoring, the following prototype specs must be reconciled against the integrated baseline:

```text
[ ] DESIGN-DEFAULTS.md explicitly forbids tactical-map interpretation.
[ ] SURFACE-CATALOG.md names central Play region as mapless context/stage and preserves first-run Tutorial.
[ ] LAYER-MODEL.md makes Base/Canvas terminology non-spatial/non-map.
[ ] SCENARIO-CATALOG.md starts first run with Tutorial and makes Play scenarios mapless.
[ ] MOCK-DATA-CONTRACT.md forbids Actor tactical x/y coordinates.
[ ] PROTOTYPE-WORK-ORDER.md points to a new candidate entry.
```

Until all six pass:

```text
P0 SPECIFICATION: NOT READY
P1 HTML BUILD: BLOCKED
```

---

# 10. Scope boundary

Allowed:

```text
docs/design/ui-ux/prototype/app/
docs/design/ui-ux/prototype/
bounded docs/design/ui-ux routing/derived maintenance
```

Forbidden:

- production `src/` edits;
- production dependency changes;
- real backend/network/storage calls;
- production schema changes;
- authoritative D&D/rules calculation;
- privacy/network semantics invented in prototype JavaScript.

---

# 11. Current result

```text
INTEGRATED BASELINE: PASS
MAPLESS CORE INTERPRETATION: PASS
CURRENT CANDIDATES: INVALIDATED
PROTOTYPE REBUILD CONTRACT: CREATED
CATALOG RECONCILIATION: PENDING
NEW HTML AUTHORING: BLOCKED UNTIL CATALOG RECONCILIATION
OWNER PROTOTYPE ACCEPTANCE: NOT STARTED
RUNTIME SRC IMPLEMENTATION: NOT AUTHORIZED
```
