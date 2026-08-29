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

Family P (`trigger-frequency-automatic`) remains `INCOMPLETE`. Damage events, actor-owned turn boundaries, and recurring once-per-turn/round frequency now have production evidence without a parallel trigger engine.

Damage event slices:

- `2ad9a9da`: `commonPlayEffectRuntime.ts` generalizes the existing positive-damage effect dispatcher from `damage.taken` to the structurally symmetric `damage.taken | damage.dealt` roles. A `damage.dealt` effect matches the authoritative pending actor, while `damage.taken` continues to match the damage target; both append downstream operations and effect removal into the originating Resolver transaction rather than a second commit.
- `cf5c4d05`: arbitrary external IDs prove installed production semantics for `damage.dealt`, including atomic source recoil plus target damage and identity rename invariance.
- `e673e8ce`: the connected proof is registered in the existing UI live-lifecycle workflow.
- UI workflow `33276209929`, job `99163290985`, exact head `e673e8cee93fa0e173c724f5e15d10f45a2cbb79`: connected/live-lifecycle step 17 SUCCESS for Host/Client convergence, duplicate replay, ordered reconnect, and event-native Undo; steps 18-27 also green. Broad Phase09 step 28 is inherited FAILURE and typecheck/build is skipped.

Actor-owned turn/frequency slice:

- `96ef2d038692f3ab65d7b01cca7d2c82f21e96f0`: `commonPlayActorTurnRuleComposition.ts` discovers installed actor-owned `turn-start | turn-end` rules structurally from actor artifact `actionDefinitionIds`. It accepts the existing generic frequency vocabulary (`unlimited`, `once`, `once-per-turn`, `once-per-round`, `once-per-resolution`), compiles only already-supported `resource.change` through the normal operations lowerer, and stores frequency tokens on the actor artifact with the existing reversible `update-artifact` operation. No trigger store, named actor/action branch, or new transport is added.
- `a3d602234157f9b6286ad762060e4ef787c4d07b`: `phase09EffectAwareTurnAdapter.ts` composes those actor-owned turn rules beside existing Zone turn rules through the existing `advanceTurnRuntimeLifecycle` additional-operation hook, so turn boundary, resource change, and frequency marker remain one authoritative PendingResolution/event batch.
- `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: production tests prove recurring `damage.dealt` rules with both `once-per-turn` and `once-per-round` suppress a same-turn repeat and re-arm on the following round; the connected proof covers frequency-marker convergence and event-native rollback rather than a local-only marker assertion.
- UI workflow `33276658731`, job `99164452949`, exact head `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: connected/live-lifecycle step 17 SUCCESS with the new recurring-frequency proof; steps 18-27 also SUCCESS. Broad Phase09 step 28 remains the inherited FAILURE and typecheck/build step 29 is skipped, so no full-build green is claimed.

Rest-event audit:

- `short-rest` and `long-rest` already exist as typed Resolver operations and produce authoritative events for the resting `targetId`.
- `resolutionRestOps.ts` performs rest-bound Effect expiry inside the rest operation itself before returning that operation's event/result.
- Therefore a generic persistent Effect rule bound to `short-rest`/`long-rest` would require a new ordering decision: whether its trigger is evaluated before rest expiry, after rest expiry, or against the pre-rest snapshot while downstream operations execute after the rest mutation. Current Common Play contracts do not determine that ordering/lifetime semantic.
- Per the C9 anti-drift rule, no rest-trigger dispatcher was added. This is an architecture-semantic gap, not a missing one-line production hook.

Recharge/cooldown audit:

- `recharge-resource` is already a typed Resolver operation and `executeRechargeResource` correctly owns turn-start validation, resource mutation, reversible `resource` StateChange emission, success/failure range evaluation, and stale/revision safety through the normal PendingResolution path.
- The current operation requires an authoritative die face in `operation.die.faces` and a structural `resourceId`/success range, but there is no portable installed production contract that binds a resource/action definition to a Recharge X-Y policy and no current production owner that supplies that authoritative die face at turn start.
- Actor artifacts carry action definition IDs and resource current/maximum values but not recharge policy metadata. The C6 proof is domain-only and the ledger correctly records `monster action catalog recharge projection` as the remaining seam.
- Adding automatic recharge now would require a deliberate portable policy binding and die-authority contract. No monster/action-ID branch or inferred recharge policy was added.

Attack/save outcome audit after the turn/frequency proof:

- `common-play-contract.schema.json` intentionally preserves `rule.event` as a non-empty string and generic frequency values, so no new schema primitive is required merely to represent another event family.
- `attack.ts` already owns the authoritative attack d20 result inside one PendingResolution, and its existing downstream damage/critical operations use `OperationPredicate` against `${request.id}:attack` fields such as `outcome` and `critical`. `resolutionContext.ts` supports exact equality predicates on prior operation results, so outcome-gated atomic composition is mechanically possible without a second commit.
- However, the current portable contract does not define canonical top-level event names for attack hit/miss or save success/failure, nor the event subject/target binding for those rules. Defining those names/bindings inside a production adapter would silently create semantics rather than route an already-owned contract.
- Therefore no hit/miss/save dispatcher was added in this checkpoint. This is a narrower contract-vocabulary/subject-binding gap; the existing d20 transaction itself is not missing the ability to execute conditional downstream operations.

Coverage remains `IMPLEMENTED=2`, `INCOMPLETE=34`, `PROVEN_UNNEEDED=0`: Families S and T are final; P is still incomplete. `gateNBlockingNamedFallbacks` remains empty. Gate N remains blocked by the other incomplete rows. Overall verdict: `V1 INCOMPLETE`.

## Next Exact Action

Continue Family P without repeating final Zone, damage-event, or turn/frequency evidence. Do not implement rest triggers until trigger-vs-rest-expiry ordering is deliberately defined, do not productionize Recharge until a portable policy/die-authority binding exists, and do not invent attack/save event names or subject binding inside an adapter. Audit the next already-owned authoritative event producer whose event identity and subject/lifetime ordering already exist in the contract/runtime (starting with state/effect application or expiry). If one can be composed from canonical ResolutionEvent/operation semantics without a new policy decision, implement the smallest structural dispatcher and prove arbitrary identity plus connected replay/reconnect/Undo. Otherwise record that semantic gap and continue to another already-owned producer. Keep Family P `INCOMPLETE` until its complete event/frequency matrix is evidenced.