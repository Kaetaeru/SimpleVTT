# WO-UI-001 — Scoped Product/UX Implementation Freeze

Status: **ACTIVE FOR WO-UI-001 ONLY**

Owner authorization: **explicitly approved in conversation on 2026-08-21**

Applies only to:

`docs/design/ui-ux/work-orders/WO-UI-001-product-shell-first-run-tutorial-sheet-preference.md`

This record uses the scoped-authorization exception defined by `docs/design/ui-ux-planning-framework.md`: Reviewed Product/UX decisions may be relied upon as stable implementation dependencies when an explicit scoped authorization says so.

It does **not** globally change the lifecycle status of these Decision Cards in `decisions.md`; outside WO-UI-001 they remain governed by their canonical lifecycle status.

## Scoped frozen dependency set

For WO-UI-001 implementation only, the following Reviewed decisions are fixed implementation dependencies and MUST NOT be reinterpreted or changed by implementation code/tests:

- `UX-01-01` — Product posture
- `UX-01-02` — Application relationship
- `UX-03-01` — Global destinations stay small
- `UX-03-05` — Standalone Sheet prioritizes identity and use
- `NAV-01-01` — Global menu order
- `NAV-01-04` — Utility return restores prior context
- `NAV-01-07` — First-run guidance is an overlay
- `NAV-01-08` — App restart begins at Home
- `UI-01-01` — Product Shell uses top navigation
- `UI-01-07` — Two first-class Character Sheet layouts

## Stable implementation meaning for this Work Order

The implementation may rely on the following without asking new Owner questions:

1. Fresh first use presents dedicated Tutorial/Onboarding before Home.
2. Tutorial explains Standalone Character use and Connected Host/Join orientation.
3. Tutorial asks for the initial Official-style vs SimpleVTT Sheet presentation.
4. Both Sheet presentations render the same canonical Character; layout is presentation-only state.
5. Returning app launch begins at Home after tutorial completion.
6. Tutorial can be reopened from Settings/Help without resetting Character/session/rules state.
7. Product Shell global order is Home -> Characters -> Session -> Content -> Rules -> Settings.
8. Normal Product Shell navigation is top-header based, not a permanent left navigation rail.
9. Supporting utility return preserves the prior safe Product context where practical.

## Explicit non-scope

This scoped freeze does **not** authorize or freeze:

- `UX-01-03` Play continuity;
- `NAV-01-02` Persistent Return to Play;
- `QA-NAV-06` connected Return-to-Play continuity;
- Connected Session lifecycle/role behavior;
- Connected Play composition;
- targeting, resolution, Activity privacy, Handout, or spatial contracts;
- any Domain/Architecture rule or networking semantics;
- `WO-UI-002` or later Work Orders.

## Current runtime blockers

None of the repository-wide open Domain/Architecture gaps materially blocks WO-UI-001.

The remaining gate is **separate explicit runtime implementation authorization**. This freeze record alone does not authorize edits under `src/` or runtime tests.
