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

Family P (`trigger-frequency-automatic`) remains `INCOMPLETE`, but the `damage.dealt` event-family slice is now production-proven without a parallel trigger engine.

- `2ad9a9da`: `commonPlayEffectRuntime.ts` generalizes the existing positive-damage effect dispatcher from `damage.taken` to the structurally symmetric `damage.taken | damage.dealt` roles. A `damage.dealt` effect matches the authoritative pending actor, while `damage.taken` continues to match the damage target; both append downstream operations and effect removal into the originating Resolver transaction rather than a second commit.
- The slice deliberately remains one-shot (`frequency:"once"` + `until-event` lifetime) and does not claim the broader once-per-turn/round/recharge/cooldown matrix already tracked by Family P.
- `cf5c4d05`: arbitrary external IDs prove installed production semantics for the new `damage.dealt` trigger, including atomic source recoil plus target damage and identity rename invariance.
- `e673e8ce`: the connected proof is registered in the existing UI live-lifecycle workflow.

Exact Family P slice verification:

- UI workflow `33276209929`, job `99163290985`, exact head `e673e8cee93fa0e173c724f5e15d10f45a2cbb79`.
- Connected/live-lifecycle step 17: SUCCESS, proving Host/Client convergence, duplicate replay idempotence, ordered reconnect reconstruction, and event-native Undo for the arbitrary installed `damage.dealt` effect.
- Steps 18-27 also completed successfully.
- Broad Phase09 step 28 remains the inherited FAILURE and typecheck/build step 29 is skipped; no full-build green is claimed.

Rest-event audit after the damage-dealt slice:

- `short-rest` and `long-rest` already exist as typed Resolver operations and produce authoritative events for the resting `targetId`.
- `resolutionRestOps.ts` performs rest-bound Effect expiry inside the rest operation itself before returning that operation's event/result.
- Therefore a generic persistent Effect rule bound to `short-rest`/`long-rest` would require a new ordering decision: whether its trigger is evaluated before rest expiry, after rest expiry, or against the pre-rest snapshot while downstream operations execute after the rest mutation. Current Common Play contracts do not determine that ordering/lifetime semantic.
- Per the C9 anti-drift rule, no rest-trigger dispatcher was added. This is an architecture-semantic gap, not a missing one-line production hook.

Coverage remains `IMPLEMENTED=2`, `INCOMPLETE=34`, `PROVEN_UNNEEDED=0`: Families S and T are final; P is still incomplete. `gateNBlockingNamedFallbacks` remains empty. Gate N remains blocked by the other incomplete rows. Overall verdict: `V1 INCOMPLETE`.

## Next Exact Action

Continue Family P without repeating the final Zone matrix or the now-proven `damage.taken/dealt` slice. Do not implement rest-trigger dispatch until the trigger-vs-rest-expiry ordering contract is deliberately resolved. Instead audit the already-typed `recharge-resource` turn-start operation and its current production callers to determine whether recharge/cooldown can be made portable/automatic by composition with existing turn lifecycle and resource ownership, with no new event vocabulary or state owner. If that path is already semantically owned, add the smallest arbitrary-ID production/connected/reconnect/Undo proof; if it also requires new authority/lifetime semantics, stop for architecture review and select another already-determined event family. Keep Family P `INCOMPLETE` until its complete required event/frequency matrix is evidenced.
