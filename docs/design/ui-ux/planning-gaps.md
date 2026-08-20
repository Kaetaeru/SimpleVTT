# SimpleVTT UI/UX Planning Gaps

Status: active unresolved planning queue

This file records **known material gaps that AI must not silently invent**. It is not a miscellaneous todo list.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Dashboard: [`README.md`](README.md)

## Gap rules

A gap belongs here when implementation or downstream planning would otherwise require guessing product behavior, authority, visibility, persistence, transition, or required UI state.

Each gap must identify:

- `Gap ID`
- `Owner Sheet / Destination`
- `Affected IDs / Surfaces`
- `Gap`
- `Why AI cannot infer it safely`
- `Smallest decision needed`
- `Status`

Once resolved, move the normative answer into `decisions.md` and mark the gap `Resolved` with the resulting Decision ID.

---

## GAP-UX02-ROLE-MODEL

- **Owner Sheet:** UX-02
- **Affected:** Role-aware IA, Session, Play, authority matrices
- **Gap:** The product has not yet reviewed whether Play Role (`DM / Player`) and Connection Role (`Offline / Host / Client`) are separate axes or one combined role model.
- **Why AI cannot infer it safely:** Current implementation exposes both role-like concepts, but code shape is evidence rather than product truth.
- **Smallest decision needed:** `UX-02-01`
- **Status:** Open

## GAP-UX02-OFFLINE-ROLE

- **Owner Sheet:** UX-02
- **Depends On:** UX-02-01
- **Gap:** Whether standalone/offline use carries an explicit DM/Player identity is undecided.
- **Why AI cannot infer it safely:** Standalone Character use is first-class and should not be forced into a role merely because connected Play uses roles.
- **Smallest decision needed:** `UX-02-02`
- **Status:** Open

## GAP-JOIN-NO-CHARACTER

- **Owner Sheet:** UX-02 / SES-01
- **Affected:** Join flow, Character selection
- **Gap:** What happens when a Player attempts to join but has no valid Character available is undecided.
- **Why AI cannot infer it safely:** Automatically creating, importing, spectating, or blocking are materially different product behaviors.
- **Smallest decision needed:** Define the allowed no-character Join branch.
- **Status:** Open

## GAP-MAIN-HAND-CANONICAL-RELATION

- **Owner Sheet:** DND-03 / domain dependency
- **Affected Decision:** ORIGIN-UX-01-17
- **Gap:** The UI intent assumes a canonical relation from equipped Main Hand to executable attack, but that relation must exist in authoritative application/domain data.
- **Why AI cannot infer it safely:** UI choosing a weapon by heuristics would violate the no-invention and UI-not-rules boundaries.
- **Smallest decision needed:** Confirm/provide the canonical main-hand executable-action relation or explicitly block the default-click behavior until available.
- **Status:** Open

## GAP-DM-ROLL-VISIBILITY-PERSISTENCE

- **Owner Sheet:** DM-01
- **Affected Decision:** ORIGIN-UX-01-27
- **Gap:** The initial default for `Public / DM Only` and the exact persistence boundary are not decided.
- **Why AI cannot infer it safely:** Per-session, per-device, per-scene, or persistent-user preference produce different privacy behavior.
- **Smallest decision needed:** Decide initial value and persistence lifetime.
- **Status:** Open

## GAP-DM-PRIVATE-ACTIVITY-PRESENTATION

- **Owner Sheet:** DM-02
- **Origin:** old UX-01-30, unanswered
- **Gap:** How DM Activity displays private rolls is undecided.
- **Known options from prior review:** one chronological record with DM-only badge; separate private-roll area; one chronology with visibility filter.
- **Why AI cannot infer it safely:** This determines auditability, density, and disclosure affordances.
- **Smallest decision needed:** Ask only when the complete DM-02 Decision Map is active.
- **Status:** Open / deferred to DM-02

## GAP-ACTOR-CONTEXT-MENU-CONTENTS

- **Owner Sheet:** INT-01
- **Affected Decision:** ORIGIN-UX-01-16
- **Gap:** Exact Actor Context Menu commands are intentionally undecided.
- **Why AI cannot infer it safely:** The menu must not become a duplicate Hotbar and DM-specific commands require authority decisions.
- **Smallest decision needed:** Define context-menu command categories during INT-01 review.
- **Status:** Open

## GAP-RESOLUTION-SAFE-INTERACTIONS

- **Owner Sheet:** DND-03 / INT-01
- **Affected Decision:** ORIGIN-UX-01-21
- **Gap:** Resolution keeps the HUD skeleton and locks only conflicting interactions, but the exact safe-vs-conflicting interaction boundary is undecided.
- **Why AI cannot infer it safely:** Allowing a conflicting command can corrupt flow; over-locking violates the reviewed UX direction.
- **Smallest decision needed:** Define the interaction lock matrix for each material resolution/interrupt stage.
- **Status:** Open

## GAP-HANDOUT-NETWORK-CONTRACT

- **Owner Sheet:** SES-01 / SES-02
- **Affected Decisions:** ORIGIN-UX-01-12, ORIGIN-UX-01-13
- **Gap:** Shared presentation mode and reconnect restoration require a session/network presentation contract that the current handout envelope does not yet express.
- **Why AI cannot infer it safely:** Adding local-only presentation state would violate the reviewed shared-state behavior; changing network schema is an architecture contract decision.
- **Smallest decision needed:** Specify authoritative handout presentation state fields and reconnect projection when implementation is authorized.
- **Status:** Open implementation contract gap

## GAP-DM-ONLY-DELIVERY-PROTOCOL

- **Owner Sheet:** SES-02
- **Affected Decisions:** ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29
- **Gap:** The authoritative event/network projection for DM-only adjudication and later disclosure is not yet fully specified.
- **Why AI cannot infer it safely:** UI-only hiding would be a privacy/authority violation. Existence metadata, Activity events, reconnect ledger, and later reveal all need role-scoped projection semantics.
- **Smallest decision needed:** Define session event visibility/disclosure contract in SES-02 before implementation.
- **Status:** Open / Critical

## GAP-CANONICAL-UX-DOC-RECONCILIATION

- **Owner Sheet:** Governance / affected downstream sheets
- **Affected:** Existing `V1_PRODUCT_EXPERIENCE.md`, `V1_PLAY_SURFACE_REVISION.md`, selected UI planning decisions
- **Gap:** Existing planning prose contains directions such as tabletop-first/VTT-additional, intent-first compact action UX, and initiative-stage replacement that conflict with newer Reviewed/Selected planning direction.
- **Why AI cannot infer it safely:** Until applicable product decisions are Frozen and canonical planning docs are reconciled, implementation agents may receive contradictory guidance.
- **Smallest decision needed:** After relevant sheets are Reviewed/Frozen, explicitly supersede or revise conflicting legacy planning text by ID/scope.
- **Status:** Open reconciliation gap

## GAP-R1-R9-INVENTORY

- **Owner Sheet:** Framework execution
- **Affected:** Whole product
- **Gap:** The complete R1-R9 inventory is not yet materialized in canonical files.
- **Why AI cannot infer it safely:** Missing inventory risks skipping non-route UI such as confirmations, notification surfaces, edge states, and motion contracts.
- **Smallest decision needed:** None from owner yet; AI should prepare the inventory for owner review before resuming UX-02.
- **Status:** Next preparation task

## GAP-M1-M6-COVERAGE

- **Owner Sheet:** Framework execution
- **Depends On:** GAP-R1-R9-INVENTORY
- **Gap:** Required matrix rows have not yet been enumerated for all material surfaces.
- **Why AI cannot infer it safely:** Authority/accessibility/responsive/state coverage can be missed if not cross-checked systematically.
- **Smallest decision needed:** None from owner until the generated coverage exposes a material product choice.
- **Status:** Pending inventory

---

# Resolved gaps

None recorded yet in this canonical queue.
