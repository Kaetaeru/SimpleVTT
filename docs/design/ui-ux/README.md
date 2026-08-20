# SimpleVTT UI/UX Planning Dashboard

This is the **default starting point for the owner and for a new AI planning session**.

Framework: [`../ui-ux-planning-framework.md`](../ui-ux-planning-framework.md)

## Primary goals

1. **Easy for the owner to control and change.**
2. **Easy for AI to read correctly without guessing.**

If the planning structure makes either goal harder, simplify it before adding more structure.

## Current planning status

| Item | Current state |
| --- | --- |
| Framework | `Reviewed / Selected` as planning method |
| Product UI decisions | Partially reviewed; not globally Frozen |
| `UX-01` | 7 decisions Reviewed, not Frozen |
| `UX-02` | Decision Map prepared; individual review paused while the master UI model is materialized |
| Master User Flow | Draft baseline exists; Home has direct Character / Host / Join / Content / Rules / Settings paths |
| R1-R9 inventory | **Next AI preparation task** |
| M1-M6 matrices | Skeleton/coverage to be generated after registry inventory |
| Implementation | Not authorized by planning status alone |

## Current rule for what happens next

**Do not resume individual UX questions yet.**

AI should first materialize the complete UI planning inventory so the owner can see the whole product before continuing one-by-one decisions:

```text
1. R1-R9 complete inventory
2. Master User Flow / Surface Map cross-check
3. M1-M6 required matrix rows / gaps
4. 27-sheet Decision Map coverage check
5. Then resume the predeclared UX-02 sequence
```

Newly discovered questions go to `planning-gaps.md` or the appropriate downstream Decision Map. Do not ask them immediately.

## Owner controls — plain language is enough

The owner does **not** need to edit IDs or tables directly. Examples:

| Owner says | AI must do |
| --- | --- |
| `현재 상태 보여줘` | Summarize this dashboard and only material open gaps/next work. |
| `이 결정 바꾸자` | Resolve affected Decision ID, update one canonical Decision Card, calculate impact. |
| `UX-02 질문 전체 보여줘` | Show the complete declared Decision Map before asking anything. |
| `이건 확정` / `freeze` | Freeze only the explicitly named scope and run impact checks. |
| `이 화면에 뭐가 남았어?` | Use Surface + Matrix coverage to show unresolved decisions/states. |
| `구현 준비됐어?` | Check Frozen dependencies, gaps, contracts, and required Work Order. |
| `되돌려` | Restore/supersede the affected decision with traceability; do not rewrite unrelated decisions. |

## The owner normally needs only these files

- [`README.md`](README.md) — current dashboard and next work.
- [`decisions.md`](decisions.md) — canonical Decision Ledger.
- [`master-flow.md`](master-flow.md) — product flow and surface structure.
- [`planning-gaps.md`](planning-gaps.md) — unresolved choices/conflicts that AI must not invent.

AI maintains registries, matrices, detailed contracts, and work orders when they are materialized.

## New AI bootstrap — bounded reading order

A new AI continuing UI/UX planning MUST read in this order:

```text
1. docs/design/ui-ux-planning-framework.md
2. docs/design/ui-ux/README.md
3. docs/design/ui-ux/decisions.md
4. docs/design/ui-ux/master-flow.md
5. docs/design/ui-ux/planning-gaps.md
6. only then read the current sheet's referenced canonical/domain/code evidence
```

Do **not** scan all implementation files or all design documents before knowing the current task.

For implementation, use the stricter Work Order reading protocol in the framework.

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
Open gaps:
Next planned work:
Frozen changes: none / <IDs>
```

The detailed maintenance belongs in canonical files, not in a long conversational recap.
