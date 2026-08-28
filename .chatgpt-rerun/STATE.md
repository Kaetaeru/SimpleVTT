# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `4`
- task_id: `common-play-foundation-convergence`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- Rerun working branch/ref: `agent/resolver-foundation-convergence`
- product integration target: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- architecture charter: `docs/rules/common-play-resolver-architecture-charter.md`
- product plan: `docs/rules/resolver-execution-checklist-v2.md`
- human current-work entrypoint: `docs/CURRENT.md`
- checkpointed_at: `2026-08-29 Asia/Seoul`

## Durable checkpoint

Resource/Economy remains `MIGRATED` on the convergence parent. Tests/Rolls/Outcomes and Damage/Healing/HP are now `PRODUCTION` after their bounded generic Common Play production bridges. Do not promote any family beyond its recorded maturity without explicit remaining evidence, and do not repeat already-valid validation without an affected-surface reason.

PR #171, `rules: migrate built-in Action Surge to generic Common Play`, was merged into `agent/resolver-foundation-convergence` as `24d507e809a33b9b5ec7a5bf7fefcf2c3d17ec8f` from validated exact head `8c9978a8d3a30bf08ab492cc8d805c2d77d63094`.

Reusable PR #171 evidence:

- focused Common Play / Action Surge behavior harness passed 8/8 on the candidate lineage, covering two-resource spend, restricted extra Action semantics, authoritative writeback/Undo, connected convergence, arbitrary installed Common Play production coverage, and action/content/definition/display-name rename invariance;
- Contract validation `33174441211` — `SUCCESS`;
- M1 Common Play Resource Economy `33174441198` — `SUCCESS`;
- Persistence `33174441162` — `SUCCESS`;
- Rules Domain `33174441191` — `SUCCESS`;
- UI `33174441234` — `SUCCESS`;
- Phase 12 Connected Session `33174441183` — `SUCCESS`, including Windows connected-playable;
- Phase 11 Playable `33174441152` — `SUCCESS`, including Windows playable;
- `src/app/fighterActionSurgeRuntimeAdapter.ts` is absent after the merge;
- `.agents/LEGACY_EXECUTION_BASELINE.json` no longer contains the removed Fighter Action Surge adapter.

PR #172, `rules: add generic Common Play d20 production bridge`, was merged into `agent/resolver-foundation-convergence` as `ff523a4b8b83f29b781720dcd174f0245e7c16ca` from validated exact head `350224dc10fe747ff52e8a8f2c428208edb9af2e`.

Reusable PR #172 evidence:

- focused Common Play/production/import/Action Surge harness — `24/24` SUCCESS on the candidate;
- installed-content persistence + connected protocol/runtime harness — `19/19` SUCCESS on the candidate;
- `npx tsc --noEmit` — SUCCESS;
- `tools/validate_contracts.py` — SUCCESS;
- `npm run build` — SUCCESS;
- Contract validation `33185347702` — `SUCCESS`;
- M1 Common Play d20 `33185347735` — `SUCCESS`;
- M1 Common Play Resource Economy `33185347722` — `SUCCESS`;
- Rules Domain `33185347732` — `SUCCESS`;
- UI `33185347707` — `SUCCESS`;
- Persistence `33185347714` — `SUCCESS`;
- Phase 11 Playable `33185347718` — `SUCCESS`, including Windows playable;
- Phase 12 Connected Session `33185347705` — `SUCCESS`, including Windows connected-playable;
- authored actor ability checks, saving throws, and attack rolls reuse the existing generic Resolver `d20` semantics through validation, installed persistence/rehydration, production authority, connected presentation, and ID/name rename invariance;
- no new evaluator, Resolver, store, transport, fallback, or ID/name algorithm branch was introduced;
- named post-roll seams and property-backed / target/every-target d20 authoring remain deliberately outside this slice, so Tests/Rolls/Outcomes is `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

PR #173, `rules: add generic Common Play damage and healing production bridge`, was merged into `agent/resolver-foundation-convergence` as `284fcc9068292d90698d3d3ada5f128db72a77a7` from validated exact head `949d90f48fbd44cf101c47f7702c14208011a237`.

Reusable PR #173 evidence:

- focused Common Play + established Action Surge regression harness — `31/31` SUCCESS on the candidate;
- persistence/connected regression harness — `19/19` SUCCESS on the candidate;
- `npm run build` — SUCCESS;
- `npx tsc --noEmit` — SUCCESS;
- contract validation — SUCCESS, including the generic HP fixture;
- Contract validation `33202849933` — `SUCCESS`;
- M1 Common Play d20 `33202849981` — `SUCCESS`;
- M1 Common Play HP `33202850017` — `SUCCESS`;
- M1 Common Play Resource Economy `33202849927` — `SUCCESS`;
- Rules Domain `33202849909` — `SUCCESS`;
- UI `33202849931` — `SUCCESS`;
- Persistence `33202849948` — `SUCCESS`;
- Phase 11 Playable `33202849961` — `SUCCESS`;
- Phase 12 Connected Session `33202849941` — `SUCCESS`;
- authored `damage.apply` supports literal or bounded dice-formula damage and reuses the existing generic Resolver `damage-roll -> damage` semantics;
- authored `healing.apply` supports literal healing and reuses the existing generic Resolver `healing` semantics;
- one already-resolved runtime target, authoritative HP writeback/Undo, connected Host/Client convergence, and ID/name rename invariance are covered;
- no new Resolver, evaluator, state store, transport, fallback, selector, or content-ID/name algorithm branch was introduced;
- temporary HP, compound damage, defenses, concentration, critical authoring, healing dice, multi-target/selectors/allocation, spell execution, and named HP seams remain deliberately outside this slice, so Damage/Healing/HP is `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

The rejected `agent/m1-action-surge-generic-parity` experiment remains rejected as an integration candidate and must not be revived merely because later bounded migrations are complete.

Repository routing remains unchanged: Rerun state/control belongs on `agent/resolver-foundation-convergence`, product integration target remains `work/v1-composite`, and product work must not be routed to `main`.

## Waiting condition

None. PR #173 is merged and there is no current external blocker. Control remains `continue` so the canonical product plan may advance by mechanism family.

## Next Exact Action

1. Perform mandatory preflight and read the current canonical product-plan maturity board plus `docs/rules/legacy-execution-inventory.md`; reuse Gate A-E, M0, PR #159, PR #168, PR #171, PR #172, and PR #173 evidence unless new affected-surface evidence invalidates it.
2. Select the next smallest coherent Phase 2 mechanism-family slice from the product plan and current legacy debt. Do not select work by class/spell/feat name order.
3. Inspect only the source, behavior oracles, authority/lifetime boundaries, and existing generic primitives needed for that slice. Attempt existing Common Play composition before proposing a new primitive or activating Gates F-M.
4. Freeze a bounded behavior/acceptance contract before repository-dependent implementation. Use Codex for implementation once the contract is sufficiently fixed; return to architecture review if named-content branching, a speculative primitive, ambiguous authority/lifetime, or a conflicting contract appears necessary.
5. Eventual product integration remains `work/v1-composite`, never `main`.
