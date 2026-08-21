# WO-UI-002 — Implementation Record

Status: **CLOSED / ACCEPTED — AUTOMATED PASS — OWNER HUMAN QA PASS**

Work Order:

`WO-UI-002-connected-product-shell-continuity-return-to-play.md`

Scoped authorization:

`WO-UI-002-SCOPED-AUTHORIZATION.md`

Human QA:

`WO-UI-002-HUMAN-QA.md`

Accepted visual/interaction reference:

`docs/design/ui-ux/prototype/app/integrated-reference.html`

Accepted candidate code reference:

`4c12084bef603866b9b69f1bfd8f363146920184`

---

# Implemented bounded slice

**Connected Product Shell Continuity / Return to Play**

Implemented behavior:

```text
Live Connected Play
-> compact `SimpleVTT 메뉴`
-> Product Shell / safe Product destination
-> visible `플레이로 돌아가기`
-> exact same SessionModeRoot live Session
```

`AppProvider` remains above `ProductRoot`; no second Session store or second connected authority was introduced.

Preserved authoritative state includes:

- Session identity;
- Host/DM or Client/Player role;
- SessionMode;
- Initiative/current turn;
- controlled Actor where canonical;
- PendingResolution/game state;
- connection state;
- participants;
- HP/resources/effects/history.

Product navigation does not call Host/Join/stop/reconnect merely because a Product destination is opened.

---

# Runtime implementation

Primary touched files:

- `src/ProductRoot.tsx`;
- `src/product-root.css`;
- `tests/ui/v1ProductShellStructure.test.ts`;
- `tests/ui/connectedProductShellContinuity.test.ts`;
- `.github/workflows/ui.yml`.

The connected return path reuses the same `SessionModeRoot` instead of mounting `ProductionPlayScreen` as a second connected workspace.

---

# Behavior / QA traceability

Primary behavior:

- Scenario 34 — Product navigation during live Host Session.

Primary QA:

- `QA-NAV-06` — live Return to Play preserves context;
- `QA-SES-09` — Product navigation preserves role/session.

---

# Automated verification — PASS

Verified implementation lineage included exact-head UI workflow:

```text
run_id: 32490406078
job: frontend
conclusion: success
```

It covered the dedicated continuity gate, Session layer regressions, connected lifecycle/ownership, authoritative mechanics, TypeScript and production build.

Subsequent accepted Host lifecycle corrections (`Open -> immediate live Freeform`, zero-Player validity, live late join) were also exercised by exact-head connected/UI automation before Human QA.

---

# Owner Human QA — PASS

The owner manually exercised the bounded continuity flow and reported:

> 응 다 잘 됐어. 근데 UI형태가 이상한데 우리가 기획했던 대로의 레이아웃이야?

The first sentence is the bounded WO-UI-002 PASS verdict. See `WO-UI-002-HUMAN-QA.md`.

The second sentence is explicitly **not** acceptance of the broader Connected Play visual topology.

---

# Visual/topology boundary

WO-UI-002 did not implement or accept:

- Upper opposing Actor Board;
- Lower allied Actor Board;
- broad mapless Tabletop Stage composition;
- persistent Command Center topology;
- direct Hotbar capability composition.

The owner correctly identified this remaining drift after WO-UI-002 functionality passed.

That separate runtime slice is now:

`WO-UI-003-connected-play-actor-boards-command-center.md`

---

# Final evidence

```text
AUTOMATED VERIFICATION: PASS
OWNER HUMAN QA — NAVIGATION/CONTINUITY: PASS
WO-UI-002: CLOSED / ACCEPTED
CONNECTED PLAY BROAD LAYOUT: NOT ACCEPTED BY WO-UI-002
```

WO-UI-002 acceptance does not automatically accept or close WO-UI-003.
