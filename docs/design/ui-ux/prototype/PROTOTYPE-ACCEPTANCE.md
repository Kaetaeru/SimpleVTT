# UI Reference Prototype — Acceptance

Status: **IN REVIEW — Final-Spec replacement candidate; explicit owner acceptance not yet given**

This checklist determines when the replacement Final-Spec Reference Demo is accepted as the visual/interaction reference for later runtime preparation.

Active review entry:

```text
docs/design/ui-ux/prototype/app/final-spec.html
```

The previous `app/index.html` candidate was rejected by the owner and is historical only.

Current state:

```text
FIRST CANDIDATE: REJECTED / SUPERSEDED
FINAL-SPEC CANDIDATE: CREATED
FINAL-SPEC STATIC STRUCTURAL VERIFICATION: PASS
BROWSER / VISUAL / INTERACTION REVIEW: PENDING OWNER
OWNER ACCEPTANCE: NOT STARTED
RUNTIME UI PREPARATION: BLOCKED
```

Owner corrections: [`OWNER-CORRECTIONS.md`](OWNER-CORRECTIONS.md)

Final-Spec static verification: [`FINAL-SPEC-VERIFICATION.md`](FINAL-SPEC-VERIFICATION.md)

---

# 1. Non-negotiable owner-correction checks

These are fail-fast acceptance conditions.

## Standalone / Offline dice

```text
[ ] Clicking any Standalone roll keeps the current Character Sheet mounted, visible and spatially continuous.
[ ] Skill, save, attack, damage and other Standalone roll examples all use the same in-Sheet roll behavior.
[ ] Dice visibly roll inside the current Sheet workspace / in-surface Roll Plane.
[ ] No Standalone roll opens a modal, dialog, drawer, detached result card, separate route, separate browser-like window or replacement screen.
[ ] No Back/Close action is required merely to return from an ordinary Standalone roll.
[ ] Dice visually travel far/back -> near/front -> settle inside the Sheet workspace.
[ ] Final face/total appears as fixture-authoritative presentation at settlement; physics does not decide the value.
[ ] Reduced Motion preserves the same mounted Sheet and result order.
```

**Any detached Standalone roll surface or ordinary roll-induced Sheet remount/navigation is an automatic prototype acceptance failure.**

## Connected Play structural topology

```text
[ ] Compact Play chrome/session status remains above the live workspace.
[ ] NPC/Neutral/Hostile Actor Board is a dedicated upper board.
[ ] Scene/Table is the flexible central region.
[ ] Player/Allied Actor Board is a dedicated lower board directly above Command Center.
[ ] Persistent BG3-family Command Center remains at the bottom.
[ ] Command Center upper row shows economy/resources; lower-left shows controlled Actor; larger lower/right region shows Hotbar/actions.
[ ] Initiative Tracker overlays the Scene top edge and does not replace either Actor Board.
[ ] Opening Activity/Encounter/Participants/Session/Advanced DM utility preserves the core Play skeleton and uses contextual side-pane behavior.
[ ] DM and Player use the same core structural skeleton; only role-specific tools/information differ.
[ ] Actor Boards switch to horizontal overflow/paging instead of shrinking below useful card size.
```

**Losing this topology or replacing it with a generic dashboard/HUD is an automatic prototype acceptance failure.**

---

# 2. Product hierarchy / character workflows

```text
[ ] Home / Characters / Session / Content / Rules / Settings read as one clear global structure.
[ ] Activity / Encounter / Adjudication / Session utilities feel contextual rather than duplicate global destinations.
[ ] First Run clearly explains Official-style vs SimpleVTT Sheet choice without making it permanent/irreversible.
[ ] Character Library feels like the Character-management hub.
[ ] Official-style and SimpleVTT Sheets both feel first-class.
[ ] Builder and Level Up reference surfaces keep the accepted workflow family rather than introducing a new product model.
[ ] Return to Play appears only when a live connected context is represented.
```

# 3. Session flow

```text
[ ] Host Session clearly opens directly into an already-live Freeform session.
[ ] No Lobby / Ready / Start Session stage remains.
[ ] DM can understand Play + preparation/edit inside the same live session.
[ ] Mid-session Player Join is understandable.
[ ] No-Character Join clearly blocks and offers Create / Import before retry.
[ ] Host=DM and Client=Player presentation is unambiguous.
[ ] No Spectator / Co-DM / Observer UI is accidentally exposed.
```

# 4. Play targeting / action UX

```text
[ ] All Actor Cards remain visible while targeting.
[ ] Valid / invalid / selected target states are visually distinct.
[ ] Invalid target keeps its Actor visible and exposes a fixture-provided reason.
[ ] Single-target valid click proceeds to submitted/resolving without an extra confirmation screen.
[ ] Multi-target selection exposes explicit Execute.
[ ] No selected action + valid hostile click uses fixture-provided canonical Main Hand only.
[ ] Main Hand unavailable shows the fixture reason and chooses no fallback action.
[ ] Selected-action targeting takes priority over ordinary Actor selection/control focus.
```

# 5. Resolution / dice / interrupt / result in Connected Play

```text
[ ] Resolution preserves Actor Boards, Scene orientation and Command Center skeleton.
[ ] Only fixture-declared conflicting interactions appear locked; the whole workspace is not replaced.
[ ] Connected dice use the broad central Scene/Table as Roll Area.
[ ] Dice presentation conveys far/back -> near/front -> impact/roll/settle.
[ ] Final face/result is visibly fixture-authoritative rather than physics-authoritative.
[ ] Immediate result stays scene-integrated instead of opening a detached result route/window.
[ ] Reaction/Interrupt keeps Scene/Actor/Command Center orientation visible.
[ ] Concentration response keeps Scene/Actor/Command Center orientation visible and does not invent DC/modifier legality.
[ ] Activity/detail remains the durable history path.
[ ] Reduced Motion preserves result and comprehension order.
```

# 6. Command Center

```text
[ ] Controlled Actor portrait/name/HP/Temp/status are readable.
[ ] Hotbar page structure remains understandable.
[ ] Actions remain directly discoverable; no intent-first hidden capability funnel returns.
[ ] Action / Bonus / Reaction / Movement indicators are readable.
[ ] Dynamic Resource Rail remains readable with multiple resources.
[ ] Selected / unavailable / pending / resolving states are distinct.
[ ] End Turn / Execute / Cancel controls appear contextually without replacing normal Hotbar structure.
```

# 7. Layers and contextual tools

```text
[ ] Activity can coexist with Play without making Scene/Command Center unusable.
[ ] Encounter and advanced spatial controls feel like contextual DM tools.
[ ] Utility pane can be resized within useful bounds without destroying the core Play skeleton.
[ ] Quick Sheet is a lightweight contextual layer and does not replace Play.
[ ] Full Sheet is a heavier layer but the live session remains clearly behind/continuous.
[ ] Actor Context Menu contains UI/context management, not duplicate Attack/Spell/Item actions.
[ ] Rich hover/focus explanation helps dense controls without making essential state hover-only.
[ ] Destructive confirmation outranks lower contextual layers without being used for ordinary target execution.
[ ] Right-click Actor Context Menu remains supplementary rather than the only path to essential information/action.
```

# 8. Handout

```text
[ ] Overlay / Upper Scene / Full Scene are clearly different.
[ ] Player can locally dismiss/reopen Overlay.
[ ] Upper/Full remain DM-controlled shared-presentation examples.
[ ] Full Scene still feels like live Play rather than a separate Product route.
[ ] Zoom/pan reads as local presentation.
[ ] Mock Handout state is not mistaken for a completed network contract.
```

# 9. Privacy / Activity / correction

```text
[ ] DM Only state is continuously clear to DM.
[ ] DM Activity shows public/private items in one chronology with filtering.
[ ] Player view contains no placeholder/existence row for fixture DM-only events.
[ ] Later disclosure reads as a projection, not a reroll/recalculation.
[ ] Correction/reversal leaves the original history visible and adds a related event.
```

Production privacy remains blocked by `GAP-DM-ONLY-DELIVERY-PROTOCOL` until its architecture contract exists.

# 10. Content / import / Rules / Settings

```text
[ ] Official SimpleVTT package lifecycle is understandable from Content reference UI.
[ ] Package Import Review distinguishes valid/warning/blocking conditions without UI guesswork.
[ ] Live-session content snapshot is described as stable after local library changes.
[ ] Rules Browser reads as authoritative-content presentation rather than UI-invented rules logic.
[ ] Settings contains presentation/accessibility preferences without creating a new product workflow.
```

# 11. Desktop responsive review

Review at:

- Wide 1600×1000
- Normal 1366×768
- Narrow Desktop 960×700

```text
[ ] Command Center remains directly reachable at Narrow Desktop.
[ ] Scene/Actor context remains usable.
[ ] Actor Cards stop shrinking and use horizontal overflow/paging when needed.
[ ] Contextual utility pane remains desktop-oriented and does not turn into a mobile-first product.
[ ] Character Sheet remains usable while retaining same-mounted-Sheet Roll Plane.
[ ] Quick/Full Sheet layers remain usable.
[ ] Handout remains usable.
[ ] Long names/resources/Activity text do not destroy hierarchy.
```

# 12. Accessibility / state clarity

```text
[ ] Common actionable controls are keyboard reachable unless an explicit reviewed exception exists.
[ ] Visible focus is clear.
[ ] Hotbar hover explanation also has focus behavior.
[ ] State meaning does not rely on color alone.
[ ] Reduced Motion can be reviewed.
[ ] Compact pointer targets remain practically usable.
```

# 13. Prototype boundary

Static verification currently records:

```text
[x] Active Final-Spec files are confined to docs/design/ui-ux/prototype/app/.
[x] Target validity/unavailable reasons/results are fixture inputs.
[x] Final-Spec design contains no intended real backend/network/storage integration.
[x] Final-Spec design does not import production `src/` UI.
[x] Prototype Controls are visibly separate from intended product UI.
[ ] Browser review confirms the Final-Spec entry loads and interactions work as intended.
```

# 14. Required Final-Spec scenario spot-check

At minimum inspect:

```text
FINAL-SCN-FIRST-RUN
FINAL-SCN-SHEET
FINAL-SCN-SHEET-ROLL
FINAL-SCN-BUILDER
FINAL-SCN-LEVEL-UP
FINAL-SCN-DM-FREEFORM
FINAL-SCN-PLAYER-FREEFORM
FINAL-SCN-PLAYER-TARGET
FINAL-SCN-MULTI
FINAL-SCN-MAIN-HAND-UNAVAILABLE
FINAL-SCN-RESOLVE
FINAL-SCN-RESULT
FINAL-SCN-INTERRUPT
FINAL-SCN-CONCENTRATION
FINAL-SCN-QUICK-SHEET
FINAL-SCN-FULL-SHEET
FINAL-SCN-DM-ACTIVITY
FINAL-SCN-PLAYER-ACTIVITY
FINAL-SCN-DM-SPATIAL
FINAL-SCN-HANDOUT-OVERLAY
FINAL-SCN-HANDOUT-UPPER
FINAL-SCN-HANDOUT-FULL
FINAL-SCN-RECONNECT
FINAL-SCN-PANEL-RESIZE
FINAL-SCN-CONFIRM
FINAL-SCN-CONTENT-IMPORT
FINAL-SCN-NARROW
FINAL-SCN-COMPONENTS
```

---

# Owner acceptance record

Do not fill this until the owner explicitly accepts the replacement Final-Spec candidate.

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

After acceptance, next phase is contract extraction + technical-gap resolution + legacy reconciliation + owner-correction canonical reconciliation + scoped Freeze/readiness. It is not immediate `src/` implementation.
