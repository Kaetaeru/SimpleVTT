# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:27:55+09:00`

## Durable checkpoint

Mandatory preflight was reconciled in the required README -> control -> STATE -> PLAN order and repeated after concurrent watcher activity advanced the Rerun parent. Run identity remains sequence `2`, task `common-play-foundation-convergence`, with control authorization `continue`. PLAN routing did not change. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` remain authoritative. Gate E, M0, and the already-integrated M1 generic resource/economy harness were not repeated.

## Retained completed evidence

Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.

M0 remains `DONE`; its inventory and no-new-named-execution boundary remain authoritative.

The generic M1 resource/economy harness remains integrated through merged PR #150. Reuse its retained green evidence unless subsequently touched product surfaces require revalidation.

## M1 / Probe S — portable RuleModule mechanics bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable-mechanics bridge. The duplicate PR #165 created during stale-state reconciliation was closed unmerged as superseded and must not be resumed.

Direct Git ref is authoritative for the child tip. Latest exact candidate observed at this checkpoint:

`e235c87b5b892cbddd0d9416ed40f06e1664df66`

The live PR diff remains exactly six files:

- `schemas/installed-content.schema.json`;
- `src/app/installedContentContracts.ts`;
- `src/app/installedContentPersistence.ts`;
- `src/app/ruleModulePackageImport.ts`;
- `src/domain/commonPlayOperationRuntime.ts`;
- `tests/ui/ruleModulePackageImport.test.ts`.

Current bridge invariants remain:

- only registered data-only `mechanics[{kind:"common-play"}]` is accepted;
- config is parsed through the existing `commonPlayOperationRuntime` parser;
- import and rehydration share the manual-only Common Play executable validator;
- installed-content hydration and session-installed persistence revalidate portable mechanics;
- installed-content schema/type parity includes the portable mechanics field;
- existing whole-entry persistence/session synchronization carries mechanics without a new store or transport;
- arbitrary/custom mechanic kinds, unsupported envelope fields/operation kinds, non-portable `resource.change.target` values, and non-manual installed entry points fail before or during persistence validation;
- no Fighter/Action Surge identity branch, second evaluator, transport, or hidden fallback is added;
- the named Fighter Action Surge production seam remains until installed portable mechanics execute end-to-end through the generic production/session path;
- Gate F-M remain dormant.

Recent bounded hardening after the previous recorded candidate:

- `634b4dda69b50885afc3499a1f1e22487a7b669a` made RuleModule import reuse the shared manual-only Common Play validator;
- `b5781df269cfa40ad1c9faba563ce21b7f499c02` made installed-content rehydration reuse that same validator;
- `e235c87b5b892cbddd0d9416ed40f06e1664df66` added a deterministic regression proving persisted non-manual Common Play mechanics are rejected during decode/hydration.

None of these commits expands runtime semantics or begins generic production action dispatch.

## Validation status for exact head `e235c87b5b892cbddd0d9416ed40f06e1664df66`

Seven pull-request-triggered workflow runs were already registered and were read rather than manually rerun. At this checkpoint all seven remain `queued`; therefore no green, failure, merge-ready, or merge-approval waiting conclusion is claimed.

Exact-head runs:

- Phase 12 Connected Session `33135941537`: queued;
- M1 Common Play Resource Economy `33135941536`: queued;
- Contract validation `33135941565`: queued;
- UI `33135941603`: queued;
- Persistence `33135941618`: queued;
- Phase 11 Playable `33135941548`: queued;
- Rules Domain `33135941599`: queued.

The live Rerun parent immediately before this checkpoint was `e35c66c380551483819e089abff9ad8bc5abc8a9`; no product file was changed on the parent during this continuation.

## Next Exact Action

On the next continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN and re-fetch the live parent;
2. resolve PR #159 child tip from the direct Git ref before trusting convenience endpoint metadata;
3. read the already-created exact-head workflow runs for that SHA; do not rerun queued or already-completed evidence merely to refresh it;
4. if any required run fails, inspect only that failure and make the smallest parity fix;
5. if required runs are green, confirm the diff remains the bounded six-file portable data/validation bridge with no named-content branch, second evaluator, new transport, or hidden fallback;
6. reconcile coordination-only ancestry if necessary, checkpoint exact green evidence, and publish `control.json` as `needs_user` solely for PR #159 merge approval;
7. do not begin generic production/session action dispatch before #159 is integrated;
8. after integration, capture the deterministic red for installed portable mechanics -> generic production/session action dispatch through `commonPlayOperationRuntime` + Resolver;
9. only after end-to-end parity may the named Fighter Action Surge seam be deleted and the M0 legacy baseline shrink;
10. keep Gate F-M dormant, do not reopen M0 or repeat unchanged Gate E/M1-harness validation, and do not route to `main`.
