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

## 8. Active Cutting Words slice checkpoint — generic roll reduction integrated

The first Cutting Words composition review proved a concrete Common Play gap rather than a need for a named replacement engine. Existing Gate A/operation runtime could add modifier dice and recalculate d20 outcomes, but could not represent an authoritative rolled die as a subtraction. The bounded Gate A reaction slice also only recalculated a literal `defense.ac` property modification and did not supply this missing roll-reduction semantic.

PR #176 (`rules: add generic Common Play subtract-die semantic`) therefore added only the smallest reusable missing operation:

- candidate exact head: `3f1de2b22aa8335cc95ca343e2b00b765ebd08b1`;
- merge commit on the Rerun working branch: `bb53ef104a76547099673daa7deb33a5d7928016`;
- Common Play schema now permits structural `roll.modify` mode `subtract-die`;
- the existing Common Play operation lowerer requires authoritative modifier-die faces before commit and lowers the full authored `XdY+Z`/`XdY-Z` formula as a subtraction;
- the existing central d20 evaluator applies the signed die contribution while preserving its natural-1/natural-20/critical semantics;
- arbitrary external definition ID/name rename preserves mechanical output;
- missing modifier-die authority rejects before state mutation.

Exact-head candidate evidence:

- M1 Common Play d20, including TypeScript typecheck: SUCCESS;
- M1 Common Play Interaction: SUCCESS;
- M1 Common Play Targeting: SUCCESS;
- M1 Common Play Resource Economy: SUCCESS;
- M1 Common Play HP: SUCCESS;
- Rules Domain: SUCCESS;
- Persistence: SUCCESS.

Two red workflow families were investigated rather than misclassified as candidate regressions:

- Contract validation reaches schema/fixture/coverage checks successfully and then fails the unified-definition step because its workflow environment invokes `tsx` without installing it (`sh: 1: tsx: not found`);
- UI/Phase11/Phase12 inherit the parent product checkpoint's pre-existing Phase09 failures. The recovered product checkpoint `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9` produces the same Phase09 result, 104/116 passing with the same 12 failures and the same deterministic-dice/HP/spatial-provenance mismatches.

PR #176 does **not** complete the Cutting Words migration. It removes no named execution path, so the C8 debt remains 40 `LEGACY_EXECUTION` paths, 19 named production RuntimeAdapter paths, and 36 `INCOMPLETE` coverage rows. No coverage family becomes terminal from this primitive alone.

The next step is to use this generic semantic through the production/session interceptor path for the normative Cutting Words trigger families, including damage-roll reduction, remote responder Reaction/resource payment, and authoritative spatial/visibility facts. Only after that generic path and connected/Undo evidence exist should built-in Cutting Words data become authoritative and the named app/domain execution be deleted.

## 9. Next Exact Action

1. Perform mandatory Rerun preflight on `agent/v1-common-play-full-convergence`; confirm merge `bb53ef104a76547099673daa7deb33a5d7928016` remains in ancestry. Treat PR #176's generic `subtract-die` proof as retained evidence unless that surface changes.
2. Extend the existing generic Common Play interceptor/production-session path — not a Cutting-Words-specific engine — so an eligible external responder can atomically pay Reaction/resource costs and apply `subtract-die` to an already-successful ability check or attack roll using the central d20 recalculation semantics.
3. Extend the same generic interceptor path to authoritative damage-roll reduction. Do not fabricate spatial, visibility, or sensory facts when no provider/manual authority supplies them.
4. Encode the built-in Cutting Words mechanic through the class-feature Common Play module and prove arbitrary-ID/name rename invariance plus the applicable connected-session/reconnect/Undo authority behavior.
5. Delete the absorbed `bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter` and named Cutting Words domain execution only after the generic path is authoritative; then shrink the legacy baseline/inventory and verify the negative delta before any coverage-terminal claim.
6. Continue C8 until all named D&D execution reaches zero. Do not enter C9 Gate N yet.
