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

The recovered V1 Common Play Master Run checkpoint remains valid and in ancestry of the live working branch.

- recovered code checkpoint: `2bf3f0b0b16ac11e2e4e8a4cfd699b64a5f5b8b9`
- recovered tree: `bb3e2f83ac1c4d169a3692a09f186daf63e5a217`
- preflight live HEAD before this checkpoint write: `45282f9d851fbf6b4d6ad9837184f3eb7cad1f7c`
- the checkpoint is the merge-base of that live HEAD;
- the five commits after the recovered code checkpoint change only Rerun/planning documentation, not product `src/` code.

Product integration remains `work/v1-composite`, never `main`.

## Reconciled evidence reused without repetition

Because product code is unchanged from the recovered code checkpoint, the still-valid broad Master Run evidence was not repeated:

- last reported `npm run build`: green;
- Common Play representative composition: 79/79 green;
- foundation Gates A-E and already integrated production slices remain reusable unless a later affected-surface product change invalidates them.

The existing repository boundary/checker definitions and unchanged product tree reconcile the active C8 debt as:

- D&D `LEGACY_EXECUTION`: **40** total = 39 direct + 1 transitive;
- class/subclass-named production RuntimeAdapter paths: **19**;
- V1 coverage ledger: **36** mandatory families, all still `INCOMPLETE`.

No coverage row was promoted by this checkpoint.

## Current C8 slice — Cutting Words design review

Live legacy evidence still supports College of Lore Cutting Words as the first unstarted coherent C8 slice.

Normative behavior has been re-derived from SRD 5.2.1/current public Basic Rules rather than legacy output: a visible creature within 60 feet can be reacted to when it makes a damage roll or succeeds on an ability check or attack roll; the responder spends Reaction plus one Bardic Inspiration die and subtracts that die from the roll. Saving throws are not an eligible trigger.

Repository inspection establishes these constraints:

- `bardCollegeLoreCuttingWordsFollowUpRuntimeAdapter.ts` and `resolveLoreCuttingWords` are named legacy execution and must not be preserved as the migrated algorithm;
- the named adapter currently calls a compatibility targeting provider that can fabricate mapless `0ft + visible` facts; the migrated path must not use that fallback;
- existing Resolver operations already cover Reaction economy, resource spending, d20 semantic recalculation, and damage-roll transactions;
- attack recalculation must reuse the existing d20 semantics so natural-1/natural-20/critical policy is not reduced to raw `total >= AC` arithmetic;
- authoritative spatial eligibility must come from an actual provider/manual relation; absence of a fact must not synthesize visibility or distance;
- connected interrupt routing is already responder-ID driven and does not require a Cutting-Words-specific transport.

A proposed side contract such as `runtimeRollReductions` was deliberately rejected during design review because it would duplicate the canonical Common Play execution language.

The canonical schema already contains the relevant structural vocabulary:

- top-level `interceptors`;
- blocking `interaction` with responder/revalidation semantics;
- `roll.modify`;
- interceptor operation `recalculate`;
- slots including `attack.roll` and `primary.damage`.

The built-in class-feature Common Play module already exists at `content/modules/dnd-srd-5.2.1.class-feature-common-play/module.json`; therefore Cutting Words should enter through RuleModule/Common Play data plus a generic production bridge, not through another named runtime engine.

One semantic question remains intentionally unresolved before implementation: the current `roll.modify` schema exposes additive dice and flat values but does not visibly expose a signed/subtractive die mode. Before adding any primitive, the next execution must inspect the existing Gate A/interceptor lowerer and representative tests to determine whether a Bardic-Inspiration die subtraction is already expressible through bindings/expressions or whether a reusable signed-die roll-modification semantic is genuinely missing. If a new semantic is required, follow the charter's gate-activation/design-review rule rather than inventing it inside a named migration.

No product files were changed in this checkpoint, so the legacy/named counts remain 40/19 and no new validation run was required.

## Waiting condition

None. Sequence 5 remains authorized to continue directly on `agent/v1-common-play-full-convergence`.

C9 Gate N remains prohibited until all D&D named legacy execution is removed and the coverage ledger reaches terminal evidence.

## Next Exact Action

1. Read the existing Gate A interceptor/recalculation lowerer and its representative tests, focusing only on `interaction`, `interceptors`, `roll.modify`, bindings, and authoritative responder/spatial facts.
2. Prove whether subtracting a rolled die can be represented with the existing Common Play contract. Do not add a new primitive if existing composition suffices.
3. If composition suffices, author an arbitrary-ID Common Play interceptor fixture first and wire the smallest generic production/session bridge needed for remote responder + authoritative spatial eligibility; then encode built-in Cutting Words in the class-feature Common Play module.
4. If composition does not suffice, document the deterministic Cutting Words failure against the existing contract and activate only the smallest reusable signed-die/roll-reduction semantic under the architecture charter before product wiring.
5. Run focused generic/interceptor + Cutting Words + connected responder/Undo verification on the changed exact head, then delete the absorbed named app/domain execution, shrink the legacy baseline/inventory, and only then checkpoint the resulting negative delta.

Current verdict: `V1 INCOMPLETE`.
