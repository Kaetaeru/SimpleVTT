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
| Framework | Canonical planning method active; Product/UX and domain/architecture authority separated |
| AI Reading Guide | Sole canonical task router / reading-order owner active |
| Machine-readable Manifest | Schema v2 active; roles, enums, exact reference syntax, derived sources, global gate declared |
| Preflight | Active; consistency/readiness/schema/reference gate required before substantive work |
| Product UI decisions | Partially Reviewed; not globally Frozen |
| `UX-01` | 7 decisions have `Status: Reviewed`; none Frozen |
| Migrated prior decisions | Preserved with destination sheets; `Status: Reviewed`; none Frozen |
| `UX-02` | T2-complete Decision Map exists; individual review **blocked by Global Planning Gate** |
| `UX-03` | T2-complete Decision Map exists; individual review **blocked by Global Planning Gate** |
| 27-sheet Review Plan | Materialized; 24 later maps still need complete predeclaration |
| Master User Flow | Draft **derived owner view**; not a canonical decision store |
| R1-R9 inventory | Draft derived seed inventory; full implementation/flow/decision cross-check incomplete |
| M1-M6 matrices | Draft derived seed coverage; references/M6 values normalized; whole-product coverage incomplete |
| Global Planning Gate | **NOT PASSED** |
| Planning Gaps | Canonical typed/severity/status queue active (`Open / Deferred / Resolved`) |
| Templates | Schema v2 enum/reference rules + canonical Preflight reference aligned |
| Implementation | Not authorized by planning status alone |

## Global Planning Gate — current required work

**Do not resume individual UX questions, including `UX-02-01`, until this gate passes.**

```text
[ ] R1-R9 complete inventory cross-check
[ ] M1-M6 material coverage for all material Registry items
[ ] all 27 governance sheets have complete T2 Decision Maps
    - Scope
    - Non-scope
    - Exit Criteria
    - full decision list
    - Status
    - full dependency IDs / conditional branches
    - Destination
[ ] Missing / Duplication / Coverage audit passes
[ ] owner receives one concise whole-product coverage checkpoint
```

Canonical gate detail lives in [`review-plan.md`](review-plan.md) and the framework. This Dashboard is only the current summary.

## Current next work

```text
1. Run PREFLIGHT for Route D — Explore Whole Product
2. Complete/cross-check R1-R9 against:
   - current implementation evidence
   - derived master-flow.md view
   - existing made Decision Cards
   - generic non-route UI patterns
3. Expand M1-M6 material coverage; turn material unknown behavior into explicit Planning Gaps instead of guesses
4. Materialize T2-complete Decision Maps for all remaining governance sheets
5. Run Missing / Duplication / Coverage audit
6. Present owner whole-product coverage checkpoint
7. Only then resume sequential review at UX-02-01
```

During this preparation AI may identify artifacts, exact references, gaps, derived views, and coverage. It MUST NOT silently make new product decisions.

## Owner controls — plain language is enough

| Owner says | AI must do |
| --- | --- |
| `현재 상태 보여줘` | Summarize this Dashboard plus material gaps/gate status. |
| `이 결정 바꾸자` | Resolve affected canonical Decision ID, update one Decision Card, calculate impact. |
| `이 플로우 바꾸자` | Use `master-flow.md` as the readable view, resolve the canonical Decision/Map/Gap source first, then refresh the derived flow. |
| `UX-02 질문 전체 보여줘` | Show the complete declared map from `review-plan.md`; do not start answering it while Global Gate is blocked. |
| `이건 확정` / `freeze` | Freeze only explicitly named canonical scope and run impact checks. |
| `이 화면에 뭐가 남았어?` | Use Registry Planning/Contract status + Matrix coverage. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, Contract Readiness, spec tier, contracts, Work Order, and authority-domain compatibility. |
| `되돌려` | Restore/supersede affected decision with traceability, then refresh derived views. |
| `전체 플로우 보여줘` | Show `master-flow.md` as a derived owner view; do not treat it as an independent authority source. |
| `다음에 뭘 정하지?` | Report Global Gate work first; after it passes, use `review-plan.md`. |

## Owner-facing files

The owner normally needs only:

- [`README.md`](README.md) — current dashboard/gate/next work.
- [`decisions.md`](decisions.md) — made canonical Decision Cards only.
- [`master-flow.md`](master-flow.md) — derived readable product flow/topology view.
- [`planning-gaps.md`](planning-gaps.md) — canonical material unknowns AI must not invent.
- [`review-plan.md`](review-plan.md) — canonical review order, undecided Decision Maps, Global Planning Gate.

Supporting files maintained mainly by AI:

- [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md)
- [`MANIFEST.yaml`](MANIFEST.yaml)
- [`PREFLIGHT.md`](PREFLIGHT.md)
- [`registry.md`](registry.md)
- [`matrices.md`](matrices.md)
- [`templates.md`](templates.md)

Detailed Surface/Component/Motion/Work Order files are materialized only when the selected specification tier requires them.

## AI maintenance boundaries

AI MAY without owner approval:

- identify/add an existing or planned artifact to the Registry;
- add Matrix coverage referencing existing decisions/contracts;
- refresh `master-flow.md` from canonical Decision/Map/Gap sources;
- update Contract Readiness when named gaps/contracts clearly change;
- maintain exact cross-references and Dashboard summaries;
- identify/classify a Planning Gap;
- repair obvious derived-document/schema/reference drift.

AI MUST NOT without owner/domain authority:

- decide new product behavior while filling Master Flow/Registry/Matrix/Decision Maps;
- treat `master-flow.md` as a second canonical decision store;
- change Registry Planning Maturity outside the decision lifecycle;
- change the declared review order (AI may propose; owner must approve);
- promote a contextual tool into a top-level destination;
- create authority, visibility, fallback, persistence, rules, network, or privacy semantics;
- use a Frozen UI decision to override a domain/architecture contract;
- Freeze a decision;
- treat current implementation as product truth merely because it exists.

## Structured vocabularies

Decision Status:

`Draft / Selected / Reviewed / Frozen / Superseded`

Gap Status:

`Open / Deferred / Resolved`

Contract Readiness:

`None / Partial / Ready / Blocked`

References:

`full stable ID/path only` — no ranges, omitted prefixes, or contextual prose aliases.

- Selected/Reviewed is not Frozen.
- Reviewed is not Contract Ready.
- AI never Freezes automatically.
- Missing material policy = `PLANNING GAP`, not an AI-created fallback.

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
