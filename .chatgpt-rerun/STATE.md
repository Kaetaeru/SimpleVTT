# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `6`
- task_id: `v1-common-play-c8-rerun`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/c9-gate-n-coverage-reconciliation`
- product integration target: `work/v1-composite`
- product plan: `docs/rules/resolver-execution-checklist-v2.md`
- checkpointed_at: `2026-08-30 Asia/Seoul`

## Durable checkpoint

C8 Core boundaries 1-4 are complete in the local convergence stack.

- PR #178: portable interceptor lowering, merged as `fc6a45fb7905790ea01c947d39af5ab15f02f668`.
- PR #179: production/session discovery and responder authority, merged as `8278036108d48084666ea79a9d506ed681ee15bf` from exact candidate `623ce5f0c577cc8fce7c9bd540077195e88a139e`.

PR #179 exact-head evidence:

- M1 Common Play Interaction workflow `33249665899`: SUCCESS;
- Rules Domain workflow `33249665907`: SUCCESS;
- local focused workflow including the atomic-attack regression: 79/79 passed;
- local TypeScript `tsc --noEmit`: passed;
- PR diff: seven bounded files; mergeability true; boundary-1 ancestry confirmed.

Broad Contract/Resource/Phase/UI reds remain inherited workflow failures and were not required for this boundary. Do not repeat PR #176-#179 validation unless their affected surfaces change.

Boundary 3/4 local evidence:

- authoritative interceptor facts: 26 focused schema/domain/production checks plus 4 connected authority checks passed;
- damage-roll and final acceptance: exact M1 Common Play Interaction 87/87 passed;
- connected/fact/atomic-attack focused regression 45/45 passed;
- TypeScript `tsc --noEmit` passed.

## Active boundary

C9 Gate N coverage implementation. The complete 36-row audit remains the authority; a row stays `INCOMPLETE` until its required semantic/evidence matrix is complete.

Current validated C9 checkpoints:

- `7be5c795`: actor artifact creates/removes typed combatants and projects Scene/Host/Client/expiry/Undo lifecycle;
- `583ff38c`: generic Common Play payments atomically spend Action, Bonus Action, or Reaction with production Undo;
- `281be9b1`: summoned actors project scoped installed Common Play actions and execute them through Host-authoritative connected events with Undo.
- `acc46a1a`: schema PaymentContract is preserved and atomically executed across operations, save-damage, effect, zone, and artifact lowerers with production Host/Client convergence and Undo.
- `c87402f9`: canonical stored-invocation artifacts resolve arbitrary installed attack/spell payloads off turn with Reaction, exactly-once consumption, Host/Client event replay, reconnect, and Undo.
- `5308c15e`: movement.relocate executes through the operations lowerer and stored invocation; Ready UI uses the authoritative artifact for installed content; cancel, Undo, and turn-boundary expiry are production-proven.
- `50498ba6`: held-Concentration loss/release/cancel/Undo is production-proven and Family S stored-invocation-ready is promoted to `IMPLEMENTED`.
- `458585cf`: installed damage.taken rules are structurally discovered and appended to the originating Resolver transaction with atomic effect consumption, connected replay/reconnect, and Undo.
- `b659b063`: arbitrary installed Zone artifacts project manual enter/leave actions and commit membership, enter damage/frequency, Host/Client replay, reconnect, and Undo through the canonical Zone runtime.
- `641c00fe`: installed Zone turn-start/end operations are composed into the same authoritative end-turn/begin-turn PendingResolution rather than a second mechanical commit.
- `fbcee3c6`: begin-turn, end-turn, and advance-time emit canonical `turn-clock` StateChanges; event-native apply/replay and Undo both read and restore exact RuntimeClock snapshots. The focused clock Undo regression passes.
- `b4b5fc5e`: the exact `ResolutionEvent[]` returned by `advanceTurnRuntimeLifecycle` is retained without recomputation and carried on the existing connected `mode-transition` payload; no Zone-specific side channel or second mechanical commit is introduced.
- `4b5f40b8`: the connected Zone turn acceptance test was corrected to assert canonical HP + Temporary HP damage rather than treating Temporary HP absorption as missing damage.
- `64a1ff5d`: turn lifecycle events are registered in the existing `runtimeResolutionEventHistory`/`lastResolutionId` authority instead of maintaining a competing snapshot Undo path. The final generic event-native Undo owner restores Host runtime state, and the connected turn wrapper publishes the same inverse ResolutionEvents as a `resolution-undo` event.
- `0426859e`: shared connected Undo provenance preserves its literal `applied` type; this removes the TypeScript widening error observed at `64a1ff5d`.
- `91a7dc94`: normal initiative progression now advances the generic elapsed runtime clock by 6 seconds only when initiative wraps to a new D&D round. The generic `advance-time` operation is inserted in the same authoritative PendingResolution after turn-end Zone operations and before begin-turn, so elapsed artifact expiry/cleanup is event-native rather than a Zone-specific timer.
- `72a2c7fd`: production connected acceptance proves a 6-second arbitrary installed elapsed Zone expires on round wrap, removes its artifact and membership, converges on Host/Client, remains duplicate-idempotent, reconstructs on ordered reconnect, and restores exact clock/artifact/membership state through event-native Undo.
- `5bea7af`: Families P/T in the Gate N coverage ledger were reconciled to the already-proven automatic Zone turn-start/end and elapsed-duration cleanup evidence without promotion. The commit changes only `docs/rules/v1-mechanism-coverage-ledger.json`; stale automatic-dispatch/full-duration-cleanup seams were removed while real remaining seams were retained.

Verification for the Zone turn lifecycle and duration slice:

- UI workflow `33270194527` at `64a1ff5d14248273320f6b645bc6214e1dc1a31d`, step 17: SUCCESS. The exact production regression `arbitrary installed Zone turn-end and next turn-start converge through one connected transaction, reconnect, and Undo` passed.
- That regression proves arbitrary installed identity, automatic `zone.turn-end` and next `zone.turn-start` composition inside one authoritative turn transaction, canonical once-per-turn frequency metadata, Host/Client convergence, duplicate replay idempotence, ordered reconnect replay, and event-native Undo.
- UI workflow `33270308747` at `0426859e1b73bb50dba40b0de36defa5d1fd3366`, step 17: SUCCESS again after the provenance typing fix.
- UI workflow `33270906900` at exact code/test head `72a2c7fd67890d1dee3452f0d194f7370535fe7f`, step 17: SUCCESS, 32/32. The new regression `elapsed Zone duration expires on round wrap and restores through connected Undo` passed together with the prior turn-event transport and arbitrary Zone turn-start/end regressions.
- Exact-head `33270906900` still fails the broad Phase09 step at 106/118 with the same deterministic-dice, runtime-revision, and legacy-provenance expectation mismatches observed before this duration change; Typecheck/build is therefore skipped by workflow fail-fast and is not claimed green.
- The most recent Rules Domain run available before this duration slice (`33270194519` at `64a1ff5d`) had all 440 domain tests green and Phase09 compatibility 113/113 green, but correctly failed Gate N coverage (`IMPLEMENTED=1`, `INCOMPLETE=35`) and reducer projection drift (100 expected projected rows versus 98 checked in).
- No GitHub Actions workflow was created for docs-only ledger commit `5bea7af`; its verification is therefore limited to the GitHub commit diff, which shows only the intended P/T ledger reconciliation. No checker-green claim is made for that head.

Coverage remains `IMPLEMENTED=1`, `INCOMPLETE=35`, `PROVEN_UNNEEDED=0`. Family P still lacks its remaining event-family/frequency matrix. Family T now accurately records automatic turn dispatch and elapsed cleanup as proven, but still lacks spatial-provider membership production plus stay/effect breadth and named aura/zone migration.

Spatial membership investigation after `5bea7af` found a concrete contract gap rather than merely missing evidence:

- `commonPlayZoneRuntime.ts` supports `ZoneMembershipAuthority = manual | spatial`, but installed production activation and membership resolution currently hardcode `manual`.
- `spatialRuntimeContracts.ts` already accepts authoritative pairwise distance/visibility/cover facts from an external module and the attack path consumes them, but a Zone template currently carries no geometry/radius and that relation does not authoritatively state Zone inside/outside membership.
- Therefore Core must not infer Zone membership from pairwise distance. Doing so would fabricate a spatial fact and violate the architecture charter's unknown-fact rule.
- The smallest valid next seam is an explicit provider-supplied Zone membership fact/command (`artifactId`, `subjectId`, `present`, provenance) routed into the existing `resolveCommonPlayZoneMembershipChange(... authority: "spatial")` transaction. It should reuse the existing connected ResolutionEvent/replay/Undo path and must not create a second geometry engine or Zone-specific network protocol.

## Next Exact Action

Implement the explicit authoritative spatial-Zone membership production seam described above: allow an external spatial module to submit an inside/outside membership fact for an installed Zone, route it through the existing Common Play Zone membership transaction with `authority: "spatial"`, do not project manual enter/leave controls for spatial-authority artifacts, and prove arbitrary identity plus Host/Client replay, reconnect, duplicate idempotence, and Undo. Only after that evidence exists should Family T's spatial-membership seam be removed; then continue to T stay/effect breadth or the next Family P event dispatcher. Do not infer geometry from `spatialByPair`, and do not repeat validated turn/duration work.

C8 Core is complete. C9 remains active and Gate N remains blocked by 35 `INCOMPLETE` coverage rows. Overall verdict: `V1 INCOMPLETE`.
