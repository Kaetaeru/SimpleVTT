# Rerun Plan — SimpleVTT

## Project coordinates

- Repository: `Kaetaeru/SimpleVTT`
- Canonical target branch: `work/v1-composite`
- Control path: `.chatgpt-rerun/control.json`
- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch: `continue`

## Active V1 planning authority

After the mandatory Rerun read order (`README.md -> control.json -> STATE.md -> PLAN.md`), read and reconcile the current V1 planning sources with actual GitHub state. `.agents/V1_CURRENT_HANDOFF.md` is the active execution pointer and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` is the broader acceptance contract. Actual branch/PR state wins stale embedded SHA or prose.

Do not replay previously validated V1-13, Indomitable, or already-GREEN Rage domain/attack work.

## Current active slice

Canonical sequence remains **R1 — Barbarian Rage lifecycle**.

- Tracking issue: `#124` — `R1: Barbarian Rage lifecycle`
- Active draft PR: `#125`
- Working branch: `codex/v1-barbarian-rage`
- PR base: `work/v1-composite`
- Canonical base remains `bde75ed8bbe68959765935d199c2685446c2c0f7` at this checkpoint.
- Last verified product head before this coordination update: `d31a26302f1469b2edbb3b4d1b2c939ec840f7e9`.

The branch already contains and has validated the Rage domain foundation, physical damage resistance/status semantics, Concentration and Heavy Armor termination handling, Rage damage breakpoints, and Strength-based weapon/unarmed Rage damage integration. The SRD 5.2.1 contract has **no voluntary Rage-end resolver**; Session must not invent an End Rage button. Existing natural/condition/armor termination remains domain-owned.

The production attack snapshot regression is now present and GREEN: the real production Longsword projection exposes `attackAbility: str` and Rage Damage metadata.

The player-facing local Session Rage start slice is also implemented and GREEN at `d31a263`:

- `action.barbarian.rage` projects for a Barbarian with the canonical Rage resource.
- Freeform resolves through the canonical ResolutionEvent path and updates Resource, Activity, and event-native Undo.
- Initiative consumes Bonus Action plus one Rage use, disables a duplicate start while Rage is active, and Undo restores the atomic start state.
- Heavy Armor blocks start through existing canonical armor mechanics.
- The implementation reuses existing turn-runtime, event apply, Character write-back, Activity projection, and event-history services; no parallel Rage engine or persistence schema was added.

Verification for `d31a263`:

- UI run `32879026250`: success, including the focused Rage Session regressions and TypeScript/production build.
- Contract validation run `32879026270`: success.
- Rules Domain run `32879026373`: success.
- Phase 11 Playable run `32879026268` and Phase 12 Connected Session run `32879026318` were still in progress when this checkpoint was prepared; re-read their current GitHub conclusions before relying on them.

## Next Exact Action

1. Fetch PR `#125`, branch `codex/v1-barbarian-rage`, and the workflow conclusions for the latest head. If GitHub advanced, reconcile from that newer state.
2. Do **not** repeat the now-GREEN local Rage Session action work or production weapon snapshot regression.
3. Add the smallest deterministic RED regression on the existing connected Session surface for a remote owner using `action.barbarian.rage`, proving the canonical connected requirements: owner-authorized request, exactly-once authoritative commit, Rage Resource/effect visibility after reconnect, and event-native Undo without double spend or duplicate Activity.
4. Implement only the minimum connected projection/routing change needed to make that regression GREEN, reusing the existing ActionRequest/host authority/session projection/event history paths.
5. After focused connected GREEN, run the related Phase 12/Session regression surface and then decide whether R1 is ready to close or still has an explicit remaining acceptance gap.
6. Preserve the handoff order after Rage: Wild Shape -> Monk Focus -> Rogue Cunning Action/Uncanny Dodge unless canonical planning or an explicit owner decision changes it.

## Resume invariants

- Actual GitHub state wins stale checkpoint prose.
- One active implementation slice at a time; deterministic regression first for a behavior gap.
- Reuse existing adapters/services and keep the changed-file set minimal.
- Do not create a voluntary Rage-end API or a second mechanics authority.
- Connected Player requests must remain owner-authorized and host-authoritative; retries/reconnect must not duplicate commits.
- Windows two-instance/human acceptance remains a later release gate unless canonical planning explicitly moves it forward.
