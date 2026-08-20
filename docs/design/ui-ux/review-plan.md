# SimpleVTT UI/UX Review Coverage Plan

Status: active review-order control

This file controls **which governance sheet is being reviewed, which Decision Maps are already declared, and which sheets must not start yet**.

Dashboard: [`README.md`](README.md)
Decisions: [`decisions.md`](decisions.md)
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Templates: [`templates.md`](templates.md)

## Review-order rule

- Do not ask a sheet's first question until that sheet's complete Decision Map is shown/materialized.
- A Decision Map is `Complete` only when it satisfies T2: Scope, Non-scope, Exit Criteria, and a full table containing ID, Question, Status, Depends On, Conditional, and Destination.
- Do not skip an unfinished earlier dependency merely because a later UI area looks interesting.
- Existing migrated decisions may seed a later Decision Map, but they do not authorize inventing the rest of that map mid-review.
- New discoveries go to Planning Gaps or a downstream sheet before becoming owner questions.
- AI MAY propose a review-order change when dependency analysis shows a better order.
- AI MUST NOT change the declared review order without owner approval. Record the approved reason when the order changes.
- All reference fields use full stable IDs; do not use ranges or omitted prefixes.

## Current sequence

| Order | Sheet | Purpose | Map status | Review status | Notes |
| ---: | --- | --- | --- | --- | --- |
| 1 | `UX-01` Product Principles | top-level product experience principles | **Complete** | **Reviewed, not Frozen** | 7 decisions; no new UX-01 questions |
| 2 | `UX-02` User & Role Model | users, roles, ownership/control, information entitlement | **Complete** | Not started individually | First individual review sheet only after the Global Planning Gate passes |
| 3 | `UX-03` Information Hierarchy | global/contextual information priority and duplication | **Complete** | Not started | T2 schema normalized below; still blocked by Global Planning Gate |
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
| 20 | `DND-02` Roll & Dice UX | dice, result, resolution presentation | Not materialized | **Many seed decisions exist** | ORIGIN-UX-01-22, ORIGIN-UX-01-22A, ORIGIN-UX-01-23, ORIGIN-UX-01-24, ORIGIN-UX-01-25 |
| 21 | `DND-03` Action UX | capability/hotbar/economy/targeting/execution | Not materialized | **Many seed decisions exist** | UX-01-04, UX-01-05, UX-01-06 plus migrated decisions |
| 22 | `DND-04` Combat UX | initiative/turn/interrupt combat presentation | Not materialized | Seed decisions exist | ORIGIN-UX-01-14, ORIGIN-UX-01-15 |
| 23 | `SES-01` Session UX | session lifecycle and Play workspace | Not materialized | Many seed decisions exist | ORIGIN-FLOW-01, ORIGIN-FLOW-02 and Command Center/Actor Board/Handout seeds |
| 24 | `SES-02` Multiplayer Authority UX | role-scoped delivery/visibility/reconnect authority | Not materialized | Seed decisions + Critical gaps | DM-only roll decisions |
| 25 | `DM-01` DM Controls | persistent DM controls and management surfaces | Not materialized | Seed decision exists | visibility toggle |
| 26 | `DM-02` Adjudication & Undo | disclosure, activity, correction, undo | Not materialized | Seed decision + deferred question | historical pre-ledger Activity question remains unanswered |
| 27 | `CONTENT-02` Rules & Add-on UX | Rules browser, import, validation, add-on management | Not materialized | Not started | R1/R2/R5/R6 seeds exist |

---

# UX-01 — Product Principles

## Scope

Define the top-level experience principles that constrain all later UI/UX planning: product posture, Shell/Play relationship, Play continuity, core capability exposure, context adaptation, discoverability/customization, and Play visual priority.

## Non-scope

Do not define exact navigation topology, role permissions, pixel layout, component styling, individual Hotbar contents, detailed targeting rules, session wire formats, or DM authority implementation here. Those belong to downstream sheets/contracts.

## Exit Criteria

- Standalone Character and Connected VTT product posture is defined.
- Product Shell and dedicated Play relationship is defined.
- Leaving/returning to Play continuity principle is defined.
- Core capability visibility and contextual adaptation principles are defined.
- Discoverability/customization relationship is defined.
- Play Workspace co-primary visual anchors are defined.
- No additional question is appended to UX-01 without explicitly reopening/updating this complete map.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-01-01` | What is SimpleVTT's product posture between standalone Character use and connected VTT play? | Reviewed | none | no | `UX-01`, `DND-01`, `SES-01` |
| `UX-01-02` | How do the common Product Shell and dedicated Play Workspace relate? | Reviewed | `UX-01-01` | no | `UX-01`, `NAV-01`, `SES-01` |
| `UX-01-03` | What authoritative/session/game state must survive leaving and returning to Play? | Reviewed | `UX-01-02` | no | `UX-01`, `NAV-01`, `SES-01`, `SES-02` |
| `UX-01-04` | How directly must core capabilities be exposed? | Reviewed | none | no | `UX-01`, `DND-03`, `CMP-01` |
| `UX-01-05` | How should a stable capability skeleton adapt to canonical context? | Reviewed | `UX-01-04` | no | `UX-01`, `DND-03`, `STATE-01` |
| `UX-01-06` | How should automatic capability discovery coexist with user Hotbar customization? | Reviewed | `UX-01-04`, `UX-01-05` | no | `UX-01`, `DND-03` |
| `UX-01-07` | What are the co-primary visual anchors of Play? | Reviewed | `UX-01-02`, `UX-01-04` | no | `UX-01`, `SES-01`, `DND-03`, `DND-04` |

---

# UX-02 — User & Role Model

## Scope

Define the product-level user/role model used by standalone and connected experiences: role axes, Character ownership vs Actor control, number/control scope, role switching, UI divergence, unauthorized information, and v1 extra-role scope.

## Non-scope

Do not define secret-event wire format, exact payload redaction, exact DM menu layout, role-specific component styling, or implementation schema here. Route those details to `SES-02`, `DM-01`, `DM-02`, `CMP-01`, or architecture contracts as applicable.

## Exit Criteria

- Role axes are defined.
- Offline role treatment is defined.
- Character ownership and Actor control are distinguishable.
- Player/DM control scope is defined at product level.
- Role switching policy is defined.
- UI divergence and unauthorized-information principles are defined.
- v1 extra-role scope is decided.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-02-01` | Separate Play Role and Connection Role, or one role axis? | Draft | none | no | `UX-02`, `SES-02` |
| `UX-02-02` | Does Offline/Standalone have a DM/Player identity? | Draft | `UX-02-01` | no | `UX-02` |
| `UX-02-03` | How does Character ownership relate to actual Actor control? | Draft | `UX-02-01` | no | `UX-02`, `SES-01`, `SES-02` |
| `UX-02-04` | How many Actors may a Player control? | Draft | `UX-02-03` | no | `UX-02`, `SES-01` |
| `UX-02-05` | What is the DM Actor-control authority model? | Draft | `UX-02-03` | no | `UX-02`, `DM-01` |
| `UX-02-06` | Allow live DM <-> Player role switching? | Draft | `UX-02-01` | no | `UX-02`, `SES-02` |
| `UX-02-07` | What is the allowed limit of role-specific UI structural divergence? | Draft | `UX-02-01` | no | `UX-02`, `NAV-01` |
| `UX-02-08` | What is the default principle for information a role is not authorized to know? | Draft | `UX-02-03` | no | `UX-02`, `SES-02` |
| `UX-02-09` | Include Spectator / Co-DM / Observer in v1? | Draft | `UX-02-01` | no | `UX-02` |
| `UX-02-09A` | Define extra-role permission boundaries. | Draft | `UX-02-09` | yes; only if extra roles included | `UX-02`, `SES-02` |

---

# UX-03 — Information Hierarchy

## Scope

Define which information/destinations are global vs contextual, how Product Shell and live Play relate, what UI remains persistent vs contextual, the high-level priority of Play/Character information, progressive disclosure, duplicate-information policy, and transient result/notification/Activity priority.

## Non-scope

Do not set exact pixel layout, Actor Board height, Initiative Tracker geometry, Result Strip size, typography values, exact component styling, or network disclosure implementation.

## Exit Criteria

- Global vs contextual destination boundary is defined.
- Product Shell <-> live Play continuity principle is defined.
- Persistent vs contextual UI principle is defined.
- Play Workspace and standalone Character Sheet information priorities are defined.
- Progressive disclosure and duplication principles are defined.
- Transient result/notification/Activity priority is defined.

## Decision Map

| ID | Question | Status | Depends On | Conditional? | Destination |
| --- | --- | --- | --- | --- | --- |
| `UX-03-01` | What is the boundary between Global and Contextual destinations? | Draft | `UX-01-02` | no | `NAV-01` |
| `UX-03-02` | How should Product Shell <-> Live Play continuity behave at the hierarchy level? | Draft | `UX-01-03` | no | `NAV-01`, `SES-01` |
| `UX-03-03` | What is the principle for Permanent UI vs Contextual UI? | Draft | `UX-01-04`, `UX-01-05` | no | `INT-02` |
| `UX-03-04` | What information has priority inside Play Workspace? | Draft | `UX-01-07` | no | `SES-01`, `DND-04` |
| `UX-03-05` | What information has priority on standalone Character Sheet? | Draft | `UX-01-01` | no | `DND-01` |
| `UX-03-06` | What scope of progressive disclosure is allowed? | Draft | `UX-01-04` | no | `UI-05`, `CONTENT-01` |
| `UX-03-07` | What is the principle for duplicated information? | Draft | none | no | `CMP-01` |
| `UX-03-08` | What is the priority of transient result/notification/Activity information? | Draft | none | no | `STATE-01`, `STATE-02`, `DND-02`, `DM-02` |

---

# Global Planning Gate — required before individual review resumes

**No individual governance-sheet question, including `UX-02-01`, may resume until every item below is complete.**

AI performs this preparation without asking new product questions unless a genuinely blocking ambiguity requires owner input. Newly discovered material choices are registered as Planning Gaps or placed into the appropriate still-unreviewed Decision Map.

```text
[ ] R1-R9 complete Master UI Inventory is cross-checked against current implementation, derived master-flow.md, existing Decision Cards, and generic non-route UI patterns.
[ ] M1-M6 required coverage is materialized for every material Registry item; material TBD behavior is represented by a Decision/Contract, N/A with reason, or explicit Planning Gap.
[ ] All 27 governance sheets have a complete predeclared T2 Decision Map containing Scope, Non-scope, Exit Criteria, full decision list, Status, full dependency IDs/conditional branches, and Destination.
[ ] Missing / Duplication / Coverage audit passes:
    [ ] every Registry item has at least one governing sheet/contract owner;
    [ ] every governance sheet has inventory/decision-map coverage;
    [ ] no normative requirement has duplicate canonical authority;
    [ ] all material unknowns are explicit Planning Gaps rather than AI inference.
[ ] Owner receives one concise whole-product coverage checkpoint showing what is ready, what is still a gap, and confirming no product decisions were silently added.
```

Only after this Global Planning Gate passes may the sequential owner review resume at `UX-02-01`.

Do not create `UX-02-10` or any spontaneous new sheet question without first updating the declared Decision Map under the framework rules.
