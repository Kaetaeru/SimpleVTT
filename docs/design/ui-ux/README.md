# SimpleVTT UI/UX Planning Dashboard

This is the **default starting point for the owner**.

For AI agents:

1. read [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md);
2. inspect [`MANIFEST.yaml`](MANIFEST.yaml) for schema/roles/reference rules;
3. pass [`PREFLIGHT.md`](PREFLIGHT.md) before substantive work.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Primary goals

1. **Easy for the owner to control and change.**
2. **Easy for AI to read correctly without guessing.**

If the planning structure makes either goal harder, simplify before adding more structure.

## Current planning status

| Item | Current state |
| --- | --- |
| Meta governance baseline | **Stable v1**; bounded 10-scenario validation passed; reopen only for material governance drift/change or explicit owner request |
| Framework | Canonical planning method active; planning truth vs implementation reliance and Product/UX vs domain/architecture authority separated |
| AI Reading Guide | Sole canonical task router / reading-order owner active |
| Machine-readable Manifest | Schema v2 active; roles, enums, exact references, derived sources, and Global Planning Gate state declared |
| Preflight | Active; consistency/readiness/schema/reference/planning-truth gate required before substantive work |
| Product UI decisions | Partially Reviewed; not globally Frozen |
| `UX-01` | 7 decisions `Reviewed`; none Frozen |
| Migrated prior decisions | Preserved in destination sheets; `Reviewed`; none Frozen |
| `UX-02` | T2-complete map; **next sequential review starts at `UX-02-01`** |
| `UX-03` through `CONTENT-02` | T2-complete maps; Not Started except Reviewed migrated seeds |
| 27-sheet Review Plan | **All 27 T2 Decision Maps complete** |
| Master User Flow | Draft **derived owner view**; not a canonical decision store |
| R1-R9 inventory | **Route D active-runtime/planning cross-check PASS** for current snapshot |
| M1-M6 matrices | **Material coverage PASS** for current Registry snapshot; unresolved cells remain owned by Draft map items or explicit gaps |
| Missing / Duplication / Coverage audit | **PASS**; duplicate `ORIGIN-UX-01-20` map body removed from INT-03 |
| Global Planning Gate | **PASS** |
| Planning Gaps | Canonical typed/severity/status queue active (`Open / Deferred / Resolved`) |
| Templates | Schema v2 enum/reference rules + canonical Preflight reference aligned |
| Implementation | **Not authorized** by Gate passage or planning status |

`Stable v1` applies to the governance/meta-document system. `Global Planning Gate: PASS` means sequential owner review may resume; neither status Freezes product decisions or authorizes implementation.

## Global Planning Gate — PASS

The current planning/runtime snapshot has completed the preparation gate:

```text
[x] R1-R9 complete inventory cross-check
[x] M1-M6 material coverage for all material Registry areas
[x] all 27 governance sheets have complete T2 Decision Maps
[x] Missing / Duplication / Coverage audit passes
[x] owner whole-product coverage checkpoint prepared/delivered
```

Canonical gate detail lives in [`review-plan.md`](review-plan.md). Future code/planning changes require bounded delta maintenance; they do not reopen the completed gate automatically unless the change materially invalidates its coverage.

## Whole-product coverage checkpoint

```text
Changed:
- R1-R9 active runtime/planning inventory cross-check completed.
- Activity, Concentration Save, and DM Spatial Relation active artifacts registered as Draft evidence, without productizing current behavior.
- M1-M6 expanded through the material Registry surface set.
- All 27 governance sheets now have complete T2 Decision Maps.
- Duplicate Reviewed ORIGIN-UX-01-20 map body removed from INT-03; DND-03 remains its canonical map owner.

Global Planning Gate: PASS

Current status:
- Meta governance: Stable v1
- UX-01: Reviewed, not Frozen
- UX-02: map Complete, review Not Started
- Current implementation drift is recorded as evidence and does not override reviewed planning intent.

Open material gaps:
- GAP-UX02-ROLE-MODEL
- GAP-UX02-OFFLINE-ROLE
- GAP-JOIN-NO-CHARACTER
- GAP-MAIN-HAND-CANONICAL-RELATION
- GAP-DM-ROLL-VISIBILITY-PERSISTENCE
- GAP-ACTOR-CONTEXT-MENU-CONTENTS
- GAP-RESOLUTION-SAFE-INTERACTIONS
- GAP-HANDOUT-NETWORK-CONTRACT
- GAP-DM-ONLY-DELIVERY-PROTOCOL (Critical)
- GAP-DM-PRIVATE-ACTIVITY-PRESENTATION (Deferred)
- GAP-CANONICAL-UX-DOC-RECONCILIATION (Deferred)

Next planned work:
- Resume one-at-a-time owner review at UX-02-01.

Frozen changes: none
Implementation authorization: none
```

## Current next work

```text
Route A — Resume Planning
Current sheet: UX-02 — User & Role Model
Current Decision ID: UX-02-01
Question: Separate Play Role and Connection Role, or one role axis?
Next predeclared ID after resolution: UX-02-02
```

Do not skip ahead or append spontaneous questions. Newly discovered material choices first update the appropriate declared map or Planning Gap.

## Owner controls — plain language is enough

| Owner says | AI must do |
| --- | --- |
| `현재 상태 보여줘` | Summarize this Dashboard plus material gaps. |
| `이 결정 바꾸자` | Resolve affected canonical Decision ID, update one Decision Card, calculate impact. |
| `이 플로우 바꾸자` | Use `master-flow.md` as the readable view, resolve canonical Decision/Map/Gap source first, then refresh the derived flow. |
| `UX-02 질문 전체 보여줘` | Show the complete declared map from `review-plan.md`. |
| `이건 확정` / `freeze` | Freeze only explicitly named canonical scope and run impact checks. |
| `이 화면에 뭐가 남았어?` | Use Registry Planning/Contract status + Matrix coverage. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, Contract Readiness, spec tier, contracts, Work Order, and authority-domain compatibility. |
| `되돌려` | Restore/supersede affected decision with traceability, then refresh derived views. |
| `전체 플로우 보여줘` | Show `master-flow.md` as a derived owner view; do not treat it as independent authority. |
| `다음에 뭘 정하지?` | Use `review-plan.md`; current answer is `UX-02-01`. |

## Owner-facing files

The owner normally needs only:

- [`README.md`](README.md) — current dashboard/gate/next work.
- [`decisions.md`](decisions.md) — made canonical Decision Cards only.
- [`master-flow.md`](master-flow.md) — derived readable product flow/topology view.
- [`planning-gaps.md`](planning-gaps.md) — canonical material unknowns AI must not invent.
- [`review-plan.md`](review-plan.md) — canonical review order and undecided Decision Maps.

Supporting files maintained mainly by AI:

- [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md)
- [`MANIFEST.yaml`](MANIFEST.yaml)
- [`PREFLIGHT.md`](PREFLIGHT.md)
- [`registry.md`](registry.md)
- [`matrices.md`](matrices.md)
- [`templates.md`](templates.md)

Detailed Surface/Component/Motion/Work Order files are materialized only when the selected specification tier requires them.

## AI maintenance boundaries

AI MAY without owner product approval:

- identify/add an existing or planned artifact to Registry;
- add Matrix coverage referencing existing decisions/contracts;
- refresh `master-flow.md` from canonical Decision/Map/Gap sources;
- update Contract Readiness when named gaps/contracts clearly change;
- maintain exact cross-references and Dashboard summaries;
- identify/classify a Planning Gap;
- repair obvious derived-document/schema/reference drift.

AI MUST NOT without owner/domain authority:

- decide new product behavior while filling Master Flow/Registry/Matrix/Decision Maps;
- treat `master-flow.md` as a second decision store;
- change Registry Planning Maturity outside the decision lifecycle;
- change declared review order without owner approval;
- promote a contextual tool into a top-level destination;
- create authority, visibility, fallback, persistence, rules, network, or privacy semantics;
- let current implementation replace applicable Selected/Reviewed/Frozen planning intent;
- treat Selected/Reviewed as stable implementation reliance;
- use a Frozen UI decision to override a domain/architecture contract;
- Freeze a decision;
- treat current implementation as product truth merely because it exists.

## Structured vocabularies

Decision Status / Registry Planning Maturity:

`Draft / Selected / Reviewed / Frozen / Superseded`

Governance-sheet Review Status:

`Not Started / In Review / Reviewed`

Gap Status:

`Open / Deferred / Resolved`

Contract Readiness:

`None / Partial / Ready / Blocked`

References:

`full stable ID/path only` — no ranges, omitted prefixes, or contextual prose aliases.

- Selected/Reviewed/Frozen made decisions are planning truth over current code within valid Product/UX scope.
- Only Frozen decisions are stable implementation dependencies by default.
- Reviewed is not Contract Ready.
- AI never Freezes automatically.
- Missing material policy = declared Draft Decision Map item or `PLANNING GAP`, never an AI-created fallback.

## Owner checkpoint format

```text
Changed:
Global Planning Gate: PASS / BLOCKED
Current status:
Open material gaps:
Next planned work:
Frozen changes: none / <full IDs>
```

Internal Registry/Matrix/Manifest/Preflight maintenance should not be dumped on the owner unless it changes product intent or blocks progress.