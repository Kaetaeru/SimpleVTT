# UI Reference Prototype — Preflight

Status: **STATIC REVIEW CANDIDATE READY — browser / Owner review pending**

Run this before materially iterating the active prototype or moving its review state forward.

Active candidate:

```text
app/integrated-reference.html
```

Historical candidates remain invalid:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED / HISTORICAL
```

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
18. INTEGRATED-REFERENCE-VERIFICATION.md
19. PROTOTYPE-ACCEPTANCE.md
20. PROTOTYPE-WORK-ORDER.md
```

Do not use rejected HTML as design authority.

`.agents/*`, old demos, `src/*` and tests are historical/implementation evidence after formal requirements are known.

---

# 2. Candidate state

```text
ACTIVE ENTRY                  app/integrated-reference.html
STATIC VERIFICATION           PASS
BROWSER VISUAL/INTERACTION QA PENDING
OWNER ACCEPTANCE              PENDING
RUNTIME UI                    NOT AUTHORIZED
```

Static verification source:

```text
INTEGRATED-REFERENCE-VERIFICATION.md
Candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

The available execution container could not resolve GitHub hosts for an exact local Chromium run. Do not upgrade browser/visual items to PASS from static inspection alone.

---

# 3. Mapless Core gate

Before any prototype iteration:

```text
[x] Core contains no battlemap requirement.
[x] Scene/Table/Stage/Canvas is interpreted as context/presentation space, not a map.
[x] Actor fixture data contains no tactical x/y coordinates.
[x] Actor cards are not draggable map tokens.
[x] no square/hex grid is present.
[x] no pathfinding/movement trace/collision/fog/LoS map visualization is present.
[x] Handout is presentation, not tactical terrain.
[x] target selection is Actor-card/manual-list based.
[x] advanced DM spatial UI is fact-oriented, not coordinate editing.
```

Any future regression blocks review immediately.

---

# 4. First-run gate

Static candidate:

```text
[x] Fresh first-run default scenario starts with dedicated Tutorial/Onboarding.
[x] Tutorial contains Official-style vs SimpleVTT Sheet selection.
[x] Tutorial explains Standalone vs Connected use.
[x] Tutorial exposes Character / Host / Join orientation.
[x] Tutorial has a Settings/Help reopen path.
[x] Tutorial completion proceeds to Home.
```

Browser hierarchy/readability remains part of Owner review.

---

# 5. Standalone Sheet/dice gate

```text
[x] both Official-style and SimpleVTT Sheet references exist.
[x] ordinary Sheet rolls leave the current Sheet mounted/visible/stable in source structure.
[x] dice are transient presentation over/within the same Sheet viewport.
[x] no separate dice/result route/window/modal/drawer/persistent tray is used.
[x] no Close/Back is required merely to return from a routine roll.
[x] fixture/local result authority is separate from physics presentation.
```

Visual feel/timing remains browser-review work.

---

# 6. Connected Play gate

```text
[x] Host=DM and Client=Player.
[x] Host opens directly into live Freeform; no Lobby/Ready/Start gate.
[x] no-Character Join recovery is represented.
[x] upper NPC/Neutral/Hostile Actor Board retained.
[x] central region is non-spatial Play Context/Tabletop Stage.
[x] lower Player/Allied Actor Board retained.
[x] persistent Command Center retained.
[x] Freeform has no fake turn economy.
[x] Initiative adds tracker/economy without replacing Actor Boards.
[x] DM/Player share the same core skeleton.
[x] safe Product-shell navigation restores prior connected Host/DM or Client/Player identity.
```

---

# 7. Interaction gate

```text
[x] normal capabilities are directly discoverable per current Hotbar decisions.
[x] historical intent-first funnel is not restored as primary capability access.
[x] selected-action targeting has click priority.
[x] explicit DM control mode has priority over ordinary hostile-click behavior when no action targets.
[x] all Actor Cards remain visible while targeting.
[x] valid/invalid/selected target states come from fixtures.
[x] single valid target submits immediately.
[x] multi-target uses explicit Execute.
[x] area-like targeting is a manual target set, not a map template.
[x] Main Hand unavailable selects no fallback.
[x] right-click Actor menu remains UI/context oriented.
```

---

# 8. Resolution / privacy / Handout gate

```text
[x] resolution preserves Play skeleton.
[x] selective locking consumes explicit QA fixture values rather than deriving conflict safety.
[x] reaction/concentration stays in context.
[x] connected dice use central presentation space.
[x] immediate result stays in Play; Activity holds durable detail.
[x] Player fixture receives no DM-only placeholder/existence row.
[x] Handout modes are presentation-only and contain no map/token interaction.
[x] advanced spatial facts are contextual rather than routine top-level Play chrome.
```

Open technical gaps remain explicit runtime blockers.

---

# 9. Catalog / fixture reconciliation gate

```text
[x] DESIGN-DEFAULTS.md carries the tactical-map prohibition.
[x] SURFACE-CATALOG.md defines central Play as mapless/contextual.
[x] LAYER-MODEL.md treats Base/Canvas as non-spatial product context.
[x] SCENARIO-CATALOG.md starts with Tutorial and uses mapless Play scenarios.
[x] MOCK-DATA-CONTRACT.md forbids Actor tactical x/y coordinates.
[x] PROTOTYPE-WORK-ORDER.md points to the integrated candidate.
[x] explicit QA fixture exists for unresolved selective-lock semantics.
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
PROTOTYPE SPECIFICATION: PASS FOR CURRENT REVIEW CANDIDATE
ACTIVE CANDIDATE: app/integrated-reference.html
STATIC VERIFICATION: PASS
BROWSER VISUAL / INTERACTION QA: PENDING
OWNER PROTOTYPE ACCEPTANCE: PENDING
RUNTIME SRC IMPLEMENTATION: NOT AUTHORIZED
```
