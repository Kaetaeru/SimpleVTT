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

Resource/Economy remains `MIGRATED` on the convergence parent. Tests/Rolls/Outcomes, Damage/Healing/HP, bounded single-target Targeting/Selectors/Allocation, and bounded manual actor-consent Interactions/Reactions/Interceptors are `PRODUCTION` after their generic Common Play production bridges. Do not promote any family beyond its recorded maturity without explicit remaining evidence, and do not repeat already-valid validation without an affected-surface reason.

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

PR #174, `rules: add bounded Common Play targeting production bridge`, was merged into `agent/resolver-foundation-convergence` as `4624a63dd8ea4a81f0716187e5ceb57a9a469497` from validated exact head `27ae09ebdc53431e57264934f58a59c70e4b023b`.

Reusable PR #174 evidence:

- focused Common Play production harness — `39/39` SUCCESS on the candidate;
- targeting/atomicity/persistence/connected regression harness — `37/37` SUCCESS on the candidate;
- contract validation — SUCCESS;
- TypeScript check — SUCCESS;
- `npm run build` — SUCCESS;
- exact-head workflow count — `10/10` SUCCESS;
- Phase 11 Playable `33206073692` — `SUCCESS`;
- Persistence `33206073674` — `SUCCESS`;
- UI `33206073675` — `SUCCESS`;
- Rules Domain `33206073640` — `SUCCESS`;
- Contract validation `33206073765` — `SUCCESS`;
- M1 Common Play HP `33206073641` — `SUCCESS`;
- M1 Common Play Targeting `33206073764` — `SUCCESS`;
- M1 Common Play Resource Economy `33206073736` — `SUCCESS`;
- M1 Common Play d20 `33206073630` — `SUCCESS`;
- Phase 12 Connected Session `33206073888` — `SUCCESS`;
- only canonical `{ from:"targets", min:1, max:1 }` targeting is production-supported; it validates one already-selected authoritative combatant and lowers before downstream mutation to the existing generic Resolver `targeting` / `resolveTargeting()` path;
- zero, multiple, nonexistent, and temporarily unavailable targets reject atomically without downstream HP mutation or partial authoritative events;
- no fabricated distance, sight, or cover facts are supplied; the bounded neutral rule uses `directTarget:false`;
- actor/self and one other runtime combatant, persistence/rehydration, authoritative commit/Undo, Host/Client convergence, and ID/name rename invariance are covered;
- no selector evaluator, targeting engine, allocation engine, geometry engine, store, transport, fallback, or ID/name algorithm branch was introduced;
- richer selectors, automatic discovery, multi-target, allocation/Gate G, harmful targeting semantics, spatial/range/sight/cover facts, and named target-dependent seams remain deliberately outside this slice, so Targeting/Selectors/Allocation is bounded `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

PR #175, `rules: add bounded Common Play interaction reaction production bridge`, was merged into `agent/resolver-foundation-convergence` as `0e567d738c94000f059d351a21ef37637c28809e` from validated exact head `9b6c5cb564150ebf0e80eb01bd716ca77fc3ebbf`.

Reusable PR #175 evidence:

- focused Common Play production harness — `55/55` SUCCESS on the candidate;
- affected regression harness — `35/35` SUCCESS on the candidate;
- contract validation — SUCCESS;
- TypeScript check — SUCCESS;
- `npm run build` — SUCCESS;
- exact-head workflow count — `11/11` SUCCESS;
- M1 Common Play Interaction `33211213753` — `SUCCESS`;
- Phase 12 Connected Session `33211213825` — `SUCCESS`;
- Contract validation `33211213603` — `SUCCESS`;
- M1 Common Play d20 `33211213478` — `SUCCESS`;
- M1 Common Play Targeting `33211213494` — `SUCCESS`;
- M1 Common Play HP `33211213542` — `SUCCESS`;
- M1 Common Play Resource Economy `33211213489` — `SUCCESS`;
- Rules Domain `33211213518` — `SUCCESS`;
- UI `33211213543` — `SUCCESS`;
- Persistence `33211213575` — `SUCCESS`;
- Phase 11 Playable `33211213565` — `SUCCESS`;
- only manual actor `consent` + blocking boolean input + `revalidate:"always"` is production-supported, paired with exactly one commit-time refundable amount-one Reaction economy payment;
- invocation reuses the existing `ResolutionView.interrupt` presentation without pre-consent mutation; decline clears the interrupt with no mechanical mutation;
- accept re-looks up installed content, snapshots current authority, revalidates action/actor/targets/payments, requires matching accepted compiler authorization, and lowers Reaction consumption to the existing generic `use-economy` Reaction slot;
- Reaction, resource payments, and downstream operations commit in one existing `PendingResolution`; unavailable Reaction, insufficient resource, and invalid target reject without partial mutation;
- accepted interaction supports authoritative writeback, Undo, duplicate-response safety, persistence/rehydration, required-session content transfer, Host-authoritative connected convergence, and ID/name rename invariance;
- no prompt framework, pending store, interaction/reaction engine, transport, fallback, or ID/name algorithm branch was introduced;
- `roll.modify`, reroll, interceptors, triggered dispatch, remote/non-actor responders, reconnect continuation, multiple options, and named post-roll seams remain outside this slice, so Interactions/Reactions/Interceptors is bounded `PRODUCTION`, not `MIGRATED` or `ACCEPTED`.

The rejected `agent/m1-action-surge-generic-parity` experiment remains rejected as an integration candidate and must not be revived merely because later bounded migrations are complete.

Repository routing remains unchanged: Rerun state/control belongs on `agent/resolver-foundation-convergence`, product integration target remains `work/v1-composite`, and product work must not be routed to `main`.

## Waiting condition

None. PR #175 is merged and there is no current external blocker. Control remains `continue` so the canonical product plan may advance by mechanism family.

## Next Exact Action

1. Perform mandatory preflight and read the current canonical product-plan maturity board plus `docs/rules/legacy-execution-inventory.md`; reuse Gate A-E, M0, PR #159, PR #168, PR #171, PR #172, PR #173, PR #174, and PR #175 evidence unless new affected-surface evidence invalidates it.
2. Select the next smallest coherent Phase 2 mechanism-family slice from the product plan and current legacy debt. Do not select work by class/spell/feat name order.
3. Inspect only the source, behavior oracles, authority/lifetime boundaries, and existing generic primitives needed for that slice. Attempt existing Common Play composition before proposing a new primitive or activating Gates F-M.
4. Freeze a bounded behavior/acceptance contract before repository-dependent implementation. Use Codex for implementation once the contract is sufficiently fixed; return to architecture review if named-content branching, a speculative primitive, ambiguous authority/lifetime, or a conflicting contract appears necessary.
5. Eventual product integration remains `work/v1-composite`, never `main`.
