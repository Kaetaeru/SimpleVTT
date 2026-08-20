# SimpleVTT UI/UX Planning Dashboard

This is the **default starting point for the owner**.

## Owner review — preferred workflow

Do not review the remaining UI/UX questions one-by-one in chat by default.

Edit the GitHub worksheets here:

[`owner-review/README.md`](owner-review/README.md)

Each predeclared question has:

```text
선택지: A / B / C / ... / CUSTOM
OWNER SELECT: <owner fills this>
OWNER NOTE: <optional or controlling text for CUSTOM>
AI STATUS: PENDING / PROCESSED   # AI-managed
```

After editing the worksheets, tell AI to process/reconcile them. AI reads the filled owner fields, validates dependencies/conflicts, writes canonical Decision Cards to [`decisions.md`](decisions.md), updates derived planning files, and marks processed worksheet entries.

**Candidate options in the worksheet are not product truth. A filled `OWNER SELECT` / `OWNER NOTE` is explicit owner input. Canonical made-decision authority is established after reconciliation in `decisions.md`.**

No worksheet selection Freezes a decision or authorizes implementation.

## Worksheet files

| File | Sheets |
| --- | --- |
| [`owner-review/01-foundation-navigation-layout.md`](owner-review/01-foundation-navigation-layout.md) | UX-03, NAV-01, UI-01, INT-01 |
| [`owner-review/02-states-layering-confirmation.md`](owner-review/02-states-layering-confirmation.md) | STATE-01, STATE-02, INT-02, INT-03 |
| [`owner-review/03-visual-components-content.md`](owner-review/03-visual-components-content.md) | UI-02, UI-03, UI-04, UI-05, CMP-01, CONTENT-01 |
| [`owner-review/04-accessibility-platform.md`](owner-review/04-accessibility-platform.md) | A11Y-01, PLATFORM-01 |
| [`owner-review/05-dnd-experience.md`](owner-review/05-dnd-experience.md) | DND-01, DND-02, DND-03, DND-04 |
| [`owner-review/06-session-authority-dm-content.md`](owner-review/06-session-authority-dm-content.md) | SES-01, SES-02, DM-01, DM-02, CONTENT-02 |

## AI entry

For AI agents:

1. read [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md);
2. inspect [`MANIFEST.yaml`](MANIFEST.yaml);
3. pass [`PREFLIGHT.md`](PREFLIGHT.md);
4. for Route A, read the current owner-review worksheet **before asking any question in chat**.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Current planning status

| Item | Current state |
| --- | --- |
| Meta governance baseline | **Stable v1** |
| Global Planning Gate | **PASS** |
| `UX-01` | **Reviewed**, none Frozen |
| `UX-02` | **Reviewed**, none Frozen |
| `UX-03` | **In Review**; owner input lives in worksheet 01 |
| `NAV-01` through `CONTENT-02` | Complete predeclared T2 maps; owner worksheet choices prepared |
| 27-sheet Review Plan | **All 27 T2 Decision Maps complete** |
| R1-R9 inventory | **PASS** for current active runtime/planning snapshot |
| M1-M6 coverage | **PASS** for current snapshot |
| Missing / Duplication / Coverage audit | **PASS** |
| Implementation | **Not authorized** |

## UX-02 reviewed checkpoint

```text
UX-02-01 Host = DM; Client = Player.
UX-02-02 Offline/Standalone has no DM/Player role.
UX-02-03 Character ownership establishes baseline control of its Actor.
UX-02-04 Player defaults to one Actor; DM may assign additional Actors without transferring ownership.
UX-02-05 DM may control any Actor.
UX-02-06 No live DM <-> Player role switching.
UX-02-07 Shared core Play skeleton; role-specific tools/information may differ.
UX-02-08 Unauthorized-information handling is information-specific; DM-only/secret authoritative data remains strict non-delivery to Player.
UX-02-09 No Spectator / Co-DM / Observer / extra connected roles in v1.
UX-02-09A Extra-role permission branch is N/A in v1.

Frozen changes: none
```

## Global Planning Gate — PASS

```text
[x] R1-R9 complete inventory cross-check
[x] M1-M6 material coverage
[x] all 27 governance sheets have complete T2 Decision Maps
[x] Missing / Duplication / Coverage audit passes
[x] owner whole-product coverage checkpoint delivered
```

Passing this gate allows planning review to continue. It does not Freeze product decisions and does not authorize implementation.

## Open material gaps

- `GAP-JOIN-NO-CHARACTER`
- `GAP-MAIN-HAND-CANONICAL-RELATION`
- `GAP-DM-ROLL-VISIBILITY-PERSISTENCE`
- `GAP-ACTOR-CONTEXT-MENU-CONTENTS`
- `GAP-RESOLUTION-SAFE-INTERACTIONS`
- `GAP-HANDOUT-NETWORK-CONTRACT`
- `GAP-DM-ONLY-DELIVERY-PROTOCOL` — Critical
- `GAP-DM-PRIVATE-ACTIVITY-PRESENTATION` — Deferred
- `GAP-CANONICAL-UX-DOC-RECONCILIATION` — Deferred

## Current next work

```text
Route A — Owner worksheet review
Current sheet: UX-03 — Information Hierarchy
Current worksheet: owner-review/01-foundation-navigation-layout.md
Current IDs: UX-03-01 through UX-03-08
Next sheet after completion: NAV-01
```

The owner may fill later worksheet files in advance. AI processes filled entries in canonical dependency/review order.

## Owner controls — plain language is enough

| Owner says | AI must do |
| --- | --- |
| `워크시트 반영해` / `내가 입력했어` | Read pending `OWNER SELECT` / `OWNER NOTE`, reconcile them, write canonical decisions, update statuses. |
| `현재 상태 보여줘` | Summarize this Dashboard, pending worksheet state, and material gaps. |
| `이 결정 바꾸자` | Resolve affected canonical Decision ID, update/supersede the Decision Card, calculate impact. |
| `이 플로우 바꾸자` | Use `master-flow.md` as readable view, resolve canonical source first, then refresh derived flow. |
| `채팅으로 질문해줘` | Temporarily review the current predeclared questions conversationally instead of through worksheets. |
| `이건 확정` / `freeze` | Freeze only explicitly named canonical scope and run impact checks. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, Contract Readiness, spec tier, contracts, Work Order, and authority-domain compatibility. |

## Canonical / supporting files

Owner-facing:

- [`owner-review/README.md`](owner-review/README.md) — **preferred owner input workspace**.
- [`README.md`](README.md) — dashboard.
- [`decisions.md`](decisions.md) — canonical made Decision Cards.
- [`review-plan.md`](review-plan.md) — canonical question IDs/order.
- [`master-flow.md`](master-flow.md) — derived readable flow/topology.
- [`planning-gaps.md`](planning-gaps.md) — explicit material unknowns.

AI-maintained support:

- [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md)
- [`MANIFEST.yaml`](MANIFEST.yaml)
- [`PREFLIGHT.md`](PREFLIGHT.md)
- [`registry.md`](registry.md)
- [`matrices.md`](matrices.md)
- [`templates.md`](templates.md)

## Core authority reminders

- Filled worksheet selections are explicit owner input but are not yet canonical Decision Cards until reconciled.
- Unselected candidate options have zero product authority.
- Selected/Reviewed/Frozen Decision Cards are planning truth over current implementation within valid Product/UX scope.
- Only Frozen decisions are stable implementation dependencies by default.
- Product/UX decisions do not override domain/architecture contracts.
- Current code is evidence, not automatic product truth.
- Missing material policy is a declared Draft Decision Map item or Planning Gap, never AI invention.
- AI never Freezes automatically.
