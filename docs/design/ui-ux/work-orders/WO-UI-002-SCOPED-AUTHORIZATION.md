# WO-UI-002 — Scoped Product/UX Dependency + Runtime Authorization

Status: **ACTIVE FOR WO-UI-002 ONLY**

Owner authorization: **explicitly approved in conversation on 2026-08-21**

Owner instruction:

> 최신 기획 문서를 잘 참고하면서 다음 작업을 이어서 해줘

Applies only to:

`docs/design/ui-ux/work-orders/WO-UI-002-connected-product-shell-continuity-return-to-play.md`

This record uses the scoped-authorization mechanism defined by the UI/UX planning framework. For this Work Order only, the dependencies below are stable implementation inputs and the bounded runtime implementation described by WO-UI-002 is authorized.

It does **not** globally change Decision Card lifecycle state and does not authorize WO-UI-003 or any adjacent runtime slice.

## Scoped dependency set

For WO-UI-002 implementation only, the following Product/UX dependencies are fixed and MUST NOT be reinterpreted by implementation code/tests:

- `UX-01-02` — one common Product Shell + dedicated Play Workspace
- `UX-01-03` — authoritative/session/game state survives leaving/returning to Play
- `UX-02-01` — Host = DM / Client = Player
- `UX-02-06` — no live DM/Player role switching
- `UX-02-07` — DM/Player share the same core Play workspace grammar
- `UX-03-01` — Product destinations remain Home / Characters / Session / Content / Rules / Settings
- `UX-03-02` — dedicated Play retains a persistent Product Shell return path
- `NAV-01-01` — global Product navigation order
- `NAV-01-02` — visible Return to Play while a live Session exists
- `NAV-01-04` — supporting Product utilities preserve a safe prior context where practical
- `NAV-01-06` — Back / Close / Return remain semantically distinct
- `NAV-01-08` — application restart begins at Home; no silent connected-Session restoration
- `UI-01-01` — Product Shell remains top-navigation based

## Stable implementation meaning for this Work Order

The implementation may rely on the following without asking new Owner questions:

1. A newly live connected Session opens the dedicated `SessionModeRoot` Play workspace.
2. Connected Play exposes a compact, keyboard-reachable Product Shell entry in Play chrome.
3. Opening Product Shell is presentation navigation only and must not call Host/Join/Stop/reconnect operations.
4. While a live connected Session remains authoritative, safe Product Shell destinations are usable and show a visible Return to Play path.
5. Return to Play restores the existing `SessionModeRoot`; it must not mount `ProductionPlayScreen` as a second connected Play implementation.
6. Navigation preserves Session identity, Host/Client role, SessionMode, initiative/current turn, authoritative controlled Actor where valid, PendingResolution, connection state, participants, HP/resources/effects and committed history.
7. Product-vs-Play workspace selection is local presentation state only. It is not a second Session store and is not persisted across process restart.
8. Session End/Leave remains a separate lifecycle action from Product navigation.

## Explicit implementation authorization

This Owner instruction authorizes production changes only for the bounded WO-UI-002 source/test scope after the required contract and source inspection has passed.

Authorized primary scope:

```text
src/ProductRoot.tsx
src/App.tsx
src/SessionModeRoot.tsx
src/session-mode.css

tests/ui/v1ProductShellStructure.test.ts
tests/ui/connectedProductShellContinuity.test.ts
.github/workflows/ui.yml
```

Conditional/minimal scope remains limited to the Work Order.

## Explicit non-scope

This authorization does **not** authorize:

- Connected Play topology redesign;
- Actor Board redesign;
- Command Center redesign;
- targeting / Main Hand behavior;
- selective Resolution locking;
- DM-only delivery/privacy protocol;
- Handout networking/reconnect contract;
- Session transport/wire/authority changes;
- Host/Join lifecycle redesign;
- Character rules/progression changes;
- map/spatial modules;
- any future Work Order.

## Current Domain / Architecture blockers

The current declared repository-wide gaps do not materially block WO-UI-002 because this slice changes presentation/navigation composition only.

Open gaps remain open and out of scope:

- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL`

## Required verification

Primary behavior:

- Scenario 34 — Product navigation during live Host Session

Primary QA:

- `QA-NAV-06`
- `QA-SES-09`

Adjacent regression scenarios/QA remain those named in WO-UI-002.

Implementation remains draft/unmerged and must be verified at the exact resulting head before this Work Order can be closed.
