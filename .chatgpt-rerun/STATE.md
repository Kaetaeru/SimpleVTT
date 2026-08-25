# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to preserve: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- canonical head reconciled this slice: `bde75ed8bbe68959765935d199c2685446c2c0f7`
- active work branch: `codex/v1-barbarian-rage`
- active issue: `#124` — R1 Barbarian Rage lifecycle
- active draft PR: `#125`
- verified product head: `d31a26302f1469b2edbb3b4d1b2c939ec840f7e9`
- PLAN coordination commit written immediately before this STATE update: `49ee79567cce6a8205e1ad2e74de5e19af5743e5`
- checkpointed_at: `2026-08-26T02:39:46+09:00`

## Resume source of truth

Mandatory Rerun preflight was performed in the required order for this slice:

`.chatgpt-rerun/README.md -> control.json -> STATE.md -> PLAN.md`

Then canonical root, current V1 handoff, release checklist, actual branch/PR state, relevant design contracts, and CI were reconciled. The canonical Rerun files on `work/v1-composite` still describe an older V1-13 checkpoint; the active PR branch state is newer and authoritative for unfinished R1 work.

Do not repeat previously validated V1-13, Indomitable, Rage domain foundation, or Rage attack-damage integration.

## Work completed in this slice

### Production attack snapshot regression

- The earlier regression failure was traced to a test-only wrong action ID assumption, not a product defect.
- Real Aelar Longsword uses `action.longsword`; the test was corrected to that canonical ID.
- The existing product adapter already used `ItemInstanceVm.definitionId`; no duplicate product fix was made.
- The production snapshot regression now proves `attackAbility: str` plus Rage Damage metadata on the real production path and is GREEN.

### Local player-facing Rage Session action

A deterministic RED was added to `tests/ui/barbarianRageRuntimeAdapter.test.ts` and observed in CI before implementation: the production Session had no `action.barbarian.rage` projection.

The minimum production adapter was then added and installed in canonical offline composition:

- `src/app/barbarianRageActionRuntimeAdapter.ts`
- `src/app/offlineRuntimeAdapters.ts`

The adapter reuses the existing authoritative pipeline:

`domain Rage resolver -> ResolutionEvents -> event apply -> Character write-back -> turn-runtime commit -> Activity projection -> runtime event history/Undo`

It does not add a second rules engine, persistence schema, or voluntary Rage-end API.

Verified local behavior at `d31a263`:

- Freeform: Rage appears as a self Bonus Action presentation, spends one canonical Rage use, creates a committed resolution and Activity entry, and Undo restores the Resource.
- Initiative: Rage consumes the authoritative Bonus Action and one Rage use; while active, a second start is unavailable; Undo restores Bonus Action, Rage Resource, and availability.
- Heavy Armor start gating uses the existing equipment `armor-definition.training === heavy` fact.
- Activity expectation follows the existing canonical projector (`격노 → Aelar`) rather than inventing a Rage-specific title format.
- Existing Rage termination remains domain-owned. The current SRD 5.2.1 regression explicitly forbids a voluntary `resolveBarbarianRageEnd` API.

## Verification evidence

For product head `d31a26302f1469b2edbb3b4d1b2c939ec840f7e9`:

- UI run `32879026250`: **success**.
  - focused production/local Rage Session tests: success.
  - production weapon Rage projection regression: success.
  - all preceding/following UI groups: success.
  - TypeScript + production build: success.
- Contract validation run `32879026270`: **success**.
- Rules Domain run `32879026373`: **success**.
- Phase 11 Playable run `32879026268`: was still `in_progress` at the last pre-checkpoint read.
- Phase 12 Connected Session run `32879026318`: was still `in_progress` at the last pre-checkpoint read.

A future resume must re-fetch current workflow conclusions instead of assuming those two in-progress runs completed successfully.

## Current unfinished point / Next Exact Action

R1 local Session acceptance is now checkpointed. The next unfinished boundary is **connected remote-owner Rage exactly-once/reconnect/Undo**.

1. Re-fetch PR `#125`, latest branch head, and CI conclusions. GitHub state wins this checkpoint if it advanced.
2. Add one minimal deterministic RED to the existing connected Session tests for a saved remote-owner Barbarian invoking `action.barbarian.rage`.
3. The regression must prove owner authorization and host authority, exactly one Rage Resource spend/authoritative commit, committed effect/Activity continuity through reconnect, and one event-native Undo restoring the transaction without duplicate history.
4. Reuse the existing connected ActionRequest/session projection/event-history path; do not create a Rage-specific transport or duplicate mechanics state.
5. After connected GREEN and related Phase 12 regression, evaluate whether any explicit R1 acceptance gap remains before closing Rage and moving to Wild Shape.

Keep PR `#125` draft until the full Rage R1 acceptance boundary is satisfied.
