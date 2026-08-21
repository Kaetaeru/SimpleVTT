# WO-UI-006 — Session/Home theme convergence and grouped Hotbar

Date: 2026-08-22
Status: IMPLEMENTED / OWNER QA PENDING
Authority: explicit Owner follow-up to WO-UI-005

## Objective

Keep the mapless Connected Play topology and WO-UI-005 targeting contract while making the live Session feel like the same product as Home rather than a separate demo.

## Actor Boards

- Upper and lower Actor collections are horizontally centered when they fit.
- Portrait cards use a taller `70 × 98px` desktop frame inside a `112px` board.
- Overflow remains horizontally scrollable; centering must not make edge Actors unreachable.
- Portrait-only resting content, damage fill, hover detail, control, turn, and target states remain unchanged.

## Freeform resting stage

- When no resolution, Handout, utility, or other DM-presented stage content is active, Freeform shows the illustration of the last Actor that rolled.
- The current mounted Session remembers `ResolutionView.actorId`; initial local projection may recover the latest matching Actor name from Activity.
- The presentation does not infer a rules result from Activity and does not alter roll authority.
- If no matching Actor exists, show a quiet first-roll empty state.

## Capability taxonomy

Persistent pages are:

```text
통합 | 행동 | 직업(마법 포함) | 아이템 | 특수 | 커스텀
```

Presentation grouping uses existing ActionVm facts only:

- Item: `itemCost`;
- Class: `category = magic` or `resourceCost`;
- Action: weapon, attack, or ability-check;
- Special: remaining executable projections;
- Custom: only explicitly curated capability data when a canonical schema exists.

Mixed/통합 displays each group as a visibly separated icon matrix. The Player may reorder group sections left/right; this local presentation order persists. It does not reorder authoritative actions or create Custom content.

## Density and geometry

The Hotbar remains 2–4 rows. Command Center height expands with the chosen row count so three and four rows are not clipped. The global upper board / stage / lower board / command topology remains stable, but the former fixed `174px` Command Center is now the two-row minimum rather than a universal fixed height.

## Theme convergence

Session surfaces consume the same `--bg`, `--surface`, `--surface-2`, `--recess`, `--line`, `--line-strong`, `--text`, `--muted`, `--quiet`, `--accent`, and `--shadow` tokens as Home. Buttons, panels, tabs, tooltips, rounded corners, serif headings, focus/accent treatment, and light-theme behavior use the shared shell language.

## Retained boundaries

- no tactical coordinates or map calculations;
- no rules-legality calculation in the UI;
- no inferred strongest/default action;
- no canonical slot/order mutation from local category order;
- no invented NPC portrait asset;
- no privacy or Handout transport change.
