# WO-UI-002 — Implementation Record

Status: **IMPLEMENTED — AUTOMATED VERIFICATION PASS — OWNER HUMAN QA PENDING**

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

# Automated verification — PASS

Verified source/runtime implementation commit:

```text
cd9b514b3169c63d69a42bdfbb4672fe7131d1cd
```

The documentation-only implementation-record commit then moved the PR head to:

```text
34671a9c33c855a69b4507805477c9c1973015e7
```

The exact-head UI workflow for that head completed successfully:

```text
run_id: 32490406078
job: frontend
conclusion: success
```

Passed in that workflow:

- dependency install / generated content;
- UI named-rule boundary;
- **WO-UI-002 connected Product Shell continuity gate**;
- v1 first-run / Product Shell / Session layer contracts;
- Session accessibility/responsive/layer regressions;
- Phase 14 Play/session/tabletop-sheet/physics-dice/non-Character/live-DM regressions;
- connected lifecycle / Character ownership / inventory / spellcasting regressions;
- creation/progression representative regressions;
- authoritative spellcasting;
- Phase 09 real mechanics services;
- **TypeScript + production build**.

No automated failure was observed in the UI workflow.

---

# Remaining acceptance gate

WO-UI-002 is **not closed yet**.

Required next gate:

**Owner Human QA of the bounded navigation flow.**

Review path:

```text
Host or Client enters live Connected Play
-> use `SimpleVTT 메뉴`
-> open Home or Rules while Session remains live
-> use `플레이로 돌아가기`
-> verify the same live Session/role/mode/turn/context is still present
```

Also verify that:

- `SimpleVTT 메뉴` does not end the Session;
- `세션 종료` / leave remains a separate action;
- narrow window still exposes the Product entry;
- Return to Play does not open a visibly different/legacy connected Play screen.

Do not mark WO-UI-002 CLOSED / ACCEPTED until the Owner reports the human result.

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
