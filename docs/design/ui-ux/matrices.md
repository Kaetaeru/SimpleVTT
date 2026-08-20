# SimpleVTT M1-M6 Cross-cutting Matrices

Status: **Draft structured coverage — not Frozen**

These matrices answer questions that cut across many UI artifacts. They reference exact Decision, Review Question, Gap, Registry, Matrix, Sheet, Contract IDs, or repository paths instead of duplicating normative product prose.

Dashboard: [`README.md`](README.md)
Registry: [`registry.md`](registry.md)
Decisions: [`decisions.md`](decisions.md)
Gaps: [`planning-gaps.md`](planning-gaps.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)

## Matrix rules

- A row may be created by AI for coverage without creating a new product decision.
- If a row exposes an undecided product behavior, link a Planning Gap instead of guessing.
- Reference fields MUST follow `MANIFEST.yaml`: complete resolvable IDs/paths only; no ranges, omitted prefixes, or prose aliases.
- Prefer enums/IDs over free-form prose where practical.
- Do not copy full Decision Card text into a matrix cell.

---

# M1 — Role / Authority / Visibility / Disclosure

## Row schema

| Field | Meaning |
| --- | --- |
| Capability/Data | What is being viewed/controlled/transmitted |
| Context | Offline / Host / Client / Play mode |
| Role | DM / Player / TBD |
| May See | UI visibility |
| May Receive | network/data delivery |
| May Control | command permission |
| May Disclose | disclosure permission |
| Source | Full Decision / Review Question / Registry / Contract IDs |
| Gap | Full Gap ID or `—` |

## Seed rows

| Capability/Data | Context | Role | May See | May Receive | May Control | May Disclose | Source | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public roll projection | Connected | Player | yes | yes | n/a | n/a | ORIGIN-UX-01-26 | — |
| Public roll projection | Connected | DM | yes | yes | TBD | n/a | ORIGIN-UX-01-26 | GAP-UX02-ROLE-MODEL |
| DM-only roll details | Connected | Player | no | no | no | no | ORIGIN-UX-01-26, ORIGIN-UX-01-29 | GAP-DM-ONLY-DELIVERY-PROTOCOL |
| DM-only roll details | Connected | DM | yes | yes | TBD | yes | ORIGIN-UX-01-26, ORIGIN-UX-01-28 | GAP-DM-ROLL-VISIBILITY-PERSISTENCE |
| Encounter management | Connected Play | Player | TBD | TBD | no | no | R4-ENCOUNTER | GAP-UX02-ROLE-MODEL |
| Encounter management | Connected Play | DM | yes | TBD | yes | n/a | R4-ENCOUNTER | GAP-UX02-ROLE-MODEL |
| Actor control | Any Play | Player/DM | TBD | TBD | TBD | n/a | UX-02-03, UX-02-04, UX-02-05 | GAP-UX02-ROLE-MODEL |

Do not expand unresolved role semantics by inference before UX-02 review establishes the role model.

---

# M2 — State Machine & Transition

## Row schema

| ID | Current State | Event | Guard / Authority | Next State | Side Effect | Failure / Recovery | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Play action seed

| ID | Current State | Event | Guard / Authority | Next State | Side Effect | Failure / Recovery | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `M2-PLY-001` | `R3-ACTION-IDLE` | select capability | canonical capability available | `R3-ACTION-SELECTED` or direct resolve path | local selection only until command | unavailable reason / stay | UX-01-04, UX-01-05, UX-01-06 |
| `M2-PLY-002` | `R3-ACTION-SELECTED` | target required | action target contract | `R3-TARGET-SINGLE` or `R3-TARGET-MULTI` | project target eligibility | explicit blocker if target contract missing | ORIGIN-UX-01-19 |
| `M2-PLY-003` | `R3-TARGET-SINGLE` | click invalid Actor | not eligible | same | no gameplay mutation | show canonical reason | ORIGIN-UX-01-19 |
| `M2-PLY-004` | `R3-TARGET-SINGLE` | click valid Actor | eligible | `R3-RESOLVING` | submit authoritative action command | explicit reject / remain recoverable | ORIGIN-UX-01-20 |
| `M2-PLY-005` | `R3-TARGET-MULTI` | select valid Actor | eligible, maxTargets not exceeded | same | local target-set change | invalid selection rejected | ORIGIN-UX-01-20 |
| `M2-PLY-006` | `R3-TARGET-MULTI` | Execute | non-empty valid target set | `R3-RESOLVING` | submit authoritative action command | explicit reject / preserve recoverable selection as decided later | ORIGIN-UX-01-20 |
| `M2-PLY-007` | `R3-RESOLVING` | interrupt required | canonical resolution | `R3-INTERRUPT` | none until response | TBD | GAP-RESOLUTION-SAFE-INTERACTIONS |
| `M2-PLY-008` | `R3-RESOLVING` | authoritative dice ready | canonical resolution | `R3-DICE` | presentation only | fallback must preserve result | ORIGIN-UX-01-24, ORIGIN-UX-01-25 |
| `M2-PLY-009` | `R3-DICE` | presentation reaches reveal point | presentation contract | `R3-RESULT` | result feedback appears | reduced-motion equivalent | R9-RESULT-REVEAL |
| `M2-PLY-010` | `R3-RESULT` | continue/dismiss as applicable | canonical state committed | appropriate Play state | reflect canonical state | Activity retains detail as applicable | ORIGIN-UX-01-22 |

## Session seed

| ID | Current State | Event | Guard / Authority | Next State | Side Effect | Failure / Recovery | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `M2-SES-001` | Home/Session | Host | valid host setup | Host Setup/Lobby | create/prepare session command | explicit validation error | R2-HOST |
| `M2-SES-002` | Home/Session | Join | valid join input | Character Select / connecting path | join attempt | remain/recover | R2-JOIN |
| `M2-SES-003` | Character Select | no valid Character | none | **TBD** | none | Planning Gap | GAP-JOIN-NO-CHARACTER |
| `M2-SES-004` | Live session | connection lost | network state | Reconnecting | preserve canonical context | explicit unrecoverable branch | UX-01-03, R2-RECONNECT |
| `M2-SES-005` | Reconnecting | recovered | canonical reconnect accepted | prior live context | reconcile projection | explicit failure branch | UX-01-03 |

---

# M3 — Persistence / Ownership / Source of Truth

## Row schema

| State/Data | Owner / Source | Lifetime | Network projection | UI may mutate directly? | Refs / Gap |
| --- | --- | --- | --- | --- | --- |

## Seed rows

| State/Data | Owner / Source | Lifetime | Network projection | UI may mutate directly? | Refs / Gap |
| --- | --- | --- | --- | --- | --- |
| Permanent Character | canonical Character/domain storage | durable | session projection as applicable | no rules mutation; submit canonical commands | docs/design/README.md, docs/design/character-lifecycle.md |
| Shared session state | host/runtime authority | session | role-scoped | no; submit commands | docs/design/session-runtime.md |
| Resolution outcome/dice values | authoritative resolution/runtime | event/session/history as defined | visibility-scoped | no | ORIGIN-UX-01-24, ORIGIN-UX-01-25, ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29 |
| Dice fine trajectory | local presentation | transient | no | yes | ORIGIN-UX-01-25 |
| Hotbar custom arrangement | user presentation preference | TBD | normally local | yes when allowed | UX-01-06 |
| Selected Hotbar tab | UI presentation | transient/local preference TBD | no | yes | UX-01-06 |
| Handout presentation mode | intended shared session presentation state | session/reconnect | yes | authorized command only | ORIGIN-UX-01-12, GAP-HANDOUT-NETWORK-CONTRACT |
| Tooltip/open popover state | UI presentation | transient | no | yes | INT-02 |

Do not duplicate domain formulas or lifecycle semantics here. Reference their canonical domain/design documents.

---

# M4 — Accessibility / Input

## Row schema

| Artifact | Keyboard entry | Focus on open/select | Escape / Cancel | Focus return | Pointer alternative | Semantic/status requirement | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Seed coverage rows

| Artifact | Keyboard entry | Focus on open/select | Escape / Cancel | Focus return | Pointer alternative | Semantic/status requirement | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | required | defined per dialog | safe cancel when valid | invoker/logical next | n/a | dialog/alert-dialog pattern to review | A11Y-01, INT-03 |
| `R4-ACTOR-CONTEXT` | required equivalent | menu/context entry TBD | close | Actor Card | keyboard equivalent to right-click | exact menu semantics TBD | GAP-ACTOR-CONTEXT-MENU-CONTENTS |
| `R7-ACTOR-CARD` | required | visible focus | context dependent | n/a | click actions need keyboard equivalent | semantic role to decide | INT-01, A11Y-01 |
| `R7-HOTBAR-SLOT` | required | visible focus | targeting cancel path applicable | logical slot/context | click equivalent | unavailable state/reason accessible | DND-03, A11Y-01 |
| `R9-DICE-THROW` | no input dependency | must not steal essential focus by default | n/a | n/a | n/a | reduced-motion/result equivalent required | ORIGIN-UX-01-25 |
| `R5-BANNER` | action-dependent | should not steal focus unless required by pattern | n/a | n/a | action equivalent if actionable | status/alert semantics TBD by severity | STATE-02, A11Y-01 |

Detailed ARIA/semantic decisions are owned by A11Y-01 and component contracts; do not assume a generic role before review.

---

# M5 — Responsive / Layout

## Row schema

| Surface | Wide | Normal | Narrow | MUST remain | MAY collapse/reflow | MUST NOT hide | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Seed rows

| Surface | Wide | Normal | Narrow | MUST remain | MAY collapse/reflow | MUST NOT hide | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-PLAY` | full Dual Anchor | Dual Anchor | compressed/reflow TBD | Scene/Actor context + Command Center accessibility | secondary metadata pending review | core capabilities solely for cleanliness | UX-01-04, UX-01-07 |
| `R7-HOTBAR-TABS` | full tabs | full/compact TBD | compact/reflow TBD | capability-page reachability | labels/secondary metadata only if approved | entire Hotbar behind generic drawer by default | ORIGIN-UX-01-07 |
| `R7-ACTOR-CARD` | full card | compact card TBD | compact/reflow TBD | identity + required interaction/target state | secondary metadata TBD | invalid target existence during targeting | ORIGIN-UX-01-19 |
| `R1-CHAR-SHEET` | multi-column candidate | TBD | stacked/reflow candidate | core Character information/action access | secondary grouping | TBD | DND-01, PLATFORM-01 |

No numeric breakpoint is canonical until PLATFORM-01 / design tokens establish one.

---

# M6 — Coverage / Acceptance

## Coverage values

Every coverage cell MUST be exactly one of:

- `REQ`
- `N/A`
- `TBD`
- a specific full contract/test ID

Explanatory conditions belong in the `Notes / Refs` column, not inside the coverage value.

## Core surface grid

| Surface | Normal | Empty | Loading/Pending | Disabled | Error | Keyboard | Narrow | Role variants | Reconnect | Owner walkthrough | Notes / Refs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-HOME` | REQ | TBD | REQ | N/A | REQ | REQ | REQ | TBD | TBD | REQ | Reconnect applies only when a live session exists; role variants depend on `UX-02`. |
| `R1-CHARACTERS` | REQ | REQ | REQ | TBD | REQ | REQ | REQ | TBD | N/A | REQ | Role variants depend on `UX-02`. |
| `R1-CHAR-SHEET` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | Session-linked variants and role behavior depend on downstream review. |
| `R1-SESSION` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Connected-session first-class surface. |
| `R1-PLAY` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Whole Play workspace requires representative owner walkthrough. |
| `R3-TARGET-SINGLE` | REQ | N/A | N/A | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Disabled = invalid target; Error = explicit authoritative reject; role authority unresolved. |
| `R3-TARGET-MULTI` | REQ | N/A | N/A | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Disabled = invalid target; Error = explicit authoritative reject; role authority unresolved. |
| `R3-INTERRUPT` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | REQ | TBD | REQ | Responder authority required; reconnect behavior TBD. |
| `R3-DICE` | REQ | N/A | REQ | N/A | REQ | REQ | REQ | TBD | N/A | REQ | Error = presentation fallback; Keyboard = no essential keyboard dependency; visibility variant unresolved. |
| `R4-CONFIRM` | REQ | N/A | TBD | TBD | TBD | REQ | REQ | TBD | N/A | REQ | Action-dependent pending/disabled/error/role cases resolved by downstream contract. |
| `R5-BANNER` | REQ | N/A | N/A | N/A | TBD | REQ | REQ | TBD | TBD | REQ | Severity semantics and reconnect use depend on STATE/A11Y/SES decisions. |

## Coverage rule

Before a scope is implementation-ready, AI must convert applicable `TBD` cells that materially affect behavior into either:

- a canonical decision/contract;
- `N/A` with a reason in `Notes / Refs`; or
- an explicit Planning Gap that blocks implementation at the selected Spec Tier.

The owner should see only material blocking gaps, not every matrix maintenance detail.
