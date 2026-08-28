# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:29:04+09:00`

## Durable checkpoint

Mandatory preflight was reconciled in the required README -> control -> STATE -> PLAN order. Concurrent watcher activity was reconciled against live Git refs before every product write. Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. PLAN routing did not change. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain authoritative. Gate E, M0, and the already-integrated M1 generic resource/economy harness were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.

M0 remains `DONE`; its inventory and no-new-named-execution boundary remain authoritative.

The generic M1 resource/economy harness remains integrated through merged PR #150. Reuse its retained green evidence unless subsequently touched product surfaces require revalidation.

## M1 / Probe S — portable RuleModule mechanics bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable-mechanics bridge. Superseded duplicate bridge PRs must not be revived.

Direct Git ref is authoritative for the child tip. Latest exact candidate:

`e235c87b5b892cbddd0d9416ed40f06e1664df66`

Live PR #159 is open and unmerged. Its current bounded diff is seven files:

- `schemas/installed-content.schema.json`;
- `src/app/installedContentContracts.ts`;
- `src/app/installedContentPersistence.ts`;
- `src/app/ruleModulePackageImport.ts`;
- `src/domain/commonPlayOperationRuntime.ts`;
- `tests/ui/installedContentPersistence.test.ts`;
- `tests/ui/ruleModulePackageImport.test.ts`.

The seventh file is test-only persistence coverage; no additional product execution path was introduced.

Current bridge invariants:

- only registered data-only `mechanics[{kind:"common-play"}]` is accepted;
- the existing generic `commonPlayOperationRuntime` parser owns supported operation parsing;
- generic parsing remains capable of representing declared invocation kinds, while the currently executable installed-action slice uses one shared `parseManualCommonPlayOperationDefinition` validator;
- RuleModule import, session-installed repository writes, installed-content decode, and persisted rehydration all enforce the same manual-only executable boundary;
- a deterministic regression mutates a previously valid persisted mechanic to `triggered` and proves both decode and repository hydrate reject it;
- installed-content schema/type parity includes the portable mechanics field;
- existing whole-entry persistence/session synchronization carries mechanics without a new store or transport;
- arbitrary/custom mechanic kinds, unsupported envelope fields/operation kinds, non-portable `resource.change.target` values, and non-manual installed entry points fail before authoritative use;
- no Fighter/Action Surge identity branch, second evaluator, new transport, or hidden fallback is added;
- the named Fighter Action Surge production seam remains until installed portable mechanics execute end-to-end through the generic production/session path;
- Gate F-M remain dormant.

Recent exact commits on the child:

- `be517978826c65bad58aca9f7d7723080375bb5b` — shared manual executable validator on top of the generic Common Play parser;
- `634b4dda69b50885afc3499a1f1e22487a7b669a` — RuleModule import reuses the shared validator;
- `b5781df269cfa40ad1c9faba563ce21b7f499c02` — persisted rehydration reuses the same validator;
- `e235c87b5b892cbddd0d9416ed40f06e1664df66` — persisted non-manual decode/hydration rejection regression.

None of these commits begins generic production/session action dispatch or deletes the named Action Surge seam.

## Validation status for exact head `e235c87b5b892cbddd0d9416ed40f06e1664df66`

Seven required pull-request-triggered workflow runs are registered and have been read rather than manually rerun. All seven still remain `queued`; no green, failure, merge-ready, or merge-approval waiting conclusion is claimed.

Exact-head runs:

- Phase 12 Connected Session `33135941537`: queued;
- M1 Common Play Resource Economy `33135941536`: queued;
- Contract validation `33135941565`: queued;
- UI `33135941603`: queued;
- Persistence `33135941618`: queued;
- Phase 11 Playable `33135941548`: queued;
- Rules Domain `33135941599`: queued.

The live Rerun parent observed immediately before this checkpoint was `c40ed8688c0a5e785c2eee4c9971018222380576`; no product file was changed on the parent.

PR convenience metadata currently reports graph mergeability false after parent coordination advancement. Do not reconcile ancestry while product CI remains unresolved; re-evaluate ancestry only after exact-head evidence is green.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN and re-fetch the live parent;
2. resolve PR #159 child tip from the direct Git ref before trusting convenience endpoint metadata;
3. read the already-created exact-head workflow runs for that SHA; do not rerun queued or already-completed evidence merely to refresh it;
4. if any required run fails, inspect only that failure and make the smallest parity fix;
5. if required runs are green, confirm the diff remains the bounded seven-file portable data/validation bridge with no named-content branch, second evaluator, new transport, or hidden fallback;
6. reconcile coordination-only ancestry only after product evidence is green, then checkpoint exact evidence and publish `control.json` as `needs_user` solely for PR #159 merge approval;
7. do not begin generic production/session action dispatch before #159 is integrated;
8. after integration, capture the deterministic red for installed portable mechanics -> generic production/session action dispatch through `commonPlayOperationRuntime` + Resolver;
9. only after end-to-end parity may the named Fighter Action Surge seam be deleted and the M0 legacy baseline shrink;
10. keep Gate F-M dormant, do not reopen M0 or repeat unchanged Gate E/M1-harness validation, and do not route to `main`.
