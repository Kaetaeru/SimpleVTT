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

For every V1 implementation decision, read and follow this authority chain after Rerun preflight:

1. `CANONICAL_ROOT.md` — repository/workspace routing authority.
2. `.agents/V1_CURRENT_HANDOFF.md` — current V1 execution pointer and latest canonical checkpoint.
3. `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` — full V1 completion plan, dependency order, acceptance gates, and remaining work.
4. relevant `docs/design/` files — product behavior contracts for the selected item.

The current feature, next feature, acceptance criteria, completed-feature list, and implementation sequence must not be copied into this file. If those change, update the canonical V1 documents instead.

## Rerun responsibility

Rerun only preserves execution continuity:

- verify run/sequence/task identity;
- obey current `control.json` authorization;
- resume from `.chatgpt-rerun/STATE.md` without repeating validated work;
- reconcile current GitHub facts before edits;
- select actual product work from the canonical V1 authority chain above;
- checkpoint durable execution state before the time limit.

If Rerun files disagree with canonical V1 planning about product scope or order, canonical V1 planning wins. If a canonical V1 document contains stale factual GitHub state, reconcile and repair that canonical document rather than recording an alternate product plan here.

## Router checkpoint

- reconciled_at: `2026-08-26T09:30:17+09:00`
- observed product/source head before this Rerun metadata checkpoint: `12834c74ee0b997d9cd28f1d6c9227e326c1fe60`
- an earlier STATE-only reconciliation commit `f0a4cae0da9c32cf48693600892377340376b69a` was written out of protocol order; this checkpoint supersedes it by restarting the durable write sequence as `PLAN -> STATE -> control.json`.
- product routing remains delegated to `.agents/V1_CURRENT_HANDOFF.md`; incremental no-repeat and validation facts are recorded only in `STATE.md`.
