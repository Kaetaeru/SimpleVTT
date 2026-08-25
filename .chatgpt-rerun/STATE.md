# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T08:26:45+09:00`

## Durable execution checkpoint

Rerun preflight completed in the mandatory order and canonical V1 routing was followed. Current run/sequence/task identity remains consistent and authorized by `control.json=continue`.

Previously checkpointed Rage work remains preserved and must not be repeated:

- existing Rage resource/Berserker mechanics, start/end domain primitives, Bonus Action start economy, Heavy-armor start rejection, duplicate rejection, B/P/S resistance, Rage Damage scaling and linked-effect cleanup;
- Strength ability-check/saving-throw Advantage;
- authoritative Strength weapon/unarmed Rage Damage without Dexterity or Wild Shape leakage;
- starting Rage ends Concentration;
- production Rage start action with resource/economy, Activity/Undo, authoritative armor check, and visible active projection;
- Rage spellcasting prohibition at `compileSpellCast` from `1e23038fe314b109eaecef75aeca8e67c2462ccf`, with regression in `tests/domain/spellcastingKernel.test.ts`;
- voluntary production `End Rage` was intentionally rejected as legacy behavior and must not be reintroduced.

New progress in this execution:

- `src/domain/barbarianRageLifecycle.ts` now owns the minimal SRD 5.2.1 Rage timing facts without adding a parallel manager: initial end-of-next-turn deadline, per-turn extension deadline, and 10-minute/100-round maximum.
- `src/domain/barbarianRage.ts` reuses those facts for Rage start and adds the dedicated `resolveBarbarianRageExtend` Bonus Action path. Arbitrary Bonus Actions do not extend Rage.
- `src/domain/resolutionActionOps.ts` extends active Rage on the Barbarian's own turn when the shared D20 path executes an attack roll against an enemy or a saving throw forced on an enemy. Roll success is not required.
- `src/domain/resolutionTurnOps.ts` composes Rage special expiry with the existing turn/time effect expiry path so the core marker and Rage-linked effects end together.
- `src/app/barbarianRageRuntimeAdapter.ts` exposes `action.barbarian.rage.extend` only for active Rage and uses the existing resolution/activity/Undo pipeline. It also wraps the existing authoritative `toggleItemEquipped` mutation so donning Heavy armor automatically removes Rage and linked transient effects. This automatic equipment consequence is not exposed as a separate voluntary End Rage/Undo action.
- Existing Incapacitated/dead termination is reused; Berserker Mindless Rage already carries the same creature-state termination and `barbarian-rage` special duration.
- `tests/domain/barbarianRage.test.ts` adds deterministic coverage for initial duration, attack/save extension, dedicated Bonus Action extension, and 10-minute maximum expiry.
- `tests/ui/barbarianRageActionRuntime.test.ts` adds production coverage for extension action/resource economy and Heavy armor automatic termination, and explicitly guards against a voluntary End Rage action.
- Product source/test head is `b939f892e80b1c37b97ad23b65204d5665ea4739`.
- GitHub compare from prior Rerun head `6cf2b31007d9a0e87dd5e47746a4352dfd088228` to `b939f892` is ahead 8 / behind 0. Final product delta contains only seven intended Rage paths: `src/domain/barbarianRageLifecycle.ts`, `src/domain/barbarianRage.ts`, `src/domain/resolutionActionOps.ts`, `src/domain/resolutionTurnOps.ts`, `src/app/barbarianRageRuntimeAdapter.ts`, `tests/domain/barbarianRage.test.ts`, and `tests/ui/barbarianRageActionRuntime.test.ts`.
- `.agents/V1_CURRENT_HANDOFF.md` was advanced in `fdf1bd4a84112a00b31637d08c6988fb6620b09a`: Barbarian Rage is now source-complete and the canonical next R1 implementation item is Druid Wild Shape.

Validation status:

- A current container check still fails at `git ls-remote` with `Could not resolve host: github.com`; no local checkout exists in the runtime.
- GitHub combined status for `b939f892` returned no status checks and workflow lookup returned no workflow runs.
- Therefore no new green test/build claim is made for the Rage lifecycle increment. Historical validated matrices remain preserved and were not repeated.
- The new Rage tests are committed as deterministic validation debt for the next capable checkout/full regression. Source-complete does not mean release DONE.

## Next Exact Action

Resume from `.agents/V1_CURRENT_HANDOFF.md` section `5. Next exact action`. The canonical next implementation item is the existing Druid Wild Shape lifecycle gap. Inspect current Druid/Wild Shape primitives first, credit already implemented behavior, and implement only missing production lifecycle pieces. Do not reimplement Rage.

Keep the same run/sequence/task on `continue` while normal implementation progress remains possible.
