# Codex handoff — C9 Gate N finalization

Date: 2026-08-31 Asia/Seoul
Repository: `Kaetaeru/SimpleVTT`
Working branch: `agent/codex-c9-gate-n-finalization`
Frozen upstream baseline: `5fadeced4304aa8ae51267c699a1abe053eb5152`
Product integration target: `work/v1-composite`

## Mission

Finish C9 Gate N from the current evidence state, without reopening already validated work. Produce one exact HEAD SHA that satisfies every Gate N acceptance condition, then prepare that exact SHA for integration to `work/v1-composite`.

## Current checkpoint — local Gate N candidate complete

- Local candidate before this documentation update: `489c8dfb8ba300bae76ef3d4ffc85480e80aa1a1` (tree `899cc171366bbc788f2410a34f2154b24784740a`).
- Branch: `agent/codex-c9-gate-n-finalization`; worktree clean; 30 commits ahead of the last fetched remote.
- Ledger: 36 total, 36 `IMPLEMENTED`, 0 `INCOMPLETE`, no Gate-N-blocking named fallback.
- Completed after the historical checkpoint below: Families AE, AF, AG, AH, AI, and aggregate Family AJ.
- Validation on the candidate: `npm run build` PASS; focused Family N 12/12 PASS; Family AJ aggregate 44/44 PASS; `npm run test:v1-coverage` PASS; Gate N classifier PASS; legacy boundary PASS; `git diff --check` PASS.
- Removed all 46 temporary `.github/workflows/c9-*` one-shot workflows.
- Publication is blocked only by local Windows Git credentials (`SEC_E_NO_CREDENTIALS`). `gh` is not installed, so queued/running remote Actions could not be inspected from this environment.

### Next Exact Action

Authenticate Git, push `agent/codex-c9-gate-n-finalization`, verify normal read-only CI and that no branch-writing workflow is queued/running for the exact pushed SHA, then integrate that exact SHA into `work/v1-composite`. Do not reopen or repeat Families A-AJ.

## Preflight — do this before editing

1. Confirm the checked-out branch is `agent/codex-c9-gate-n-finalization`.
2. Read, in order:
   - `CANONICAL_ROOT.md`
   - `docs/CURRENT.md`
   - this file
   - `docs/rules/v1-mechanism-coverage-ledger.json`
   - `docs/rules/legacy-execution-inventory.md`
   - `docs/rules/resolver-execution-checklist-v2.md` only as needed for the active family.
3. Run the current Gate N classifier before choosing work:
   - `node scripts/check-v1-mechanism-coverage.mjs --gate-n`
4. Inspect `git status`, recent commits on this branch, and relevant GitHub Actions before assuming this handoff is still the newest state.
5. If live branch evidence conflicts with this document, preserve already landed verified work and update this handoff rather than reverting to the frozen baseline.

## First exact task: Family N build blocker

Latest upstream attempt: GitHub Actions run `33319298002`, workflow `C9 Family N Source Cleanup 71304`, SHA `5fadeced4304aa8ae51267c699a1abe053eb5152`.

What passed in that run:
- Family N ledger reconciliation script execution in the job workspace;
- install and content generation;
- focused Family N production lifecycle tests.

What failed:
- repository-wide `npm run build`.

Because the build failed, the workflow skipped Gate N classification, legacy-boundary verification, final Family N assertion, diff check, self-removal, ledger commit, and push. Therefore the checked-in ledger still correctly says Family N is `INCOMPLETE`.

### Required approach

Reproduce `npm run build` on the Codex branch and identify the **first actual failing command/test/type error**. Fix the smallest root cause consistent with repository architecture. Do not edit the ledger merely to make the classifier green.

After the root cause is fixed, prove Family N with at least:

```text
npm run generate:content
npx tsx --test tests/domain/c9FamilyNEffectLifecycleAcceptance.test.ts tests/domain/commonPlayEffectSuppressionRuntime.test.ts tests/ui/c9FamilyNEffectDurationProduction.test.ts
npm run build
node scripts/check-v1-mechanism-coverage.mjs
node scripts/check-legacy-execution-boundary.mjs
git diff --check
```

Only if the implementation and production evidence genuinely cover source/dependent cleanup under arbitrary/renamed external identity should Family N be changed to `IMPLEMENTED` with `remainingNamedSeams: []`.

The abandoned one-shot helper `.github/scripts/c9-family-n-source-cleanup-71304.py` is evidence of the intended ledger wording, not authority to promote the row without passing verification.

## Continue from the live ledger, not an old family list

After Family N is resolved, rerun:

```text
node scripts/check-v1-mechanism-coverage.mjs --gate-n
```

Take the next incomplete family from the current output/ledger. For each family:

1. identify the missing semantic/authority/persistence/connected evidence;
2. inspect existing generic Common Play/Resolver primitives before adding code;
3. prefer extending/reusing the generic owner over adding a named adapter;
4. add the smallest production/identity regression that proves the missing behavior;
5. run targeted tests plus the appropriate boundary/type/build checks;
6. update the ledger only after evidence exists;
7. commit a coherent family slice before moving to the next row.

Do not reopen rows already `IMPLEMENTED` unless a current regression proves their evidence is false.

## Family J / stale PR instruction

Family J is already implemented on this lineage through structural source-owned attack/save payloads and generic Common Play/Resolver execution. PRs #181 and #182 are divergent superseded alternatives. Do not merge or cherry-pick them. Their only remaining action is closure/archival.

## Temporary workflow cleanup

The upstream C9 lineage accumulated many `c9-*` one-shot workflows, some with `contents: write`, hard-coded checkout refs, self-removal, commit/rebase/push behavior, or branch-mutating helper scripts.

Do not create more of these as the implementation mechanism.

Before final acceptance:

1. inventory remaining temporary `c9-*` workflows;
2. distinguish read-only retained verification from branch-writing one-shot machinery;
3. remove obsolete branch-writing temporary workflows/scripts once their work is represented in normal source/tests;
4. confirm there are no queued or running jobs capable of pushing a later SHA to the active branch;
5. then freeze the final candidate HEAD for exact-SHA verification.

Do not delete durable normal CI such as contract, rules-domain, UI, persistence, or other established repository workflows merely because their name does not belong to C9.

## Final exact-SHA acceptance

A candidate is not complete until **the same HEAD SHA** has all of the following:

- all 36 ledger rows final (`IMPLEMENTED` or evidence-backed `PROVEN_UNNEEDED`);
- no Gate-N-blocking named fallback;
- `node scripts/check-v1-mechanism-coverage.mjs --gate-n` PASS;
- `node scripts/check-legacy-execution-boundary.mjs` PASS;
- relevant unknown/renamed external production regressions PASS;
- required connected replay/retry/reconnect/Undo and persistence proofs PASS;
- `npm run build` PASS;
- contract validation PASS;
- no branch-writing temporary workflow left able to mutate the candidate after verification;
- `git diff --check` PASS and clean worktree after commit.

If `.github/workflows/c9-gate-n-final-verifier-71304.yml` is retained, make it a trustworthy read-only verifier for the active branch/exact SHA rather than a stale trigger tied only to the old upstream branch. Do not weaken its checks to obtain green status.

## Integration

Only after the exact-SHA acceptance above:

1. record the verified SHA and evidence in `docs/CURRENT.md` / this handoff;
2. compare against `work/v1-composite` and resolve only actual integration conflicts;
3. open/prepare the integration PR from `agent/codex-c9-gate-n-finalization` to `work/v1-composite`;
4. do not claim V1 Common Play / Gate N complete until the verified candidate is integrated or the owner explicitly accepts the branch as the new integration source of truth.

## Non-goals

- Do not redesign unrelated UI/product features.
- Do not revive old Rerun coordination unless explicitly requested.
- Do not merge stale Family J PRs.
- Do not mark ledger rows complete from intention, comments, or unit-only evidence.
- Do not replace generic Resolver/Common Play authority with content-name or action-ID dispatch.
- Do not create speculative abstractions for future rules that are not required by a current incomplete row.

## Handoff completion note

When work stops before Gate N is finished, update this document with:
- exact HEAD SHA;
- rows completed in this run;
- commands/checks that passed or failed;
- the first unresolved blocker;
- one `Next Exact Action` that another Codex run can execute without repeating completed work.

## Historical checkpoint — 2026-08-31, Family AD complete

- Validated implementation HEAD before this handoff-only update: `d061e4a055820a561756289e99cc51c8173dfbb5` (tree `b8302ccf2869243fa1cf97deeef279051a6ff95f`).
- Branch: `agent/codex-c9-gate-n-finalization`; the implementation HEAD was twenty commits ahead of the previously fetched remote.
- Worktree was clean at `d061e4a0` before this handoff update.
- Current ledger: 36 total, 30 `IMPLEMENTED`, 6 `INCOMPLETE`; first incomplete is Family AE.

### Completed in this run

- Family Z: generic maintained/ritual casting lifecycle, component/inventory authority, connected restart/Undo, and identity invariance; promoted by `77e7b5da`.
- Family AA: portable progression choices, counts, replacement grants, durable RuleSource action projection, and identity invariance; source `f993cb20`, ledger `3916de33`.
- Family AC: authoritative special timing windows, pool costs, initiative-count/after-turn execution, turn-start recovery, connected replay/reconnect/Undo; source `688b07f5`, ledger `4a9c5d00`.
- Family AD: persisted controlled/independent mount and drawn-vehicle topology, atomic mount/dismount movement cost, fall-off save/Prone/unlink, capacity/crew/speed, actor/object action projection, connected replay/reconnect/Undo, and full external identity rename; `d061e4a0`.

### Validation completed

- Family AA progression suite: PASS 303/303; focused installed projection suite: PASS 11/11.
- Family AC focused production suite: PASS 3/3.
- Family AD focused domain/production/connected suite: PASS 25/25; `tsc --noEmit`: PASS.
- Repository-wide `npm run build`: PASS after all Family AD source changes.
- `node scripts/check-v1-mechanism-coverage.mjs`: PASS, 30 implemented / 6 incomplete.
- `node scripts/check-legacy-execution-boundary.mjs`: PASS, 85 classified imports / 18 guarded named adapter paths / 0 unclear.
- `node scripts/check-v1-mechanism-coverage.mjs --gate-n`: expected FAIL only for AE, AF, AG, AH, AI, AJ.
- `git diff --check`: PASS.

### First unresolved blocker

Family AE now has a durable generic exposure artifact owner at `5b50bcd6`; production create/advance/recover, identity rename, and Undo pass 14/14 focused tests. The remaining blocker is joining newly crossed intervals to generic save/damage/Exhaustion operations and proving connected replay/reconnect plus restart persistence. Do not promote AE yet.

### Next Exact Action

Continue Family AE at `5b50bcd6`: compose `advance-exposure` newly crossed intervals with threshold-only generic save/damage/effect operations in one transaction, then prove falling, suffocation, dehydration/malnutrition/extreme exposure, poison/trap, connected replay/reconnect/Undo, and restart persistence. Run focused verification and `npm run build`, then promote AE only if all evidence is green.

Gate N remains incomplete. Do not repeat Families Z, AA, AC, or AD.
