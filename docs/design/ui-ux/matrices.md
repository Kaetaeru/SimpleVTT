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
- If a row exposes an undecided product behavior, link a Planning Gap or declared Draft Decision Map item instead of guessing.
- Reference fields MUST follow `MANIFEST.yaml`: complete resolvable IDs/paths only; no ranges, omitted prefixes, or prose aliases.
- Prefer enums/IDs over free-form prose where practical.
- Do not copy full Decision Card text into a matrix cell.
- Current implementation paths may appear as evidence references; they never substitute for a Decision/Gap/contract when behavior is normative.

---

# M1 — Role / Authority / Visibility / Disclosure

Connected identity invariant from `UX-02-01`: **Host = DM; Client = Player.** Host/Player and Client/DM are not valid connected-role combinations. Offline/Standalone is explicitly **role-free** under `UX-02-02`; do not assign DM/Player identity to local-only use.

## Row schema

| Capability/Data | Context | Role | May See | May Receive | May Control | May Disclose | Source | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Seed rows

| Capability/Data | Context | Role | May See | May Receive | May Control | May Disclose | Source | Gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Public roll projection | Connected Client | Player | yes | yes | n/a | n/a | UX-02-01, ORIGIN-UX-01-26 | — |
| Public roll projection | Connected Host | DM | yes | yes | TBD | n/a | UX-02-01, ORIGIN-UX-01-26 | UX-02-05 |
| DM-only roll details | Connected Client | Player | no | no | no | no | UX-02-01, ORIGIN-UX-01-26, ORIGIN-UX-01-29 | GAP-DM-ONLY-DELIVERY-PROTOCOL |
| DM-only roll details | Connected Host | DM | yes | yes | TBD | yes | UX-02-01, ORIGIN-UX-01-26, ORIGIN-UX-01-28 | GAP-DM-ROLL-VISIBILITY-PERSISTENCE |
| Activity / play record | Connected Client | Player | TBD | TBD | no | no | UX-02-01, R4-ACTIVITY | UX-02-08, GAP-DM-PRIVATE-ACTIVITY-PRESENTATION |
| Activity / play record | Connected Host | DM | yes | yes | TBD | TBD | UX-02-01, R4-ACTIVITY, ORIGIN-UX-01-28 | UX-02-05, GAP-DM-PRIVATE-ACTIVITY-PRESENTATION |
| Encounter management | Connected Client Play | Player | TBD | TBD | TBD | no | UX-02-01, R4-ENCOUNTER | UX-02-03, UX-02-04 |
| Encounter management | Connected Host Play | DM | TBD | TBD | TBD | n/a | UX-02-01, R4-ENCOUNTER | UX-02-05 |
| DM spatial relation authoring | Connected Client Play | Player | TBD | TBD | TBD | no | UX-02-01, R4-DM-SPATIAL-RELATION | UX-02-03, UX-02-04 |
| DM spatial relation authoring | Connected Host Play | DM | yes in current implementation | session/domain projection TBD | TBD | n/a | UX-02-01, R4-DM-SPATIAL-RELATION, DM-01-03 | UX-02-05 |
| Participant roster | Connected Client Play | Player | TBD | TBD | TBD | no | UX-02-01, R4-PARTICIPANTS | UX-02-07, UX-02-08 |
| Participant roster | Connected Host Play | DM | TBD | TBD | TBD | n/a | UX-02-01, R4-PARTICIPANTS | UX-02-05, UX-02-07 |
| Session share/address/content info | Connected Client Play | Player | TBD | TBD | TBD | no | UX-02-01, R4-SESSION-SHARE | UX-02-07, UX-02-08 |
| Session share/address/content info | Connected Host Play | DM | TBD | TBD | TBD | TBD | UX-02-01, R4-SESSION-SHARE | UX-02-05, UX-02-07 |
| Actor control | Connected Play | Player/DM by fixed connection mapping | TBD | TBD | TBD | n/a | UX-02-01, UX-02-03, UX-02-04, UX-02-05 | UX-02-03, UX-02-04, UX-02-05 |
| Manual movement-reaction declaration | Initiative | Player/DM by fixed connection mapping | TBD | TBD | TBD | n/a | UX-02-01, R4-MOVEMENT-REACTION-INPUT | UX-02-03, UX-02-04, UX-02-05 |
| Concentration save response | Resolution | Player/DM by fixed connection mapping | TBD | authoritative resolution projection | TBD | n/a | UX-02-01, R4-CONCENTRATION-SAVE, DND-02-09 | UX-02-03, UX-02-05 |
| Player connection/rejoin/leave controls | Connected Client | Player | yes | local/session projection | TBD | n/a | UX-02-01, R4-PLAYER-SESSION, UX-01-03 | UX-02-03, UX-02-07 |
| Handout presentation control | Connected Client | Player | yes when authorized projection exists | authorized projection only | local dismiss only where reviewed | no | UX-02-01, ORIGIN-UX-01-12, ORIGIN-UX-01-13 | GAP-HANDOUT-NETWORK-CONTRACT |
| Handout presentation control | Connected Host | DM | yes | yes | TBD | TBD | UX-02-01, ORIGIN-UX-01-12 | UX-02-05, GAP-HANDOUT-NETWORK-CONTRACT |

Do not infer Actor control, UI divergence, or unauthorized-information policy from the fixed Host/DM and Client/Player mapping. Those remain owned by `UX-02-03` through `UX-02-08` as applicable. Offline/Standalone has no DM/Player role under `UX-02-02`.

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
| `M2-PLY-011` | `R3-RESOLVING` | concentration save response required | authoritative resolution requests response | `R4-CONCENTRATION-SAVE` within resolving context | no final commit until accepted response | invalid/unavailable response remains explicit | R4-CONCENTRATION-SAVE, DND-02-09 |

## Session seed

| ID | Current State | Event | Guard / Authority | Next State | Side Effect | Failure / Recovery | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `M2-SES-001` | Home/Session | Host | valid host setup; connected Host maps to DM by UX-02-01 | Host Setup/Lobby | create/prepare session command | explicit validation error | UX-02-01, R2-HOST |
| `M2-SES-002` | Home/Session | Join | valid join input; connected Client maps to Player by UX-02-01 | Character Select / connecting path | join attempt | remain/recover | UX-02-01, R2-JOIN |
| `M2-SES-003` | Character Select | no valid Character | none | **TBD** | none | explicit Planning Gap | GAP-JOIN-NO-CHARACTER |
| `M2-SES-004` | Live session | connection lost | network state | Reconnecting | preserve canonical context | explicit unrecoverable branch | UX-01-03, R2-RECONNECT |
| `M2-SES-005` | Reconnecting | recovered | canonical reconnect accepted | prior live context | reconcile projection | explicit failure branch | UX-01-03 |
| `M2-SES-006` | Disconnected | rejoin same Host | connection/session authority | Connecting/Reconnecting | submit rejoin | remain disconnected with reason | R4-PLAYER-SESSION, R6-DISCONNECTED |
| `M2-SES-007` | Connected Play | open session utility | local presentation | same canonical Play + utility open | no gameplay mutation | close/restore focus | R7-SESSION-UTILITY-RAIL |
| `M2-SES-008` | Session utility open | Escape/close | local presentation | same canonical Play + utility closed | no gameplay mutation | return focus to launcher | R7-SESSION-UTILITY-RAIL, A11Y-01 |
| `M2-SES-009` | Connected Play | open Full Sheet | local presentation | same canonical Play + Full Sheet layer | no session/game-state reset | close/return context | R4-FULL-SHEET-LAYER, UX-01-03 |
| `M2-SES-010` | Player handout visible | local dismiss | reviewed Overlay semantics when applicable | same shared handout state + local hidden presentation | local presentation only | reopen from handout launcher | ORIGIN-UX-01-13, R4-PLAYER-HANDOUT-VIEWER |

## Character / content seed

| ID | Current State | Event | Guard / Authority | Next State | Side Effect | Failure / Recovery | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `M2-CHR-001` | Home guide open | dismiss | local presentation preference | Home guide closed | persist local preference when available | guide may reopen explicitly | R2-FIRST-USE |
| `M2-CHR-002` | Character Sheet | switch layout | local presentation preference | same Character Sheet with other layout | persist local preference | fallback to supported layout | R3-SHEET-SIMPLEVTT, R3-SHEET-OFFICIAL |
| `M2-CONT-001` | Content | choose add-on file | file/read contract | Import Review | parse/preview only | blocking file/read error stays recoverable | R2-CONTENT-INSTALL, R4-IMPORT-REVIEW |
| `M2-CONT-002` | Import Review | install | validation has no blocking issue | Content | durable/local catalog mutation according to content contract | preserve review/error on failure | R2-CONTENT-INSTALL |

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
| Concentration save input/result | authoritative resolution/runtime | resolution/event | visibility/authority scoped | response only through resolution command | R4-CONCENTRATION-SAVE, DND-02-09 |
| Activity event history | authoritative activity/session history | event/session/history as defined | visibility/disclosure scoped | no direct history mutation | R4-ACTIVITY, ORIGIN-UX-01-22, GAP-DM-PRIVATE-ACTIVITY-PRESENTATION |
| DM-authored spatial relation | authoritative spatial/session relation source TBD by domain/session contract | session/current relation lifetime TBD | session projection TBD | only through authorized relation command | R4-DM-SPATIAL-RELATION, DM-01-03 |
| Dice fine trajectory | local presentation | transient | no | yes | ORIGIN-UX-01-25 |
| Hotbar custom arrangement | user presentation preference | TBD | normally local | yes when allowed | UX-01-06 |
| Selected Hotbar tab | UI presentation | transient/local preference TBD | no | yes | UX-01-06 |
| Character Sheet layout preference | local presentation preference | durable local preference in current implementation | no | yes | R3-SHEET-SIMPLEVTT, R3-SHEET-OFFICIAL, src/CharacterSheetPlayScreen.tsx |
| Appearance mode/accent | local presentation preference | durable local preference in current implementation | no | yes | R1-SETTINGS, src/AppearanceSettingsBridge.tsx |
| Home onboarding dismissal | local presentation preference | durable/best-effort local preference in current implementation | no | yes | R2-FIRST-USE, src/V1HomeScreen.tsx |
| Session utility open/layer state | local presentation | transient | no | yes | R7-SESSION-UTILITY-RAIL, R4-FULL-SHEET-LAYER |
| Handout presentation mode | intended shared session presentation state | session/reconnect | yes | authorized command only | ORIGIN-UX-01-12, GAP-HANDOUT-NETWORK-CONTRACT |
| Handout local dismissed/open state | local presentation | current handout/session | no | yes only where reviewed | ORIGIN-UX-01-13, R4-PLAYER-HANDOUT-VIEWER |
| Portrait asset/focal point | canonical Character presentation data or Character-owned profile data TBD by DND-01 | durable in current implementation | session projection TBD | through Character update command only | R4-PORTRAIT-EDITOR, DND-01 |
| Tooltip/open popover state | UI presentation | transient | no | yes | INT-02 |

Do not duplicate domain formulas or lifecycle semantics here. Reference their canonical domain/design documents. `TBD` ownership/lifetime values must be resolved by the responsible Decision Map/contract before implementation reliance.

---

# M4 — Accessibility / Input

## Seed coverage rows

| Artifact | Keyboard entry | Focus on open/select | Escape / Cancel | Focus return | Pointer alternative | Semantic/status requirement | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R4-CONFIRM` | required | defined per dialog | safe cancel when valid | invoker/logical next | n/a | dialog/alert-dialog pattern to review | A11Y-01, INT-03 |
| `R4-ACTOR-CONTEXT` | required equivalent | menu/context entry TBD | close | Actor Card | keyboard equivalent to right-click | exact menu semantics TBD | GAP-ACTOR-CONTEXT-MENU-CONTENTS |
| `R4-QUICK-SHEET` | required | launcher -> sheet | close/Escape | launcher | all launch controls keyboard reachable | pane/region semantics to review | R4-QUICK-SHEET, A11Y-01 |
| `R4-FULL-SHEET-LAYER` | required | launcher -> workspace | close/Escape | launcher or prior utility | full sheet functionality keyboard reachable | layer/workspace semantics TBD | R4-FULL-SHEET-LAYER, A11Y-01 |
| `R4-ACTIVITY` | required | launcher/route -> record list | close/return by host context | launcher/logical prior route | record/detail actions keyboard reachable | private/public visibility must be exposed semantically | R4-ACTIVITY, DM-02-01, A11Y-01 |
| `R4-PLAYER-HANDOUT-VIEWER` | required | open control/viewer close | local close where applicable | handout launcher | reopen equivalent | current modal dialog evidence; final mode semantics vary | ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT |
| `R4-CONCENTRATION-SAVE` | required | resolution prompt -> d20 input | cancellation policy TBD by resolution | resolution context | number input/submit keyboard reachable | required response/result announcement semantics TBD | R4-CONCENTRATION-SAVE, A11Y-01 |
| `R4-MOVEMENT-REACTION-INPUT` | required | trigger -> dialog | cancel/Escape requirement TBD | trigger | all fields/actions keyboard reachable | modal dialog evidence; authority semantics TBD | R4-MOVEMENT-REACTION-INPUT, A11Y-01 |
| `R4-DM-SPATIAL-RELATION` | required if productized | utility/advanced control | collapse/return TBD | invoking utility context | selects/inputs/checks keyboard reachable | relation field state must not rely on pointer only | R4-DM-SPATIAL-RELATION, A11Y-01 |
| `R4-PORTRAIT-EDITOR` | required | portrait control | explicit cancel | portrait control | file/range/buttons keyboard reachable | errors must be announced/readable | R4-PORTRAIT-EDITOR, A11Y-01 |
| `R4-PLAYER-SESSION` | required | launcher -> pane | close/Escape | launcher | recovery controls keyboard reachable | connection changes announced | R4-PLAYER-SESSION, R5-CONNECTION-RECOVERY |
| `R7-SESSION-UTILITY-RAIL` | required | all utilities reachable | open utility closes with Escape | exact launcher | pointer and keyboard equivalent | active utility exposed semantically | R7-SESSION-UTILITY-RAIL, A11Y-01 |
| `R7-ACTOR-CARD` | required | visible focus | context dependent | n/a | click actions need keyboard equivalent | semantic role to decide | INT-01, A11Y-01 |
| `R7-HOTBAR-SLOT` | required | visible focus | targeting cancel path applicable | logical slot/context | click equivalent | unavailable state/reason accessible | DND-03, A11Y-01 |
| `R9-DICE-THROW` | no input dependency | must not steal essential focus by default | n/a | n/a | n/a | reduced-motion/result equivalent required | ORIGIN-UX-01-25 |
| `R5-BANNER` | action-dependent | should not steal focus unless required by pattern | n/a | n/a | action equivalent if actionable | status/alert semantics TBD by severity | STATE-02, A11Y-01 |

Detailed ARIA/semantic decisions are owned by A11Y-01 and component contracts; current ARIA usage is evidence only.

---

# M5 — Responsive / Layout

## Seed rows

| Surface | Wide | Normal | Narrow | MUST remain | MAY collapse/reflow | MUST NOT hide | Refs / Gap |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-PLAY` | full Dual Anchor | Dual Anchor | compressed/reflow TBD | Scene/Actor context + Command Center accessibility | secondary metadata pending review | core capabilities solely for cleanliness | UX-01-04, UX-01-07 |
| `R7-HOTBAR-TABS` | full tabs | full/compact TBD | compact/reflow TBD | capability-page reachability | labels/secondary metadata only if approved | entire Hotbar behind generic drawer by default | ORIGIN-UX-01-07 |
| `R7-ACTOR-CARD` | full card | compact card TBD | compact/reflow TBD | identity + required interaction/target state | secondary metadata TBD | invalid target existence during targeting | ORIGIN-UX-01-19 |
| `R7-COMMAND-CENTER` | full command surface | full command surface | reflow/compress TBD | capabilities + economy/resources + current actor context | secondary labels/metadata when approved | command surface entirely behind utility navigation | UX-01-04, UX-01-07, ORIGIN-UX-01-09 |
| `R7-SESSION-UTILITY-RAIL` | current implementation uses rail | current implementation uses rail | reflow/alternative TBD | reachable contextual utilities when applicable | rail may transform if NAV/PLATFORM approve | core command capabilities | R7-SESSION-UTILITY-RAIL, PLATFORM-01 |
| `R1-CHAR-SHEET` | multi-column candidate | TBD | stacked/reflow candidate | core Character information/action access | secondary grouping | TBD | DND-01, PLATFORM-01 |
| `R1-CHAR-BUILDER` | step/work/preview candidate | step/work/preview candidate | stacked/reflow TBD | progress + active work + primary actions | preview/step presentation | validation/commit/cancel access | DND-01, PLATFORM-01 |
| `R1-LEVEL-UP` | step/work/preview candidate | step/work/preview candidate | stacked/reflow TBD | current stage + preview + commit/cancel | secondary detail | blocking validation and primary actions | DND-01, PLATFORM-01 |
| `R4-FULL-SHEET-LAYER` | full workspace layer | full workspace layer | stacked/scroll behavior TBD | sheet actions + close/return | layout columns | close/return control | R4-FULL-SHEET-LAYER, PLATFORM-01 |
| `R4-ACTIVITY` | list/detail as space allows | list/detail | stacked/detail TBD | event chronology + visibility state | technical detail/provenance | correction/disclosure state | R4-ACTIVITY, PLATFORM-01 |
| `R4-PLAYER-HANDOUT-VIEWER` | mode-dependent | mode-dependent | mode-dependent TBD | authorized image + required dismissal semantics | image fit/zoom controls | DM-required shared presentation state | ORIGIN-UX-01-12, ORIGIN-UX-01-13, GAP-HANDOUT-NETWORK-CONTRACT |
| `R4-CONCENTRATION-SAVE` | resolution-embedded | resolution-embedded | reflow within resolution TBD | prompt/result + submit when required | secondary explanation | authoritative required response | R4-CONCENTRATION-SAVE, PLATFORM-01 |
| `R4-DM-SPATIAL-RELATION` | contextual/advanced control | contextual/advanced control | stacked/reflow TBD | required relation fields if productized | labels/grouping | submit/recovery state | R4-DM-SPATIAL-RELATION, PLATFORM-01 |

No numeric breakpoint is canonical until PLATFORM-01 / design tokens establish one.

---

# M6 — Coverage / Acceptance

## Coverage values

Every coverage cell MUST be exactly one of:

- `REQ`
- `N/A`
- `TBD`
- a specific full contract/test ID

Explanatory conditions belong in the human-readable `Notes` column, not inside the coverage value.

## Core surface grid

| Surface | Normal | Empty | Loading/Pending | Disabled | Error | Keyboard | Narrow | Role variants | Reconnect | Owner walkthrough | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-HOME` | REQ | TBD | REQ | N/A | REQ | REQ | REQ | TBD | TBD | REQ | Reconnect applies only when a live session exists; connected Host/DM and Client/Player mapping is fixed, while Offline/Standalone has no role variant. |
| `R2-FIRST-USE` | REQ | N/A | N/A | N/A | TBD | REQ | REQ | N/A | N/A | REQ | Offline/Standalone first-use guidance is role-free; dismiss/reopen/persistence need explicit onboarding review. |
| `R1-CHARACTERS` | REQ | REQ | REQ | TBD | REQ | REQ | REQ | TBD | N/A | REQ | Offline/Standalone has no role variant; connected Character context may still differ by later UX-02 decisions. |
| `R1-CHAR-BUILDER` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Guided/quick/import/edit mode coverage; unsupported/validation branches required. Offline use is role-free. |
| `R1-CHAR-SHEET` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | Standalone context is role-free; connected session context and layout variants require representative coverage. |
| `R1-LEVEL-UP` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Choice-blocked, HP roll, validation, review and commit/cancel branches. Offline use is role-free. |
| `R2-STANDALONE-ROLL` | REQ | N/A | REQ | TBD | REQ | REQ | REQ | N/A | N/A | REQ | Local roll/result/dice path; no DM/Player role variant. |
| `R1-SESSION` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Host=DM and Client=Player are fixed connected variants; lobby/live/recovery coverage remains required. |
| `R1-PLAY` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Whole connected Play workspace requires Host/DM and Client/Player representative walkthroughs. |
| `R1-CONTENT` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | Installed/import/validation/persistence states; active-session policy still downstream. |
| `R1-RULES` | REQ | REQ | REQ | TBD | REQ | REQ | REQ | TBD | REQ | REQ | Product-shell and in-session lookup paths. |
| `R1-SETTINGS` | REQ | N/A | N/A | TBD | REQ | REQ | REQ | TBD | N/A | REQ | Theme/accent/motion preference coverage; persistence failure policy downstream. |
| `R3-TARGET-SINGLE` | REQ | N/A | N/A | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Target authority/control remains UX-02-03/04/05 despite fixed connected roles. |
| `R3-TARGET-MULTI` | REQ | N/A | N/A | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Target authority/control remains UX-02-03/04/05 despite fixed connected roles. |
| `R3-INTERRUPT` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | REQ | TBD | REQ | Responder authority and safe-interaction boundary required. |
| `R3-DICE` | REQ | N/A | REQ | N/A | REQ | REQ | REQ | TBD | N/A | REQ | Error = presentation fallback; visibility variants remain downstream. |
| `R4-RESOLUTION-DRAWER` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | N/A | N/A | REQ | Offline/product-shell resolution path is role-free; adjudication/Undo DM variant belongs to connected Host/DM context. |
| `R4-SESSION-RESOLUTION` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | REQ | TBD | REQ | Connected Play resolution layer. |
| `R4-QUICK-SHEET` | REQ | TBD | TBD | TBD | TBD | REQ | REQ | REQ | REQ | REQ | Client/Player current evidence; exact entitlement/topology unreviewed. |
| `R4-FULL-SHEET-LAYER` | REQ | TBD | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | Client/Player current evidence; must preserve session context. |
| `R4-SESSION-RULES` | REQ | REQ | TBD | TBD | REQ | REQ | REQ | TBD | REQ | REQ | Contextual Rules search/detail. |
| `R4-ACTIVITY` | REQ | REQ | TBD | TBD | REQ | REQ | REQ | TBD | REQ | REQ | Public/private/corrected/reversed history variants; private presentation deferred. |
| `R4-ENCOUNTER` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Host=DM fixed; exact Player visibility/control and DM authority remain UX-02-03/04/05/08. |
| `R4-DM-SPATIAL-RELATION` | TBD | TBD | TBD | TBD | TBD | REQ | REQ | REQ | TBD | REQ | Current Host/DM evidence; productization and exact authority/placement remain Draft. |
| `R4-PARTICIPANTS` | REQ | REQ | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | Connected roles fixed; information entitlement remains UX-02-07/08. |
| `R4-SESSION-SHARE` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Host/DM utility evidence; exact Player visibility remains downstream. |
| `R4-PLAYER-SESSION` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Connected Client/Player utility; rejoin/leave/connection state. |
| `R4-DM-HANDOUT-PANE` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Connected Host/DM authoring surface; shared presentation contract blocks readiness. |
| `R4-PLAYER-HANDOUT-VIEWER` | REQ | N/A | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | Connected Client/Player viewer; must cover Overlay/Upper/Full once contract exists. |
| `R4-CONCENTRATION-SAVE` | REQ | N/A | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | Required-response, validation and completed-result variants; Actor control authority remains downstream. |
| `R4-MOVEMENT-REACTION-INPUT` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | Current modal evidence; exact Actor-control authority/policy not reviewed. |
| `R4-PORTRAIT-EDITOR` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | TBD | TBD | REQ | File error/cancel/save/remove/focal controls; role/session projection TBD. |
| `R4-IMPORT-REVIEW` | REQ | REQ | REQ | REQ | REQ | REQ | REQ | TBD | N/A | REQ | Add-on/Character/Combatant variants. |
| `R4-CONFIRM` | REQ | N/A | TBD | TBD | TBD | REQ | REQ | TBD | N/A | REQ | Action-dependent pending/disabled/error/role cases resolved by downstream contract. |
| `R5-BANNER` | REQ | N/A | N/A | N/A | TBD | REQ | REQ | TBD | TBD | REQ | Severity semantics and reconnect use depend on STATE/A11Y/SES decisions. |
| `R5-CONNECTION-RECOVERY` | REQ | N/A | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | Connected Client/Player recovery is known; exact information/authority details remain downstream. |
| `R6-NO-VALID-CHARACTER` | TBD | REQ | N/A | REQ | REQ | REQ | REQ | REQ | N/A | REQ | Applies to connected Client/Player Join; recovery semantics blocked by GAP-JOIN-NO-CHARACTER. |
| `R7-COMMAND-CENTER` | REQ | TBD | REQ | REQ | REQ | REQ | REQ | REQ | REQ | REQ | Host/DM and Client/Player variants required; canonical planned anchor still differs from implementation. |
| `R9-COMBAT-VFX` | REQ | N/A | N/A | N/A | REQ | N/A | REQ | TBD | N/A | REQ | Reduced-motion equivalent belongs to A11Y/DND contracts. |

## Coverage rule

Before a scope is implementation-ready, AI must convert applicable `TBD` cells that materially affect behavior into either:

- a canonical decision/contract;
- `N/A` with a reason in `Notes`; or
- an explicit Planning Gap that blocks implementation at the selected Spec Tier.

The current Global Planning Gate requires **material coverage to exist**, not every future `TBD` to be decided before sequential review starts. A `TBD` is acceptable at this planning stage when it is owned by a declared Draft Decision Map item or explicit Planning Gap and is not being inferred by AI.

**Route D M1-M6 material coverage: PASS for the current Registry snapshot.** Future Registry/code/planning deltas require bounded coverage maintenance rather than keeping the current gate open indefinitely.

The owner should see only material blocking gaps, not every matrix maintenance detail.