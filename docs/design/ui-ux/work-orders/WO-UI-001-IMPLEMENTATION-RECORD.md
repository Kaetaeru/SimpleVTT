# WO-UI-001 — Runtime Implementation Record

Status: **VERIFIED COMPLETE**

Owner runtime authorization: **explicitly approved in conversation on 2026-08-21**

Work Order:

`WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md`

Scoped dependency freeze:

`WO-UI-001-SCOPED-FREEZE.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

---

# 1. Implemented behavior

The WO-UI-001 runtime slice implements:

1. a dedicated first-run Tutorial that appears before normal Home interaction when the new completion marker is absent;
2. Tutorial orientation for Standalone Character, Host Session, and Join Session;
3. required initial Official-style vs SimpleVTT Sheet presentation selection;
4. independent local persistence of Tutorial completion and Sheet presentation preference;
5. returning launches without the forced Tutorial after completion;
6. Settings entry to reopen the same canonical Tutorial;
7. removal of the old Home-owned competing onboarding lifecycle;
8. normal Product navigation presented horizontally at the top rather than as a permanent left rail;
9. both Sheet presentations continue to use the existing shared canonical Character source.

No Connected Play continuity/runtime semantics were implemented in this slice.

---

# 2. Runtime files added

```text
src/app/firstRunPreferences.ts
src/FirstRunTutorial.tsx
src/FirstRunTutorialBridge.tsx
src/first-run-tutorial.css
```

## `firstRunPreferences.ts`

Owns only local product preference state:

- `simplevtt.product.first-run.v1` completion marker;
- safe read/write fallback;
- no `AppSnapshot`, Character, Session, rules, network, or persistence-domain authority.

## `FirstRunTutorial.tsx`

Owns the focused Tutorial presentation and Sheet choice UI.

It does not:

- create a Character;
- start or join a Session;
- mutate rules/domain state;
- duplicate Character data.

## `FirstRunTutorialBridge.tsx`

Uses the same UI-local portal/bridge pattern already used by presentation features such as Appearance settings.

Implementation choice:

- the first-run gate is a focused product overlay rather than a new `AppRoute`;
- while open, the normal `.v1-shell` is made inert/aria-hidden;
- completion persists Sheet presentation and first-run completion independently;
- Settings can reopen the Tutorial through a portal into `.settings-card`.

This is intentionally narrower than adding Tutorial state to `AppSnapshot` or domain/application contracts.

---

# 3. Existing runtime files modified

```text
src/app/sheetLayoutPreferences.ts
src/V1HomeScreen.tsx
src/v1-product-shell.css
src/main.tsx
```

## Sheet preference

Added `readStoredSheetLayoutPreference()` so the Tutorial can distinguish:

```text
no explicit user selection
```

from:

```text
presentation fallback = SimpleVTT
```

The existing `readSheetLayoutPreference()` fallback remains intact for normal Sheet rendering.

## Home reconciliation

Removed the historical Home-owned `simplevtt.v1.guide.dismissed` onboarding lifecycle.

Home is now the returning/post-Tutorial Product surface and no longer competes with the canonical Tutorial.

## Product navigation reconciliation

The existing Product global navigation markup is retained to minimize `App.tsx` risk, but its runtime layout is changed from a permanent left rail to the accepted horizontal top Product navigation baseline.

The historical CSS class name `.v1-sidebar` remains for compatibility only; it no longer behaves or renders as a left sidebar.

A later cleanup may rename legacy class identifiers, but this is not required to satisfy the WO-UI-001 user-visible IA and must not be confused with the deferred Connected Product Shell continuity slice.

## Main composition

`FirstRunTutorialBridge` and its stylesheet are mounted/imported from `src/main.tsx`.

---

# 4. Tests added / reconciled

Added:

```text
tests/ui/firstRunTutorialPreferences.test.ts
tests/ui/firstRunTutorialStructure.test.ts
```

Reconciled:

```text
tests/ui/v1ProductShellStructure.test.ts
```

Updated CI:

```text
.github/workflows/ui.yml
```

The UI workflow runs both first-run tests together with the v1 Product Shell / Session layer contract tests.

`tests/ui/productionNonCharacterUxRedesign.test.ts` did not require modification because this implementation intentionally preserved the `App.tsx` function/surface boundaries that its unrelated regression assertions inspect.

---

# 5. QA mapping

## Required WO rows

- `QA-ID-04` — **PASS** — fresh first use is gated by the dedicated Tutorial
- `QA-ID-05` — **PASS** — both Sheet presentations preserve the existing shared `snapshot.activeCharacter`
- `QA-NAV-01` — **PASS** — Tutorial is the first meaningful fresh-use interaction
- `QA-NAV-02` — **PASS** — Tutorial requires an initial Sheet presentation choice
- `QA-NAV-03` — **PASS** — Standalone / Host / Join orientation is present
- `QA-NAV-04` — **PASS** — Settings can reopen the canonical Tutorial
- `QA-NAV-05` — **PASS** — global order is preserved and normal Product navigation is top-oriented

## Regression rows

- `QA-CHAR-01` — **PASS by unchanged regression path**
- `QA-CHAR-02` — **PASS** — existing presentation-only Sheet router preserved
- `QA-A11Y-01` — **PASS** — visible focus styling is present and CI structure checks are green
- `QA-A11Y-03` — **PASS** — Sheet selection uses text + `aria-pressed`, not color alone

## Explicitly deferred

- `QA-NAV-06` — deferred to WO-UI-002
- Connected Session / Play / targeting / resolution / privacy / Handout redesign rows — untouched by this Work Order

---

# 6. Bounded local verification

Before full CI completed, bounded verification also passed:

```text
PASS — TypeScript strict check for:
  src/app/firstRunPreferences.ts
  src/app/sheetLayoutPreferences.ts

PASS — isolated TSX strict syntax/type check with React/portal stubs for:
  src/FirstRunTutorial.tsx
  src/FirstRunTutorialBridge.tsx

PASS — executed preference behavior checks:
  fresh -> Tutorial incomplete / no explicit Sheet selection
  completion + Official preference persist independently
  invalid stored Sheet value does not become an explicit selection
```

---

# 7. GitHub Actions verification

Final successful UI workflow:

```text
run_id: 32486454036
source head_sha: ff3b253c840aa9c46f83ffcdd53374b1b5cd1760
conclusion: success
```

The run passed all executed UI steps, including:

```text
PASS — UI named-rule boundary
PASS — first-run / Product Shell / Session layer contract tests
PASS — PlaySessionDock regressions
PASS — production Play accessibility/structure
PASS — combat VFX boundaries
PASS — unified production Session UX
PASS — tabletop Sheet / dice / intent / acceptance regressions
PASS — non-Character product UX regressions
PASS — Host preparation / content regressions
PASS — live DM mechanics continuity
PASS — connected lifecycle / ownership / Character / inventory / spellcasting regressions
PASS — creation/progression regressions
PASS — authoritative spellcasting
PASS — Phase 09 mechanics services
PASS — TypeScript + production build
```

An earlier CI attempt failed only because two newly added navigation-order tests searched the entire `App.tsx` string and found unrelated earlier `characters` text. The assertions were corrected to inspect the actual global-nav declaration block; the implementation itself did not require a behavioral change for that failure.

---

# 8. Scope compliance

Not modified as part of WO-UI-001 behavior:

```text
src/ProductRoot.tsx
src/SessionModeRoot.tsx
src/ProductionPlayScreen.tsx
session authority / transport / lifecycle
Actor Boards
Command Center
targeting / Main Hand
resolution selective locking
DM-only privacy
Handout networking
map/spatial modules
Character creation / Level Up rules logic
```

`ProductRoot` connected-shell bypass and accepted Return-to-Play continuity remain intentionally deferred to `WO-UI-002`.

---

# 9. Completion gate

```text
RUNTIME IMPLEMENTATION AUTHORIZATION: USED / RECORDED
WO-UI-001 CODE: IMPLEMENTED
BOUNDED LOCAL CHECKS: PASS
FULL UI CI: PASS
PRODUCTION TYPESCRIPT / BUILD: PASS
WO-UI-001 VERIFIED COMPLETE: YES
WO-UI-002: NOT AUTHORIZED
```

WO-UI-001 is closed as a verified runtime slice. Any next runtime slice requires its own bounded Work Order / dependency gate / authorization.
