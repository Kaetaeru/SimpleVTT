# UI Reference Prototype — Acceptance

Status: **IN REVIEW — explicit owner acceptance not yet given**

This checklist determines when the standalone HTML Reference Prototype is accepted as the visual/interaction reference for later runtime preparation.

Prototype acceptance is separate from Product Decision Freeze and runtime implementation authorization.

Current state:

```text
PROTOTYPE CANDIDATE: CREATED
STATIC VERIFICATION: PASS
BROWSER / VISUAL REVIEW: PENDING OWNER
OWNER ACCEPTANCE: NOT STARTED
RUNTIME UI PREPARATION: BLOCKED BY PROTOTYPE ACCEPTANCE
```

Static build details: [`BUILD-VERIFICATION.md`](BUILD-VERIFICATION.md)

Review entry: [`app/index.html`](app/index.html)

---

# 1. Product hierarchy

```text
[ ] Home / Characters / Session / Content / Rules / Settings read as one clear global structure.
[ ] Activity / Encounter / Adjudication / Session utilities feel contextual rather than duplicate global destinations.
[ ] Return to Play appears only when a live connected context is represented.
[ ] First-run guidance is understandable and reopenable.
[ ] Character Library feels like the Character-management hub.
[ ] Official-style and SimpleVTT Sheets both feel first-class.
```

# 2. Session flow

```text
[ ] Host Setup clearly opens directly into an already-live Freeform session.
[ ] No Lobby / Ready / Start Session stage remains.
[ ] DM can understand Play + preparation/edit inside the same live session.
[ ] Mid-session Player Join is understandable.
[ ] No-Character Join clearly blocks and offers Create / Import before retry.
[ ] Host=DM and Client=Player presentation is unambiguous.
[ ] No Spectator / Co-DM / Observer UI is accidentally exposed.
```

# 3. Play composition

```text
[ ] Scene/Actor Context and Command Center feel co-primary.
[ ] Upper opposing and lower allied Actor Boards remain legible without consuming too much Scene space.
[ ] Command Center stays persistent and capabilities remain directly discoverable.
[ ] Initiative adds the compact top tracker without replacing Actor Boards.
[ ] Current turn, controlled Actor, selection, valid target, invalid target and focus are visually distinguishable.
[ ] DM and Player share the core Play skeleton while role-specific tools/information differ clearly.
[ ] NOTICE UI communicates important persistent state without becoming a second Activity feed.
```

# 4. Command Center / action UX

```text
[ ] Controlled Actor context is obvious.
[ ] Hotbar pages / slots / economy / Resource Rail are readable.
[ ] Current action UI does not reintroduce an intent-first hidden capability funnel.
[ ] Selected / unavailable / pending / resolving states are distinct.
[ ] Resolution keeps the Command Center skeleton.
[ ] Multi-target uses explicit Execute; single-target valid click does not add another confirmation.
[ ] Main Hand unavailable example shows the fixture reason and chooses no fallback.
```

# 5. Layers and contextual tools

```text
[ ] Activity can coexist with Play without making Scene/Command Center unusable.
[ ] Encounter and advanced spatial controls feel like contextual DM tools.
[ ] Full Sheet preserves live-session context and has a clear return path.
[ ] Actor Context Menu contains UI/context management, not duplicate Attack/Spell/Item actions.
[ ] Rich hover explanation helps dense controls without making essential state hover-only.
[ ] Confirmation modal clearly outranks lower contextual layers.
[ ] Reaction/interrupt retains enough Scene/Actor orientation.
[ ] Panel resize has sensible minimums and Reset Layout works conceptually.
```

# 6. Handout

```text
[ ] Overlay / Upper Scene / Full Scene are clearly different.
[ ] Player can locally dismiss/reopen Overlay.
[ ] Upper/Full remain DM-controlled shared presentation examples.
[ ] Full Scene still feels like live Play rather than a separate Product route.
[ ] Zoom/pan reads as local presentation.
[ ] Mock Handout state is not mistaken for a completed network contract.
```

# 7. Dice / result

```text
[ ] Connected dice uses the broad central Scene/Table concept.
[ ] Dice presentation conveys far/back -> near/front -> settle.
[ ] Final face/result is visibly fixture-authoritative rather than physics-authoritative.
[ ] Result feedback stays scene-integrated with Activity/detail path.
[ ] Standalone Character roll has an understandable local result example.
[ ] Reduced Motion preserves result/order comprehension.
```

# 8. Privacy / Activity / correction

```text
[ ] DM Only state is continuously clear to DM.
[ ] DM Activity shows public/private items in one chronology with filtering.
[ ] Player view contains no placeholder/existence row for fixture DM-only events.
[ ] Later disclosure reads as projection, not reroll.
[ ] Correction/reversal leaves the original history visible and adds a related event.
```

Production privacy remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL` until the architecture contract exists.

# 9. Content

```text
[ ] Official SimpleVTT package import flow is understandable.
[ ] Warning / blocking / unsupported validation states are distinct.
[ ] Install/update/replace/disable/delete lifecycle is understandable without overwhelming the normal Content page.
[ ] Live-session content snapshot remains visually stable when local library content changes.
```

# 10. Desktop responsive review

Review at prototype presets:

- Wide 1600×1000
- Normal 1366×768
- Narrow Desktop 960×700

```text
[ ] Command Center remains directly reachable at Narrow Desktop.
[ ] Scene/Actor context remains usable.
[ ] Actor Cards stop shrinking and use horizontal paging/scroll when needed.
[ ] Contextual utility transformation remains desktop-oriented.
[ ] Full Sheet and Handout remain usable.
[ ] Modals/popovers stay inside the viewport.
[ ] Long names/resources/Activity text do not destroy hierarchy.
```

# 11. Accessibility / state clarity

```text
[ ] Common actionable controls are keyboard reachable unless an explicit reviewed exception exists.
[ ] Visible focus is clear.
[ ] Hover-only explanation has equivalent access where required.
[ ] State meaning does not rely on color alone.
[ ] Reduced Motion can be reviewed.
[ ] Compact pointer targets remain usable.
[ ] Right-click Actor Context Menu remains supplementary rather than the only path to essential information/action.
```

# 12. Prototype boundary

Static verification currently passes these structural checks; browser review should confirm there is no accidental runtime behavior:

```text
[x] Prototype files are confined to docs/design/ui-ux/prototype/app/.
[x] Main prototype JavaScript contains no production src/ reference.
[x] Main prototype JavaScript contains no fetch( call.
[x] Main prototype JavaScript contains no WebSocket use.
[x] Fixtures provide target validity/unavailable/result examples.
[x] Prototype Controls are explicitly separate from intended product UI.
[ ] Browser review confirms the candidate loads and interactions work as intended.
```

# 13. Required scenario spot-check

At minimum inspect:

```text
PROTO-SCN-05 immediate-live Host
PROTO-SCN-07 mid-session Join
PROTO-SCN-08 DM Freeform
PROTO-SCN-09 Player Freeform
PROTO-SCN-12 target validity
PROTO-SCN-16 resolving
PROTO-SCN-20 Initiative
PROTO-SCN-23 / 24 / 25 Handout modes
PROTO-SCN-26 advanced DM tool
PROTO-SCN-27 correction history
PROTO-SCN-30 live content snapshot
PROTO-SCN-32 Narrow Desktop stress
PROTO-SCN-34 Component Gallery
```

All 34 scenarios remain available for detailed review.

---

# Owner acceptance record

Do not fill this until the owner explicitly accepts the reviewed prototype.

```text
Prototype Status: <IN REVIEW | NEEDS CHANGE | ACCEPTED>
Accepted By: <blank until explicit acceptance>
Accepted Reference: <blank until explicit acceptance>
Acceptance Note: <optional>
```

Until explicit acceptance exists:

```text
P3 OWNER ACCEPTANCE: NOT PASSED
P4 RUNTIME PREPARATION: BLOCKED
P5 RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```

After acceptance, the next phase is **contract extraction + technical-gap resolution + legacy reconciliation + scoped Freeze/readiness**, not immediate `src/` implementation.