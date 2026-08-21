# WO-UI-001 — Product Shell + First-run Tutorial + Sheet Presentation Preference

Status: **PREPARED — NOT AUTHORIZED FOR RUNTIME IMPLEMENTATION**

Branch context: `agent/108-production-play-session-ux`

Accepted UI reference:

```text
docs/design/ui-ux/prototype/app/integrated-reference.html
candidate code reference: 4c12084bef603866b9b69f1bfd8f363146920184
```

This Work Order is the first bounded Runtime Preparation slice derived from the accepted prototype and implementation contracts. It does **not** authorize edits under `src/` yet.

---

# 1. Objective

Implement, after separate authorization, the smallest production slice that establishes the accepted product identity before Connected Play redesign:

1. fresh first use shows dedicated Tutorial/Onboarding before Home;
2. Tutorial explains Standalone / Host / Join and asks for initial Official-style vs SimpleVTT Sheet presentation;
3. Tutorial completion and Sheet presentation preference persist as local presentation/product-preference state;
4. returning launch enters Home;
5. Tutorial can be reopened from Settings/Help without resetting product/session/Character state;
6. normal Product Shell uses top navigation in the accepted order rather than a permanent left navigation rail;
7. both Sheet layouts continue to render the same canonical Character.

This slice intentionally stops before connected Product-Shell/Play continuity work.

---

# 2. Applicable accepted behavior scenarios

Required scenarios from `contracts/BEHAVIOR-SCENARIOS.md`:

- **Scenario 01 — Fresh first run**
- **Scenario 02 — Returning user opens Home**
- **Scenario 03 — Reopen Tutorial**
- **Scenario 05 — Switch Sheet presentation**

Adjacent regression context, not implementation scope:

- Scenario 04 — Character Library open exact Character
- Scenario 06 — Standalone skill roll

The slice must not regress those adjacent flows.

---

# 3. Required QA rows

Must be evaluated for this slice:

- `QA-ID-04` — Tutorial first
- `QA-ID-05` — Same Character across Sheet layouts
- `QA-NAV-01` — Tutorial is first meaningful fresh-use panel
- `QA-NAV-02` — Tutorial contains Sheet choice
- `QA-NAV-03` — Tutorial covers Standalone/Host/Join orientation
- `QA-NAV-04` — Tutorial can reopen later
- `QA-NAV-05` — Global nav order / no permanent left-sidebar primary IA

Regression rows to keep green where touched:

- `QA-CHAR-01` — CharacterCard opens exact Character
- `QA-CHAR-02` — Sheet layout is presentation
- `QA-A11Y-01` — visible focus
- `QA-A11Y-03` — state not color-only

Explicitly **not in this slice**:

- `QA-NAV-06` — live Return to Play preserves connected context
- all `QA-SES-*`
- all Connected Play / targeting / resolution / privacy / Handout rows

`QA-NAV-06` belongs to the next connected-shell continuity slice because current `ProductRoot` bypasses the Product Shell whenever `snapshot.session.role !== "offline"`.

---

# 4. Product/UX dependencies

Applicable Reviewed decisions:

- `UX-01-01` — Standalone Character and Connected Session are co-equal core experiences
- `UX-01-02` — common Product Shell + dedicated Play Workspace
- `UX-03-01` — global destinations stay small
- `UX-03-05` — two first-class Character Sheet presentations on one Character
- `NAV-01-01` — global order Home → Characters → Session → Content → Rules → Settings
- `NAV-01-04` — return from supporting utilities restores safe prior context where practical
- `NAV-01-07` — first-run guidance is dedicated Tutorial/Onboarding and can reopen later
- `NAV-01-08` — returning app launch begins at Home, not prior Play
- `UI-01-01` — Product Shell uses top navigation, not permanent left rail
- `UI-01-07` — Official-style + SimpleVTT layouts; first-run Tutorial asks initial layout

No new Owner question is required for this slice.

## Freeze requirement

Current status of these decisions is `Reviewed`, not `Frozen`.

Before runtime implementation begins, the implementation gate requires the applicable dependency set to be scoped and explicitly Frozen/authorized according to the planning framework. This Work Order does **not** perform that Freeze.

Recommended scoped Freeze candidate set for WO-UI-001:

```text
UX-01-01
UX-01-02
UX-03-01
UX-03-05
NAV-01-01
NAV-01-04
NAV-01-07
NAV-01-08
UI-01-01
UI-01-07
```

If the owner does not authorize the scoped Freeze, implementation remains blocked.

---

# 5. Current implementation evidence and classification

## 5.1 `src/App.tsx` — MODIFY in implementation phase

Current evidence:

- initializes route as `home`;
- renders a permanent `.v1-sidebar` containing global navigation;
- also renders `.v1-topbar`;
- nav order itself already matches Home / Characters / Session / Content / Rules / Settings;
- current Settings surface exists in this file;
- current `liveSession` / Return-to-Play controls exist, but connected sessions normally bypass `App` through `ProductRoot`.

Required WO-UI-001 change:

- place first-run gate before interactive Home;
- compose accepted top Product navigation;
- remove permanent left sidebar as primary Product IA;
- provide Settings/Help path to reopen Tutorial;
- preserve existing route semantics for Character/Content/Rules/Settings unless required by this slice.

Must not:

- redesign Connected Play;
- modify session authority;
- solve Return-to-Play connected composition in this slice.

## 5.2 `src/V1HomeScreen.tsx` — MODIFY / RECONCILE

Reusable:

- product positioning copy;
- Character / Session / Content / Rules entry content;
- current Home status summaries.

Stale behavior:

- owns `simplevtt.v1.guide.dismissed`;
- shows onboarding as a Home section;
- permits Home to be the first interactive surface;
- Home guide does not own initial Sheet presentation choice.

Required change:

- remove Home-owned first-run lifecycle;
- Home becomes returning/post-Tutorial Product surface;
- optional lightweight Help entry may remain only if it opens the canonical Tutorial/Help surface, not a second competing onboarding model.

Legacy `simplevtt.v1.guide.dismissed` must not be treated as sufficient proof that the new accepted Tutorial has been completed.

Default migration policy for this Work Order: if the new Tutorial completion marker does not exist, show the new Tutorial once. This intentionally allows an existing pre-contract install to see the new Tutorial once because the legacy guide omitted the required Sheet-choice/product orientation contract.

## 5.3 `src/v1-product-shell.css` — MODIFY

Current evidence:

- `.v1-shell` is a two-column layout;
- `.v1-sidebar` is the permanent primary navigation;
- narrow rules collapse that sidebar into a top strip.

Required change:

- top-navigation Product Shell is the normal desktop baseline;
- content remains below the header/navigation;
- no permanent left navigation rail in normal Product Shell;
- responsive treatment may reflow but must preserve navigation order and keyboard reachability.

Exact pixel/token values remain implementation/design-system detail constrained by accepted reference and contracts.

## 5.4 `src/app/sheetLayoutPreferences.ts` — REUSE, SMALL EXTENSION ONLY IF REQUIRED

Existing correct behavior:

- preference type is `simplevtt | official`;
- stored separately from Character data;
- persistence failure does not block Character use.

Important current limitation:

- missing stored value resolves immediately to `DEFAULT_SHEET_LAYOUT = "simplevtt"`;
- it does not tell the caller whether the user has ever explicitly chosen a layout.

WO-UI-001 rule:

- do not create a second Character model;
- Tutorial may persist through the existing `persistSheetLayoutPreference` mechanism;
- add only the smallest read/introspection helper if needed to distinguish stored preference from fallback presentation;
- do not make Sheet preference part of `AppSnapshot` or rules/domain state.

## 5.5 `src/CharacterSheetPlayScreen.tsx` — REUSE / MINIMAL TOUCH

Current correct behavior:

- both layouts read the same `snapshot.activeCharacter`;
- switching layout persists presentation preference;
- the layout switch does not alter Character rules data.

Prefer no behavioral change beyond consuming any small preference API refinement needed by the Tutorial flow.

## 5.6 New local first-run preference module — ADD

Expected production responsibility:

```text
read tutorial completion
persist tutorial completion
storage failure fallback
optional schema/version constant
```

Recommended location:

```text
src/app/firstRunPreferences.ts
```

This state is local product/presentation preference, **not** D&D/session authority.

Do not add it to `AppSnapshot` unless a later architecture decision gives a concrete reason.

## 5.7 New Tutorial surface/component — ADD

Recommended bounded component:

```text
src/FirstRunTutorial.tsx
```

Responsibilities:

- focused first-run Tutorial/Onboarding;
- explain Standalone Character;
- explain Host Session;
- explain Join Session;
- present Official-style and SimpleVTT initial layout choice;
- clearly state layout can change later;
- Complete persists selected presentation + Tutorial completion;
- reopened mode can close/complete without touching Character/session/rules state.

It must not:

- create a Character automatically;
- start/join a Session;
- duplicate Character data;
- own D&D/rules logic.

## 5.8 `src/AppearanceSettingsBridge.tsx` / appearance preference helpers — REFERENCE / NO REQUIRED CHANGE

These establish an existing local-presentation persistence pattern. Do not merge Tutorial completion into appearance state merely for convenience.

## 5.9 `src/ProductRoot.tsx` — INSPECTED, DEFERRED

Current behavior:

```text
connected session -> SessionModeRoot only
offline -> App
```

This blocks the accepted live Product-navigation/Return-to-Play model, but correcting it requires a connected-shell composition slice touching SessionModeRoot/Play continuity.

**Out of WO-UI-001.**

Create/follow a later Work Order for `QA-NAV-06`, `UX-01-03`, `NAV-01-02`, and connected Product Shell continuity.

## 5.10 `src/app/AppProvider.tsx` / `src/app/contracts.ts` — INSPECTED, NO DOMAIN CHANGE

The AppProvider owns authoritative adapter snapshot operations. First-run Tutorial and Sheet presentation preference do not belong there.

`AppRoute` need not gain a `tutorial` domain/application route if the Tutorial is implemented as the Product Shell first-run gate/focused layer. Prefer local UI composition over expanding application-domain contracts for presentation-only state.

---

# 6. Authoritative / owning state sources

| State | Owner for this slice | Notes |
| --- | --- | --- |
| Tutorial complete | new local first-run preference module | local product preference, not AppSnapshot |
| Tutorial currently open | Product Shell local UI state | reopening does not reset completion marker |
| Sheet presentation | existing `sheetLayoutPreferences.ts` | presentation only |
| Character data | existing `snapshot.activeCharacter` / Character runtime | must not change because layout changes |
| Product route | existing Product Shell UI route state | Tutorial gate precedes normal route interaction on fresh use |
| Appearance | existing appearance preference path | no merge with Tutorial state |
| Session/role/connection | existing session snapshot/runtime | read-only for this slice; do not redefine |

---

# 7. Test inventory and reconciliation

## `tests/ui/v1ProductShellStructure.test.ts` — MODIFY; PARTIALLY STALE

Stale assertions to replace:

- `useState<AppRoute>("home")` as proof of fresh-launch Home;
- `.v1-sidebar` as required global navigation;
- `.v1-sidebar` production composition as a success condition;
- `.agents/V1_PRODUCT_EXPERIENCE.md` as completion authority for the new accepted shell where it conflicts with formal contracts.

Preserve/rewrite useful assertions:

- global destination set/order;
- Content route remains first-class;
- appearance preference behavior;
- explicit source composition rather than Vite rewrite.

New assertions should use accepted contracts/Work Order rather than historical `.agents` intent where there is a conflict.

## `tests/ui/productionNonCharacterUxRedesign.test.ts` — REGRESSION; MODIFY ONLY IF COMPOSITION ASSERTIONS BREAK

Useful current assertions to preserve:

- role mapping follows session authority;
- implementation jargon is not leaked into primary UI;
- session name handshake remains authoritative.

Do not broaden this Slice to SessionModeRoot/ProductionPlay just to satisfy old composition assertions.

## `tests/ui/characterSheetV10Structure.test.ts` — PRESERVE

Official Sheet/domain presentation structure remains out of this Slice and should stay green.

## `tests/ui/phase11OfflineWalkthrough.test.ts` — PRESERVE

Important regression guarantees include:

- production Character persistence;
- authoritative rolls;
- no fabricated spatial distance when no spatial module fact exists.

No changes expected.

## New tests — ADD

Recommended:

```text
tests/ui/firstRunTutorialPreferences.test.ts
tests/ui/firstRunTutorialStructure.test.ts
```

Required coverage:

1. fresh storage -> Tutorial before Home;
2. both Sheet options rendered;
3. completing Tutorial persists completion + selected Sheet presentation;
4. returning storage -> Home without forced Tutorial;
5. Settings/Help can reopen Tutorial;
6. reopened Tutorial does not clear Character/session state;
7. global nav order is exact;
8. permanent left-sidebar primary IA is absent;
9. layout switching preserves the same Character source.

Use injectable memory storage for preference unit tests where practical.

---

# 8. Implementation file scope

## Expected IN SCOPE

Existing files that may be modified:

```text
src/App.tsx
src/V1HomeScreen.tsx
src/v1-product-shell.css
src/app/sheetLayoutPreferences.ts        # only if a minimal preference introspection helper is needed
src/CharacterSheetPlayScreen.tsx         # only if required by preference API refinement
tests/ui/v1ProductShellStructure.test.ts
tests/ui/productionNonCharacterUxRedesign.test.ts  # only if touched shell assertions require reconciliation
```

Expected new files:

```text
src/FirstRunTutorial.tsx
src/app/firstRunPreferences.ts
tests/ui/firstRunTutorialPreferences.test.ts
tests/ui/firstRunTutorialStructure.test.ts
```

Optional bounded style split instead of extending `v1-product-shell.css`:

```text
src/first-run-tutorial.css
```

If a new stylesheet is used, `src/main.tsx` may be touched only to import that stylesheet.

## OUT OF SCOPE

```text
src/ProductRoot.tsx
src/SessionModeRoot.tsx
src/ProductionPlayScreen.tsx
session runtime/wire/authority adapters
Connected Play redesign
Actor Boards
Command Center
targeting / Main Hand
resolution / selective locking
DM-only privacy
Handout networking
session lifecycle semantics
Character creation/level-up rules logic
content/rules domain logic
map/spatial modules
```

A later Work Order must own connected Product-Shell/Play continuity and `QA-NAV-06`.

---

# 9. Must Not Change

- canonical Character schema/data because of Sheet presentation;
- Host=DM / Client=Player semantics;
- session lifecycle or reconnect behavior;
- D&D calculation/rules legality;
- mapless Core boundary;
- Connected Play topology;
- runtime attack/target eligibility;
- content snapshot/validation contracts;
- DM-only delivery contract;
- Handout network behavior.

No prototype fixture/mock code may be imported into production.

---

# 10. Open blockers

The four known broad runtime blockers:

```text
GAP-MAIN-HAND-CANONICAL-RELATION
GAP-RESOLUTION-SAFE-INTERACTIONS
GAP-HANDOUT-NETWORK-CONTRACT
GAP-DM-ONLY-DELIVERY-PROTOCOL
```

are **not blockers for WO-UI-001** because those behaviors are explicitly out of scope.

Slice-specific blocker remaining:

```text
SCOPED FREEZE / IMPLEMENTATION AUTHORIZATION
```

No new Domain/Architecture contract is currently required for Tutorial completion or Sheet presentation preference because both are bounded local UI/product-preference state.

---

# 11. Verification plan after implementation authorization

Minimum targeted tests:

```text
npx tsx --test \
  tests/ui/firstRunTutorialPreferences.test.ts \
  tests/ui/firstRunTutorialStructure.test.ts \
  tests/ui/v1ProductShellStructure.test.ts \
  tests/ui/productionNonCharacterUxRedesign.test.ts \
  tests/ui/characterSheetV10Structure.test.ts
```

Regression confidence:

```text
npx tsx --test tests/ui/phase11OfflineWalkthrough.test.ts
npm run test:ui-rule-boundary
npm run build
```

Visual QA must cover at least:

- fresh state Tutorial;
- Official-style selection -> Complete -> Home;
- returning launch -> Home;
- Settings/Help reopen Tutorial;
- top navigation at normal desktop;
- constrained/narrow desktop navigation;
- Character Sheet opens with persisted layout;
- switching layout preserves same Character values.

Record the touched `QA-*` rows as PASS/FAIL after implementation. Do not mark a requirement PASS merely because the DOM resembles the prototype.

---

# 12. Stop conditions

Stop implementation and return to planning if any of these becomes necessary:

1. modifying `ProductRoot` / `SessionModeRoot` / Connected Play to complete this Slice;
2. changing session authority, role, lifecycle or transport;
3. adding Tutorial/Sheet preference to authoritative Character or session schema;
4. changing Character data/rules values when switching layouts;
5. inventing a new owner-level flow not already covered by accepted contracts;
6. touching any of the four open technical Gap semantics;
7. introducing a map/token/grid/spatial-geometry concept;
8. changing Builder/Level Up workflow beyond navigation integration;
9. a current test requires restoring Home-first or permanent-sidebar behavior solely because the test is stale.

For stale tests, update the test to the accepted contract rather than restoring superseded behavior.

---

# 13. Known deferred follow-up slice

`WO-UI-002` should later own **Connected Product Shell continuity / Return to Play**, including at least:

- current `ProductRoot` connected bypass;
- Product Shell access while a live session exists;
- preserve exact Host/DM or Client/Player role;
- preserve SessionMode/current turn/controlled Actor/authoritative state;
- `UX-01-03`;
- `NAV-01-02`;
- `QA-NAV-06`;
- likely relevant Session/connection regression tests.

Do not silently absorb WO-UI-002 into WO-UI-001.

---

# 14. Readiness record

```text
Accepted Prototype: PASS
Integrated baseline: CURRENT
Contract set: READY
Runtime slice: SELECTED — WO-UI-001
Current src inspected: PASS
Current relevant tests inspected: PASS
Known stale tests identified: PASS
Blocking Domain/Architecture Gap for this slice: NONE
Applicable Product dependencies Frozen: NO
Runtime implementation authorization: NO
```

Therefore:

```text
WO-UI-001 PREPARATION: COMPLETE
WO-UI-001 IMPLEMENTATION-READY: NO
Blocked by:
  1. scoped Freeze/implementation-dependency authorization
  2. explicit runtime implementation authorization
```
