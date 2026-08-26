# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T19:14:00+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live state remained authoritative during concurrent branch movement. `PLAN.md` is unchanged.

Do not repeat validated R1 work without direct regression evidence: Rage, Wild Shape, Monk Focus, Rogue Cunning Action/Uncanny Dodge, Berserker Intimidating Presence, Open Hand Wholeness of Body, Open Hand Fleet Step, Devotion Holy Nimbus, Open Hand Quivering Palm supported path, Devotion Smite of Protection, Fiend Dark One's Own Luck, College of Lore Peerless Skill, College of Lore Cutting Words, and the passive Berserker Mindless Rage production integration described below.

## College of Lore Cutting Words — R1 execution-validated

Cutting Words has a mechanics-complete production path for the R1 scope: another creature's ability check, attack roll, and staged attack damage; Bardic Inspiration/Reaction economy; Activity; level gate; queued damage modifier preservation; and event-native Undo. The implementation reuses the existing Bardic Inspiration/domain/atomic attack machinery instead of adding a parallel resolution engine.

Important live commits in the final reconciliation chain:

- `aaa23862dc1d90b438d98e5722ad273f55900eb7`: stages Cutting Words before authoritative atomic damage build and reuses the sanctioned staged preview/rebuild seam.
- `d39d599c60d8499028e0cff25ab34358f15ca6aa`: production spell router delegates already-present non-spell runtime actions before taking a snapshot, preventing transient non-spell ability checks from being erased.
- `90514e44a21840070bb77ea17561036a86b2e5ca`: removes the concurrent current-actor action-priority regression that broke connected projected Character inventory actions while preserving the spell-router fix.
- `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`: removes temporary Cutting Words diagnostic workflow steps only; no product code change from `90514e4`.

Exact execution evidence:

- Product checkpoint `90514e44a21840070bb77ea17561036a86b2e5ca`:
  - UI run `32960806646` / frontend job `98152495174`: **success**. Cutting Words ability-check, attack-roll, staged-damage, below-level focused slices and `Typecheck and build` all green.
  - Phase 12 Connected Session run `32960806633` / connected-protocol job `98152494916`: **success**.
- Workflow-cleanup head `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`:
  - UI run `32961013657` / frontend job `98153136326`: **success**.

Do not reapply the reverted current-actor action-priority experiment. Shared staged-damage invariants remain queued-modifier preservation, authoritative dice preservation, single Character write-back/event history, and event-native Undo.

## Canonical sync status

Canonical docs are synchronized with validated Cutting Words:

- `.agents/V1_CURRENT_HANDOFF.md`: commit `b21d814035317921292502f3800a199a47cfead7`.
- `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`: commit `1e56353c11619ce82de2facfc1d912fdb7e2fcc1`.

The later inventory audit is durable in STATE but is not yet recorded as canonical R1 closure.

## R1 subclass resolver inventory — exhausted for honest action-bar projection

The live SRD subclass domain inventory was reconciled after Cutting Words. No additional standalone mechanics-complete subclass action remains that can be honestly projected through the current production `resolveAction(actionId,targetIds)` surface without inventing inputs or converting passive/trigger mechanics into fake buttons.

Inventory result:

- Berserker: completed Intimidating Presence; `Retaliation` requires an explicit melee weapon/Unarmed Strike choice. Mindless Rage is passive, not an action-bar candidate.
- College of Lore: Peerless Skill and Cutting Words are execution-validated.
- Life Domain: `Preserve Life` requires explicit per-target healing allocations; remaining healing wrappers are automatic mechanics.
- Circle of the Land: `Land's Aid` requires an authoritative point plus damage/healing target sets and results; no simple targetIds-only projection is honest.
- Champion: remaining resolver surface is critical-range/critical-movement contribution, not a standalone action.
- Open Hand: supported Wholeness/Fleet Step/Quivering Palm R1 paths are validated; unsupported attack-replacement input remains intentionally unexposed.
- Devotion: Holy Nimbus and Smite of Protection are validated; Aura of Devotion is passive.
- Hunter: Defensive Tactics is a rest-time choice; Escape the Horde/Multiattack Defense are roll-state triggers; Superior Hunter's Prey is automatic; Superior Hunter's Defense is a damage reaction.
- Thief: Supreme Sneak is passive, Use Magic Device is item/scroll runtime behavior, and Thief's Reflexes is initiative behavior.
- Draconic Sorcery: current domain mechanics are passive/spell integrations; no mechanics-complete standalone action resolver exists for Dragon Wings/Dragon Companion.
- Fiend: Dark One's Own Luck is validated; Fiendish Resilience is a rest-time damage-type choice and Hurl Through Hell is an on-hit trigger/recovery path.
- Evocation: current live domain source is progression/spell integration; no standalone subclass action resolver is present.

R1 source/execution action-matrix conclusion: the final unchecked subclass-inventory item is an **inventory exhaustion result**, not a missing action implementation. `V1-21 Complete local play loop` remains PARTIAL because Windows/human/durable journey acceptance is broader than R1 source/execution completion.

## Berserker Mindless Rage — passive production integration execution-validated

During reconciliation, live source confirmed a real passive production gap even though Mindless Rage is not an action-bar candidate. The domain mechanics and domain tests already existed, so no second implementation or fake button was added.

- `8bbd21a0ff4b20bef4c0232f175785c5f7633312`: `barbarianRageRuntimeAdapter.ts` composes existing core Rage operations with `compileBerserkerMindlessRageStart` into **one atomic PendingResolution** for Berserker 6+. This preserves one revision increment and one event-native Undo history instead of attempting two sequential runtime commits.
- The automatic Rage start removes existing Charmed/Frightened effects and applies the existing `condition-immunity:charmed` / `condition-immunity:frightened` marker linked to the `barbarian-rage` special duration. Existing Rage termination removes the linked marker; no new End Rage surface was added.
- `b82e9048618ab3c105f2f99e148d2e5d2198c5dc`: adds one focused Berserker production regression to the already-build-gated `barbarianBerserkerIntimidatingPresenceRuntime.test.ts`; no package/build wiring change was needed.
- Focused production evidence verifies condition cleanup, immunity marker projection, Activity state-change evidence, one-call event-native Undo restoring prior conditions, and Rage-end lifecycle removal.

Exact-head evidence at `b82e9048618ab3c105f2f99e148d2e5d2198c5dc`:

- UI run `32961779455` / frontend job `98155486715`: **success**, including `Typecheck and build` and existing `test:berserker-presence` build gate containing the new focused case.
- Phase 12 Connected Session run `32961779556` / connected-protocol job `98155487334`: **success**.
- `windows-connected-playable` is R3 packaging/acceptance debt and is not required for this R1/source checkpoint.

This passive closure does **not** reopen or change the action-bar inventory exhaustion conclusion. It is additional source/execution coverage discovered during the same inventory reconciliation.

## Inventory exclusions

- Life Domain `Preserve Life`: requires explicit per-target allocation; no auto-allocation.
- Circle of the Land `Land's Aid`: requires richer point/multi-result input; no fake simple button.
- Berserker `Retaliation`: requires player choice of melee weapon/Unarmed Strike; do not auto-select an attack.
- Passive, rest-choice, item-runtime, automatic trigger, and reaction-only subclass mechanics are not converted into dead or misleading action-bar buttons merely to exhaust the list.
- R2 remote-owner exactly-once/reconnect/event-native Undo work starts only after canonical R1 closure.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer than this checkpoint.
2. Do not rerun Cutting Words, Mindless Rage, or earlier validated R1 mechanics without direct regression evidence.
3. Record the exhausted 12-subclass action-bar inventory in `.agents/V1_CURRENT_HANDOFF.md`: check the subclass-action umbrella and inventory-exhaustion item, check the completed local/freeform/initiative/Activity/Undo umbrella, and state that richer-choice/passive/trigger mechanics remain unexposed rather than faked. Record Mindless Rage `b82e9048` only as an additional passive production checkpoint, not as an action-bar requirement.
4. Update `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` R1 evidence to the same conclusion while keeping `V1-21` PARTIAL; do not promote release DONE from source-only evidence.
5. After canonical R1 closure, route Next Exact Action to R2 connected remote-owner matrix. Do not implement R2 before that canonical handoff change.
6. `PLAN.md` remains unchanged. After canonical writes, update `STATE.md` and `control.json` last; `control.json` remains `continue` until the sequence itself reaches a waiting status.
