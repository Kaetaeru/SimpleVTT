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

C8 Core is complete. C9 Gate N mechanism-coverage reconciliation remains active. The 36-row coverage ledger is authoritative; a row stays `INCOMPLETE` until its full required semantic/evidence matrix is satisfied. Current coverage is `IMPLEMENTED=4`, `INCOMPLETE=32`, `PROVEN_UNNEEDED=0`. `gateNBlockingNamedFallbacks` remains empty. Overall verdict: `V1 INCOMPLETE`.

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

- `566cb1e2`: reconciles the stale Family T ledger row to the already-restored authoritative zone.stay source and connected acceptance; no mechanics changed.
- UI `33275769385`, job `99162085528`, head `a614c427194a0f436a7a3763a48808155d7865f3`: connected/live-lifecycle step 17 SUCCESS for Zone effect breadth; later focused steps green; broad Phase09 inherited red and build skipped.
- UI `33276086024`, job `99162952306`, head `fda7436c5945d055d0231f9a65b8653e7b622443`: step 17 SUCCESS for authoritative spatial Zone placement replay; same inherited broad Phase09 red/build skip.
- `9c287a175cbae621662fc883406b1463277a4f55`: restored the already-accepted authoritative `zone.stay` provider ingress after a concurrent Family U refactor accidentally dropped the export/dispatch. Descendant UI run `33279041449` at `255871dbabd40bc27a6c0a210fe56fe7b6f4c126` returned connected/live-lifecycle step 17 to SUCCESS; later broad Phase09 remained the inherited red. This is affected-surface regression recovery, not a reopening of Family T.

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

## Family V audit — lifetime/reconnect/recast replacement advanced, final disposition unchanged

The arbitrary installed actor-artifact regressions reuse the existing generic artifact expiry/removal, turn-clock, ResolutionEvent, connected replay, and event-native Undo paths:

- `afa2860f55ff498929984dca2905c1bbacf9e5b5`: `connectedActorArtifactLifecycleProduction.test.ts` proves an unknown elapsed 6-second actor artifact spawns with its typed combatant, reconstructs on a fresh connected replica, expires on normal round-wrap elapsed advance, removes both artifact and projected combatant, rejects duplicate replay, reconstructs the expired state on fresh reconnect, restores artifact + combatant through event-native Undo, and reconstructs the restored state on another fresh reconnect.
- `18a66247a175eacb099b70dbf16b59ca32257089`: registers that lifecycle regression in the authoritative UI connected/live-lifecycle step.
- UI run `33277978481`, job `99167998243`, exact head `18a66247a175eacb099b70dbf16b59ca32257089`: step 17 SUCCESS including `connectedActorArtifactLifecycleProduction.test.ts` and the existing `connectedActorArtifactReconnectProduction.test.ts`; steps 18-27 also SUCCESS. Broad Phase09 step 28 remains the inherited failure and Typecheck/build step 29 is skipped, so no full-build green is claimed.
- `a8c461bad256b6344ea9a9c4bfe6f69259179f7b`: the persisted `lifetime.kind:"until-source-recast"` now composes existing generic `remove-artifact` then `spawn-artifact` operations in the same PendingResolution for matching actor artifacts from the same definition/source actor/template. No replacement-specific primitive, store, or transport was added.
- `dfe1c9c9e40e0dab7398f3d1af3c44e0168ad70f`: connected replacement acceptance proves Host replacement, Client convergence, duplicate replay idempotence, ordered reconnect, event-native Undo back to the previous actor artifact, and reconnect after Undo. Its first identity assertion incorrectly expected a Scene HP projection that this VM does not expose.
- `e29193460d922900e6769a8192f2952d693197f3`: removes only that invalid HP presentation expectation while preserving structural replacement identity checks. UI run `33279905204`, job `99173205994`, step 17 SUCCESS proves the corrected arbitrary-ID/rename replacement acceptance together with the retained actor lifecycle/reconnect suite.
- C9 reconciliation run `33279838612`, job `99173027884`, descendant head `b5ea8a45f1ea57fe1d8cf69fa1f77a1851d926cc`: `Verify TypeScript` SUCCESS with the recast replacement source in ancestry. No new exact-head full-build claim is made from that run.

This closes elapsed lifetime/despawn, connected reconnect/replay/Undo, and the explicit `until-source-recast` replacement semantic. Family V remains `INCOMPLETE`: repository authority still does not define actor-death-driven artifact removal policy, and the row's full restart persistence matrix is not yet complete. Do not guess death semantics merely to promote the row.

## Completed Family U

Family U (`object-link-artifacts`) is now `IMPLEMENTED` in the Gate N ledger.

The final ownership is deliberately single-path: object/link creation remains in `commonPlayArtifactRuntime.ts`, while source-owned lifecycle actions are authored under persisted artifact-template `grantedEntryPoints` and execute through `commonPlayArtifactLifecycleRuntime.ts` into the existing generic Resolver artifact operations. A duplicate top-level lifecycle lowering attempt was removed so there is no second artifact engine.

Retained implementation and acceptance evidence:

- `59bdb5d8de2468c4338dac4030e08dbbbac8b691`: persisted Common Play schema exposes artifact lifecycle vocabulary and template granted entry points.
- `d1c98e8cb2b66e1d5b0f78857f23f01cb8338db3`: schema-backed granted artifact lifecycle operations lower to existing generic Resolver damage/repair/relocate/update/remove artifact operations.
- `efa12bc784805e204b2189a41d4cde18f0ce6bec`: lifecycle action projection accumulates actions across multiple source-owned artifacts instead of replacing a prior artifact's actions.
- `d9385c1e1ffd670c6da1900cedc3c6f7e9756721`: connected acceptance uses authoritative resolved link endpoints rather than the pre-resolution `actor` binding token.
- `16741437419c0c80ec1da42df29aece09016eca2`: keeps lifecycle ownership on the granted-entry runtime and removes duplicate top-level lifecycle lowering.
- C9 Family U Diagnostic run `33279420876`, job `99171917300`, head `612739d4a3f1877b293cb1b4d778724ae4fd220d`: focused `connectedObjectLinkArtifactLifecycleProduction.test.ts` is 2/2 green, proving unknown object/link spawn, AC/HP/threshold/defenses, damage/repair/destruction, relocation/opaque placement, portal/link/tether relations, elapsed cleanup, Host/Client replay, duplicate handling, fresh reconnect, event-native Undo, and identity rename invariance.
- `525ac6204f4e966502654ea46393be313683f36a`: ledger promotion to `IMPLEMENTED` with implementation/production/identity/connected/persistence evidence.
- `86e9b08b3af1d2eff9965abf4010c9485809f76c`: removes the temporary promotion helper workflow after the durable ledger write.
- `9f0fb6d59bc816d037ea108f38cb34cd8f33aa41`: closes the shared turn-clock/life/effect TypeScript narrowing drift without changing mechanics. C9 Runtime Type Narrowing Fix run `33279701060`, job `99172653860`, passed the focused C9 production slices, `npx tsc --noEmit`, and `npx vite build`, then committed the verified source fix.

## Family W audit — actual production projection gap

Family W (`form-transformation-possession`) remains `INCOMPLETE`. The audit found a real production seam rather than merely missing test evidence:

- `runtimeArtifact.ts` and `commonPlayArtifactRuntime.ts` persist/validate a typed form artifact with target/controller, property overlay/retention/replacement, HP policy, action policy, spellcasting policy, action IDs, resources, and generic expiry.
- `realTurnRuntimeService.projectTurnRuntimeToScene()` currently materializes actor artifacts into live Scene/combatant state but has no corresponding form projection/restoration pass.
- `installedCommonPlayRuntimeAdapter.projectRuntimeArtifactActions()` projects actor-artifact actions plus stored-invocation/Zone controls, but does not apply form `actionPolicy` or form spellcasting/property/HP overlays to the target.
- Therefore the current production path can store and reconnect the form artifact identity but does not execute the ledger-required transformation semantics on the live target. Replacement/restoration and death/end ownership are also not defined by an existing production owner.

Do not invent a second form engine or guess replacement/death policy in an adapter. Family W stays blocked until the existing typed form contract is deliberately connected to an authoritative target projection/restoration owner with deterministic rules for HP/actions/spellcasting/property overlays and end behavior.

## Family X/Y audit — durable item source ownership gap

Families X (`items-inventory-equipment`) and Y (`attunement-magic-item`) remain `INCOMPLETE`. Their generic kernels are materially richer than the current ledger text suggests, but production portability is blocked at the durable Character source model rather than by a missing combat Resolver primitive.

- `commonPlayInventoryRuntime.ts` already owns revision-bound grant, quantity, destroy, equip, wield, charges, container validation, two-owner transfer, attunement/unattunement, prerequisites, maximum attunement count, cursed removal, benefit activation, and rule-driven attunement loss.
- `phase09RealAtomicItemAdapter.ts` plus `resolutionCharacterDurableProjection.ts` preserve current item quantity/charges through existing ResolutionEvents and Character write-back/Undo, but only by mapping `phase09:item:<id>:quantity|charges` pseudo-resources onto an already-existing item instance.
- `CharacterRuntimeDurableSnapshotV1.items` persists runtime quantity/equipped/wielded/attuned/charges for items already declared in `CharacterSourceSnapshotV1.itemReferences`; it does not own creation of new source item definitions, container topology, or the richer portable attunement policy.
- `CharacterItemSourceReferenceV1` currently retains basic definition/presentation, `attunementRequired`, charge maximum, passive effects, granted actions, and provenance, but has no generic container relationship, attunement prerequisite, curse/loss policy, or equivalent portable durable source payload.
- The Common Play schema has item selectors/payments and permits `artifactKind:"item"`, but the canonical operation vocabulary does not define durable inventory grant/equip/transfer operations, and the architecture charter explicitly says Character-durable mutations must use their correctly-owned durable transaction instead of being forced into fake combat RuntimeArtifacts.

Therefore a production adapter that merely mutates `CharacterSheet.items` or models inventory as a session artifact would violate the existing durability/source-revision boundary. X/Y need a deliberate portable durable-item source/write-back contract that joins source references and runtime item state atomically; that ownership is not currently defined, so it must not be guessed merely to promote the ledger rows.

## Family Z/AA audit — named/durable ownership blockers

Family Z (`spellcasting-meta`) remains `INCOMPLETE`. The typed component and maintained-casting kernels are reusable, but production still selects spell mechanics through `spellMechanicById(metadata.spellId)` in `productionSpellRuntimeAdapter.ts`, which is content-identity dispatch forbidden by the architecture charter. `resolveSpellComponents()` can also report consumed material components, but that output is not atomically joined to the Character-owned durable inventory transaction. Do not hide either gap behind another spell adapter.

Family AA (`progression`) remains `INCOMPLETE`. Its installed progression contributions belong to the existing ProgressionDraft/Character revision domain, while the live level-up projection still has named adapters. Do not force progression grants into a combat Resolution merely to satisfy Gate N evidence.

## Latest C9 reconciliation — authoritative Zone stay

- Family T (zones) is now ledger `IMPLEMENTED`: `connectedSpatialZoneStayProduction.test.ts` proves an explicit provider-authored stay fact through the canonical Zone resolution with Host/Client convergence, duplicate replay, reconnect, and Undo; Core still does not infer geometry.
- Focused stay test and `tsc --noEmit` pass on the reconciliation head.
- Actual ledger coverage is now `IMPLEMENTED=3`, `INCOMPLETE=33`, `PROVEN_UNNEEDED=0`; `gateNBlockingNamedFallbacks` remains empty.
- Family AB final availability/consumption acceptance is now closed by `0537062111c91c4af898802b27ab4a5d1e3cac17`: the recharged actor Action spends both its Action and recovered charge atomically, gates availability at zero, converges on Client, is duplicate-idempotent, reconstructs on reconnect, and restores through event-native Undo. UI run `33280926167`, job `99175842905`, step 17 SUCCESS; the later broad Phase09 step remains inherited red.

## Completed Family AB

Family AB (`recharge-cooldown`) is now `IMPLEMENTED`. Commit `496b23076958aecdd9e3a15a1938419198a53ba3` adds persisted portable `resource.recharge` vocabulary and lowers it to the existing generic `recharge-resource` Resolver operation. Actor-owned turn-start rules receive exactly one authoritative die face from the existing runtime die authority inside the same end-turn/begin-turn transaction; no monster-specific engine, store, transport, or identity dispatch was added.

Retained acceptance evidence:

- C9 Recharge Production Slice run `33280246505`, job `99174086720`: patch/generate, focused `connectedActorTurnRuleProduction.test.ts`, and `npx tsc --noEmit` all SUCCESS; the workflow committed verified source as `496b23076958aecdd9e3a15a1938419198a53ba3`.
- The focused Recharge test retains arbitrary external identity rename invariance, Host/Client convergence, duplicate replay idempotence, fresh reconnect, and event-native Undo.
- Existing actor-artifact action execution evidence (`281be9b1`) supplies the separate action/resource-consumption side of the Recharge availability model; the Recharge rule only restores the shared actor resource.
- Installed Common Play persistence/rehydration authority from PR #159 remains unchanged; `resource.recharge` is schema-backed persisted mechanic data, not an adapter-only shape.

Family P remains `INCOMPLETE`, but its prior "portable Recharge policy/die authority" blocker is now closed by Family AB. Its other undefined event-vocabulary/order seams remain and must not be guessed.

## Family AC audit — authority contract gap

Family AC (`legendary-lair-special-timing`) remains `INCOMPLETE`: the kernel compiles owner/timing/option/cost, but the persisted Common Play contract has no portable special-action timing definition and live TurnRuntime has no authoritative after-turn/initiative-count event, refresh/order policy, connected owner interaction, or persistence owner. No production policy was invented.

## Family AD audit — authority contract gap

Family AD (`mount-vehicle-controller`) remains `INCOMPLETE` after repository-authority audit. The existing mount kernel and artifact primitives are insufficient to claim a production mount/vehicle composition.

- `commonPlayMountRuntime.ts` validates rider/mount/controller identities, size, mode, movement cost, controlled action IDs, and a pure fall-off/Prone outcome.
- `runtimeArtifact.ts` separately supplies actor controller/initiative plus object HP/AC/damage-threshold/repair and generic link primitives, but none of those contracts defines a rider-mount relationship or mounted-combat ownership.
- `schemas/common-play-contract.schema.json` has no persisted mount/vehicle relationship vocabulary, and `realTurnRuntimeService.ts` has no live mount topology owner.
- Mount/dismount cost, controlled action/initiative substitution, independent mount behavior, fall-off save dispatch, capacity, drawn-vehicle crew/speed, reconnect, and durable persistence are therefore not repository-defined production semantics.
- No AD production source was changed. Coverage remains `IMPLEMENTED=4`, `INCOMPLETE=32`, `PROVEN_UNNEEDED=0`; `gateNBlockingNamedFallbacks` remains empty.

## Family AE audit — durable exposure clock owner missing

Family AE (`hazards-exposure-environment`) remains `INCOMPLETE`. The exposure/environment code is kernel-only: exposure owns a revision-bound local elapsed counter and environment helpers calculate fall/movement/attack/defense results, while authoritative `RuntimeClock` is combat/session round+elapsed time. The persisted Common Play contract and production session do not define durable exposure state, campaign-time ownership, periodic threshold dispatch into saves/damage/Effects, recovery persistence, or reconnect reconstruction. Reusing combat elapsed time as campaign exposure time would invent lifetime policy forbidden by the charter.

## Family AF audit — underwater environment activation owner missing

Family AF (`underwater-special-environment`) remains `INCOMPLETE`. `commonPlayEnvironmentRuntime.ts` already evaluates profile-driven movement, attack restrictions/disadvantage, and damage defenses, but no persisted Common Play/session contract owns which environment profile is active for a subject or scene. Production has no caller for these helpers, and breathing/suffocation depends on the unresolved durable exposure owner from Family AE. Applying the underwater profile implicitly would fabricate session state and persistence semantics.

## Family AG audit — standard action dependencies remain

Family AG (`standard-actions`) remains `INCOMPLETE`. Most standard actions are already structural production projections: Attack uses authored attack facts; Dash uses movement budget; Disengage/Dodge/Help use status/effect facts; Hide/Influence/Search/Study use generic d20 checks; Utilize uses generic no-roll completion. However built-in Ready still routes through `action.standard.ready`/`READY_TRIGGER_ID` compatibility logic in `standardActionReactionAdapter.ts`, and Magic enters the Family Z spell path that still uses `spellMechanicById`. Installed arbitrary Ready has generic stored-invocation evidence, but those remaining production identity/dependency seams prevent family-wide final disposition.

## Family AH audit — durable project/output owner missing

Family AH (`tools-crafting-projects`) remains `INCOMPLETE`. `commonPlayProjectRuntime.ts` is a revision-safe work/payment threshold kernel only. It does not own contributors, prerequisites, daily validation, cancellation, completion outputs, persistence, or item creation/write-back, and the Common Play schema has no portable project definition. Production has no durable project repository/transaction; completion outputs also depend on the unresolved X/Y durable item source boundary. Do not model a multi-day project as a combat RuntimeArtifact merely to satisfy coverage.

## Family AI audit — durable capacity source facts missing

Family AI (`carrying-capacity-cargo`) remains `INCOMPLETE`. Generic expressions can derive a number only after authoritative inputs exist, but current portable/source contracts do not own item weight, container capacity, carrying/cargo capacity, or mutation-time enforcement. Vehicle cargo depends on unresolved Family AD topology and item/container constraints depend on unresolved Families X/Y durable source ownership. Adding a standalone capacity formula would not satisfy production authority and would fabricate missing source facts.

## Next Exact Action

Audit Family AJ (`authority-persistence-ownership`) only as a cross-family acceptance row: reconcile which ownership/retry/reconnect/Undo patterns are already proven and list the still-blocking families whose durable/session owners remain undefined. Do not mark AJ final while any required family still lacks its correct transaction owner. After AJ reconciliation, return to the earliest non-authority-blocked incomplete family from the ledger and implement the smallest actual semantic/evidence gap rather than continuing audit-only work.
