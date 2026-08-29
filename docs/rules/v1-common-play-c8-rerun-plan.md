# V1 Common Play C8 Rerun Plan

Status: **ACTIVE CANONICAL CONTINUATION PLAN — C8 REMAINING LEGACY STRANGLER**  
Repository: `Kaetaeru/SimpleVTT`  
Rerun working branch: `agent/v1-common-play-full-convergence`  
Product integration target: `work/v1-composite`  
Architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`

This document owns the next product action after recovery of the large V1 Common Play Master Run checkpoint. It does not replace the architecture charter. It narrows execution to C8 remaining legacy removal and then C9 Gate N.

## 1. Recovered checkpoint

The Master Run checkpoint is now present on GitHub and was verified before this plan was activated:

- recovered branch: `agent/v1-common-play-full-convergence`
- code checkpoint HEAD: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- code checkpoint tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- convergence base: `agent/resolver-foundation-convergence`
- base SHA: `5fc742c5195930f92b2dfe8225f93f22f26038d6`

Rerun coordination commits may advance the branch after that checkpoint. The code checkpoint above must remain in ancestry; do not reconstruct or replay the Master Run from the old convergence branch.

## 2. Reconciled Master Run state

The recovered handoff reports:

- C1: 36-row V1 coverage contract/checker built;
- C2: unified parse/normalize/validate/lower Common Play boundary built;
- C3-C7: generic primitives and 79 representative composition scenarios validated, with final production acceptance still incomplete;
- completed C8 slices: atomic save/attack/item/healing, effect lifecycle, mapless authority, spell router removal, Dash/status/effect grant, Bardic Inspiration, Divine Sense, Tactical Mind, Dark One's Own Luck, Peerless Skill, and Indomitable;
- Indomitable was checked against SRD 5.2.1;
- last Master Run `npm run build` was reported green;
- Common Play composition was reported 79/79 green;
- Cutting Words was not started;
- coverage ledger was reported as 36 rows, all still `INCOMPLETE` pending final acceptance.

Live inspection of `.agents/LEGACY_EXECUTION_BASELINE.json` on the recovered branch confirms **40 remaining `LEGACY_EXECUTION` paths: 39 direct plus 1 transitive**. The reported 19 named adapter paths and 36 incomplete ledger rows must be rechecked by the appropriate existing boundary/coverage checker at the first Rerun execution rather than assumed from chat text.

Do not rerun broad evidence merely because Rerun resumed. Revalidate when the current slice affects the evidence or when C8 exit requires convergence proof.

## 3. Normative correctness rule

Legacy behavior is **not** the correctness oracle and legacy parity is **not** a migration requirement.

Correctness priority is:

1. explicit SimpleVTT product rule / RulesProfile;
2. SRD 5.2.1 / current public Basic Rules for the covered D&D rule;
3. Common Play architecture invariants and correctly-owned transaction authority.

Legacy code is used only as migration inventory and implementation archaeology. Do not require Common Play to reproduce legacy output, preserve legacy bugs, or create compatibility fallbacks merely because normative Common Play behavior differs from old named execution.

Existing legacy tests are not automatically golden tests. Keep them only when they independently test a normative rule or generic invariant. Rewrite legacy-bound expectations when the scenario is still useful. Delete obsolete named-implementation tests only after preserving real D&D coverage with spec-derived generic tests where needed.

## 4. C8 objective and exit gate

C8 removes all remaining D&D identity-selected execution while preserving the generic Common Play, progression, and durable-state transaction architecture.

C8 ends only when all of the following hold:

- D&D `LEGACY_EXECUTION` count is 0;
- named runtime adapter execution paths are 0;
- content ID/name/class/spell/feature identity does not select execution algorithms;
- supported D&D mechanisms have no compatibility fallback or second named engine;
- deleted legacy behavior has normative spec-derived generic coverage where needed;
- relevant authority, persistence, connected-session, retry/replay, and Undo evidence is green where applicable.

Do not enter C9 while any D&D named legacy execution remains.

## 5. C8 execution method

Work by the smallest coherent generic mechanism/debt boundary, not arbitrary class-name order. Cutting Words is the reported first unstarted candidate, but live repository evidence decides the first slice.

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

Prefer existing generic semantics. Do not create feature-specific replacement helpers that merely rename old adapters. Do not create a second Common Play engine, content-ID/name dispatch, fabricated spatial/sensory facts, or progression-through-combat-Resolver shortcuts.

## 6. Rerun direct-execution policy

The owner explicitly chose ChatGPT Rerun, not Codex, for the remaining C8 work. Rerun performs repository-dependent implementation directly in bounded executions unless the owner later changes direction.

Every execution follows the existing 20-minute hard stop. By approximately 18 minutes, checkpoint instead of starting another risky slice. Use focused validation first and broader validation only when affected-surface risk or a convergence gate justifies it.

## 7. C9 Gate N

After C8 reaches zero named D&D execution, reconcile the 36-row coverage ledger against actual implementation evidence and enter Gate N.

Final V1 acceptance requires at minimum:

- all 36 coverage-ledger rows green under required evidence;
- D&D named legacy execution = 0;
- unknown external multi-category RuleModule executes without source registration;
- ID/name rename invariance passes;
- no-edit external RuleModule acceptance passes;
- authoritative transaction ownership, persistence/reconnect/retry/Undo pass where applicable;
- unsupported/provider/manual authority behavior is explicit rather than fabricated;
- final exact-head CI/build/contract evidence is green.

Until then the verdict remains `V1 INCOMPLETE`.

## 8. Next Exact Action

1. Perform mandatory Rerun preflight on `agent/v1-common-play-full-convergence` and confirm the recovered code checkpoint remains in ancestry.
2. Run the existing legacy-boundary and coverage checks needed to revalidate the current 40 legacy paths, reported 19 named adapter paths, and 36 incomplete coverage rows without repeating unrelated broad suites.
3. Select the smallest coherent remaining C8 mechanism-family slice from live debt. Cutting Words is the first reported unstarted candidate if current evidence still supports that choice.
4. Establish the normative RulesProfile/SRD contract, implement through existing Common Play composition first, remove the absorbed named path, run focused verification, and checkpoint before the Rerun hard stop.
5. Continue C8 until named D&D execution reaches zero; only then enter C9 Gate N.
