# UI Reference Prototype — Build Verification

Status: **STATIC VERIFICATION PASS — BROWSER OWNER REVIEW PENDING**

This record verifies the current standalone Reference Prototype candidate without claiming browser/visual acceptance that has not happened yet.

## Candidate files present

Verified on `agent/108-production-play-session-ux`:

```text
docs/design/ui-ux/prototype/app/index.html
docs/design/ui-ux/prototype/app/prototype.css
docs/design/ui-ux/prototype/app/prototype.js
docs/design/ui-ux/prototype/app/fixtures.js
docs/design/ui-ux/prototype/app/review-patch.css
docs/design/ui-ux/prototype/app/review-patch.js
docs/design/ui-ux/prototype/app/README.md
```

## Structural checks

```text
[x] Prototype Controls are outside the product viewport and explicitly labeled NOT PRODUCT UI.
[x] Scenario selector exists.
[x] Direct Surface selector exists.
[x] Host/DM, Client/Player, Offline view selector exists.
[x] Freeform / Initiative selector exists.
[x] Wide / Normal / Narrow desktop presets exist.
[x] Connection, Handout, Public/DM Only, Reduced Motion, Error and Pending controls exist.
[x] Component Gallery entry exists.
[x] Reset Layout exists.
[x] fixtures.js declares PROTO-SCN-01 through PROTO-SCN-34.
[x] Standalone Character roll has a dedicated review presentation.
[x] Offline Product Shell review hides Return to Play unless a live connected context is being represented.
```

## Boundary checks

Static inspection of the prototype app found:

```text
[x] no production src/ import/reference in prototype.js
[x] no fetch( call in prototype.js
[x] no WebSocket use in prototype.js
[x] no real backend/network/storage wiring intentionally added
[x] target validity and unavailable reasons come from fixtures
[x] DM-only Player view filters private fixture rows instead of showing placeholders
[x] Main Hand unavailable example does not select a fallback action
```

All writes in this prototype execution were confined to `docs/design/ui-ux/` and especially `docs/design/ui-ux/prototype/`. No production `src/` file was modified by this work.

## Execution limitation

An attempted local syntax/runtime verification could not download the GitHub branch into the execution container because that container could not resolve `raw.githubusercontent.com`.

Therefore this record does **not** claim:

- browser rendering has been visually inspected;
- every interaction has been exercised in a real browser;
- JavaScript runtime errors are impossible;
- Prototype Acceptance has passed.

Those checks belong to the next Owner/browser review iteration.

## Current result

```text
P0 PROTOTYPE SPECIFICATION: PASS
P1 REFERENCE HTML AUTHORING: REVIEW CANDIDATE CREATED
STATIC BOUNDARY / COVERAGE CHECK: PASS
BROWSER VISUAL / INTERACTION REVIEW: PENDING
P2 OWNER REVIEW ITERATION: READY
P3 OWNER ACCEPTANCE: NOT STARTED
P4 RUNTIME PREPARATION: BLOCKED
P5 RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```

Any defect found when opening the HTML should be fixed inside the prototype before Product Decision Freeze/runtime preparation.