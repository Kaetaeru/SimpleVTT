# UI Reference Prototype — Acceptance

Status: **BLOCKED — NO ACTIVE REVIEW CANDIDATE**

The previous candidates are not eligible for acceptance:

```text
app/index.html      -> REJECTED / HISTORICAL
app/final-spec.html -> INVALIDATED BY REPOSITORY-WIDE PRODUCT/UX AUDIT
```

Current mandatory baseline:

```text
../INTEGRATED-PRODUCT-UX-PLAN.md
```

A new candidate must be built from the reconciled prototype specification before this acceptance gate can return to `IN REVIEW`.

---

# 1. Fail-fast acceptance conditions for the next candidate

Any one of the following is an automatic failure.

```text
[ ] Core Play contains a battlemap/tactical grid.
[ ] Core Actors are positioned with x/y map coordinates or draggable tokens.
[ ] Core UI contains pathfinding/movement traces/Fog of War/LoS/range-map geometry.
[ ] A Handout is treated as a tactical map.
[ ] First run does not begin with the dedicated Tutorial/Onboarding panel.
[ ] Initial Official-style vs SimpleVTT Sheet choice is missing from first-run Tutorial.
[ ] An ordinary Standalone Sheet roll opens a detached dice/result window, modal workflow, route or persistent separate dice stage.
[ ] Standalone roll displaces/replaces the current Character Sheet rather than presenting transient dice over/within it.
[ ] Connected Play loses the Reviewed upper opposing Actor Board / lower allied Actor Board / persistent Command Center skeleton.
[ ] Initiative replaces the whole Play IA instead of adding tracker/economy to the same structure.
[ ] Freeform presents fake per-turn Action/Bonus/Reaction/Movement spend state.
[ ] Targeting relies on map positions instead of Actor Cards/manual authoritative target sets.
[ ] Main Hand unavailable silently falls back to another action.
[ ] Player UI contains a placeholder/existence marker for an undelivered DM-only event.
[ ] Historical `.agents` planning, old demos or stale implementation tests are treated as current Product authority.
```

The boxes above describe failure cases: the next candidate passes only when every listed failure is absent.

---

# 2. First-run / Product Shell

```text
[ ] Tutorial/Onboarding is the first meaningful first-run panel.
[ ] Tutorial explains Standalone and Connected modes.
[ ] Tutorial asks Official-style vs SimpleVTT initial Sheet layout.
[ ] Tutorial explains the preference can be changed later.
[ ] Tutorial or immediate orientation exposes Character / Host / Join basics.
[ ] Tutorial can be reopened from Settings/Help.
[ ] Completion proceeds to Home.
[ ] Product Shell uses the Reviewed top-navigation model.
[ ] Home exposes distinct Host Session and Join Session actions.
[ ] Global order is Home / Characters / Session / Content / Rules / Settings.
[ ] Live context provides Return to Play without making Play a permanent global destination.
```

---

# 3. Character workflows

```text
[ ] Character Library is the Character-management hub.
[ ] Opening a Character opens the exact selected canonical Character.
[ ] Official-style and SimpleVTT Sheets are both first-class views of the same Character.
[ ] Character Create/Edit follows the existing canonical dynamic CharacterCreationPlan flow rather than an invented replacement wizard.
[ ] Level Up follows the existing canonical progression flow rather than a new UX model.
[ ] Required long-screen scroll behavior is usable at desktop review sizes.
```

---

# 4. Standalone Sheet / dice

```text
[ ] The Sheet alone is clearly usable at a physical table.
[ ] Ability/save/skill/Initiative/attack/damage/common-die examples are directly reachable.
[ ] Current Sheet remains mounted/visible/stable while dice animate.
[ ] Dice enter from visual depth/back, roll/settle quickly and do not create a separate product surface.
[ ] Result is readable without opening/closing a detached result panel.
[ ] User continues on the exact same Sheet after the transient presentation clears.
[ ] Local history does not recreate a permanent dice frame.
[ ] Reduced Motion preserves the same information/result order.
```

---

# 5. Session entry / continuity

```text
[ ] Host and Join are distinct flows.
[ ] Open Session enters an already-live Host/DM Freeform session immediately.
[ ] There is no normal Host Preparing / Lobby / Ready / Start gate.
[ ] Zero connected Players is a valid live DM session state.
[ ] Join selects a valid local Character, synchronizes as needed, then enters the current live state.
[ ] No-Character Join blocks with Create/Import recovery and a new Join attempt.
[ ] Reconnect returns to current authoritative live context without a Ready/Start loop.
```

---

# 6. Mapless Connected Play

```text
[ ] Compact Play chrome/session status is present.
[ ] Upper NPC/Neutral/Hostile Actor Board is present.
[ ] Lower Player/Allied Actor Board is present.
[ ] Actor Cards are list/board objects, not map tokens.
[ ] Card minimum width is preserved and overflow/paging handles density.
[ ] Central region reads as Mapless Play Context / Tabletop Stage, not a battlefield.
[ ] Central region contains no grid, terrain, positional token layout, movement path or tactical spatial affordance.
[ ] Persistent bottom Command Center remains available through targeting/resolution/dice/result.
[ ] DM and Player share the same core skeleton with role-specific tools/information.
```

---

# 7. Freeform / Initiative

```text
[ ] Freeform remains the same Play workspace and contains no fake turn economy.
[ ] Normal capabilities remain directly discoverable through the Reviewed Command Center/Hotbar direction.
[ ] Initiative adds one compact horizontal tracker at the top edge of the mapless Play Context.
[ ] Initiative adds authoritative turn economy only when Initiative is active.
[ ] Actor Boards remain during Initiative.
[ ] End Turn appears only where meaningful.
```

---

# 8. Command Center / targeting

```text
[ ] Command Center uses BG3-family information architecture without importing tactical-map UI.
[ ] Economy/resources occupy a compact upper row when applicable.
[ ] Controlled Actor status is clear.
[ ] Hotbar/action region is larger and directly discoverable.
[ ] Mixed/Action/Spell/Item/custom organization is understandable.
[ ] Rich hover/focus explanations work without making essential state hover-only.
[ ] Selected-action targeting has click priority.
[ ] All Actor Cards remain visible during targeting.
[ ] Valid/invalid/selected target states are distinct and invalid reason comes from fixture/authority input.
[ ] Single valid target submits immediately.
[ ] Multi-target selection uses explicit Execute.
[ ] Area-like action is represented as manual target-set selection, not an AoE map template.
```

---

# 9. Resolution / reaction / dice / result

```text
[ ] Resolution preserves Actor Boards, mapless context and Command Center skeleton.
[ ] Only fixture-declared conflicting interactions are shown locked.
[ ] Reaction/Interrupt explains the response inside the current Play context.
[ ] Concentration response stays in current context and does not invent rules values.
[ ] Connected physical dice use the broad mapless Tabletop Stage as presentation space.
[ ] Dice physics/trajectory cannot alter authoritative connected results.
[ ] Immediate result stays integrated into Play.
[ ] Durable detail/history is reachable through Activity.
```

---

# 10. DM / Activity / privacy / Handout

```text
[ ] Encounter/Participants/Session/Activity/advanced spatial tools are contextual panes/layers.
[ ] Advanced spatial tool is fact-oriented; it is not a coordinate/map editor.
[ ] DM Activity shows public/private chronology and filters.
[ ] Player receives no placeholder for fixture DM-only events.
[ ] Correction/reversal preserves original history and appends linkage.
[ ] Handout Overlay / Upper / Full are clearly presentation modes.
[ ] Handout is visibly not a battlemap and has no token/grid interactions.
[ ] Player local dismiss/reopen of Overlay is distinct from DM shared withdraw/state.
```

Runtime privacy and Handout reconnect semantics remain blocked by their declared Architecture Gaps.

---

# 11. Content / Rules / Settings

```text
[ ] Content uses the supported declarative SimpleVTT package model honestly.
[ ] Import preview distinguishes valid/warning/blocking/unsupported conditions.
[ ] Install/update/replace/disable/delete lifecycle is understandable.
[ ] Live-session content snapshot is not visually mutated by local library changes.
[ ] Rules browse/lookup reads authoritative composed content rather than UI-invented rules.
[ ] Settings contains real appearance/accessibility/product preferences, including Sheet presentation and Reduced Motion.
```

---

# 12. Desktop / accessibility / layers

Review at:

- Wide 1600x1000
- Normal 1366x768
- Narrow Desktop 960x700

```text
[ ] Core controls remain reachable at all three review sizes.
[ ] Actor Boards overflow instead of collapsing below useful card size.
[ ] Contextual utilities do not destroy the mapless Play skeleton.
[ ] Quick/Full Sheet and Handout remain usable.
[ ] Long names/resources/Activity text preserve hierarchy.
[ ] Keyboard focus is visible.
[ ] Hover explanation has a keyboard/focus path where required.
[ ] State meaning does not rely on color alone.
[ ] Escape/cancel behavior follows the interaction stack.
[ ] Reduced Motion can be reviewed.
```

---

# 13. Prototype boundary

```text
[ ] Candidate files are confined to prototype scope.
[ ] No production src UI import/change.
[ ] No real backend/network/storage.
[ ] No rules/target/privacy calculation in prototype JavaScript.
[ ] Target eligibility/result/unavailable reasons are explicit fixture inputs.
[ ] Fixture Actors contain no Core tactical x/y positions.
[ ] Prototype Controls remain visibly outside intended product UI.
```

---

# 14. Current gate

```text
ACTIVE REVIEW CANDIDATE: NONE
SPEC RECONCILIATION: REQUIRED
PROTOTYPE REBUILD: REQUIRED
BROWSER REVIEW: BLOCKED
OWNER ACCEPTANCE: NOT STARTED
RUNTIME PREPARATION: BLOCKED
RUNTIME UI IMPLEMENTATION: NOT AUTHORIZED
```

Do not fill an acceptance record until a new candidate exists and the owner explicitly accepts a specific reference revision.
