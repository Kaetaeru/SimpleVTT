# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `7`
- task_id: `v1-common-play-c8-rerun`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/c9-gate-n-coverage-reconciliation`
- product integration target: `work/v1-composite`
- product plan: `docs/rules/resolver-execution-checklist-v2.md`
- checkpointed_at: `2026-08-30 Asia/Seoul`

## Durable checkpoint

C8 Core is complete. C9 Gate N mechanism-coverage reconciliation remains active. Repository authority is the 36-row coverage ledger; no row may be promoted until its full required semantic/evidence matrix is satisfied.

Previously validated C9 checkpoints remain authoritative and must not be repeated unless an affected surface changes:

- `7be5c795`: typed actor artifact/combatant lifecycle.
- `583ff38c`: generic Action/Bonus Action/Reaction payments.
- `281be9b1`: summoned actor connected action execution + Undo.
- `acc46a1a`: PaymentContract preserved/executed across Common Play lowerers.
- `c87402f9`: canonical stored invocation for installed attack/spell with Reaction, exactly-once, replay/reconnect, Undo.
- `5308c15e`: movement.relocate + Ready capture/cancel/expiry/Undo.
- `50498ba6`: held Concentration lifecycle; Family S promoted `IMPLEMENTED`.
- `458585cf`: installed `damage.taken` automatic rules atomically append to originating resolution.
- `b659b063`: manual Zone enter/leave membership, trigger, connected replay/reconnect, Undo.
- `641c00fe`: installed Zone turn-start/end rules compose into authoritative turn lifecycle.
- `fbcee3c6`: canonical reversible `turn-clock` StateChanges.
- `b4b5fc5e` and `7aa6a2cb`: exact turn lifecycle ResolutionEvents use existing connected mode-transition path and Client/reconnect event-native apply.
- `64a1ff5d` / `0426859e`: turn lifecycle uses existing runtimeResolutionEventHistory/event-native Undo authority; connected inverse events preserve typed provenance.
- `91a7dc94`: initiative round wrap advances elapsed runtime by 6 seconds in the same PendingResolution.
- `72a2c7fd`: arbitrary elapsed Zone expiry/cleanup converges Host/Client, duplicate replay, reconnect, Undo.
- `5bea7af`: Families P/T ledger text reconciled to already-proven automatic turn dispatch and elapsed cleanup without promotion.
- `34358920` / `742e5c70` / `d8e72006` / `ce09f959` / `2ed2ff8d`: authoritative external spatial Zone membership enters the existing canonical Zone transaction and standard connected ResolutionEvent path with arbitrary identity, no manual controls, provider provenance, Host/Client convergence, duplicate replay, reconnect, and Undo.
- `bb154414`: Family T ledger text reconciled to the spatial-provider evidence without promotion.
- `f41fabf3` / `3eddc991` / `7f0de733`: canonical `zone.stay` accepts provider stay facts only for active members and proves once-per-turn frequency, standard connected replay/reconnect, and Undo without membership mutation.
- `a8698c55`: Family T ledger text reconciled to the stay evidence without promotion.

## Completed Family T checkpoint

Family T (`zones`) is complete and promoted to `IMPLEMENTED`. No Zone-specific Effect engine, geometry engine, timer, or transport was added.

- `b503364d`: `commonPlayEffectRuntime.ts` exposes reusable generic `effect.apply -> apply-effect` lowering and effect-template validation.
- `aa15c643`: `commonPlayZoneRuntime.ts` composes Zone `effect.apply` rules through the same canonical `apply-effect` operation.
- `c4dabadb`: `commonPlayDefinitionRuntime.ts` retains effect templates referenced transitively from Zone rules.
- `a614c427`: arbitrary installed Zone effect trigger converges Host/Client, duplicate replay, reconnect, and event-native Undo.
- `1766dfde`: Family T ledger row promoted to `IMPLEMENTED`; named aura/zone code remains non-fallback migration debt only.
- `87faf94b`: authoritative spatial provider facts may carry opaque Zone `placementRef` without Core geometry inference.
- `fda7436c`: connected spatial Zone proof verifies placementRef replay/reconnect alongside existing membership semantics.

Exact Family T verification:

- UI workflow `33275769385`, job `99162085528`, exact head `a614c427194a0f436a7a3763a48808155d7865f3`: connected/live-lifecycle step 17 SUCCESS for Zone effect breadth; steps 18-27 also SUCCESS; broad Phase09 step 28 remains inherited FAILURE and typecheck/build step 29 was skipped.
- UI workflow `33276086024`, job `99162952306`, exact head `fda7436c5945d055d0231f9a65b8653e7b622443`: connected/live-lifecycle step 17 SUCCESS for authoritative spatial Zone placement replay; the same inherited broad Phase09 failure remains and build was skipped.

## Current Family P checkpoint

Family P (`trigger-frequency-automatic`) remains `INCOMPLETE`. Damage events, recurring once-per-turn/round frequency, and actor-owned turn-start/end resource rules now have exact production evidence without a parallel trigger engine.

Damage event slices:

- `2ad9a9da`: `commonPlayEffectRuntime.ts` generalizes the existing positive-damage effect dispatcher from `damage.taken` to the structurally symmetric `damage.taken | damage.dealt` roles. A `damage.dealt` effect matches the authoritative pending actor, while `damage.taken` continues to match the damage target; both append downstream operations and effect removal into the originating Resolver transaction rather than a second commit.
- `cf5c4d05`: arbitrary external IDs prove installed production semantics for `damage.dealt`, including atomic source recoil plus target damage and identity rename invariance.
- `e673e8ce`: the connected proof is registered in the existing UI live-lifecycle workflow.
- UI workflow `33276209929`, job `99163290985`, exact head `e673e8cee93fa0e173c724f5e15d10f45a2cbb79`: connected/live-lifecycle step 17 SUCCESS for Host/Client convergence, duplicate replay, ordered reconnect, and event-native Undo; steps 18-27 also green. Broad Phase09 step 28 is inherited FAILURE and typecheck/build is skipped.

Recurring frequency slice:

- `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: production tests prove recurring `damage.dealt` rules with both `once-per-turn` and `once-per-round` suppress a same-turn repeat and re-arm on the following round; the connected proof covers frequency-marker convergence and event-native rollback rather than a local-only marker assertion.
- UI workflow `33276658731`, job `99164452949`, exact head `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: connected/live-lifecycle step 17 SUCCESS with the recurring-frequency proof; steps 18-27 also SUCCESS. Broad Phase09 step 28 remains the inherited FAILURE and typecheck/build step 29 is skipped, so no full-build green is claimed.

Actor-owned turn boundary slice:

- `96ef2d038692f3ab65d7b01cca7d2c82f21e96f0`: `commonPlayActorTurnRuleComposition.ts` structurally discovers actor-owned `turn-start | turn-end` rules from installed actor artifact action definitions and compiles existing `resource.change` plus generic frequency metadata.
- `a3d602234157f9b6286ad762060e4ef787c4d07b`: `phase09EffectAwareTurnAdapter.ts` composes those operations through the existing authoritative turn PendingResolution beside Zone turn rules.
- UI run `33276867829`, job `99165007115`, head `f876ff6e8e1e988a8fe36043cbc293a54bece495`, step 17 exposed a test-only initiative-order assumption: the fixture expected one `endTurn()` from Aelar to reach an independently-ordered summoned actor, so four new actor-turn assertions observed resource `0 !== 1` before the actor's actual turn boundary.
- `2da641307e85c354415be63136bb62962a830f73` corrects only that fixture: it advances through the authoritative initiative order until the summoned actor is actually active and preserves the exact event-native connected/Undo assertions. No production source was changed by this correction.
- UI workflow `33277003153`, job `99165362025`, exact head `2da641307e85c354415be63136bb62962a830f73`: connected/live-lifecycle step 17 SUCCESS with the corrected actor turn-start/end identity, Host/Client convergence, duplicate replay, ordered reconnect, and event-native Undo proofs. Steps 18-27 also SUCCESS. Broad Phase09 step 28 remains inherited FAILURE and typecheck/build step 29 is skipped, so no full-build green is claimed.

Rest-event audit and discarded staging attempt:

- `short-rest` and `long-rest` already exist as typed Resolver operations and produce authoritative events for the resting `targetId`.
- `resolutionRestOps.ts` performs rest-bound Effect expiry inside the rest operation itself before returning that operation's event/result.
- Therefore a generic persistent Effect rule bound to `short-rest`/`long-rest` requires a deliberate ordering decision: trigger before rest expiry, trigger after rest expiry, or evaluate against the pre-rest snapshot while downstream operations execute after rest mutation. The current Common Play contract/checklist does not define that choice.
- Concurrent commit `f22d50cb559f779c4070c208860036d6e12b6b83` temporarily added `.github/workflows/rerun-c9-rest-trigger-patch.yml`, which attempted to choose one rest ordering/lifetime behavior without first reconciling that semantic decision. Workflow run `33277045870` failed immediately and did not push any proposed domain/app/test source changes.
- `7727cf2af1f1af6bb9d257b183c214d5f9f3f7ab` explicitly deletes that staging workflow. The unauthorized rest-trigger approach is discarded; no rest-trigger product code entered the branch, and no owner decision is currently required merely to continue auditing other already-owned event producers.
- Rest-trigger production remains intentionally unimplemented until its ordering/lifetime contract is deliberately defined.

Recharge/cooldown audit:

- `recharge-resource` is already a typed Resolver operation and `executeRechargeResource` correctly owns turn-start validation, resource mutation, reversible `resource` StateChange emission, success/failure range evaluation, and stale/revision safety through the normal PendingResolution path.
- The current operation requires an authoritative die face in `operation.die.faces` and a structural `resourceId`/success range, but there is no portable installed production contract that binds a resource/action definition to a Recharge X-Y policy and no current production owner that supplies that authoritative die face at turn start.
- Actor artifacts carry action definition IDs and resource current/maximum values but not recharge policy metadata. The C6 proof is domain-only and the ledger correctly records `monster action catalog recharge projection` as the remaining seam.
- Adding automatic recharge now would require a deliberate portable policy binding and die-authority contract. No monster/action-ID branch or inferred recharge policy was added.

Attack/save outcome audit:

- `common-play-contract.schema.json` intentionally preserves `rule.event` as a non-empty string and generic frequency values, so no new schema primitive is required merely to represent another event family.
- `attack.ts` already owns the authoritative attack d20 result inside one PendingResolution, and existing downstream damage/critical operations use `OperationPredicate` against the attack result. `resolutionContext.ts` supports exact equality predicates on prior operation results, so outcome-gated atomic composition is mechanically possible without a second commit.
- However, the current portable contract does not define canonical top-level event names for attack hit/miss or save success/failure, nor the event subject/target binding for those rules. Defining those names/bindings inside a production adapter would silently create semantics rather than route an already-owned contract.
- Therefore no hit/miss/save dispatcher was added. This remains a contract-vocabulary/subject-binding gap.

State/effect application and expiry audit:

- `resolutionEffectOps.ts` emits authoritative Resolver events for `apply-effect` and `remove-effect` operations with explicit target subjects and reversible Effect StateChanges.
- The portable automatic-rule contract does not define a canonical top-level event identity/subject binding that maps the ledger's `state applied` semantic to those operation events. Reusing `apply-effect` as an authored trigger name inside an adapter would define new portable semantics rather than consume an existing contract.
- Effect expiry is broader than explicit `remove-effect`: turn boundaries, elapsed advance, rest, Concentration, incapacitation/death, and other lifecycle owners can remove Effects as state changes inside their owning operation. There is no single existing portable `expiry` trigger event with defined pre/post-removal ordering and source-effect lifetime semantics.
- No state-applied/expiry dispatcher was added. These remain contract-vocabulary/ordering gaps rather than missing transport or Resolver primitives.

Coverage remains `IMPLEMENTED=2`, `INCOMPLETE=34`, `PROVEN_UNNEEDED=0`: Families S and T are final; P is still incomplete. `gateNBlockingNamedFallbacks` remains empty. Gate N remains blocked by the other incomplete rows. Overall verdict: `V1 INCOMPLETE`.

## Next Exact Action

Continue Family P without repeating final Zone, damage-event, recurring-frequency, or actor-turn evidence. Do not implement rest triggers until trigger-vs-expiry ordering is deliberately defined; do not productionize Recharge without a portable policy/die-authority binding; do not invent attack/save/state-applied/expiry event names or subject/lifetime ordering inside adapters. Audit the already-canonical interceptor timing points in `commonPlayRuntime.ts` (`attack.outcome-determined`, `d20.outcome-determined`, `damage.rolled`) against Family P's before/after roll/outcome semantics and existing production/identity/connected evidence. If that evidence satisfies part of P without new semantics, reconcile only that evidence; otherwise continue to another already-owned producer. Keep Family P `INCOMPLETE` until the complete event/frequency matrix is evidenced.
