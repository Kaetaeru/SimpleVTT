# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `5`
- task_id: `v1-common-play-c8-rerun`
- dispatch status to publish: `blocked`
- repository: `Kaetaeru/SimpleVTT`
- Rerun coordination branch/ref: `agent/resolver-foundation-convergence`
- intended implementation branch: `agent/v1-common-play-full-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/v1-common-play-c8-rerun-plan.md`
- checkpointed_at: `2026-08-29 Asia/Seoul`

## Durable checkpoint

The owner completed a large local V1 Common Play Master Run and intentionally stopped before continuing the remaining large C8 legacy-strangler workload.

Reported local checkpoint:

- branch: `agent/v1-common-play-full-convergence`
- HEAD: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- base branch: `agent/resolver-foundation-convergence`
- base SHA: `5fc742c5195930f92b2dfe8225f93f22f26038d6`
- worktree: reported clean
- push result: failed with local Git authentication/TLS exit 128

Live GitHub reconciliation on this sequence confirmed:

- remote `agent/resolver-foundation-convergence` still resolves from the known convergence lineage;
- GitHub does not contain commit `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`;
- GitHub does not currently expose branch `agent/v1-common-play-full-convergence`;
- therefore the large local Master Run cannot be reconstructed or resumed safely from remote GitHub yet.

Do not execute C8 from the older convergence branch and do not recreate the Master Run from conversation summaries.

## Reported local Master Run state to reconcile after recovery

These are owner/Codex handoff claims and remain provisional until the exact implementation branch is pushed and inspected:

- C1: 36-row V1 coverage contract/checker completed;
- C2: unified Common Play parse/normalize/validate/lower boundary completed;
- C3-C7: generic primitives plus 79 representative composition scenarios completed, while final production acceptance remains incomplete;
- completed C8 slices: atomic save/attack/item/healing, effect lifecycle, mapless authority, spell router removal, Dash/status/effect grant, Bardic Inspiration, Divine Sense, Tactical Mind, Dark One's Own Luck, Peerless Skill, Indomitable;
- Indomitable checked against SRD 5.2.1;
- latest full `npm run build`: reported green;
- Common Play composition: reported 79/79 green;
- Cutting Words: not started;
- legacy baseline: reported 49 -> 40;
- named adapter paths remaining: reported 19;
- coverage ledger: reported 36 rows, all `INCOMPLETE` pending final acceptance;
- `.chatgpt-rerun/*`: reported untouched by the local Master Run.

## Correctness policy for remaining C8

Legacy behavior is not normative and legacy parity is not required.

Correctness priority is the product plan's rule: explicit RulesProfile/product rules, then SRD 5.2.1/current public Basic Rules, then Common Play architecture invariants. Legacy exists only as deletion inventory and implementation archaeology.

Do not preserve legacy bugs or write compatibility fallbacks merely to reproduce legacy output.

## Waiting condition

**Technical recovery blocker.** The exact implementation checkpoint exists only in the user's local repository and is not reachable from GitHub.

Rerun must remain blocked until the local checkpoint is pushed.

## Next Exact Action

1. From the local repository that contains commit `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`, push that exact lineage as `agent/v1-common-play-full-convergence` without rebasing or reconstructing it.
2. Verify GitHub resolves the implementation branch and contains the expected checkpoint or a documented direct descendant.
3. On the recovered branch, reconcile the product-plan claims, legacy count, named-adapter count, ledger state, and last valid test/build evidence against actual files.
4. Update the Rerun working coordinates/state onto the recovered implementation branch and set control to `continue` only after reconciliation succeeds.
5. Resume C8 from the first still-unstarted coherent debt boundary. Cutting Words is the reported next candidate, but actual recovered repository evidence decides the exact first slice.
6. Continue C8 until D&D named legacy execution reaches zero. Only then enter C9 Gate N.

Do not route product integration to `main`; target remains `work/v1-composite`.
