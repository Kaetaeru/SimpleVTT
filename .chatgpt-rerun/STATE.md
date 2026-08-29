# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `5`
- task_id: `v1-common-play-c8-rerun`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/v1-common-play-full-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/v1-common-play-c8-rerun-plan.md`
- checkpointed_at: `2026-08-29 Asia/Seoul`

## Durable checkpoint

The large V1 Common Play Master Run checkpoint has been recovered on GitHub exactly as reported before Rerun continuation was activated.

Recovered code checkpoint:

- branch: `agent/v1-common-play-full-convergence`
- HEAD: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- convergence base: `agent/resolver-foundation-convergence`
- base SHA: `5fc742c5195930f92b2dfe8225f93f22f26038d6`

Rerun coordination commits now advance the same branch after this code checkpoint; do not reset back to the checkpoint or reconstruct the Master Run from the old base. Product integration remains `work/v1-composite`, never `main`.

## Recovered Master Run evidence

The Master Run handoff records:

- C1: 36-row V1 coverage contract/checker;
- C2: unified parse/normalize/validate/lower Common Play boundary;
- C3-C7: generic primitives plus 79 representative compositions, while final production acceptance remains incomplete;
- completed C8 slices: atomic save/attack/item/healing, effect lifecycle, mapless authority, spell router removal, Dash/status/effect grant, Bardic Inspiration, Divine Sense, Tactical Mind, Dark One's Own Luck, Peerless Skill, and Indomitable;
- Indomitable checked against SRD 5.2.1;
- last Master Run `npm run build` reported green;
- Common Play composition reported 79/79 green;
- Cutting Words not started;
- coverage ledger reported as 36 rows, all `INCOMPLETE` pending final acceptance.

Live inspection on the recovered branch confirms `.agents/LEGACY_EXECUTION_BASELINE.json` contains 40 remaining legacy paths: 39 direct `LEGACY_EXECUTION` entries plus 1 transitive entry. The handoff also reports 19 named adapter paths remaining. Revalidate the named-adapter and coverage-ledger counts with the existing repository checks at the first sequence-5 execution rather than treating the chat report as final acceptance evidence.

## Correctness policy

Legacy behavior and legacy tests are not normative correctness or parity targets. Use explicit RulesProfile/product rules first, then SRD 5.2.1/current public Basic Rules, then Common Play architecture invariants. Legacy is only deletion inventory and implementation archaeology.

There is no required legacy-output parity step. If normative Common Play behavior differs from old named behavior, do not preserve the old result, add a compatibility fallback, or bend the generic architecture to match it.

## Waiting condition

None. The remote recovery blocker is resolved. Sequence 5 may continue directly on `agent/v1-common-play-full-convergence`.

C9 Gate N remains prohibited until all D&D named legacy execution is removed.

## Next Exact Action

1. Perform mandatory Rerun preflight and confirm the recovered code checkpoint remains in ancestry of the live working branch.
2. Run the existing legacy-boundary and coverage checks needed to reconcile the current 40 legacy paths, reported 19 named adapter paths, and 36 incomplete coverage rows without repeating unrelated broad validation.
3. Read `docs/rules/v1-common-play-c8-rerun-plan.md` and select the smallest coherent remaining C8 mechanism-family slice from live debt. Cutting Words is the first reported unstarted candidate if current evidence still supports it.
4. Establish normative RulesProfile/SRD behavior, attempt existing Common Play composition first, implement the smallest generic change, delete the absorbed named path, run focused verification, and checkpoint before the 20-minute hard stop.
5. Continue C8 until named D&D execution reaches zero. Only then enter C9 Gate N.

Current verdict: `V1 INCOMPLETE`.
