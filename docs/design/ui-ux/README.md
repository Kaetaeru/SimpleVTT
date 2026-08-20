# SimpleVTT UI/UX Planning Dashboard

This is the **default starting point for the owner**.

For AI agents:

1. read [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md);
2. inspect [`MANIFEST.yaml`](MANIFEST.yaml);
3. pass [`PREFLIGHT.md`](PREFLIGHT.md) before substantive work.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Primary goals

1. **Easy for the owner to control and change.**
2. **Easy for AI to read correctly without guessing.**

If the planning structure makes either goal harder, simplify before adding more structure.

## Current planning status

| Item | Current state |
| --- | --- |
| Framework | Canonical planning method active; does not itself Freeze product decisions |
| AI Reading Guide | Sole canonical task router / reading-order owner active |
| Machine-readable Manifest | Active; roles, entrypoints, derived sources, global gate declared |
| Preflight | Active; consistency/readiness gate required before substantive work |
| Product UI decisions | Partially Reviewed; not globally Frozen |
| `UX-01` | 7 decisions Reviewed, not Frozen |
| Migrated prior decisions | Preserved with destination sheets; not Frozen |
| `UX-02` | Complete Decision Map exists; individual review **blocked by Global Planning Gate** |
| `UX-03` | Baseline Decision Map exists; full-map audit still required |
| 27-sheet Review Plan | Materialized; most later maps still need complete predeclaration |
| Master User Flow | Draft canonical planning baseline materialized |
| R1-R9 inventory | Draft seed inventory materialized; full implementation/master-flow/decision cross-check incomplete |
| M1-M6 matrices | Draft seed coverage materialized; whole-product coverage incomplete |
| Global Planning Gate | **NOT PASSED** |
| Planning Gaps | Typed/severity-classified canonical queue active |
| Templates | Current Gap schema + canonical Preflight reference aligned |
| Implementation | Not authorized by planning status alone |

## Global Planning Gate — current required work

**Do not resume individual UX questions, including `UX-02-01`, until this gate passes.**

```text
[ ] R1-R9 complete inventory cross-check
[ ] M1-M6 material coverage for all material Registry items
[ ] all 27 governance sheets have complete Decision Maps
    - Scope
    - Non-scope
    - full decision list
    - dependencies / conditional branches
    - Exit Criteria
[ ] Missing / Duplication / Coverage audit passes
[ ] owner receives one concise whole-product coverage checkpoint
```

Canonical gate detail lives in [`review-plan.md`](review-plan.md) and the framework. This Dashboard is only the current summary.

## Current next work

```text
1. Run PREFLIGHT for Route D — Explore Whole Product
2. Complete/cross-check R1-R9 against:
   - current implementation evidence
   - master-flow.md
   - existing made Decision Cards
   - generic non-route UI patterns
3. Expand M1-M6 material coverage; turn material unknown behavior into explicit Planning Gaps instead of guesses
4. Materialize complete Decision Maps for all remaining governance sheets
5. Run Missing / Duplication / Coverage audit
6. Present owner whole-product coverage checkpoint
7. Only then resume sequential review at UX-02-01
```

During this preparation AI may identify artifacts, references, gaps, and coverage. It MUST NOT silently make new product decisions.

## Owner controls — plain language is enough

| Owner says | AI must do |
| --- | --- |
| `현재 상태 보여줘` | Summarize this Dashboard plus material gaps/gate status. |
| `이 결정 바꾸자` | Resolve affected Decision ID, update one canonical Decision Card, calculate impact. |
| `UX-02 질문 전체 보여줘` | Show the complete declared map from `review-plan.md`; do not start answering it while Global Gate is blocked. |
| `이건 확정` / `freeze` | Freeze only explicitly named scope and run impact checks. |
| `이 화면에 뭐가 남았어?` | Use Registry Planning/Contract status + Matrix coverage. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, Contract Readiness, spec tier, contracts, Work Order. |
| `되돌려` | Restore/supersede affected decision with traceability. |
| `전체 플로우 보여줘` | Use `master-flow.md`, not an ad hoc code reconstruction. |
| `다음에 뭘 정하지?` | Report Global Gate work first; after it passes, use `review-plan.md`. |

## Owner-facing files

The owner normally needs only:

- [`README.md`](README.md) — current dashboard/gate/next work.
- [`decisions.md`](decisions.md) — made Decision Cards only.
- [`master-flow.md`](master-flow.md) — product flow/topology.
- [`planning-gaps.md`](planning-gaps.md) — material unknowns AI must not invent.
- [`review-plan.md`](review-plan.md) — review order, undecided Decision Maps, Global Planning Gate.

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
- update Contract Readiness when named gaps/contracts clearly change;
- maintain cross-references and Dashboard summaries;
- identify/classify a Planning Gap;
- repair obvious derived-document drift.

AI MUST NOT without owner/domain authority:

- decide new product behavior while filling Registry/Matrix/Decision Maps;
- change Registry Planning Maturity outside the decision lifecycle;
- change the declared review order (AI may propose; owner must approve);
- promote a contextual tool into a top-level destination;
- create authority, visibility, fallback, persistence, or rules semantics;
- Freeze a decision;
- treat current implementation as product truth merely because it exists.

## Status vocabulary

Decision maturity:

`Draft -> Selected -> Reviewed -> Frozen -> optionally Superseded`

Contract readiness:

`None / Partial / Ready / Blocked`

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
Frozen changes: none / <IDs>
```

Internal Registry/Matrix/Manifest/Preflight maintenance should not be dumped on the owner unless it changes product intent or blocks progress.
