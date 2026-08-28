# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:24:30+09:00`

## Durable checkpoint

Mandatory preflight was reconciled in the required README -> control -> STATE -> PLAN order and repeated whenever concurrent watcher activity advanced the Rerun parent. Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. PLAN routing did not change. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain authoritative. Gate E, M0, and the already-integrated M1 generic resource/economy harness were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.

M0 remains `DONE`; its inventory and no-new-named-execution boundary remain authoritative.

The generic M1 resource/economy harness remains integrated through merged PR #150. Reuse its retained green evidence unless subsequently touched product surfaces require revalidation.

## M1 / Probe S — portable RuleModule mechanics bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable-mechanics bridge. Duplicate bridge PRs remain superseded/closed and must not be revived.

Direct Git ref is authoritative for the child tip. Latest exact candidate:

`372b030fb152b8dfeb613217ca2664198aa54a91`

The candidate remains a bounded six-file portable data/validation bridge relative to the product parent:

- `schemas/installed-content.schema.json`;
- `src/app/installedContentContracts.ts`;
- `src/app/installedContentPersistence.ts`;
- `src/app/ruleModulePackageImport.ts`;
- `src/domain/commonPlayOperationRuntime.ts`;
- `tests/ui/ruleModulePackageImport.test.ts`.

Current invariants:

- only registered data-only `mechanics[{kind:"common-play"}]` is accepted;
- config is parsed through the existing `commonPlayOperationRuntime` parser;
- installed-content hydration validates mechanics again;
- session-installed entries are also revalidated with the same installed-entry assertion before repository persistence;
- installed-content schema/type parity includes the portable mechanics field;
- existing whole-entry persistence/session synchronization carries mechanics without a new store or transport;
- arbitrary/custom mechanic kinds, unsupported envelope fields/operation kinds, non-portable `resource.change.target` values, and non-manual installed entry points fail before persistence;
- no Fighter/Action Surge identity branch, second evaluator, transport, or hidden fallback is added;
- the named Fighter Action Surge production seam remains until installed portable mechanics execute end-to-end through the generic production/session path;
- Gate F-M remain dormant.

Recent bounded hardening after the prior checkpoint:

- `e5fd6624fc096cd81c04726cc86355ef79032dac` added a deterministic regression rejecting non-manual installed Common Play entry points;
- `520235475f252f44132c5c96589e03742eccf94a` added the matching five-line import capability gate;
- `372b030fb152b8dfeb613217ca2664198aa54a91` added one-line session-installed entry revalidation before persistence.

None of these commits expands runtime semantics or begins production action dispatch.

## Validation status for exact head `372b030fb152b8dfeb613217ca2664198aa54a91`

Nine pull-request-triggered workflow runs are registered for this exact head. They were read rather than manually rerun. At this checkpoint all remain `queued`, and completed-run queries returned `0` completed workflows.

Observed exact-head runs include:

- Rules Domain `33135795353`: queued;
- Persistence `33135795378`: queued;
- the remaining Contract, UI, M1 Common Play Resource Economy, Phase 11, Phase 12, and related PR-triggered checks are registered on the same exact head and remain queued.

No green, failure, merge-ready, or merge-approval waiting conclusion is claimed yet.

The live Rerun parent immediately before this checkpoint was `6f47b1e50b156c812df1ce3c459566dba4dbd428`; no product file was changed on the parent during this continuation.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN and re-fetch the live parent;
2. resolve PR #159 child tip from the direct Git ref before trusting convenience endpoint metadata;
3. read the already-created exact-head workflow runs for that SHA; do not rerun them merely because they were queued here;
4. if any required run fails, inspect only that failure and make the smallest parity fix;
5. if required runs are green, confirm the endpoint diff remains the bounded portable data/validation bridge with no named-content branch, second evaluator, new transport, or hidden fallback;
6. reconcile coordination-only ancestry if necessary, checkpoint exact green evidence, and publish `control.json` as `needs_user` solely for PR #159 merge approval;
7. do not begin generic production/session action dispatch before #159 is integrated;
8. after integration, capture the deterministic red for installed portable mechanics -> generic production/session action dispatch through `commonPlayOperationRuntime` + Resolver;
9. only after end-to-end parity may the named Fighter Action Surge seam be deleted and the M0 legacy baseline shrink;
10. keep Gate F-M dormant, do not reopen M0 or repeat unchanged Gate E/M1-harness validation, and do not route to `main`.
