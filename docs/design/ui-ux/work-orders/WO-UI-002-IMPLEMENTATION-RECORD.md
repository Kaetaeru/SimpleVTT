# WO-UI-002 — Implementation Record

Status: **IMPLEMENTED — EXACT-HEAD AUTOMATED VERIFICATION PENDING**

Work Order:

`WO-UI-002-connected-product-shell-continuity-return-to-play.md`

Scoped authorization:

`WO-UI-002-SCOPED-AUTHORIZATION.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

---

# Implemented bounded slice

**Connected Product Shell Continuity / Return to Play**

Current implementation changes:

- `src/ProductRoot.tsx`
  - separates authoritative live-session truth from local `product | play` presentation state;
  - newly-live connected Session enters the dedicated `SessionModeRoot`;
  - ordinary snapshot refresh does not force a user who intentionally opened Product Shell back into Play;
  - Session end/offline returns presentation to Product Shell;
  - Connected Play exposes a compact Product Shell entry;
  - live Product Shell Return-to-Play controls are captured before the legacy local `scene` route can mount `ProductionPlayScreen` as a second connected Play implementation.
- `src/product-root.css`
  - compact keyboard-visible Product Shell entry;
  - constrained desktop variants without hiding the control.
- `tests/ui/v1ProductShellStructure.test.ts`
  - replaces the stale `connected => SessionModeRoot only` structural assumption with Product-vs-Play continuity requirements.
- `tests/ui/connectedProductShellContinuity.test.ts`
  - dedicated WO-UI-002 structural gate for authority/presentation separation and Return-to-Play reuse.
- `.github/workflows/ui.yml`
  - adds the dedicated continuity test to the UI workflow.

No Session transport, runtime authority, action mechanics, targeting, privacy, Handout networking, map/spatial, Character rules, or progression code was changed.

---

# Authority preservation

The implementation intentionally leaves `AppProvider` above `ProductRoot` and does not create a second Session store.

Presentation-only state:

```text
ProductRoot surface = product | play
```

Authoritative state remains in existing application/runtime projections:

```text
Session identity
Host/Client role
SessionMode
initiative/current turn
controlled Actor where canonical
PendingResolution
connection state
participants
HP/resources/effects
committed history
```

Product navigation does not call:

```text
stopSession
hostSession
joinSession
startPreparedSession
setSessionReady
```

Session termination remains an explicit, separate control inside the existing Session workspace.

---

# Behavior / QA traceability

Primary behavior:

- Scenario 34 — Product navigation during live Host Session

Primary QA:

- `QA-NAV-06` — live Return to Play preserves context
- `QA-SES-09` — Product nav preserves role/session

Adjacent regression coverage remains as defined by the Work Order.

---

# Verification state

Current exact implementation head before this record:

```text
cd9b514b3169c63d69a42bdfbb4672fe7131d1cd
```

UI workflow:

```text
run_id: 32490366407
status at record creation: queued
```

Other exact-head PR workflows were also queued/pending at that checkpoint.

Do not mark WO-UI-002 closed until exact-head automated verification has completed successfully and any required Owner Human QA is recorded.

---

# Remaining scope boundary

Still out of scope and unresolved here:

- Connected Play topology / Actor Boards / Command Center redesign;
- Main Hand canonical relation;
- selective Resolution safe-interaction contract;
- DM-only delivery/privacy protocol;
- shared Handout network/reconnect contract;
- map/spatial modules;
- future Work Orders.
