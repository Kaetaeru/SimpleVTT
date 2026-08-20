# SimpleVTT UI/UX Planning Dashboard

This is the **default starting point for the owner**.

For AI agents, the mandatory document router is [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md).
Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Primary goals

1. **Easy for the owner to control and change.**
2. **Easy for AI to read correctly without guessing.**

If the planning structure makes either goal harder, simplify it before adding more structure.

## Current planning status

| Item | Current state |
| --- | --- |
| Framework | `Reviewed / Selected` as planning method |
| AI Reading Guide | Canonical task router and mandatory reading-order guide active |
| Product UI decisions | Partially reviewed; not globally Frozen |
| `UX-01` | 7 decisions Reviewed, not Frozen |
| Migrated prior decisions | Preserved in Decision Ledger with destination sheets; not Frozen |
| `UX-02` | Complete Decision Map preserved; individual review paused |
| `UX-03` | Baseline Decision Map preserved; not started |
| 27-sheet Review Plan | Materialized; later maps still pending |
| Master User Flow | Draft canonical planning baseline materialized |
| R1-R9 inventory | Draft seed inventory materialized; implementation cross-check still required |
| M1-M6 matrices | Draft seed rows/coverage materialized; expansion follows inventory cross-check |
| Planning Gaps | Canonical queue active |
| Templates | Copy-safe Decision/Surface/Transition/Work Order templates available |
| Implementation | Not authorized by planning status alone |

## Current rule for what happens next

**Do not resume individual UX questions yet.**

AI should finish the whole-product visibility pass first:

```text
1. Cross-check R1-R9 against current implementation + master flow + existing decisions
2. Add missing inventory rows without inventing behavior
3. Expand only the M1-M6 rows needed for material coverage
4. Complete the next missing Decision Maps according to review-plan.md when their turn arrives
5. Present owner a concise whole-product planning checkpoint
6. Then resume the predeclared UX-02 sequence
```

New material behavior questions go to `planning-gaps.md` or the appropriate downstream Decision Map. Do not ask them immediately.

## Owner controls — plain language is enough

The owner does **not** need to edit IDs or tables directly.

| Owner says | AI must do |
| --- | --- |
| `현재 상태 보여줘` | Summarize this dashboard and only material open gaps/next work. |
| `이 결정 바꾸자` | Resolve affected Decision ID, update one canonical Decision Card, calculate impact. |
| `UX-02 질문 전체 보여줘` | Show the complete declared Decision Map before asking anything. |
| `이건 확정` / `freeze` | Freeze only the explicitly named scope and run impact checks. |
| `이 화면에 뭐가 남았어?` | Use Registry + Matrix coverage to show unresolved decisions/states. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, spec tier, contracts, and required Work Order. |
| `되돌려` | Restore/supersede the affected decision with traceability; do not rewrite unrelated decisions. |
| `전체 플로우 보여줘` | Use `master-flow.md`; do not reconstruct a different flow from code ad hoc. |
| `다음에 뭘 정하지?` | Use `review-plan.md`; do not invent a new review sequence. |

## Owner-facing files

The owner normally needs only these:

- [`README.md`](README.md) — current dashboard and next work.
- [`decisions.md`](decisions.md) — canonical Decision Ledger.
- [`master-flow.md`](master-flow.md) — product flow and major surface structure.
- [`planning-gaps.md`](planning-gaps.md) — unresolved choices/conflicts AI must not invent.
- [`review-plan.md`](review-plan.md) — fixed review order and declared Decision Maps.

Supporting files maintained mainly by AI:

- [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md) — mandatory task router and reading order for AI.
- [`registry.md`](registry.md) — R1-R9 structured UI inventory.
- [`matrices.md`](matrices.md) — M1-M6 cross-cutting coverage.
- [`templates.md`](templates.md) — copy-safe planning / implementation templates.

Detailed Surface, Component, Motion, and Work Order files are added only when the selected specification tier requires them.

## New AI bootstrap

AI agents MUST start with [`AI-READING-GUIDE.md`](AI-READING-GUIDE.md) and follow the route for the actual task.

The guide intentionally uses different bounded reading orders for:

- resume planning;
- show status;
- change a decision;
- whole-product inventory;
- prepare implementation;
- implement;
- verify / QA;
- resolve document conflicts/history.

Do **not** use one giant reading list for every task. Do **not** scan all implementation files or all design documents before the task router says they are needed.

## AI maintenance boundaries

AI MAY without owner approval:

- add an inventory row for an already existing/planned UI artifact;
- add a matrix coverage row that only references existing decisions/contracts;
- update cross-references and dashboard counts/status summaries;
- identify a new Planning Gap;
- mark derived artifacts `review/update required` after an owner change.

AI MUST NOT without an owner/domain decision:

- decide new product behavior while filling an inventory/matrix;
- promote a contextual tool into a top-level destination;
- create authority, visibility, fallback, persistence, or rules semantics;
- Freeze a decision;
- treat current implementation as product truth merely because it exists.

## Status vocabulary

`Draft` -> `Selected` -> `Reviewed` -> `Frozen` -> optionally `Superseded`

- Selected/Reviewed is **not** Frozen.
- AI never freezes automatically.
- Current implementation is evidence, not automatic product truth.
- Missing material policy = `PLANNING GAP`, not an AI-created fallback.

## Owner checkpoint format

At the end of any meaningful planning update, AI should keep the owner-facing checkpoint short:

```text
Changed:
Current status:
Open material gaps:
Next planned work:
Frozen changes: none / <IDs>
```

Detailed registry/matrix maintenance belongs in canonical files, not in a long conversational recap.
