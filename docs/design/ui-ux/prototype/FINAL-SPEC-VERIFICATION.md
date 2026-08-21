# SimpleVTT Final-Spec Reference Demo — Verification

Status: **STATIC STRUCTURAL VERIFICATION PASS — BROWSER REVIEW PENDING**

This record applies only to the replacement Final-Spec Reference Demo created after the owner rejected the first prototype candidate.

Active entry:

```text
docs/design/ui-ux/prototype/app/final-spec.html
```

Historical `app/index.html` is not an active review/reference candidate.

---

# 1. Owner corrections represented

## Offline / Standalone dice

Static source inspection confirms the replacement demo models Standalone roll presentation inside the currently mounted Character Sheet:

```text
[x] Final-Spec Character Sheet stays mounted when an ordinary roll is invoked.
[x] final-spec-stability.js intercepts Standalone roll activation before the base renderer navigates/remounts anything.
[x] `sheet-roll-plane` is appended directly inside the existing `.sheet-workspace` DOM.
[x] ordinary Standalone roll does not navigate to another route/surface.
[x] ordinary Standalone roll does not open a modal/dialog/drawer/detached result window.
[x] ordinary Standalone roll does not require a Back/Close action to return to the Sheet.
[x] multiple fixture roll categories exist: skills, saves, attacks, damage.
[x] initial in-Sheet presentation shows roll context/notation; fixture total is revealed at settlement.
[x] roll fixture contains authoritative mock face/total; prototype does not compute rules.
[x] CSS demonstrates far/back -> near/front -> settle within the Sheet workspace.
[x] Reduced Motion changes presentation, not surface/result order.
```

Browser review must still confirm the animation visually reads as part of the current Sheet rather than as a detached window.

## Connected Play topology

Static source inspection confirms the replacement demo encodes the reviewed structural order:

```text
[x] Play root = compact Play chrome + Play main + persistent bottom Command Center.
[x] Scene system = upper opposing Actor Board + central Scene/Table + lower allied Actor Board.
[x] Command Center is outside the Scene system and remains a fixed bottom region.
[x] Command Center upper row contains economy/resources; lower region separates controlled Actor from larger Hotbar/actions area.
[x] Initiative Tracker is rendered over the central Scene/Table rather than replacing Actor Boards.
[x] contextual utilities render as side panes beside the Scene system.
[x] utility pane has a prototype resize handle with bounded width.
[x] dice render on the central Scene/Table plane.
[x] immediate result renders on the central Scene/Table.
[x] Actor Cards remain visible during targeting.
[x] fixture valid / invalid / selected target states are represented.
[x] single-target valid click enters resolution directly.
[x] multi-target state exposes explicit Execute.
[x] no smart fallback is selected when Main Hand fixture is unavailable.
[x] DM and Player use the same Play skeleton with role-specific controls/information.
[x] Player Activity filters DM-only fixture events without a placeholder row.
[x] Reaction/Interrupt and Concentration examples keep the surrounding Play orientation visible.
[x] Quick Sheet and Full Sheet examples are layers over the live session rather than replacement Product routes.
```

---

# 2. Final-Spec demo files

Verified repository paths:

```text
app/final-spec.html
app/final-spec.css
app/final-spec-coverage.css
app/final-spec.js
app/final-spec-fixtures.js
app/final-spec-stability.js
app/final-spec-coverage.js
```

Supporting owner correction:

```text
OWNER-CORRECTIONS.md
```

The previous prototype files remain only as historical evidence and must not be used as runtime implementation reference.

---

# 3. Product reference coverage

The replacement demo includes reference surfaces/interactions for:

- First Run / initial Sheet-style choice;
- Home / Characters;
- Character Builder reference;
- Level Up reference;
- Session Host and Join entry;
- Character-less Join block;
- Content / Package Import Review / Rules / Settings;
- Official-style and SimpleVTT Standalone Character Sheets;
- same-mounted-Sheet rolls for multiple roll types;
- DM and Player Freeform;
- Initiative without replacing Actor Boards;
- upper/lower Actor Boards;
- Scene tokens;
- persistent BG3-family Command Center;
- Hotbar pages, economy and Resource Rail;
- targeting / invalid target / multi-target Execute;
- Main Hand unavailable + no fallback;
- central Scene dice / result;
- Reaction / Interrupt;
- Concentration response;
- Quick Sheet / Full Sheet layers;
- Activity privacy filtering;
- Encounter / Participants / Session / advanced spatial side panes;
- utility panel resize;
- reconnect state;
- destructive confirmation layer example;
- Handout Overlay / Upper / Full examples;
- right-click Actor context menu;
- rich hover/focus explanation;
- wide / normal / narrow desktop presets;
- Reduced Motion;
- Component Gallery.

---

# 4. Boundary checks

Repository/code search and static source inspection found no intended production/runtime integration in the Final-Spec demo:

```text
[x] no real backend call is part of the Final-Spec design.
[x] no WebSocket/network implementation is part of the Final-Spec design.
[x] no production `src/` import is part of the Final-Spec design.
[x] target eligibility comes from `final-spec-fixtures.js` lookup data.
[x] roll face/total comes from fixtures.
[x] Main Hand availability/reason comes from fixtures.
[x] DM-only history visibility is represented by fixture filtering, not network security implementation.
[x] Builder/Level Up/Rules/Import examples do not calculate authoritative rules/domain truth.
```

These statements are prototype-boundary checks, not proof that the eventual runtime contracts are complete.

---

# 5. Environment limitation

The current execution environment cannot resolve GitHub/raw GitHub hosts from its local container, so the replacement files could not be downloaded into a browser/Node runtime for real execution testing.

Therefore this verification does **not** claim:

- the browser rendered every layout correctly;
- every JavaScript branch was executed without runtime error;
- animation timing is visually accepted;
- all Wide/Normal/Narrow combinations were visually inspected;
- owner acceptance has passed.

The Final-Spec demo remains a **browser review candidate**, not an accepted prototype.

---

# 6. Gate state

```text
FIRST PROTOTYPE CANDIDATE: REJECTED / SUPERSEDED FOR REVIEW
FINAL-SPEC DEMO: AUTHORED
FINAL-SPEC STATIC STRUCTURAL VERIFICATION: PASS
FINAL-SPEC BROWSER / VISUAL / INTERACTION REVIEW: PENDING
PROTOTYPE OWNER ACCEPTANCE: NOT STARTED
RUNTIME PREPARATION: BLOCKED
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```

Any browser defect must be fixed in the Final-Spec demo before P3 acceptance. Runtime `src/` UI remains out of scope.
