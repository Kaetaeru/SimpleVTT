# UI Reference Prototype — Acceptance

Status: **Prototype acceptance checklist — HTML not built yet**

This checklist defines when the standalone HTML Reference Prototype is good enough to become the visual/interaction reference for runtime implementation preparation.

Prototype acceptance is a **separate gate** from Product Decision Freeze and runtime implementation authorization.

---

# 1. Acceptance states

Allowed status values for this document:

- `NOT BUILT`
- `IN REVIEW`
- `NEEDS CHANGE`
- `ACCEPTED`

Current overall status:

```text
PROTOTYPE: NOT BUILT
OWNER ACCEPTANCE: NOT STARTED
```

---

# 2. Product hierarchy acceptance

```text
[ ] Home / Characters / Session / Content / Rules / Settings are understandable as the global product structure.
[ ] Activity / Encounter / Adjudication / Session utilities feel contextual rather than duplicate top-level destinations.
[ ] Return to Play is obvious while a live session exists.
[ ] First-run guidance is understandable and reopenable without becoming a permanent interruption.
[ ] Character Library feels like the Character-management hub.
[ ] Official-style and SimpleVTT Character Sheets both feel first-class.
```

---

# 3. Session-flow acceptance

```text
[ ] Host opens a session and clearly lands directly in an already-live Freeform session.
[ ] No hidden/accidental Lobby / Ready / Start Session stage remains.
[ ] DM can understand how to prepare/edit while the live session remains active.
[ ] A Player can visually understand mid-session Join.
[ ] No-Character Join clearly blocks and offers Create / Import recovery before retry.
[ ] Host=DM and Client=Player presentation is unambiguous.
[ ] There is no v1 Spectator / Co-DM / Observer UI accidentally exposed.
```

---

# 4. Play composition acceptance

```text
[ ] Scene/Actor Context and Command Center both feel co-primary.
[ ] Upper opposing Actor Board and lower allied Actor Board are legible without overwhelming Scene space.
[ ] Command Center remains persistent and discoverable.
[ ] Initiative adds a compact top tracker without replacing Actor Boards.
[ ] Current turn, selected Actor, controlled Actor, valid target, invalid target and focus states are distinguishable.
[ ] DM and Player share the core Play skeleton while role-specific tools/information differ clearly.
[ ] Important current state can use NOTICE UI without turning into a second Activity feed.
```

---

# 5. Command Center acceptance

```text
[ ] Controlled Actor context is understandable.
[ ] Hotbar page structure is understandable.
[ ] Actions remain directly discoverable; the prototype does not reintroduce intent-first hidden capability funnels.
[ ] Action / Bonus Action / Reaction / Movement indicators are clear.
[ ] Dynamic Resource Rail remains readable with several resources.
[ ] Selected, unavailable, pending and resolving states are distinct.
[ ] Resolution preserves the Command Center skeleton.
[ ] Multi-target flow exposes explicit Execute; single-target valid click does not add an extra confirmation.
[ ] Main Hand unavailable state shows an explicit mock-provided reason and no smart fallback.
```

---

# 6. Layer / utility acceptance

```text
[ ] Activity pane can coexist with Play without making the core scene unusable.
[ ] Encounter and advanced DM spatial tool feel contextual, not permanent Play anchors.
[ ] Quick Sheet and Full Sheet have clearly different presentation weight.
[ ] Full Sheet preserves live-session continuity and has a clear return path.
[ ] Actor Context Menu contains UI/context management rather than duplicate Attack/Spell/Item commands.
[ ] Hover explanation frames help dense controls without hiding essential information exclusively behind hover.
[ ] Confirmation modals clearly outrank lower contextual layers.
[ ] Reaction/interrupt presentation retains enough Scene/Actor orientation.
```

---

# 7. Handout acceptance

```text
[ ] Overlay, Upper Scene and Full Scene are visually and behaviorally distinct.
[ ] Player local dismiss/reopen is understandable for Overlay.
[ ] Player cannot accidentally dismiss DM-controlled Upper/Full shared presentation through generic layer behavior.
[ ] Full Scene remains recognizably inside the live session, not a new Product route.
[ ] Zoom/pan reads as local presentation behavior.
[ ] Prototype labels handout shared-state behavior as mock/visual because real network contract is unresolved.
```

---

# 8. Dice / result acceptance

```text
[ ] Dice presentation uses the broad central table/scene area.
[ ] Dice visual communicates far/back -> near/front -> settle concept.
[ ] Final face/result is clearly fixture-authoritative rather than physics-authoritative.
[ ] Result feedback remains scene-integrated.
[ ] Activity/detail path is visible without turning result into a full-screen route.
[ ] Reduced-motion mode preserves result and comprehension order.
```

---

# 9. Privacy / Activity acceptance

```text
[ ] DM view clearly marks DM Only state continuously.
[ ] DM Activity may show public/private entries in one chronology with filter.
[ ] Player view contains no placeholder/existence marker for mock DM-only events.
[ ] Later disclosure is visually distinguishable from rerolling/recalculating.
[ ] Correction/reversal keeps original history and adds a related new event.
```

This visual pass does not resolve `GAP-DM-ONLY-DELIVERY-PROTOCOL`; production privacy still requires architecture contract.

---

# 10. Content acceptance

```text
[ ] Official SimpleVTT package import flow is understandable.
[ ] Valid/warning/blocking/unsupported validation states are distinct.
[ ] Install/update/replace/disable/delete lifecycle is visible without overwhelming normal Content view.
[ ] Live session content snapshot remains visibly stable after local library update example.
[ ] The UI does not imply that current live session changed because the library changed.
```

---

# 11. Responsive desktop acceptance

Test all required major surfaces at:

- Wide 1600×1000
- Normal 1366×768
- Narrow Desktop 960×700

```text
[ ] Core Command Center remains directly reachable at Narrow Desktop.
[ ] Scene/Actor context remains usable.
[ ] Actor Cards stop shrinking at a usable size and switch to paging/scroll as needed.
[ ] Utility pane transformation does not become a mobile-first navigation model.
[ ] Full Sheet remains usable.
[ ] Handout controls remain usable.
[ ] Modals/popovers remain inside viewport.
[ ] Long names, many resources and long Activity rows do not destroy hierarchy.
```

---

# 12. Accessibility / interaction acceptance

```text
[ ] Common actionable controls are keyboard reachable unless an explicit reviewed exception exists.
[ ] Visible focus is obvious.
[ ] Modal focus behavior is understandable.
[ ] Hover-only help has a focus/alternate equivalent where required.
[ ] State meaning never depends on color alone.
[ ] Reduced motion can be toggled in Prototype Controls.
[ ] Pointer targets remain practically usable in compact Play UI.
[ ] Right-click Actor Context Menu remains supplementary; essential information/actions are available elsewhere.
```

---

# 13. Prototype-boundary acceptance

```text
[ ] Prototype lives only under docs/design/ui-ux/prototype/app/.
[ ] No production `src/` file is imported or modified.
[ ] No real backend/network/session/storage call exists.
[ ] No gameplay/rules calculation exists.
[ ] Target legality, Main Hand relation, command conflict, privacy entitlement and outcomes come from fixtures.
[ ] Prototype Controls are clearly marked as NOT PRODUCT UI.
[ ] Mock technical states are not described as completed production contracts.
```

---

# 14. Scenario completion

All scenarios in `SCENARIO-CATALOG.md` must be loadable or reproducible in the prototype.

At minimum the owner should personally inspect:

- `PROTO-SCN-05` immediate-live Host;
- `PROTO-SCN-07` mid-session Join;
- `PROTO-SCN-08` DM Freeform;
- `PROTO-SCN-09` Player Freeform;
- `PROTO-SCN-12` target validity;
- `PROTO-SCN-16` resolving;
- `PROTO-SCN-20` Initiative;
- `PROTO-SCN-23` / `24` / `25` Handout modes;
- `PROTO-SCN-26` DM advanced tool;
- `PROTO-SCN-27` correction history;
- `PROTO-SCN-30` live content snapshot;
- `PROTO-SCN-32` Narrow Desktop stress test;
- `PROTO-SCN-34` component gallery.

---

# 15. Owner acceptance form

When the prototype is ready, the owner does not need to fill every checkbox manually.

AI performs the checklist and reports failures. The owner may accept in plain language after reviewing the prototype.

Canonical acceptance record should then be written here as:

```text
Prototype Status: ACCEPTED
Accepted By: Owner
Accepted Reference: <commit SHA>
Acceptance Note: <optional owner note>
```

Until this explicit record exists:

```text
RUNTIME UI IMPLEMENTATION PREPARATION: BLOCKED BY PROTOTYPE ACCEPTANCE
```

---

# 16. What acceptance does not mean

Prototype acceptance does not automatically:

- Freeze all Product Decisions;
- resolve technical Planning Gaps;
- make prototype HTML production code;
- authorize edits to `src/`;
- authorize runtime Work Order execution.

After acceptance, the next step is contract extraction + scoped Freeze/readiness + runtime Work Order.