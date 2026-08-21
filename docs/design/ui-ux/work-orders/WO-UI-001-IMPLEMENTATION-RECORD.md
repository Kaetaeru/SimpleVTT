# WO-UI-001 — Runtime Implementation Record

Status: **IMPLEMENTED — VERIFICATION IN PROGRESS**

Owner runtime authorization: **explicitly approved in conversation on 2026-08-21**

Work Order:

`WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md`

Scoped dependency freeze:

`WO-UI-001-SCOPED-FREEZE.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

---

# 1. Implemented behavior

The WO-UI-001 runtime slice now implements:

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

The UI workflow now runs both first-run tests together with the v1 Product Shell / Session layer contract tests.

`tests/ui/productionNonCharacterUxRedesign.test.ts` did not require modification because this implementation intentionally preserved the `App.tsx` function/surface boundaries that its unrelated regression assertions inspect.

---

# 5. QA mapping

## Required WO rows

- `QA-ID-04` — implemented; verification pending full UI workflow
- `QA-ID-05` — implemented using existing shared `snapshot.activeCharacter`; verification pending full UI workflow
- `QA-NAV-01` — implemented; Tutorial overlay blocks normal shell interaction on fresh first use
- `QA-NAV-02` — implemented; initial Sheet choice required
- `QA-NAV-03` — implemented; Standalone / Host / Join orientation present
- `QA-NAV-04` — implemented; Settings reopen entry present
- `QA-NAV-05` — implemented; global order preserved and normal layout moved to top navigation

## Regression rows

- `QA-CHAR-01` — untouched Character opening/domain path
- `QA-CHAR-02` — existing presentation-only Sheet router preserved
- `QA-A11Y-01` — explicit focus-visible styling added for Tutorial and Product navigation
- `QA-A11Y-03` — Sheet selection uses text + `aria-pressed`, not color alone

## Explicitly deferred

- `QA-NAV-06` — deferred to WO-UI-002
- Connected Session / Play / targeting / resolution / privacy / Handout QA rows — untouched

---

# 6. Local verification completed

Because the current GitHub Actions runner remains queued, bounded local verification was also performed:

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

These bounded checks do not replace repository-wide UI CI or production build verification.

---

# 7. GitHub Actions verification

Latest UI workflow after adding the new tests:

```text
run_id: 32485913472
head_sha: b5b408293229bc7eaeeff7b7e044c86222f8f30d
status at record creation: queued
```

The workflow includes TypeScript/production build and broad UI regressions.

Final runtime verification remains **PENDING** until the runner executes.

Do not mark this Work Order fully verified merely from the local bounded checks.

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

Current:

```text
RUNTIME IMPLEMENTATION AUTHORIZATION: USED / RECORDED
WO-UI-001 CODE: IMPLEMENTED
BOUNDED LOCAL CHECKS: PASS
FULL UI CI / PRODUCTION BUILD: QUEUED / PENDING
WO-UI-001 VERIFIED COMPLETE: NO — waiting on actual CI result
WO-UI-002: NOT AUTHORIZED
```
