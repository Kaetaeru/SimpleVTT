# SimpleVTT UI/UX Review Coverage Plan

Status: active review-order control

This file controls **which governance sheet is being reviewed, which Decision Maps are already declared, and which sheets must not start yet**.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Review-order rule

- Do not ask a sheet's first question until that sheet's complete Decision Map is shown/materialized.
- Do not skip an unfinished earlier dependency merely because a later UI area looks interesting.
- Existing migrated decisions may seed a later Decision Map, but they do not authorize inventing the rest of that map mid-review.
- New discoveries go to Planning Gaps or a downstream sheet before becoming owner questions.

## Current sequence

| Order | Sheet | Purpose | Map status | Review status | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `UX-01` Product Principles | top-level product experience principles | Complete | **Reviewed, not Frozen** | 7 decisions; no new UX-01 questions |
| 2 | `UX-02` User & Role Model | users, roles, ownership/control, information entitlement | **Complete** | Not started individually | Next review sheet after whole-product inventory pass |
| 3 | `UX-03` Information Hierarchy | global/contextual information priority and duplication | **Declared baseline** | Not started | 8 known questions below |
| 4 | `NAV-01` Navigation | product destinations, contextual return, hierarchy | Not materialized | Not started | R1/master-flow seed input |
| 5 | `UI-01` Layout & Grid | global layout primitives | Not materialized | Not started | depends on IA/play topology |
| 6 | `INT-01` Interaction | click/right-click/selection/target/context interaction | Not materialized | Seed decisions exist | migrated Actor Card decisions |
| 7 | `STATE-01` UI States | local component/task states | Not materialized | Not started | R5/R6/M6 input |
| 8 | `STATE-02` System States | loading/error/reconnect/permission/system state | Not materialized | Not started | R6 input |
| 9 | `INT-02` Layering | modal/nonmodal overlay rules | Not materialized | Not started | R4 input |
| 10 | `INT-03` Confirmation | destructive/confirmation/cancel grammar | Not materialized | Not started | R4/R8 input |
| 11 | `UI-02` Typography | type system | Not materialized | Not started | design tokens |
| 12 | `UI-03` Color & Semantic Color | semantic color system | Not materialized | Not started | state/accessibility dependency |
| 13 | `UI-04` Iconography | icon language | Not materialized | Not started | component dependency |
| 14 | `UI-05` Density & Spacing | density/spacing tokens | Not materialized | Not started | responsive/component dependency |
| 15 | `CMP-01` Core Components | reusable component contracts | Not materialized | Seed inventory exists | R7 input |
| 16 | `CONTENT-01` UX Writing | labels, error, confirmation, terminology | Not materialized | Seed inventory exists | R8 input |
| 17 | `A11Y-01` Accessibility | keyboard/focus/semantics/reduced motion | Not materialized | Seed matrix exists | M4 input |
| 18 | `PLATFORM-01` Desktop Responsive | wide/normal/narrow behavior | Not materialized | Seed matrix exists | M5 input |
| 19 | `DND-01` Character Presentation | Character Library/Builder/Sheet/Level Up | Not materialized | Not started | R1/R2 seeds exist |
| 20 | `DND-02` Roll & Dice UX | dice, result, resolution presentation | Not materialized | **Many seed decisions exist** | ORIGIN-UX-01-22..25 |
| 21 | `DND-03` Action UX | capability/hotbar/economy/targeting/execution | Not materialized | **Many seed decisions exist** | UX-01-04..06 + migrated decisions |
| 22 | `DND-04` Combat UX | initiative/turn/interrupt combat presentation | Not materialized | Seed decisions exist | ORIGIN-UX-01-14, 15 |
| 23 | `SES-01` Session UX | session lifecycle and Play workspace | Not materialized | Many seed decisions exist | Command Center/Actor Boards/Handout |
| 24 | `SES-02` Multiplayer Authority UX | role-scoped delivery/visibility/reconnect authority | Not materialized | Seed decisions + Critical gaps | DM-only roll decisions |
| 25 | `DM-01` DM Controls | persistent DM controls and management surfaces | Not materialized | Seed decision exists | visibility toggle |
| 26 | `DM-02` Adjudication & Undo | disclosure, activity, correction, undo | Not materialized | Seed decision + deferred question | old UX-01-30 remains unanswered |
| 27 | `CONTENT-02` Rules & Add-on UX | Rules browser, import, validation, add-on management | Not materialized | Not started | R1/R2/R5/R6 seeds exist |

The exact order after foundational sheets may be adjusted only if dependency analysis shows a better order; record the reason rather than silently jumping around.

---

# UX-02 declared Decision Map

| ID | Decision | Depends On | Conditional? |
| --- | --- | --- | --- |
| `UX-02-01` | Separate Play Role and Connection Role, or one role axis? | — | no |
| `UX-02-02` | Does Offline/Standalone have a DM/Player identity? | 02-01 | no |
| `UX-02-03` | Character ownership vs actual Actor control? | 02-01 | no |
| `UX-02-04` | How many Actors may a Player control? | 02-03 | no |
| `UX-02-05` | DM Actor-control authority model? | 02-03 | no |
| `UX-02-06` | Allow live DM <-> Player role switching? | 02-01 | no |
| `UX-02-07` | Limit of role-specific UI structural divergence? | 02-01 | no |
| `UX-02-08` | Default principle for information a role is not authorized to know? | 02-03 | no |
| `UX-02-09` | Include Spectator / Co-DM / Observer in v1? | 02-01 | no |
| `UX-02-09A` | Define extra-role permission boundaries | 02-09 | **yes; only if extra roles included** |

### UX-02 exit criteria

- Role axes are defined.
- Offline role treatment is defined.
- Character ownership and Actor control are distinguishable.
- Player/DM control scope is defined at product level.
- Role switching policy is defined.
- UI divergence and unauthorized-information principles are defined.
- v1 extra-role scope is decided.

Do not decide detailed secret-event wire format, exact DM menu layout, or redaction implementation here; route those to SES-02/DM sheets.

---

# UX-03 declared baseline Decision Map

| ID | Decision | Destination / Dependency |
| --- | --- | --- |
| `UX-03-01` | Boundary between Global and Contextual destinations | NAV-01 |
| `UX-03-02` | Product Shell <-> Live Play continuity | NAV-01 / SES-01 |
| `UX-03-03` | Permanent UI vs contextual UI principle | INT-02 |
| `UX-03-04` | Information priority inside Play Workspace | SES-01 / DND-04 |
| `UX-03-05` | Standalone Character Sheet information priority | DND-01 |
| `UX-03-06` | Allowed scope of progressive disclosure | UI-05 / CONTENT-01 |
| `UX-03-07` | Principle for duplicated information | CMP-01 / governance authority clarity |
| `UX-03-08` | Priority of transient result/notification/Activity information | STATE / DND-02 / DM-02 |

### UX-03 non-scope

UX-03 does not set exact pixel layout, Actor Board height, Initiative Tracker geometry, Result Strip size, or individual component styling. Those are downstream contracts.

---

# Next preparation gate before UX-02 resumes

AI should complete this checklist without asking new product questions unless a blocking ambiguity truly requires owner input:

```text
[ ] Cross-check current implementation routes/surfaces against R1-R9.
[ ] Cross-check every reviewed Decision Card against registry rows.
[ ] Cross-check master-flow branches against R2/R3/R6.
[ ] Add missing generic overlay/feedback/system-state artifacts.
[ ] Identify matrix rows needed for authority/state/persistence/accessibility/responsive/coverage.
[ ] Put every material unresolved behavior into planning-gaps.md.
[ ] Give owner one concise whole-product coverage checkpoint.
```

After this gate, resume at `UX-02-01`. Do not create `UX-02-10` or a new sheet question without first updating the declared map.
