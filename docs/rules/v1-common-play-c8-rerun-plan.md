# V1 Common Play C8 Rerun Plan

Status: **CANONICAL CONTINUATION PLAN — C8 REMAINING LEGACY STRANGLER**  
Repository: `Kaetaeru/SimpleVTT`  
Rerun coordination branch: `agent/resolver-foundation-convergence`  
Intended implementation branch: `agent/v1-common-play-full-convergence`  
Product integration target: `work/v1-composite`  
Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`

This document owns the next product action for the Rerun sequence that continues the V1 Common Play convergence after the large local Master Run checkpoint. It does not replace the architecture charter. It narrows the next execution to checkpoint recovery, C8 remaining legacy removal, and then C9 Gate N.

## 1. Recovery prerequisite

The completed local Master Run checkpoint reported by the owner is:

- branch: `agent/v1-common-play-full-convergence`
- local HEAD: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- local tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- base: `agent/resolver-foundation-convergence`
- base SHA: `5fc742c5195930f92b2dfe8225f93f22f26038d6`
- worktree was reported clean
- push failed because of local Git authentication/TLS failure

GitHub currently does not contain commit `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9` and does not contain the intended implementation branch. Therefore no Rerun implementation work may start from the older remote base and pretend the Master Run changes are present.

Before C8 execution:

1. preserve the local repository containing `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`;
2. push that exact commit as `agent/v1-common-play-full-convergence` without rebasing or reconstructing it from conversation text;
3. verify the remote branch resolves to the exact expected checkpoint or to a documented direct descendant that contains it;
4. only then move/resume Rerun execution on that implementation branch.

If the exact local checkpoint is unavailable, stop and report the recovery failure. Do not recreate the large Master Run from the older convergence branch by inference.

## 2. Local checkpoint claims to reconcile after push

These are handoff claims from the completed local run, not remote GitHub evidence until the branch is pushed and inspected:

- C1: 36-row V1 coverage contract/checker built;
- C2: unified parse/normalize/validate/lower Common Play boundary built;
- C3-C7: generic primitives and 79 representative composition scenarios green, while final production acceptance remains incomplete;
- completed C8 slices include atomic save/attack/item/healing, effect lifecycle, mapless authority, spell router removal, Dash/status/effect grant, Bardic Inspiration, Divine Sense, Tactical Mind, Dark One's Own Luck, Peerless Skill, and Indomitable;
- Indomitable was checked against SRD 5.2.1;
- last full `npm run build` was reported green;
- Common Play composition suite was reported 79/79 green;
- Cutting Words work was not started;
- legacy baseline reportedly moved 49 -> 40;
- named adapter paths reportedly moved to 19 remaining;
- coverage ledger reportedly has 36 rows, all still `INCOMPLETE` pending final acceptance.

After push, reconcile these claims against the actual branch before relying on them. Do not rerun still-valid evidence merely because a new Rerun invocation starts.

## 3. Normative correctness rule

Legacy behavior is **not** the correctness oracle and legacy parity is **not** a migration requirement.

Correctness priority is:

1. explicit SimpleVTT product rule / RulesProfile;
2. SRD 5.2.1 / current public Basic Rules for the covered D&D rule;
3. Common Play architecture invariants and correctly-owned transaction authority.

Legacy code is used only as:

- migration inventory: what named execution remains to delete;
- implementation archaeology: where old integration/state/session hooks exist.

Do not require Common Play to reproduce legacy output. Do not preserve a legacy bug for compatibility. Do not build a fallback because a normative Common Play result differs from an old named adapter.

Existing legacy tests are not automatically golden tests. Keep them only when they independently test a normative rule or generic invariant. Rewrite them when the expectation is legacy-specific but the scenario is still useful. Delete obsolete named-implementation tests only after replacing any real D&D rule coverage with spec-derived generic tests.

## 4. C8 objective

C8 removes all remaining D&D identity-selected execution while preserving the generic Common Play / progression / durable-state architecture built earlier.

The reported starting debt after checkpoint recovery is:

- `LEGACY_EXECUTION`: 40
- named adapter paths: 19

Treat these numbers as provisional until the pushed branch checker confirms them.

C8 ends only when:

- D&D `LEGACY_EXECUTION` count is 0;
- named runtime adapter execution paths are 0;
- content ID/name/class/spell/feature identity does not select execution algorithms;
- compatibility fallback/second-engine paths for supported D&D mechanisms are gone;
- deleted legacy behavior has normative spec-derived generic coverage where needed;
- relevant production authority, persistence, connected-session, retry/replay, and Undo evidence is green where applicable.

## 5. C8 work order

Work by coherent generic mechanism/debt boundary, not by arbitrary class-name order. Prefer the smallest deletion that reuses already-built semantics.

Recommended next sequence:

1. Cutting Words and any remaining post-roll interaction seams that already compose from Interaction + Reaction/resource payment + `roll.modify`/recalculation;
2. remaining named class/subclass gameplay runtime adapters;
3. remaining spell execution/fallback compatibility paths;
4. rest-time named dispatch and Character/session reconstruction seams;
5. named progression/resource/grant materializers using the correct Character revision transaction rather than combat Resolution;
6. final repository-wide legacy boundary audit and deletion of obsolete compatibility plumbing.

For each slice:

```text
normative D&D rule
-> generic rule contract
-> existing Common Play composition attempt
-> smallest reusable missing semantic only if composition fails
-> spec-derived deterministic test
-> production/session verification as applicable
-> ID/name rename invariance
-> named legacy deletion
-> baseline shrink
```

There is no legacy-output parity step.

## 6. Anti-drift rules for C8

- Do not create a second Common Play engine.
- Do not create feature-specific replacement helpers that merely rename the old adapter.
- Do not add content-ID/name algorithm dispatch.
- Do not funnel Character progression into combat/session Resolver state.
- Do not fabricate spatial/sensory facts when authority is unavailable.
- Do not reactivate a named fallback after a generic path is available.
- Do not expand scope into unrelated UI/product cleanup.
- Do not mark a mechanism accepted merely because an old regression test passes.
- Do not change the product integration target from `work/v1-composite` to `main`.

## 7. Rerun execution discipline

Each Rerun execution has the existing 20-minute hard stop. By approximately 18 minutes, checkpoint instead of starting another risky slice.

Within one execution:

1. mandatory Rerun preflight;
2. verify exact implementation branch HEAD and current debt counts;
3. select one coherent C8 debt boundary;
4. inspect only relevant source/rules/tests;
5. implement the smallest generic correction and delete the absorbed named path;
6. run focused validation, then only justified broader validation;
7. update canonical plan/evidence if the slice materially changes status;
8. checkpoint STATE and publish control last.

Do not repeat the entire 79-scenario/full-build suite on every small slice unless affected-surface risk justifies it. Use the broad suite at meaningful convergence checkpoints and before C8 exit.

## 8. C8 exit and C9 entry

C9 Gate N must not begin while any D&D named legacy execution remains.

Before entering C9, verify on the actual remote implementation branch:

- legacy execution checker = 0 D&D named execution;
- named adapter execution paths = 0;
- no hidden content-ID/name dispatch in production/session/progression paths;
- relevant Common Play composition and build/contract tests green;
- coverage ledger is reconciled against actual implementation evidence.

Then proceed to C9 Gate N using the existing V1 coverage contract.

## 9. C9 final acceptance target

Final V1 acceptance requires at minimum:

- all 36 coverage-ledger rows green under their required evidence;
- D&D named legacy execution = 0;
- unknown external multi-category RuleModule executes without source registration;
- ID/name rename invariance passes;
- no-edit external RuleModule acceptance passes;
- authoritative transaction ownership, persistence/reconnect/retry/Undo pass where applicable;
- unsupported/provider/manual authority behavior is explicit rather than fabricated;
- final exact-head CI/build/contract evidence is green.

Until then the verdict remains:

`V1 INCOMPLETE`

## 10. Next Exact Action

**Recovery first.** Push the existing local checkpoint `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9` as branch `agent/v1-common-play-full-convergence`. Verify that remote exact state, reconcile the reported C1-C8 evidence and debt counts, then resume C8 from the first still-unstarted coherent debt boundary. Cutting Words is the reported next candidate, but repository evidence after recovery decides the exact first slice.
