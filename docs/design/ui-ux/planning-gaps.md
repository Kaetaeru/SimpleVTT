# SimpleVTT UI/UX Planning Gaps

Status: active unresolved planning queue

This file records **known material gaps that AI must not silently invent**. It is not a miscellaneous todo list.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Dashboard: [`README.md`](README.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)

## Gap rules

A gap belongs here when implementation or downstream planning would otherwise require guessing product behavior, authority, visibility, persistence, transition, or required UI state.

Each gap identifies:

- `Gap ID`
- `Gap Type`
- `Severity`
- `Owner Sheet / Destination`
- `Affected IDs / Surfaces`
- `Gap`
- `Why AI cannot infer it safely`
- `Smallest decision needed`
- `Status`

### Gap Type enum

- `OWNER_DECISION` — the owner must choose product/UX behavior.
- `DOMAIN_CONTRACT` — authoritative domain/application data or semantics are missing.
- `ARCHITECTURE_CONTRACT` — networking, persistence, privacy, schema, or runtime contract is missing.
- `IMPLEMENTATION_BLOCKER` — planning is clear but implementation cannot safely proceed yet.
- `DOCUMENT_RECONCILIATION` — canonical/legacy documents conflict or need supersession cleanup.
- `COVERAGE` — planning infrastructure or systematic coverage is incomplete/stale.

### Severity enum

- `Critical` — privacy/authority/data/game-state corruption or security risk.
- `Major` — blocks a first-class flow or creates repeated material UX ambiguity.
- `Normal` — important but localized/deferred and not currently critical.

Once resolved, move the normative answer into `decisions.md` or the appropriate canonical contract and move the gap to **Resolved gaps** with the resulting Decision/Contract ID.

---

# Open gaps

## GAP-UX02-ROLE-MODEL

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** UX-02
- **Affected:** Role-aware IA, Session, Play, authority matrices
- **Gap:** The product has not yet reviewed whether Play Role (`DM / Player`) and Connection Role (`Offline / Host / Client`) are separate axes or one combined role model.
- **Why AI cannot infer it safely:** Current implementation exposes both role-like concepts, but code shape is evidence rather than product truth.
- **Smallest decision needed:** `UX-02-01`
- **Status:** Open

## GAP-UX02-OFFLINE-ROLE

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** UX-02
- **Depends On:** UX-02-01
- **Gap:** Whether standalone/offline use carries an explicit DM/Player identity is undecided.
- **Why AI cannot infer it safely:** Standalone Character use is first-class and should not be forced into a role merely because connected Play uses roles.
- **Smallest decision needed:** `UX-02-02`
- **Status:** Open

## GAP-JOIN-NO-CHARACTER

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** UX-02 / SES-01
- **Affected:** Join flow, Character selection
- **Gap:** What happens when a Player attempts to join but has no valid Character available is undecided.
- **Why AI cannot infer it safely:** Automatically creating, importing, spectating, or blocking are materially different product behaviors.
- **Smallest decision needed:** Define the allowed no-character Join branch.
- **Status:** Open

## GAP-MAIN-HAND-CANONICAL-RELATION

- **Gap Type:** DOMAIN_CONTRACT
- **Severity:** Major
- **Owner Sheet:** DND-03 / domain dependency
- **Affected Decision:** ORIGIN-UX-01-17
- **Gap:** The UI intent assumes a canonical relation from equipped Main Hand to executable attack, but that relation must exist in authoritative application/domain data.
- **Why AI cannot infer it safely:** UI choosing a weapon by heuristics would violate the no-invention and UI-not-rules boundaries.
- **Smallest decision needed:** Confirm/provide the canonical main-hand executable-action relation or explicitly block the default-click behavior until available.
- **Status:** Open

## GAP-DM-ROLL-VISIBILITY-PERSISTENCE

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** DM-01
- **Affected Decision:** ORIGIN-UX-01-27
- **Gap:** The initial default for `Public / DM Only` and the exact persistence boundary are not decided.
- **Why AI cannot infer it safely:** Per-session, per-device, per-scene, or persistent-user preference produce different privacy behavior.
- **Smallest decision needed:** Decide initial value and persistence lifetime.
- **Status:** Open

## GAP-DM-PRIVATE-ACTIVITY-PRESENTATION

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** DM-02
- **Origin:** old UX-01-30, unanswered
- **Gap:** How DM Activity displays private rolls is undecided.
- **Known options from prior review:** one chronological record with DM-only badge; separate private-roll area; one chronology with visibility filter.
- **Why AI cannot infer it safely:** This determines auditability, density, and disclosure affordances.
- **Smallest decision needed:** Ask only when the complete DM-02 Decision Map is active.
- **Status:** Open / deferred to DM-02

## GAP-ACTOR-CONTEXT-MENU-CONTENTS

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** INT-01
- **Affected Decision:** ORIGIN-UX-01-16
- **Gap:** Exact Actor Context Menu commands are intentionally undecided.
- **Why AI cannot infer it safely:** The menu must not become a duplicate Hotbar and DM-specific commands require authority decisions.
- **Smallest decision needed:** Define context-menu command categories during INT-01 review.
- **Status:** Open

## GAP-RESOLUTION-SAFE-INTERACTIONS

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** DND-03 / INT-01
- **Affected Decision:** ORIGIN-UX-01-21
- **Gap:** Resolution keeps the HUD skeleton and locks only conflicting interactions, but the exact safe-vs-conflicting interaction boundary is undecided.
- **Why AI cannot infer it safely:** Allowing a conflicting command can corrupt flow; over-locking violates the reviewed UX direction.
- **Smallest decision needed:** Define the interaction lock matrix for each material resolution/interrupt stage.
- **Status:** Open

## GAP-HANDOUT-NETWORK-CONTRACT

- **Gap Type:** ARCHITECTURE_CONTRACT
- **Severity:** Major
- **Owner Sheet:** SES-01 / SES-02
- **Affected Decisions:** ORIGIN-UX-01-12, ORIGIN-UX-01-13
- **Gap:** Shared presentation mode and reconnect restoration require a session/network presentation contract that the current handout envelope does not yet express.
- **Why AI cannot infer it safely:** Adding local-only presentation state would violate the reviewed shared-state behavior; changing network schema is an architecture contract decision.
- **Smallest decision needed:** Specify authoritative handout presentation state fields and reconnect projection when implementation is authorized.
- **Status:** Open implementation contract gap

## GAP-DM-ONLY-DELIVERY-PROTOCOL

- **Gap Type:** ARCHITECTURE_CONTRACT
- **Severity:** Critical
- **Owner Sheet:** SES-02
- **Affected Decisions:** ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29
- **Gap:** The authoritative event/network projection for DM-only adjudication and later disclosure is not yet fully specified.
- **Why AI cannot infer it safely:** UI-only hiding would be a privacy/authority violation. Existence metadata, Activity events, reconnect ledger, and later reveal all need role-scoped projection semantics.
- **Smallest decision needed:** Define session event visibility/disclosure contract in SES-02 before implementation.
- **Status:** Open / Critical

## GAP-CANONICAL-UX-DOC-RECONCILIATION

- **Gap Type:** DOCUMENT_RECONCILIATION
- **Severity:** Major
- **Owner Sheet:** Governance / affected downstream sheets
- **Affected:** Existing `V1_PRODUCT_EXPERIENCE.md`, `V1_PLAY_SURFACE_REVISION.md`, selected UI planning decisions
- **Gap:** Existing planning prose contains directions such as tabletop-first/VTT-additional, intent-first compact action UX, and initiative-stage replacement that conflict with newer Reviewed/Selected planning direction.
- **Why AI cannot infer it safely:** Until applicable product decisions are Frozen and canonical planning docs are reconciled, implementation agents may receive contradictory guidance.
- **Smallest decision needed:** After relevant sheets are Reviewed/Frozen, explicitly supersede or revise conflicting legacy planning text by ID/scope.
- **Status:** Open reconciliation gap

---

# Resolved gaps

## GAP-R1-R9-INVENTORY

- **Gap Type:** COVERAGE
- **Severity:** Major
- **Owner Sheet:** Framework execution
- **Affected:** Whole product
- **Resolution:** `registry.md` now materializes the R1-R9 seed inventory. It remains Draft and still requires implementation/master-flow/decision cross-check before owner review is complete.
- **Resolved By:** `registry.md`
- **Status:** Resolved — infrastructure materialized; coverage review continues as normal dashboard work, not as an open material gap.

## GAP-M1-M6-COVERAGE

- **Gap Type:** COVERAGE
- **Severity:** Major
- **Owner Sheet:** Framework execution
- **Resolution:** `matrices.md` now materializes M1-M6 schemas and seed coverage rows. Individual `TBD` cells may still create specific planning gaps as review proceeds.
- **Resolved By:** `matrices.md`
- **Status:** Resolved — matrix infrastructure materialized; expansion continues as derived maintenance.
