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
2. **For the current explicit owner direction, Common Play / Rules Resolver, `docs/rules/resolver-execution-checklist.md` MUST be read and followed before selecting or resuming implementation work.**
3. Until PR #139 lands that file on `work/v1-composite`, read the exact same path from ref `agent/138-resolver-execution-checklist`; Issue #136 and PR #137 are the active Gate D implementation evidence/contract.
4. `.agents/V1_CURRENT_HANDOFF.md` remains the execution pointer only for V1 release-track work that is still relevant to the active owner priority.
5. `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` preserves the wider V1 dependency/release route.
6. relevant `docs/rules/` and `docs/design/` files remain product behavior/architecture contracts.

Do not copy the current feature details, acceptance criteria, completed-feature list, or implementation sequence into this router. Update the resolver checklist / Issue / PR instead.

## Current routing directive

The current explicit owner priority is **Common Play / data-driven Rules Resolver**.

Therefore every authorized Rerun execution must:

- reconcile live `work/v1-composite` plus open resolver PRs first;
- not resume stale Lore Peerless/R2 work solely from historical STATE;
- route through the resolver checklist's current active gate / `Current next action`;
- obey the checklist's ChatGPT/Codex division of labor and return-to-design rules;
- reuse already validated Gate A/B/C and Gate D work rather than repeating it;
- preserve unrelated V1 release/R2 queues for later.

The current checklist records that Gate D design/acceptance is frozen and the bounded Codex task packet is posted on PR #137. Future Rerun turns must treat that as completed ChatGPT design work and must not redesign the same Gate D scope unless new repository evidence creates a concrete conflict.

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
- owner priority: Common Play / data-driven Rules Resolver.
- canonical checklist target path: `docs/rules/resolver-execution-checklist.md`.
- temporary checklist ref while PR #139 remains open: `agent/138-resolver-execution-checklist`.
- active Gate D implementation: Issue #136 / PR #137.
- ChatGPT Gate D mapless-membership design is frozen; bounded Codex Task Packet is posted on PR #137.
- old Lore Peerless / missing-Actions evidence remains historical and non-blocking for this priority.
- product routing details remain delegated to the checklist and active Issue/PR; PLAN stays a router only.
