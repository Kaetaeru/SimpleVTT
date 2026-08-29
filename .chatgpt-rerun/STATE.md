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

## Current execution checkpoint

The previously identified spatial-Zone contract gap is now implemented and production-proven without adding geometry inference or a Zone-specific connected protocol.

Source/test commits on this branch:

- `34358920`: added `src/app/spatialZoneMembershipRuntimeAdapter.ts`, an explicit trusted external spatial-provider ingress.
- `742e5c70`: installed that wrapper immediately outside `installedCommonPlayRuntimeAdapter` in canonical offline composition.
- `d8e72006`: retained exact installed Zone entry-point identity through spatial activation.
- `ce09f959`: added `tests/ui/connectedSpatialZoneMembershipProduction.test.ts`.
- `2ed2ff8d`: registered the focused spatial acceptance in the existing UI connected/live-lifecycle workflow step.

The seam is deliberately bounded:

- an external spatial module explicitly registers for a Host adapter;
- installed Zone activation then records membership authority as `spatial` instead of fabricating geometry in Core;
- provider facts carry `artifactId`, `subjectId`, `present`, and provenance;
- facts route through existing `resolveCommonPlayZoneMembershipChange(... authority: "spatial")` and `commitProductionRuntimeResolution`;
- standard connected `resolution` payloads carry the exact canonical ResolutionEvents; there is no Zone-specific network message;
- a Client cannot manufacture a provider fact by action ID alone because Host accepts only a matching Host-local pending provider fact;
- manual enter/leave controls are removed from presentation for artifacts whose membership authority is `spatial`.

Exact verification:

- UI workflow `33273491509`, job `99156065770`, exact code/test head `2ed2ff8d395c2171220a92eca4e3ee2878646ede`.
- Connected/live-lifecycle step 17: SUCCESS, 33/33 tests passed.
- New regression `authoritative external spatial Zone membership converges through canonical connected events and Undo`: PASS.
- The regression proves arbitrary unknown installed identity, `spatial` authority on the Zone membership state, no manual membership controls, provider provenance in the standard connected resolution payload, canonical `zone-membership` StateChange, `zone.entered` damage in the same transaction, Host/Client convergence, duplicate replay idempotence, fresh reconnect reconstruction, and event-native Undo.
- Existing turn-start/end and elapsed-duration Zone regressions also remained green in the same 33/33 connected step.
- Authoritative spellcasting step 27: SUCCESS, 5/5.
- Broad Phase09 step 28 remains an inherited failure at 106/118 with the same deterministic-dice/runtime-revision/legacy-provenance expectation mismatches seen before this spatial change. Typecheck/build step 29 was skipped by fail-fast and is not claimed green.

Coverage ledger is still `IMPLEMENTED=1`, `INCOMPLETE=35`, `PROVEN_UNNEEDED=0` because the ledger row itself has not yet been rewritten for this new proof and many independent families remain incomplete. Family T must remain `INCOMPLETE`: the spatial-provider membership production seam is now resolved, but `stay/effect breadth` and named persistent aura/zone migration remain real work. Family P also still lacks its remaining event-family/frequency matrix.

Gate N remains blocked. Overall verdict: `V1 INCOMPLETE`.

## Next Exact Action

Reconcile Family T in `docs/rules/v1-mechanism-coverage-ledger.json` with the exact spatial-provider evidence above: add `spatialZoneMembershipRuntimeAdapter.ts` and `connectedSpatialZoneMembershipProduction.test.ts` to the applicable evidence arrays and remove only the stale `spatial provider membership production` seam. Do **not** promote Family T. Then inspect the minimum source/authority needed to close the next real Family T gap (`stay/effect breadth`) or, if the ledger/checklist makes it higher priority, the remaining Family P generic event-family dispatcher. Do not repeat validated manual membership, turn-start/end, elapsed-duration, connected replay, reconnect, or Undo work; do not infer Zone membership from pairwise spatial facts.