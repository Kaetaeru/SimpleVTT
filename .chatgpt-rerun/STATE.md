# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T10:38:00+09:00`

## Durable checkpoint

Mandatory preflight was reconciled in the required README -> control -> STATE -> PLAN order and repeated whenever concurrent watcher activity advanced the Rerun parent. Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. PLAN routing did not change. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain authoritative. Gate E, M0, and the already-integrated M1 generic resource/economy harness were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.

M0 remains `DONE`; its inventory and no-new-named-execution boundary remain authoritative.

The generic M1 resource/economy harness remains integrated through merged PR #150. Reuse its retained green evidence unless subsequently touched product surfaces require revalidation.

## M1 / Probe S — portable RuleModule mechanics bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable-mechanics bridge. Duplicate bridge PRs remain superseded/closed and must not be revived.

A direct Git ref read is authoritative for the current candidate. During this continuation, branch/PR convenience endpoints briefly returned stale `7399cf53650aaa442e3aa9552dc7e87233d8c8d7` while PR-files already referenced the newer tree. Direct `git/ref/heads/agent/m1-rulemodule-portable-activation` resolved the actual tip as:

`e5fd6624fc096cd81c04726cc86355ef79032dac`

The candidate remains the same bounded six-file data/validation bridge:

- `schemas/installed-content.schema.json`;
- `src/app/installedContentContracts.ts`;
- `src/app/installedContentPersistence.ts`;
- `src/app/ruleModulePackageImport.ts`;
- `src/domain/commonPlayOperationRuntime.ts`;
- `tests/ui/ruleModulePackageImport.test.ts`.

Current bridge invariants remain:

- only registered data-only `mechanics[{kind:"common-play"}]` is accepted;
- config is parsed through the existing `commonPlayOperationRuntime` parser;
- installed-content persistence re-validates mechanics during hydrate;
- installed-content schema/type parity includes the portable mechanics field;
- existing whole-entry persistence/session synchronization carries mechanics without a new store or transport;
- arbitrary/custom mechanic kinds, unsupported envelope fields/operation kinds, non-portable `resource.change.target` values, and non-manual installed entry points fail before persistence;
- no Fighter/Action Surge identity branch, second evaluator, transport, or hidden fallback is added;
- the named Fighter Action Surge production seam remains until installed portable mechanics execute end-to-end through the generic production/session path;
- Gate F-M remain dormant.

The latest commit `e5fd6624fc096cd81c04726cc86355ef79032dac` adds a deterministic rejection regression for non-manual installed Common Play entry points; it does not expand runtime semantics.

## Validation status for exact head `e5fd6624fc096cd81c04726cc86355ef79032dac`

Nine pull-request-triggered workflow runs are registered for this exact Git-ref head. They were read rather than manually rerun. At this checkpoint all nine remain `queued`; therefore no green conclusion, merge-ready conclusion, or merge-approval waiting state is claimed.

Observed exact-head runs include:

- M1 Common Play Resource Economy `33135628987`: queued;
- Persistence `33135628975`: queued;
- the remaining PR-triggered Contract, Rules Domain, UI, Phase 11, Phase 12, and related boundary checks are registered on the same exact head and remain queued.

The earlier exact-head red and already-integrated M1 harness evidence remain retained and are not repeated.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN and re-fetch the live parent;
2. resolve PR #159 head from the direct Git ref before trusting stale convenience endpoint metadata;
3. read the already-created exact-head workflow runs for the current Git-ref SHA; do not rerun them merely because they were queued here;
4. if any required run fails, inspect only that failure and make the smallest parity fix;
5. if required runs are green, confirm the diff remains the bounded six-file portable data/validation bridge with no named-content branch, second evaluator, new transport, or hidden fallback;
6. reconcile coordination-only ancestry if necessary, checkpoint exact green evidence, and publish `control.json` as `needs_user` solely for PR #159 merge approval;
7. do not begin generic production/session action dispatch before #159 is integrated;
8. after integration, capture the deterministic red for installed portable mechanics -> generic production/session action dispatch through `commonPlayOperationRuntime` + Resolver;
9. only after end-to-end parity may the named Fighter Action Surge seam be deleted and the M0 legacy baseline shrink;
10. keep Gate F-M dormant, do not reopen M0 or repeat unchanged Gate E/M1-harness validation, and do not route to `main`.
