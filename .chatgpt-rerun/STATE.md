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

C8 Core is complete. C9 Gate N mechanism-coverage reconciliation remains active. The 36-row coverage ledger is authoritative; a row stays `INCOMPLETE` until its full required semantic/evidence matrix is satisfied. Current coverage remains `IMPLEMENTED=2`, `INCOMPLETE=34`, `PROVEN_UNNEEDED=0`. `gateNBlockingNamedFallbacks` remains empty. Overall verdict: `V1 INCOMPLETE`.

Previously validated C9 checkpoints remain authoritative and must not be repeated unless an affected surface changes:

- `7be5c795`: typed actor artifact/combatant lifecycle.
- `583ff38c`: generic Action/Bonus Action/Reaction payments.
- `281be9b1`: summoned actor connected action execution + Undo.
- `acc46a1a`: PaymentContract preserved/executed across Common Play lowerers.
- `c87402f9`: canonical stored invocation for installed attack/spell with Reaction, exactly-once, replay/reconnect, Undo.
- `5308c15e`: movement.relocate + Ready capture/cancel/expiry/Undo.
- `50498ba6`: held Concentration lifecycle; Family S promoted `IMPLEMENTED`.
- `458585cf`: installed `damage.taken` automatic rules atomically append to the originating resolution.
- `b659b063`, `641c00fe`, `fbcee3c6`, `64a1ff5d`, `0426859e`, `91a7dc94`, `72a2c7fd`: canonical Zone manual membership, automatic turn lifecycle, reversible turn-clock, event-native connected Undo, round-wrap elapsed advance, and duration cleanup.
- `34358920`, `742e5c70`, `d8e72006`, `ce09f959`, `2ed2ff8d`, `f41fabf3`, `3eddc991`, `7f0de733`: authoritative external spatial Zone membership/stay uses the existing canonical transaction and connected event path without Core geometry inference.
- `b503364d`, `aa15c643`, `c4dabadb`, `a614c427`, `1766dfde`, `87faf94b`, `fda7436c`: Zone effect.apply/opaque placement breadth; Family T promoted `IMPLEMENTED`.

## Completed Family T

Family T (`zones`) is final. Installed arbitrary Zones cover spawn/opaque placement, manual and provider-supplied spatial membership, enter/leave/stay/start/end-turn events, frequency, elapsed cleanup, damage/effect triggers, Host/Client replay, duplicate replay, reconnect, Undo, and arbitrary identity. No Zone-specific Effect engine, geometry engine, timer, or transport was introduced.

Exact retained evidence:

- UI `33275769385`, job `99162085528`, head `a614c427194a0f436a7a3763a48808155d7865f3`: connected/live-lifecycle step 17 SUCCESS for Zone effect breadth; later focused steps green; broad Phase09 inherited red and build skipped.
- UI `33276086024`, job `99162952306`, head `fda7436c5945d055d0231f9a65b8653e7b622443`: step 17 SUCCESS for authoritative spatial Zone placement replay; same inherited broad Phase09 red/build skip.

## Current Family P

Family P (`trigger-frequency-automatic`) remains `INCOMPLETE`, but the generic frequency-token matrix now has production evidence for `once`, `once-per-turn`, `once-per-round`, and `once-per-resolution`, in addition to already-proven damage events, actor turn boundaries, and retained post-roll interceptor timing.

Damage / recurring trigger evidence:

- `2ad9a9da`, `cf5c4d05`, `e673e8ce`: structural `damage.taken | damage.dealt` automatic rules append to the originating Resolver transaction; arbitrary identity and connected replay/reconnect/Undo are proven.
- UI `33276209929`, job `99163290985`, exact head `e673e8cee93fa0e173c724f5e15d10f45a2cbb79`: step 17 SUCCESS.
- `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: `once-per-turn` and `once-per-round` suppress same-window repeats and re-arm on later authoritative clock windows, including connected marker convergence/Undo.
- UI `33276658731`, job `99164452949`, exact head `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: step 17 SUCCESS.

Actor turn-boundary evidence:

- `96ef2d038692f3ab65d7b01cca7d2c82f21e96f0` and `a3d602234157f9b6286ad762060e4ef787c4d07b`: installed actor-owned `turn-start | turn-end` rules compile into the existing authoritative turn PendingResolution.
- `2da641307e85c354415be63136bb62962a830f73`: test-only fix follows authoritative initiative order rather than assuming the summoned actor is next.
- UI `33277003153`, job `99165362025`, exact head `2da641307e85c354415be63136bb62962a830f73`: step 17 SUCCESS for identity, Host/Client convergence, duplicate replay, reconnect, and event-native Undo; steps 18-27 green; broad Phase09 inherited red/build skip.

Post-roll/outcome retained evidence:

- `commonPlayRuntime.ts` already owns structural `attack.outcome-determined`, `d20.outcome-determined`, and `damage.rolled` interceptor timings. They reuse the authoritative PendingResolution with atomic payment/recalculation rather than a second mechanical commit.
- Retained C8/PR #179 evidence plus `installedCommonPlayInterceptorProductionRuntime.test.ts` proves arbitrary installed identity for d20 outcome recalculation and damage-roll reduction, atomic payment, duplicate-response safety, Host/Client event convergence, duplicate replay rejection, and event-native Undo.
- A new speculative attack-outcome-specific connected scenario was intentionally discarded after it asserted behavior not owned by the existing production surface; the canonical retained interceptor suite remains the evidence. No new top-level hit/miss/save event semantics were claimed.

`once` / `once-per-resolution` evidence completed in this checkpoint:

- `commonPlayFrequencyRuntime.ts` remains the single generic frequency policy for `unlimited | once | once-per-turn | once-per-round | once-per-resolution`; no second frequency engine was added.
- `connectedOnceFrequencyProduction.test.ts` proves a source-scoped `once` rule remains consumed across later resolutions and reconnect, and event-native Undo restores the consumed marker/state. `0af725b0a3bd6819532bc3d165ea4a22a4596fd1` adds the source-scoped regression.
- `connectedDamageDealtTriggerProduction.test.ts` proves `once-per-resolution` suppresses a second matching damage event inside one multi-damage authoritative resolution and re-arms for the next resolution, with arbitrary identity and connected replay/reconnect/Undo.
- UI `33277613401`, job `99166991572`, head `97e2dd8486c9f3c0dbf3769e90081fc10c1d1e85`: step 17 SUCCESS and steps 18-27 SUCCESS; only inherited broad Phase09 step 28 failed and build was skipped.
- Focused frequency diagnostic `33277634944` at `5e732141bccce5919a03a7bd8d062388a1b23371`: SUCCESS.
- UI `33277714480`, job `99167253569`, exact head `0af725b0a3bd6819532bc3d165ea4a22a4596fd1`: step 17 SUCCESS including the source-scoped `once` regression; steps 18-27 SUCCESS; broad Phase09 step 28 remains the inherited failure and build is skipped. No full-build green is claimed.

Family P unresolved semantic/production gaps remain explicit:

- rest triggers: `short-rest`/`long-rest` are authoritative Resolver operations, but rest-bound Effect expiry occurs inside the operation and trigger-vs-expiry ordering is not defined. The discarded `f22d50cb` staging workflow attempted to choose this without authority, failed without pushing product code, and was removed by `7727cf2a`. Do not implement rest triggers until ordering/lifetime is deliberately defined.
- recharge: `recharge-resource` exists generically, but no portable installed Recharge X-Y policy/die-authority binding exists. Do not infer it from monster/action identity.
- hit/miss/save automatic triggers: no canonical portable top-level event names or subject/target binding are defined. Do not invent them in an adapter.
- state-applied/expiry automatic triggers: `apply-effect`/`remove-effect` operations exist, but no canonical portable event identity and no single expiry ordering/lifetime contract exists across all lifecycle owners.
- pre-roll automatic timing remains distinct from the already-proven outcome/post-roll interceptor points.

Family P therefore stays `INCOMPLETE`; its frequency submatrix is no longer the blocker.

## Next candidate outside the blocked Family P semantics

Family V (`actor-artifact-summon`) is the nearest high-value row with substantial existing production evidence. The generic artifact kernel already supports actor spawn and `remove-artifact`; `executeRemoveArtifact` removes the actor artifact and its projected combatant together and emits reversible artifact + combatant StateChanges. Existing C8 evidence already covers arbitrary actor identity, actions/resources projection, Host/Client execution, and Undo.

The remaining Family V audit should therefore not invent a new despawn primitive. Determine the authoritative policy that maps actor death/lifetime/replacement to the existing `remove-artifact` operation, and prove fresh reconnect/restart reconstruction for the lifecycle. If the current artifact lifetime metadata already owns this policy, wire the smallest existing transaction seam and add focused arbitrary-identity Host/Client/reconnect/Undo evidence. If death/replacement policy is genuinely undefined, preserve that as an explicit contract gap and move to another non-blocked row rather than inferring behavior.

## Next Exact Action

Start Family V from repository truth: inspect actor-artifact lifetime metadata and current death/despawn/replacement ownership only far enough to determine whether an existing generic policy can invoke `remove-artifact`. Reuse `resolutionArtifactOps.ts` removal semantics and the existing connected ResolutionEvent/reconnect path; do not repeat actor spawn/action evidence, do not add a named summon branch, and do not invent death/replacement semantics if the contract does not already define them. Keep Family V `INCOMPLETE` until death/lifetime plus persistence/reconnect requirements are actually evidenced.
