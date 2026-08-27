# Rerun Plan Router — SimpleVTT

## Run identity

- Repository: `Kaetaeru/SimpleVTT`
- Canonical branch/ref: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`

## Canonical product-plan route

This file is not a product plan and must not duplicate one.

For every product implementation decision, read and follow this authority chain after Rerun preflight:

1. `CANONICAL_ROOT.md` — repository/workspace routing authority.
2. `.agents/V1_CURRENT_HANDOFF.md` — current V1 execution pointer and exact remaining slice.
3. `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` — wider V1 dependency/release route.
4. relevant `docs/design/` and `docs/rules/` contracts for the selected V1 item.
5. `docs/rules/resolver-execution-checklist.md` only when a concrete V1/product failure plus explicit owner direction reactivates Resolver implementation. Until PR #139 lands, that document remains on `agent/138-resolver-execution-checklist` and must not auto-activate Gate E.

Do not copy feature details, acceptance criteria, completed-feature lists, or implementation sequences into this router. Repair the canonical planning document when its factual GitHub state is stale.

## Current routing directive

Gate D merged into `work/v1-composite` as PR #137 at canonical merge commit `406a9574d249bb770ec7725efa1384808ddc9bc3`.

The explicit stop-line rule now returns execution priority to the **V1 release track**. Therefore every authorized Rerun execution must:

- reconcile live `work/v1-composite` first;
- select the next unfinished work from `.agents/V1_CURRENT_HANDOFF.md` / `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`;
- reuse already validated Gate D and R2 evidence rather than repeating it;
- keep Gate E and later Resolver gates dormant unless a concrete V1 failure proves an existing Common Play gap and the owner explicitly reactivates Resolver implementation;
- keep PR #139 separate; it is documentation-only and is not implicitly approved for merge by the PR #137 approval.

## Rerun responsibility

Rerun only preserves execution continuity:

- verify run/sequence/task identity;
- obey current `control.json` authorization;
- resume from `.chatgpt-rerun/STATE.md` without repeating validated work;
- reconcile current GitHub facts before edits;
- select actual product work from the canonical authority chain above;
- checkpoint durable execution state before the time limit.

If Rerun files disagree with canonical planning about product scope or order, the planning document selected by the current explicit owner priority wins. If a canonical document contains stale factual GitHub state, reconcile and repair that canonical document rather than recording an alternate product plan here.

## Router checkpoint

- reconciled_at: `2026-08-28 Asia/Seoul`
- owner priority: V1 release track after Gate D closure.
- Gate D canonical merge: PR #137 -> `406a9574d249bb770ec7725efa1384808ddc9bc3`.
- later Resolver gates: demand-gated and inactive.
- resolver checklist PR #139: open/unmerged; no merge approval implied.
- active execution pointer: `.agents/V1_CURRENT_HANDOFF.md`.
