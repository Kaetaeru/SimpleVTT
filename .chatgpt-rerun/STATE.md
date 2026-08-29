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

Retained exact evidence:

- UI `33275769385`, job `99162085528`, head `a614c427194a0f436a7a3763a48808155d7865f3`: connected/live-lifecycle step 17 SUCCESS for Zone effect breadth; later focused steps green; broad Phase09 inherited red and build skipped.
- UI `33276086024`, job `99162952306`, head `fda7436c5945d055d0231f9a65b8653e7b622443`: step 17 SUCCESS for authoritative spatial Zone placement replay; same inherited broad Phase09 red/build skip.

## Family P status

Family P (`trigger-frequency-automatic`) remains `INCOMPLETE`, but the generic frequency-token matrix has production evidence for `once`, `once-per-turn`, `once-per-round`, and `once-per-resolution`, plus automatic damage events, actor turn boundaries, Zone events, and retained post-roll interceptor timing.

Retained evidence:

- `2ad9a9da`, `cf5c4d05`, `e673e8ce`: structural `damage.taken | damage.dealt` automatic rules append to the originating Resolver transaction; arbitrary identity and connected replay/reconnect/Undo proven.
- `63dced7e2116d568071a5349ce7bf8cdb23b0ec2`: once-per-turn/round re-arm from authoritative clock windows.
- `96ef2d038692f3ab65d7b01cca7d2c82f21e96f0`, `a3d602234157f9b6286ad762060e4ef787c4d07b`, `2da641307e85c354415be63136bb62962a830f73`: installed actor-owned turn-start/end rules in the existing turn transaction with connected/reconnect/Undo evidence.
- `commonPlayRuntime.ts` plus retained PR #179 / `installedCommonPlayInterceptorProductionRuntime.test.ts`: `attack.outcome-determined`, `d20.outcome-determined`, and `damage.rolled` interceptor timings reuse authoritative PendingResolution semantics.
- `connectedOnceFrequencyProduction.test.ts` and `connectedDamageDealtTriggerProduction.test.ts`: source-scoped `once` and `once-per-resolution` production/reconnect/Undo evidence.
- UI `33277714480`, job `99167253569`, head `0af725b0a3bd6819532bc3d165ea4a22a4596fd1`: step 17 and steps 18-27 SUCCESS; inherited broad Phase09 step 28 fails and build is skipped.

Family P remains incomplete because repository authority still does not define or prove pre-roll automatic timing, top-level hit/miss/save trigger vocabulary and subject binding, state-applied/expiry ordering, rest trigger-vs-expiry ordering, or portable Recharge policy/die authority. Do not invent those semantics in an adapter.

## Family V audit — lifetime/reconnect advanced, final disposition unchanged

Live GitHub advanced beyond the prior STATE checkpoint before this Rerun execution. Current product/test head before this STATE write was `77b533aaa4faed38dba7aa17d85f9068dd492e13`; the immediately preceding UI-registration head was `18a66247a175eacb099b70dbf16b59ca32257089`.

No production source change was required for the new Family V lifetime proof. The added arbitrary installed actor-artifact regression uses the existing generic artifact expiry/removal, turn-clock, ResolutionEvent, connected replay, and event-native Undo path:

- `afa2860f55ff498929984dca2905c1bbacf9e5b5`: `connectedActorArtifactLifecycleProduction.test.ts` proves an unknown elapsed 6-second actor artifact spawns with its typed combatant, reconstructs on a fresh connected replica, expires on normal round-wrap elapsed advance, removes both artifact and projected combatant, rejects duplicate replay, reconstructs the expired state on fresh reconnect, restores artifact + combatant through event-native Undo, and reconstructs the restored state on another fresh reconnect.
- `18a66247a175eacb099b70dbf16b59ca32257089`: registers that lifecycle regression in the authoritative UI connected/live-lifecycle step.
- UI run `33277978481`, job `99167998243`, exact head `18a66247a175eacb099b70dbf16b59ca32257089`: step 17 SUCCESS including `connectedActorArtifactLifecycleProduction.test.ts` and the existing `connectedActorArtifactReconnectProduction.test.ts`; steps 18-27 also SUCCESS. Broad Phase09 step 28 remains the inherited failure and Typecheck/build step 29 is skipped, so no full-build green is claimed.
- `77b533aaa4faed38dba7aa17d85f9068dd492e13` removes only the temporary actor-lifecycle diagnostic workflow; it does not remove the main UI regression registration.

This closes the previously stale **elapsed lifetime/despawn + connected reconnect/replay/Undo** evidence gap for Family V. It does not define the ledger-required **death/replacement policy**. The current generic artifact contract has elapsed/durable/source-lifetime forms and `remove-artifact` semantics, but no repository-authoritative rule was found that says actor death or replacement must select a particular removal/replacement transition. Per the architecture charter and the prior Next Exact Action, that semantic must not be invented merely to promote the ledger row.

Family V therefore remains `INCOMPLETE`. The ledger row should be reconciled later to record the new lifetime/reconnect evidence, but its `death/despawn/replacement` requirement remains a real blocker until repository authority supplies or proves the policy. Do not repeat actor spawn/action/lifetime evidence.

## Next candidate: Family U portable object/link lifecycle

Family U (`object-link-artifacts`) is a concrete non-blocked production gap, not merely a stale ledger row:

- `commonPlayArtifactRuntime.ts` already lowers arbitrary object/link templates through generic `artifact.spawn`; `installedCommonPlayLoweredFamiliesProduction.test.ts` proves arbitrary object/link spawn and rename invariance in the installed production route.
- `commonPlayArtifactFamiliesRuntime.test.ts` already proves the generic Resolver kernel for object AC/HP, damage threshold, defenses, repair, relocation, destruction/removal, link endpoints/relations, identity invariance, and dangling-link rejection.
- However `commonPlayOperationRuntime.ts` currently exposes portable resource/economy/damage/healing/movement/roll operations only, while `commonPlayArtifactRuntime.ts` exposes only `artifact.spawn`. The existing generic Resolver artifact lifecycle operations (`damage-artifact`, `repair-artifact`, relocation/removal) are therefore not yet authorable/executable by an unknown installed Common Play module through the production operation surface.

This is the smallest clear Family U gap because it reuses existing Resolver semantics rather than adding a new object/link engine.

## Next Exact Action

Start Family U from the existing generic artifact kernel. Inspect the persisted Common Play schema and exact `ResolutionOperation` shapes for artifact damage, repair, relocation, and removal, then expose only the smallest reusable portable operation vocabulary required for an unknown object/link RuleModule to use those already-existing operations. Route it through the existing installed Common Play production/ResolutionEvent path and add one focused arbitrary-identity Host/Client replay, duplicate replay, fresh reconnect, and Undo proof covering object damage/repair/destruction and link lifecycle as applicable. Do not create a second artifact engine or transport, and do not infer new link/portal behavior beyond fields already owned by the artifact contract.
