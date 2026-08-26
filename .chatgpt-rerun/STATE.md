# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:28:00+09:00`

## Durable checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). `PLAN.md` unchanged. GitHub live branch is authoritative under concurrent writes.

R1 source/execution matrix remains canonically closed:
- handoff `d9e57cf7dd6a8df8d8c3de463f236fdcf07cc7b7`
- release checklist `14824868d8d29b047f4b079f482ce2d861d84f66`
Do not reopen R1 without direct regression evidence.

R2 is active. Reuse existing Host authority, ordered `ResolutionEvent`, Client apply, duplicate-safe replay, and compensating Undo. No new connected protocol/schema/remote-only rules engine.

## R2 validated slices

- Rage: focused `5585e6b3c329c3188baa60ba7c05d3a99d1ac1`; Undo repair `0f17a4d5cb9319776b66fb9909b12808b165a13b`; write-back narrowing `dec4f22178b1256597c140170481025bb26f39e3`; Phase12 `32963492151` / job `98160810148` green.
- Wild Shape: projection/source `657f7ea850350758bd5b0f5ac49977cd533d6df2` + `b9a666c772820432bc024fa0b9fb503110111e15`; proof `a65cbd2926032d70f47495873996653c7622cb1e`; Phase12 `32964082295` / job `98162628731` green.
- Cunning Action Dash: event-native `cbbda07dd7c11ba126e79c26cba99586905e7dce`; remote reconstruction `922cfd1f9b53ba4c14e4fe957b5bcc0e397cdce6`; proof `ea96509ee0c01922d0f23926445b5a7271a45ae1`; staged correction `1e7b21df54a74252c3eb91bd255edbd7a0006311`; Phase12 `32964728723` / job `98164631534` green.
- Cunning Action Disengage: event-native core `e736114de729964b855c67d181f0f14025aee630`; opportunity marker alignment `c3bb54c467c43e1940805fac2b0b468cadf9cc92`; remote runtime/reconstruction `1074cb6db2a1e917dc0db14bde771350b74b15cb` + `87e8ace567c8eb7e421c582ccbb6150e861e8fee`; proof `134e6a8d7def8711d84bb5be56186f353a4ddeb2`; staged proof fix `2e01cc2e321dbf43dad84e524013ed688e6fa5c9`; duplicate adapter cleanup `732758391dd18ec52afa65b056185f544c51fe4b`; Phase12 `32965968749` / job `98168404394` green including Phase11 + `npm run build`.

Do not repeat these slices without direct regression evidence. `windows-connected-playable` is R3 acceptance, not an R2 gate.

## R2 in progress: Cunning Action Hide

Existing standard Hide semantics are reused. No new stealth engine/protocol/schema was introduced.

Current live Hide chain already contains the required focused remote-owner proof and the product fixes; do not duplicate them:
- `5765534b320f245678edb90173d740d8fb7c0113`: Cunning Hide event/runtime bridge.
- `3ad7f6a3c1f57495103cfa86fa9f86591eee2f7c`: installs the bridge outside the generic ability-check recorder.
- `03164a314762c0981bae8c7153f391366b49b6e0`: reconstructs remote level-2+ Cunning Hide from canonical Rogue/Stealth facts.
- `f21c9f7`: focused remote-owner Hide proof.
- `694100d`: Phase12 gate wiring for the proof.
- `b071f7566d5b0fa408b87a9641a2d0d1bfdc00de`: canonical Hide d20 event-kind expectation alignment.
- `5895f7b184d73749a1207bf5d00a8569a82d1041`: canonical fixed DC work.
- `e2107025fb1fd4a896559decc1ee191c033e9b2a`: scopes the fixed DC to Cunning Hide and ensures the connected Host TurnRuntime exists before committing Hidden/economy effects.
- `97402706c54622fb128a3e2209c014deb18f5430` then exposed two broad lifecycle fixture-selection regressions; the Cunning Hide connected proof itself was green.
- `7f8e9459e433164b916ee8ef12fdf3042492d9d7`: restores the lifecycle tests to selecting an actual composed ability-check action rather than nonexistent `action.athletics`.

Exact-head evidence at checkpoint for `7f8e9459e433164b916ee8ef12fdf3042492d9d7`:
- Phase12 run `32968629791` / connected-protocol job `98176845690`: connected-session authority protocol green, including focused remote-owner Cunning Hide; Phase11 offline walkthrough green; production frontend gate (`npm run build`) still in progress at checkpoint.
- UI run `32968629784` / frontend job `98176845419`: broad UI steps were still in progress; no new direct Hide red recorded at checkpoint.

Therefore Hide product behavior/proof is green, but Hide R2 is NOT yet claimed fully validated until the exact-head production frontend/build gate finishes green.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Stay in R2. Do not reopen Rage/Wild Shape/Cunning Dash/Cunning Disengage.
3. Inspect exact-head completion of Phase12 `32968629791` / job `98176845690` and UI `32968629784` / job `98176845419` for `7f8e9459e433164b916ee8ef12fdf3042492d9d7`, unless GitHub has a newer head.
4. If exact-head connected + Phase11 + production `npm run build` are green, close Cunning Action Hide R2 without rerunning validated work, minimally repair canonical handoff/release checklist, and advance the R2 pointer to Uncanny Dodge.
5. If red, read the first direct failing step/log and fix only that regression. Do not reopen already-green Hide semantics/proof unless the failure directly implicates them.
6. Keep Uncanny Dodge separate until Hide is fully green/checkpointed.
7. `PLAN.md` unchanged. Durable update order remains STATE -> `control.json` LAST unless routing materially changes.
8. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
