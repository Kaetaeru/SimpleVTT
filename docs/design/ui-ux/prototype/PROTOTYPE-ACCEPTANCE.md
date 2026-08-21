# UI Reference Prototype — Acceptance

Status: **ACCEPTED BY OWNER — runtime preparation may begin; runtime implementation is not authorized**

Historical candidates remain ineligible:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED / HISTORICAL
```

Accepted review candidate:

```text
app/integrated-reference.html
```

Accepted candidate code reference:

```text
4c12084bef603866b9b69f1bfd8f363146920184
```

Mandatory baseline and verification:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
INTEGRATED-REFERENCE-VERIFICATION.md
```

Owner acceptance was given explicitly after reviewing the rebuilt integrated reference on **2026-08-21**.

This acceptance fixes the prototype as the visual/interaction reference for contract extraction and runtime preparation. It does **not** Freeze Product Decisions, resolve Domain/Architecture gaps, or authorize production `src/` implementation.

---

# 1. Fail-fast conditions — PASS

The accepted candidate was reviewed against the following prohibitions:

```text
[x] No Core battlemap/tactical grid.
[x] No Core Actor x/y map coordinates or draggable map tokens.
[x] No pathfinding/movement traces/Fog of War/LoS/range-map geometry.
[x] Handout is presentation, not a tactical map.
[x] First run begins with dedicated Tutorial/Onboarding.
[x] Tutorial contains initial Official-style vs SimpleVTT Sheet choice.
[x] Ordinary Standalone Sheet roll stays on the current Sheet.
[x] Standalone roll does not create a detached result/dice workflow.
[x] Connected Play retains upper opposing Actor Board, lower allied Actor Board and persistent Command Center.
[x] Initiative extends the same Play IA instead of replacing it.
[x] Freeform does not pretend per-turn Action/Bonus/Reaction/Movement spending is active.
[x] Targeting uses Actor Cards/manual authoritative target sets, not map positions.
[x] Main Hand unavailable has no smart fallback.
[x] Player projection has no placeholder/existence marker for undelivered DM-only events.
[x] Historical `.agents`, old demos and stale tests are not treated as current Product authority.
```

---

# 2. First-run / Product Shell — PASS

```text
[x] Tutorial/Onboarding is the first meaningful first-run panel.
[x] Tutorial explains Standalone and Connected use.
[x] Tutorial asks for initial Official-style vs SimpleVTT Sheet presentation.
[x] Tutorial says the presentation choice can be changed later.
[x] Character / Host / Join orientation is visible.
[x] Tutorial has a reopen path from Settings/Help.
[x] Completion proceeds to Home.
[x] Product Shell uses the Reviewed top-navigation model.
[x] Home exposes distinct Host Session and Join Session actions.
[x] Global order is Home / Characters / Session / Content / Rules / Settings.
[x] Live context exposes Return to Play without making Play a global destination.
```

---

# 3. Character workflows — PASS

```text
[x] Character Library is the Character-management hub.
[x] Opening a Character opens that selected Character.
[x] Official-style and SimpleVTT Sheets are first-class views of the same canonical Character.
[x] Create/Edit preserves the canonical CharacterCreationPlan family rather than inventing a new rules wizard.
[x] Level Up preserves the canonical progression family.
[x] Desktop long-content behavior is represented as scroll/reflow rather than route fragmentation.
```

---

# 4. Standalone Sheet / dice — PASS

```text
[x] Sheet is usable as a complete physical-table companion without Session.
[x] Ability/save/skill/Initiative/attack/damage/common-die examples are directly reachable.
[x] Current Sheet remains mounted, visible and spatially stable while dice animate.
[x] Dice use transient same-Sheet cinematic presentation.
[x] Result is readable without opening/closing a detached result panel.
[x] User continues on the exact same Sheet after transient presentation clears.
[x] No permanent dice frame is introduced for routine rolls.
[x] Reduced Motion preserves information/result order.
```

---

# 5. Session entry / continuity — PASS

```text
[x] Host and Join are distinct first-class flows.
[x] Open Session enters already-live Host/DM Freeform immediately.
[x] No normal Host Preparing / Lobby / Ready / Start gate.
[x] Zero connected Players is a valid live DM session state.
[x] Join selects a valid local Character and enters current live state after required synchronization.
[x] No-Character Join blocks with Create/Import recovery and requires a new Join attempt.
[x] Reconnect returns to current authoritative live context rather than Ready/Start lifecycle.
```

---

# 6. Connected Play composition — PASS

```text
[x] Compact Play chrome/session status is present.
[x] Upper NPC/Neutral/Hostile Actor Board is present.
[x] Lower Player/Allied Actor Board is present.
[x] Actor Cards are board/list objects, not map tokens.
[x] Actor Card minimum useful width is preserved with horizontal overflow for density.
[x] Central region reads as shared Play Context / Tabletop Stage rather than a battlefield.
[x] Central region contains no grid, tactical terrain, positional token layout or movement-path affordance.
[x] Persistent bottom Command Center remains through targeting/resolution/dice/result.
[x] DM and Player share the same core skeleton with role-specific tools/information.
```

---

# 7. Freeform / Initiative — PASS

```text
[x] Freeform uses the same Play workspace and has no fake turn economy.
[x] Normal capabilities remain directly discoverable through Command Center/Hotbar.
[x] Initiative adds a compact horizontal tracker at the Play Context top edge.
[x] Initiative economy appears only when Initiative is active.
[x] Actor Boards remain during Initiative.
[x] End Turn appears only where meaningful.
```

---

# 8. Command Center / targeting — PASS

```text
[x] Command Center uses BG3-family information architecture without tactical-map UI.
[x] Economy/resources occupy a compact upper region when applicable.
[x] Controlled Actor status is clear.
[x] Hotbar/action region is the larger operational region.
[x] Mixed / Action / Spell / Item / custom organization is understandable.
[x] Rich hover/focus explanation does not make essential state hover-only.
[x] Selected-action targeting has click priority.
[x] Explicit DM control mode outranks ordinary hostile-click behavior when no action is targeting.
[x] All Actor Cards remain visible during targeting.
[x] Valid/invalid/selected target states remain distinct; reasons are authority/fixture supplied.
[x] Single valid target submits immediately.
[x] Multi-target selection uses explicit Execute.
[x] Area-like action uses manual target-set selection, not AoE map template.
```

---

# 9. Resolution / reaction / dice / result — PASS

```text
[x] Resolution preserves Actor Boards, Play Context and Command Center skeleton.
[x] Only fixture-declared conflicting interactions are represented as locked.
[x] Fixture-declared safe interactions remain available in selective-lock examples.
[x] Reaction/Interrupt stays inside the current Play context.
[x] Concentration response stays in context and does not invent rules values.
[x] Connected physical dice use the broad Tabletop Stage as presentation space.
[x] Dice animation cannot alter authoritative connected results.
[x] Immediate result remains integrated into Play.
[x] Durable detail/history is available through Activity.
```

---

# 10. DM / Activity / privacy / Handout — PASS

```text
[x] Encounter/Participants/Session/Activity/advanced spatial tools are contextual panes/layers.
[x] Advanced spatial tool is fact-oriented, not a coordinate/map editor.
[x] DM Activity supports public/private chronology and filters.
[x] Player receives no fixture placeholder for DM-only events.
[x] Correction/reversal preserves original history and adds linkage.
[x] Handout Overlay / Upper / Full are distinct presentation modes.
[x] Handout is visibly not a battlemap and has no token/grid interaction.
[x] Player local Overlay dismiss/reopen is distinct from DM shared presentation state.
```

Runtime privacy and Handout reconnect semantics remain blocked by their declared Architecture Gaps.

---

# 11. Content / Rules / Settings — PASS

```text
[x] Content UI represents the supported declarative SimpleVTT package model honestly.
[x] Import preview distinguishes valid/warning/blocking/unsupported conditions.
[x] Install/update/replace/disable/delete lifecycle is understandable.
[x] Live-session content snapshot remains visually stable after local library changes.
[x] Rules browse/lookup presents authoritative composed content rather than UI-derived rules.
[x] Settings contains presentation/accessibility preferences including Sheet presentation and Reduced Motion.
```

---

# 12. Desktop / accessibility / layers — ACCEPTED REFERENCE

The accepted reference establishes the following required implementation behavior:

```text
[x] Wide / Normal / Narrow Desktop remain first-class review sizes.
[x] Actor Boards overflow rather than shrinking below useful card size.
[x] Contextual utilities preserve the Play skeleton.
[x] Quick/Full Sheet and Handout remain live-session layers rather than unrelated apps.
[x] Long names/resources/Activity content preserve hierarchy through truncation/reflow/scroll as appropriate.
[x] Keyboard focus must be visible.
[x] Rich hover explanation requires a focus-accessible equivalent where material.
[x] State meaning must not rely on color alone.
[x] Escape/cancel follows the interaction stack.
[x] Reduced Motion preserves information and result ordering.
```

Exact pixel-level responsive tuning remains an implementation/design-system detail unless it would materially alter these behaviors.

---

# 13. Prototype boundary — PASS

```text
[x] Candidate is confined to prototype scope.
[x] No production `src/` UI is imported or changed by the prototype.
[x] No real backend/network/storage is implemented by prototype JavaScript.
[x] Prototype does not own authoritative rules/target/privacy calculation.
[x] Target eligibility/result/unavailable reasons are fixture inputs.
[x] Fixture Actors contain no Core tactical x/y positions.
[x] Prototype Controls are outside intended product UI.
```

---

# 14. Owner acceptance record

```text
Prototype Status: ACCEPTED
Accepted By: Owner
Accepted Date: 2026-08-21
Accepted Entry: docs/design/ui-ux/prototype/app/integrated-reference.html
Accepted Candidate Code Reference: 4c12084bef603866b9b69f1bfd8f363146920184
Acceptance Note: "딱 완벽한것같아. 이걸 기준으로 문서를 작성하자"
```

---

# 15. Gate after acceptance

```text
P3 OWNER ACCEPTANCE: PASS
P4 RUNTIME PREPARATION: AUTHORIZED TO BEGIN, NOT YET READY
P5 RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
FROZEN PRODUCT DECISIONS: NONE ADDED BY THIS ACCEPTANCE
```

Next work is contract extraction and runtime preparation:

1. materialize implementation-facing Surface contract;
2. materialize implementation-facing Component contract;
3. materialize Interaction / State / Layer / Motion contract;
4. build traceability from accepted reference to Product Decisions and Domain/Architecture truth;
5. resolve applicable technical gaps for the runtime scope;
6. reconcile stale legacy docs/tests for the touched scope;
7. Freeze only explicitly approved implementation dependencies;
8. prepare a scoped runtime Work Order;
9. obtain separate runtime implementation authorization.
