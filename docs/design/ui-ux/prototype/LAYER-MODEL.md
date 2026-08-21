# UI Reference Prototype — Layer Model

Status: **AI Design Default / prototype interaction contract — mapless reconciled**

Baseline: [`../INTEGRATED-PRODUCT-UX-PLAN.md`](../INTEGRATED-PRODUCT-UX-PLAN.md)

This document defines how major prototype surfaces stack/coexist. It does not define rules/network authority.

---

# 0. Terminology guard

`Base`, `Canvas`, `Stage`, `Scene` and `Tabletop` are UI/presentation terms only.

They never imply a battlemap, Actor coordinates, grid, tokens, pathing, Fog of War or LoS geometry.

The Connected Play base region is the **Mapless Play Context / Tabletop Stage**.

---

# 1. Layer families

## PROTO-LAYER-0 — Base product/workspace surface

Contains the current Product Shell page, Character Sheet or Connected Play workspace.

Examples:

- Tutorial-underlying Product frame;
- Home;
- Character Library/Sheet;
- Connected Mapless Play Context.

Never tactical-map authority.

## PROTO-LAYER-1 — Persistent product/play anchors

Always-on structural UI of the current experience.

Examples:

- Product top navigation/header;
- Play chrome/status;
- upper/lower Actor Boards;
- persistent Command Center;
- Initiative Tracker when Initiative is active;
- persistent NOTICE state;
- persistent connection/visibility indicators when needed.

These are not overlays merely because they visually sit above the mapless central background.

## PROTO-LAYER-2 — Contextual utility panes

Nonmodal tools that coexist with the current canonical context.

Examples:

- Activity;
- Encounter;
- Participants;
- Session Share;
- Rules lookup;
- Player Session utility;
- advanced DM **spatial fact** tool;
- Quick Sheet.

Defaults:

- one primary utility pane per dock region;
- switching replaces the prior pane rather than stacking many panes;
- pane may resize within bounded desktop widths;
- core Play/session context remains active;
- advanced spatial pane is forms/rows, never coordinate canvas.

## PROTO-LAYER-3 — Anchored transient UI

Examples:

- tooltip;
- rich hover/focus explanation;
- Actor Context Menu;
- small popover/listbox.

Rules:

- anchored to invoker/context;
- does not block unrelated interaction;
- closes on Escape where applicable;
- Context Menu may close outside-click;
- right-click Actor menu contains UI/context actions, not Attack/Spell/Item duplication.

## PROTO-LAYER-4 — Major contextual presentation

Temporarily dominates a large region without destroying underlying session context.

Examples:

- Full Character Sheet layer;
- Handout Upper presentation;
- Handout Full presentation.

Rules:

- authoritative/session context preserved;
- return/close restores prior context;
- only intended region visually displaced;
- required Command Center/session anchors remain according to Reviewed mode;
- Handout remains image presentation, not tactical terrain.

## PROTO-LAYER-5 — Resolution / response / dice presentation

Higher-attention gameplay presentation:

- resolving state;
- reaction/interrupt;
- concentration response;
- physical dice;
- immediate result.

Rules:

- Actor Boards / mapless context orientation / Command Center skeleton remain recognizable;
- only fixture-declared conflicting controls lock;
- UI does not infer safe-command semantics;
- connected dice use the mapless Tabletop Stage as visual space, not a battlemap;
- Standalone dice use a transient layer over/within the currently mounted Character Sheet viewport, not a separate dice window.

## PROTO-LAYER-6 — Confirmation / destructive decision

Examples:

- destructive Session-end confirmation;
- unsaved-change confirmation;
- correction confirmation if the eventual contract requires it.

Defaults:

- modal/focused;
- lower layers blocked while unresolved;
- Cancel when safe;
- focus contained;
- routine valid target execution does **not** use this layer.

## PROTO-LAYER-7 — System blocker

Rare highest-priority state:

- incompatible Session/content state;
- app/session cannot continue safely;
- explicit recovery/exit required.

Do not use for ordinary validation.

---

# 2. First-run Tutorial layering

On fresh first run, Tutorial/Onboarding is the first meaningful product panel.

It may sit as a focused product layer over the hydrated Product Shell, but normal Home interaction is not the primary experience until Tutorial completion.

Tutorial includes:

- Standalone/Connected orientation;
- Official-style vs SimpleVTT initial Sheet choice;
- Character/Host/Join orientation.

After completion, Tutorial layer closes and Home becomes the active base surface.

Reopened Tutorial from Settings/Help uses the same content family without resetting product authority/state.

---

# 3. Standalone dice layering

Standalone roll is **not** a new surface in the navigation stack.

```text
L0 current Character Sheet
 + transient L5 dice/result presentation over/within same Sheet viewport
 -> L5 clears
 -> same L0 Sheet remains
```

Hard rules:

- no layout-pushing persistent dice frame;
- no separate modal workflow;
- no route replacement;
- no mandatory Close/Back merely to continue using the Sheet;
- local history may remain as normal Sheet content.

---

# 4. Handout layering — image presentation only

Handout modes are not generic interchangeable modals.

## Overlay

- above mapless Play Context;
- Player local dismiss/minimize/reopen;
- shared fixture state may remain active;
- no Actor token/grid interaction on the image.

## Upper

- occupies the reviewed upper presentation region;
- shared DM-controlled mode;
- cannot turn into a tactical map;
- remaining Play anchors stay according to Reviewed structure.

## Full

- dominant image presentation inside live-session frame;
- DM-controlled shared mode;
- local zoom/pan only;
- no Actor map placement/targeting;
- Command Center/session continuity retained as required.

Network/reconnect implementation remains mock-only until `GAP-HANDOUT-NETWORK-CONTRACT` is resolved.

---

# 5. Resolution coexistence

During Resolving / Interrupt / Concentration / Dice / Result:

- upper/lower Actor Boards remain unless a reviewed Handout mode explicitly changes presentation;
- central mapless context remains recognizable;
- Command Center skeleton remains;
- selected action/target state may transition to submitted/frozen representation;
- ordinary hover frames may close;
- compatible contextual utility may remain visible if fixture says it is safe;
- modal confirmation outranks utility panes;
- no tactical spatial visualization is created for resolution.

Fixture supplies conflict/safe flags; prototype does not derive legality.

---

# 6. Full Sheet coexistence

During live Session:

- Full Sheet uses Layer 4;
- connection/session state remains alive;
- turn/Actor/resolution authoritative state is not reset;
- obvious return/close exists;
- close restores invoking context/focus when practical.

If a higher-priority reaction/required response occurs while Full Sheet is open, prototype must show a safe way for the required response to become visible without losing the user's Sheet place.

Exact production command semantics remain Domain/Architecture work.

---

# 7. Context menu / hover

Actor Context Menu:

- pointer right-click entry;
- above Actor Cards/panes;
- below required response/modal/system blockers;
- outside-click/command closes;
- ordinary gameplay actions are excluded.

Rich Hover Explanation:

- may flip placement to avoid clipping;
- does not cover the active critical state when practical;
- keyboard focus receives equivalent detail access;
- essential unavailable reason is also accessible without pointer-only hover when needed.

---

# 8. NOTICE priority

NOTICE belongs to persistent Layer 1, not modal stack.

Examples:

- reconnecting;
- DM Only active;
- live content snapshot differs from local library;
- persistent warning affecting current task.

NOTICE may open Layer-2 detail.

Do not turn NOTICE into a permanent Activity feed.

---

# 9. Focus / dismissal defaults

| Layer | Escape | Outside click | Focus trap | Return focus |
| --- | --- | --- | --- | --- |
| L2 contextual pane | close when safe | normally no | no | launcher |
| L3 tooltip | clear | n/a | no | unchanged |
| L3 popover/menu | close | yes by default | no | invoker |
| L4 Full Sheet | return when safe | no | workspace-contained | launcher/prior context |
| L4 Handout Upper/Full | Player Escape does not dismiss shared mode | no | no generic trap | local controls |
| L5 required response | only if contract allows cancel | no | may focus required response | resolution context |
| L6 confirmation | Cancel when allowed | normally no | yes | invoker/logical next |
| L7 blocker | explicit recovery/exit only | no | yes | recovery-defined |

Canonical Decision/Domain contract overrides these defaults.

---

# 10. Narrow Desktop transformation

At 960x700:

- utility pane may become narrower/overlay-like while desktop-oriented;
- Actor cards keep minimum useful width then scroll/page;
- Command Center remains directly reachable;
- mapless central context can shrink but remains useful for current interaction/dice/result;
- Full Sheet can stack/reflow;
- Handout controls compact without changing shared semantics;
- confirmation stays contained;
- tooltip/popover stays inside viewport.

No mobile/tactical-map fallback.

---

# 11. Required QA combinations

1. Fresh first run + Tutorial + Sheet selection.
2. Standalone Sheet + transient dice while Sheet remains visible.
3. DM Freeform mapless + Activity pane + DM Only NOTICE.
4. Player Freeform mapless + Handout Overlay + local dismiss/reopen.
5. Player Initiative + Actor-card targeting + invalid reason.
6. DM Initiative + advanced spatial **fact** pane.
7. Full Sheet + reconnect NOTICE.
8. Resolving + Reaction/Interrupt.
9. Resolving + Concentration response.
10. Connected dice/result + Actor Boards/Command Center retained.
11. Narrow Desktop + utility pane + horizontal Actor overflow.
12. Destructive confirmation above contextual DM pane.

Layer failures discovered here must be repaired before a new candidate can be accepted.
