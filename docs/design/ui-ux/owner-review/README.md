# SimpleVTT Owner Review Worksheets

Status: **owner input workspace — not a canonical Decision Ledger**

This folder is the preferred place for the product owner to answer the predeclared UI/UX review questions without doing the review interactively in chat.

Canonical question IDs/order still live in [`../review-plan.md`](../review-plan.md). Canonical made decisions still live in [`../decisions.md`](../decisions.md).

## How to use

For each question block:

1. Read the question and candidate options.
2. Put one option code in `OWNER SELECT`.
3. If the provided options are not right, use `CUSTOM` and write the desired behavior in `OWNER NOTE`.
4. Leave questions unanswered when you do not want to decide them yet.
5. Conditional questions may use `N/A` only when their declared condition is false.

Example:

```text
OWNER SELECT: B
OWNER NOTE: Keep the same workspace skeleton, but DM utilities may use an extra contextual pane.
AI STATUS: PENDING
```

Do not edit `AI STATUS`; AI uses it only to record whether an owner entry has been reconciled into canonical planning.

## Interpretation rules

- A filled `OWNER SELECT` / `OWNER NOTE` is **owner input** and must be preserved exactly in intent.
- The worksheet does not become a second canonical decision store. AI validates dependencies/contradictions, then writes the resulting Decision Card to `../decisions.md` and synchronizes derived planning files.
- AI MUST NOT silently replace an owner selection with its preferred option.
- If two filled answers truly conflict, AI stops on those IDs and reports the conflict instead of guessing.
- Candidate options are review scaffolding, not product truth.
- `CUSTOM` is always valid.
- Existing Reviewed/Frozen constraints still apply; an option that would contradict an applicable canonical decision must be flagged before canonicalization.
- After successful reconciliation, AI changes `AI STATUS` from `PENDING` to `PROCESSED` and may record the canonical Decision ID/status.

## Current reviewed baseline

- `UX-01` — Reviewed.
- `UX-02` — Reviewed.
- Current next sheet — `UX-03`.
- No product decision is Frozen by these worksheets.
- Filling a worksheet does not authorize implementation.

## Worksheet files

| File | Sheets |
| --- | --- |
| [`01-foundation-navigation-layout.md`](01-foundation-navigation-layout.md) | UX-03, NAV-01, UI-01, INT-01 |
| [`02-states-layering-confirmation.md`](02-states-layering-confirmation.md) | STATE-01, STATE-02, INT-02, INT-03 |
| [`03-visual-components-content.md`](03-visual-components-content.md) | UI-02, UI-03, UI-04, UI-05, CMP-01, CONTENT-01 |
| [`04-accessibility-platform.md`](04-accessibility-platform.md) | A11Y-01, PLATFORM-01 |
| [`05-dnd-experience.md`](05-dnd-experience.md) | DND-01, DND-02, DND-03, DND-04 |
| [`06-session-authority-dm-content.md`](06-session-authority-dm-content.md) | SES-01, SES-02, DM-01, DM-02, CONTENT-02 |

## Processing order

AI processes filled selections in the canonical sheet order from `review-plan.md`, and within a sheet in dependency order. You may fill later files early; they simply remain pending until their dependencies are reconciled.

Preferred owner workflow:

```text
Edit worksheet files in GitHub
-> tell AI to process/reconcile the worksheet
-> AI reads filled OWNER SELECT / OWNER NOTE fields
-> AI validates dependencies and existing decisions
-> AI writes canonical Decision Cards
-> AI updates review-plan / matrices / dashboard / gaps as needed
-> worksheet AI STATUS becomes PROCESSED
```
