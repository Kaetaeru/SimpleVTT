# WO-UI-010 — Quick right pane and transfer foundation

Date: 2026-08-22
Status: QUICK PANE IMPLEMENTED / TRANSFER FOUNDATION PLANNED
Authority: Owner direction during Connected Play review

## Quick menu scope

- Move Session Quick from the centered dimming popup into the existing contextual right utility host.
- Preserve Ctrl/Cmd+K, launcher toggle, search, Escape close, and focus return.
- Choosing a result swaps the same right pane to the selected existing utility.
- Keep Scene, Actor Boards, and Command Center mounted and operable while Quick is open.
- Do not create Quick-local Session or Library authority.

## Transfer foundation scope

Record the application/domain boundary required for item and currency exchange before adding controls. The canonical foundation is `../ITEM-CURRENCY-TRANSFER-FOUNDATION.md`.

No transfer button or mutable Party Stash fixture is authorized by this Work Order alone. Runtime work starts with endpoint, policy, lifetime, idempotency, validation, and atomic commit contracts.

## Acceptance

- Quick occupies the right contextual pane with no modal/backdrop semantics.
- Scene and Command Center remain visible; Command Center is not suspended by Quick alone.
- selecting a Quick destination keeps navigation in the same pane.
- Ctrl/Cmd+K and Escape remain predictable.
- structural/type/build/browser checks pass.
- transfer foundation specifies ownership, policy, lifetime, atomicity, network privacy, persistence, and the first vertical slice.
