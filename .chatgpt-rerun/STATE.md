# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `2`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-28T11:31:30+09:00`

## Durable checkpoint

Mandatory preflight was completed in the required README -> control -> STATE -> PLAN order on the live Rerun branch. Run identity remains sequence `2`, task `common-play-foundation-convergence`. `CANONICAL_ROOT.md` and `docs/rules/resolver-execution-checklist.md` were re-read after preflight. PLAN routing did not change.

Concurrent watcher activity was reconciled before this write. The live Rerun parent advanced only through coordination commits and was observed at `6b0c8d017d5b16d8adda4d57b7f2e8d1ac81c49c`; that commit only corrected `control.json` to the current PR #159 exact child candidate. No product file on the Rerun parent changed during this continuation.

Gate E, M0, and the already-integrated M1 generic resource/economy harness were not repeated.

## Retained completed evidence

- Gate E remains `DONE` on PR #141 merge `00d3c9233bb678ec93bb828cb3941c3048c42054`.
- M0 remains `DONE`; `docs/rules/legacy-execution-inventory.md` and the no-new-named-execution boundary remain authoritative.
- The generic M1 resource/economy harness remains integrated through merged PR #150. Reuse its retained green evidence unless subsequently touched product surfaces require revalidation.

## M1 / Probe S — portable RuleModule mechanics bridge

PR #159 / `agent/m1-rulemodule-portable-activation` remains the sole authoritative portable-mechanics bridge. Superseded duplicate bridge PRs must not be revived.

The direct Git branch ref was resolved before relying on PR convenience metadata and remains unchanged at exact candidate:

`60c5fbf79dfbf6007885edcac5fd2eb3f9153712`

PR #159 remains open and unmerged. Its live metadata still reports exactly seven changed files:

- `schemas/installed-content.schema.json`;
- `src/app/installedContentContracts.ts`;
- `src/app/installedContentPersistence.ts`;
- `src/app/ruleModulePackageImport.ts`;
- `src/domain/commonPlayOperationRuntime.ts`;
- `tests/ui/installedContentPersistence.test.ts`;
- `tests/ui/ruleModulePackageImport.test.ts`.

Current bridge invariants remain unchanged:

- only registered data-only `mechanics[{kind:"common-play"}]` is accepted;
- the existing generic `commonPlayOperationRuntime` parser owns supported operation parsing;
- `parseManualCommonPlayOperationDefinition` is the single installed-action executable validator layered on that parser;
- RuleModule import, installed-content decode/rehydration, session-installed repository writes, and runtime compilation use the same manual-only executable boundary;
- installed-content schema/type parity includes the portable mechanics field;
- existing whole-entry persistence/session synchronization carries mechanics without a new store or transport;
- arbitrary/custom mechanic kinds, unsupported envelope fields/operation kinds, non-portable `resource.change.target` values, and non-manual installed entry points fail before authoritative use;
- deterministic regressions cover session-ingress rejection and persisted non-manual decode/hydration rejection;
- no Fighter/Action Surge identity branch, second evaluator, new transport, or hidden fallback is added;
- the named Fighter Action Surge production seam remains until installed portable mechanics execute end-to-end through the generic production/session path;
- Gate F-M remain dormant.

Recent bounded hardening retained on the child:

- `be517978826c65bad58aca9f7d7723080375bb5b` — shared manual executable validator layered on the generic parser;
- `634b4dda69b50885afc3499a1f1e22487a7b669a` — RuleModule import reuses the shared validator;
- `b5781df269cfa40ad1c9faba563ce21b7f499c02` — installed-content rehydration reuses the same validator;
- `e235c87b5b892cbddd0d9416ed40f06e1664df66` — persisted non-manual decode/hydration rejection regression;
- `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` — runtime compilation reuses the shared manual validator instead of duplicating the invocation check.

None of these commits begins generic production/session action dispatch or deletes the named Fighter Action Surge seam.

## Exact-head validation status

The seven already-created pull-request workflows for exact head `60c5fbf79dfbf6007885edcac5fd2eb3f9153712` were read twice during this continuation. They remain queued; no workflow was rerun and no new workflow was created.

- M1 Common Play Resource Economy `33136035747`: `queued`; job `98736117227` is also `queued` and has no logs yet;
- Contract validation `33136035750`: `queued`;
- Rules Domain `33136035788`: `queued`;
- Phase 11 Playable `33136035783`: `queued`;
- Phase 12 Connected Session `33136035803`: `queued`;
- UI `33136035774`: `queued`;
- Persistence `33136035784`: `queued`.

Workflow run `33136035747` confirms the pull-request event, head branch `agent/m1-rulemodule-portable-activation`, and exact head SHA `60c5fbf79dfbf6007885edcac5fd2eb3f9153712`. The queue currently provides no product failure evidence, so no product code was changed.

Parent/child history remains diverged because the Rerun parent continues to receive coordination commits. Do not reconcile ancestry while exact-head product CI is unresolved; re-evaluate ancestry only after the final candidate is green.

## Next Exact Action

On the next authorized continuation of sequence `2`:

1. perform mandatory preflight README -> control -> STATE -> PLAN and re-fetch the live parent;
2. resolve PR #159 child tip from the direct Git ref before trusting convenience endpoint metadata;
3. read the existing exact-head workflow runs for that SHA; do not rerun queued or already-completed evidence;
4. if the child tip advanced, treat only the new exact tip as the candidate and inspect the bounded change before drawing any CI conclusion;
5. if any required exact-head run fails, inspect only that failure and make the smallest parity fix;
6. if all required runs are green, confirm the diff remains the bounded seven-file portable data/validation bridge with no named-content branch, second evaluator, new transport, or hidden fallback;
7. reconcile coordination-only ancestry only after product evidence is green, then checkpoint exact evidence and publish `control.json` as `needs_user` solely for PR #159 merge approval;
8. do not begin generic production/session action dispatch before #159 is integrated;
9. after integration, capture the deterministic red for installed portable mechanics -> generic production/session action dispatch through `commonPlayOperationRuntime` + Resolver;
10. only after end-to-end parity may the named Fighter Action Surge seam be deleted and the M0 legacy baseline shrink;
11. keep Gate F-M dormant, do not reopen M0 or repeat unchanged Gate E/M1-harness validation, and do not route to `main`.
