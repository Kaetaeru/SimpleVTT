# SimpleVTT UI/UX Planning Gaps

Status: active unresolved planning queue

This file records **known material gaps that AI must not silently invent**. It is not a miscellaneous todo list.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)
Dashboard: [`README.md`](README.md)
Manifest: [`MANIFEST.yaml`](MANIFEST.yaml)
Integrated baseline: [`INTEGRATED-PRODUCT-UX-PLAN.md`](INTEGRATED-PRODUCT-UX-PLAN.md)

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

Structured Owner/Decision/Gap/Dependency references MUST use full stable IDs or repository paths per `MANIFEST.yaml`.

### Gap Type enum

- `OWNER_DECISION`
- `DOMAIN_CONTRACT`
- `ARCHITECTURE_CONTRACT`
- `IMPLEMENTATION_BLOCKER`
- `DOCUMENT_RECONCILIATION`
- `COVERAGE`

### Severity enum

- `Critical`
- `Major`
- `Normal`

### Status enum

- `Open`
- `Deferred`
- `Resolved`

Once resolved, move the normative answer into `decisions.md` or the appropriate canonical contract and retain the gap under Resolved gaps for traceability.

---

# Active gaps

## GAP-MAIN-HAND-CANONICAL-RELATION

- **Gap Type:** DOMAIN_CONTRACT
- **Severity:** Major
- **Owner Sheet:** DND-03
- **Affected Decision:** ORIGIN-UX-01-17
- **Gap:** The UI intent assumes a canonical relation from equipped Main Hand to executable attack, but that relation must exist in authoritative application/domain data.
- **Why AI cannot infer it safely:** UI choosing a weapon by heuristics would violate the no-invention and UI-not-rules boundaries.
- **Smallest decision needed:** Confirm/provide the canonical main-hand executable-action relation or explicitly block the default-click behavior until available.
- **Status:** Open

## GAP-RESOLUTION-SAFE-INTERACTIONS

- **Gap Type:** DOMAIN_CONTRACT
- **Severity:** Major
- **Owner Sheet:** DND-03
- **Affected Decision:** ORIGIN-UX-01-21
- **Gap:** Resolution keeps the HUD skeleton and locks only conflicting interactions, but the authoritative safe-vs-conflicting command boundary is not yet represented as a usable contract/projection.
- **Why AI cannot infer it safely:** This is command-conflict legality/safety, not a preference the owner should manually enumerate. UI must not guess which authoritative mutations may overlap.
- **Smallest decision needed:** Domain/application contract must expose or define conflict/safe interaction semantics; UI then applies the reviewed selective-locking behavior.
- **Status:** Open

## GAP-HANDOUT-NETWORK-CONTRACT

- **Gap Type:** ARCHITECTURE_CONTRACT
- **Severity:** Major
- **Owner Sheet:** SES-01, SES-02
- **Affected Decisions:** ORIGIN-UX-01-12, ORIGIN-UX-01-13
- **Gap:** Shared presentation mode and reconnect restoration require a session/network presentation contract that the current handout envelope does not yet express.
- **Why AI cannot infer it safely:** Adding local-only presentation state would violate the reviewed shared-state behavior; changing network schema is an architecture contract decision.
- **Smallest decision needed:** Specify authoritative handout presentation state fields and reconnect projection when implementation is authorized.
- **Status:** Open

## GAP-DM-ONLY-DELIVERY-PROTOCOL

- **Gap Type:** ARCHITECTURE_CONTRACT
- **Severity:** Critical
- **Owner Sheet:** SES-02
- **Affected Decisions:** ORIGIN-UX-01-26, ORIGIN-UX-01-28, ORIGIN-UX-01-29
- **Gap:** The authoritative event/network projection for DM-only adjudication and later disclosure is not yet fully specified.
- **Why AI cannot infer it safely:** UI-only hiding would be a privacy/authority violation. Existence metadata, Activity events, reconnect ledger, and later reveal all need role-scoped projection semantics.
- **Smallest decision needed:** Define session event visibility/disclosure contract in SES-02 before implementation.
- **Status:** Open

## GAP-CANONICAL-UX-DOC-RECONCILIATION

- **Gap Type:** DOCUMENT_RECONCILIATION
- **Severity:** Major
- **Owner Sheet:** docs/design/ui-ux-planning-framework.md
- **Affected:** `.agents/V1_PRODUCT_EXPERIENCE.md`, `.agents/V1_PLAY_SURFACE_REVISION.md`, `.agents/V0_9_PRODUCT_REFERENCE.md`, `.agents/V0_9_CONTINUOUS_SESSION_UI_PRINCIPLES.md`, `.agents/V0_9_UI_FIRST_PRODUCT_PLAN.md`, `.agents/V0_9_COMPLETE_UI_SCENE_PLAN.md`, selected UI planning decisions, current implementation/tests
- **Gap:** Historical non-canonical planning, derived UI documents and current UI tests contain mutually incompatible directions, including Lobby/Ready lifecycle, intent-first primary actions, Freeform Actor-board visibility, Initiative stage replacement, left-sidebar shell, and older first-run guidance. Some useful historical principles such as mapless Core/tabletop-first remain valid, but the conflicting details must be explicitly classified/superseded so implementation agents cannot combine them arbitrarily.
- **Why AI cannot infer it safely:** `.agents/` is explicitly non-canonical working context, while current code/tests still encode some of those older directions. Without explicit reconciliation, a future AI can accidentally treat a stale test or historical plan as higher authority than current Domain/Decision truth.
- **Smallest decision needed:** Use `INTEGRATED-PRODUCT-UX-PLAN.md` as the cross-source interpretation baseline now; before runtime preparation, update/supersede stale formal derived docs/tests and record exact touched-scope legacy disposition.
- **Status:** Open
- **Note:** Repository-wide audit and integrated baseline were completed on 2026-08-21. Prototype specs are being reconciled now. Runtime reconciliation remains intentionally open until the accepted rebuilt prototype and scoped runtime preparation identify the exact legacy/tests to update.

---

# Resolved gaps

## GAP-JOIN-NO-CHARACTER

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** UX-02, SES-01
- **Resolution:** `SES-01-04` blocks Join when no valid Character exists and provides Create/Import recovery actions before the user retries Join.
- **Resolved By:** SES-01-04
- **Status:** Resolved

## GAP-DM-ROLL-VISIBILITY-PERSISTENCE

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** DM-01
- **Affected Decision:** ORIGIN-UX-01-27
- **Resolution:** `DM-01-01` sets the new-session default to Public and persists the DM's changed visibility value only for the lifetime of that live session.
- **Resolved By:** DM-01-01
- **Status:** Resolved

## GAP-DM-PRIVATE-ACTIVITY-PRESENTATION

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** DM-02
- **Resolution:** `DM-02-01` uses one chronological DM Activity history with explicit public/private indicators and visibility filtering; private records remain non-delivered to Players until disclosure.
- **Resolved By:** DM-02-01
- **Status:** Resolved

## GAP-UX02-ROLE-MODEL

- **Gap Type:** OWNER_DECISION
- **Severity:** Major
- **Owner Sheet:** UX-02
- **Affected:** Connected role-aware IA, Session, Play, authority matrices
- **Resolution:** `UX-02-01` selected a fixed connected mapping: Host is always DM and Client is always Player. Connected Host/Player and Client/DM combinations are not supported role states.
- **Resolved By:** UX-02-01
- **Status:** Resolved

## GAP-UX02-OFFLINE-ROLE

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** UX-02
- **Depends On:** UX-02-01
- **Resolution:** `UX-02-02` selected no DM/Player identity for Offline/Standalone use. DM/Player roles are connected-session concepts only; Offline/Standalone remains a role-free local product context.
- **Resolved By:** UX-02-02
- **Status:** Resolved

## GAP-ACTOR-CONTEXT-MENU-CONTENTS

- **Gap Type:** OWNER_DECISION
- **Severity:** Normal
- **Owner Sheet:** INT-01
- **Affected Decision:** ORIGIN-UX-01-16
- **Resolution:** `INT-01-02` limits Actor Context Menu content to UI/context-management actions such as Details/Inspect and excludes executable gameplay actions/Hotbar duplication. Exact low-risk menu composition is AI-managed design detail within that boundary.
- **Resolved By:** INT-01-02
- **Status:** Resolved

## GAP-R1-R9-INVENTORY

- **Gap Type:** COVERAGE
- **Severity:** Major
- **Owner Sheet:** docs/design/ui-ux-planning-framework.md
- **Affected:** Whole product
- **Resolution:** `registry.md` materializes and cross-checks the R1-R9 inventory for the current active runtime/planning snapshot.
- **Resolved By:** docs/design/ui-ux/registry.md
- **Status:** Resolved

## GAP-M1-M6-COVERAGE

- **Gap Type:** COVERAGE
- **Severity:** Major
- **Owner Sheet:** docs/design/ui-ux-planning-framework.md
- **Resolution:** `matrices.md` materializes M1-M6 schemas and material coverage. Individual `TBD` cells remain owned by declared Decision Map items, AI-managed detail contracts, or explicit gaps.
- **Resolved By:** docs/design/ui-ux/matrices.md
- **Status:** Resolved
