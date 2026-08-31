# Codex handoff — C9 Gate N finalization

Date: 2026-08-31 Asia/Seoul
Repository: `Kaetaeru/SimpleVTT`
Working branch: `agent/codex-c9-gate-n-finalization`
Integration target: `work/v1-composite`
Integration PR: #186 `C9 Gate N final integration`
Issue: #185 `[Codex] Finish C9 Gate N from frozen finalization branch`

## Mission

Complete C9 Gate N on one exact verified source HEAD and integrate that exact verified source into `work/v1-composite` without reopening already proven Families A-AJ or weakening Common Play / Resolver authority.

## Current checkpoint — integration-only regressions remain

Current source HEAD before this documentation commit:

`71aa7c6cdff2ae6de163f2d2e0b028a27158238c`

The earlier source candidate `880990023735669ba99b6968f5ed5a54b8301402` proved the core Gate N acceptance on one exact SHA:

- authoritative coverage ledger: 36/36 final, no Gate-N-blocking named fallback;
- `node scripts/check-v1-mechanism-coverage.mjs --gate-n`: PASS;
- `node scripts/check-legacy-execution-boundary.mjs`: PASS;
- `npm run build`: PASS;
- `git diff --check`: PASS;
- Rules Domain: PASS;
- UI/frontend: PASS;
- contract validation: PASS;
- no `.github/workflows/c9-*` branch-writing workflow remains;
- durable Rules Domain CI is read-only (`contents: read`).

PR #186 exposed additional normal-CI regressions that were not part of the original source-branch check set. This run repaired the stale contract assertions and reduced the remaining PR-only failures to four.

### Completed in this run

1. Common Play HP parser regression fixtures were aligned with the current portable contract.
   - `temp-hp.grant` and damage `multiplier` are supported portable semantics and are no longer asserted as invalid.
   - M1 Common Play HP: PASS.
   - M1 Common Play Targeting: PASS.
   - M1 Common Play Interaction: PASS.
2. Phase 11 mapless attack regression now asserts explicit `runtime:manual-targeting:<source>-><target>:unconstrained` authority and rejects fabricated distance provenance.
3. Ready Action actor-state regression now identifies trigger actions structurally with `isReadyTriggerAction` instead of the presentation ID `action.standard.ready.trigger`.
4. All of these remain green on the latest PR CI: Rules Domain, UI, Contract validation, Persistence, Legacy Execution Boundary, Gate E Spatial Fact, M1 Common Play HP/Targeting/Interaction/Resource Economy/d20.

### Current remaining failures

#### Phase 11 Playable — one failure

`tests/ui/resolutionCharacterWriteBack.test.ts`

`Second Wind persists HP/resource once, reloads, and Undo persists the inverse once`

Observed on the PR merge candidate:
- healing HP is applied;
- `resource.second-wind.current` is `1`, expected `0` after successful Second Wind;
- potion and wand durable write-back tests in the same file pass;
- storage-failure rollback for Second Wind also passes.

Important evidence already checked:
- production Character action projection retains `resourceCost:{resourceId:secondWind.id,amount:1}`;
- `realAtomicHealingTransactionService` lowers Second Wind to generic `healing` + `spend-resource` operations;
- the generic Resolver emits character-durable resource state changes;
- `resolutionCharacterDurableProjection` supports resource write-back;
- `phase09RealAtomicHealingAdapter` persists transaction events before applying live Scene/resource state.

Therefore do not weaken the expectation to `1`. Find which outer production composition path bypasses or overwrites the atomic Second Wind resource commit when the full `offlineRuntimeAdapters` stack is installed.

#### Phase 12 Connected Session — three failures

1. `tests/ui/connectedProjectedCharacterQuiveringPalmResolution.test.ts`
   - initiative seed Host event is accepted by the Host but `applyConnectedClientEvents(client,[initiativeSeedEvent])` returns `rejected` instead of `applied`.
   - Earlier freeform seed A/B, reconnect rebind, and ordered turn events pass.
   - Next action: expose/read the actual rejection error and fix the first generic revision/state mismatch; do not special-case Quivering Palm identity.

2. `tests/ui/connectedProjectedCharacterSpellResolution.test.ts`
   - Fire Bolt projection exists and has `target:"enemy"` / range 120, but the test chooses the first Host enemy and assumes it is eligible.
   - Next action: verify whether another enemy is already in `eligibleTargetIds`. If so, make the regression choose an eligible Host enemy, matching production walkthrough behavior. If the eligible list is empty, fix generic projected-spell targeting instead. Do not dispatch on Fire Bolt ID.

3. `tests/ui/sessionImageHandoutRuntimeAdapter.test.ts`
   - test replays the exact same hello from the exact same peer and expects current presentation to be resent.
   - connected hello replay idempotency is separately green, so identical same-peer replay is not a reliable reconnect fixture.
   - Next action: drive a genuine peer rebind/reconnect and require the active handout / Last Roll dismissal to restore. If a genuine reconnect still does not restore, fix the generic presentation restore hook rather than weakening reconnect behavior.

## Settled contracts — do not regress

- Deterministic runtime attack dice come from authored dice structure, not presentation average. For a single d6 deterministic fixture the structural face is 3, not 4.
- Missing spatial-module facts do not fabricate zero distance/visibility/cover. Explicit target selection supplies typed `manual-unconstrained` authority.
- Ready Action trigger identity is structural (`readyActionRole:"trigger"` / `isReadyTriggerAction`), not exact action-ID dispatch.
- Do not introduce content-name, spell-ID, action-ID, class-feature-name, or other presentation identity dispatch to make tests pass.
- PRs #181 and #182 are superseded and must not be merged/cherry-picked.
- Do not recreate `.chatgpt-rerun` repository coordination files or temporary self-publishing C9 workflows.

## Next Exact Action

Start with the single Phase 11 failure because it is a confirmed production semantic regression:

1. reproduce/trace `resolutionCharacterWriteBack.test.ts` under the full `offlineRuntimeAdapters` composition used by Phase 11;
2. identify which outer wrapper causes a successfully resolved Second Wind to retain `resource.second-wind.current === 1`;
3. fix the smallest generic ownership/composition bug so HP + resource persist atomically and Undo/restart still pass;
4. run the focused Phase 11 workflow/tests;
5. then resolve the three Phase 12 failures in the order Quivering Palm rejection error -> projected spell eligibility -> genuine handout reconnect;
6. rerun PR #186 normal CI on the new exact source HEAD.

Do not repeat Families A-AJ or the already-green M1/common Gate N checks except as part of normal exact-SHA CI.

## Final exact-SHA acceptance and integration

Before merging PR #186, the exact PR head SHA must have:

- all 36 ledger rows final and no Gate-N-blocking named fallback;
- Gate N classifier PASS;
- legacy execution boundary PASS;
- build PASS;
- UI/frontend PASS;
- contract validation PASS;
- all normal PR workflows required by current repository state green, including Phase 11 and Phase 12;
- no temporary branch-writing `c9-*` workflow and no queued/running mutator able to push a later SHA.

Then re-fetch PR #186, verify its `head_sha` exactly equals the verified source SHA, and merge with a merge commit using that expected head SHA. Do not squash/rebase or substitute another unverified SHA. Verify `work/v1-composite` contains the exact verified source as an ancestor and record the verified source SHA plus integration merge SHA in repository-native current-state documentation.

Only then is C9 Gate N COMPLETE.
