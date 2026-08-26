# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:08:00+09:00`

## Durable checkpoint

Mandatory preflight was completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). GitHub live state remained authoritative during concurrent branch movement. `PLAN.md` is unchanged.

R1 source/execution action matrix is canonically closed. Do not repeat validated R1 work without direct regression evidence. Canonical closure remains:

- `.agents/V1_CURRENT_HANDOFF.md`: `d9e57cf7dd6a8df8d8c3de463f236fdcf07cc7b7`
- `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`: `14824868d8d29b047f4b079f482ce2d861d84f66`

R2 is the active phase. Reuse the existing Host-authority / ordered `ResolutionEvent` / Client apply / duplicate-safe replay / compensating Undo machinery. Do not create a new connected protocol, schema, class-feature framework, or remote-only rules engine.

## R2 validated slices

### Rage

Remote-owner Rage is validated through the existing connected event path:

- focused proof `5585e6b3c329c3188baa60ba7c05d3a99d1ac1`
- Phase 12 gate `d5552a086b32605dcfeab66b49147498900ef408`
- projected compensating-Undo repair `0f17a4d5cb9319776b66fb9909b12808b165a13b`
- projected write-back narrowing `dec4f22178b1256597c140170481025bb26f39e3`
- exact Phase 12 run `32963492151` / connected job `98160810148` green

Do not reopen Rage without direct regression evidence.

### Wild Shape

Remote-owner Wild Shape is validated without schema expansion:

- projection/source preservation `657f7ea850350758bd5b0f5ac49977cd533d6df2` + `b9a666c772820432bc024fa0b9fb503110111e15`
- focused proof `a65cbd2926032d70f47495873996653c7622cb1e`
- gate `6f25193d93ea8bc010b85239e56055905b62c974`
- exact Phase 12 run `32964082295` / connected job `98162628731` green

Do not reopen Wild Shape without direct regression evidence.

### Cunning Action Dash

Remote-owner Cunning Action Dash is validated on the existing staged resolution lifecycle:

- event-native local path `cbbda07dd7c11ba126e79c26cba99586905e7dce`
- focused proof `ea96509ee0c01922d0f23926445b5a7271a45ae1`
- remote Rogue reconstruction `922cfd1f9b53ba4c14e4fe957b5bcc0e397cdce6`
- gate `04afe3e7eadb33f965a70fb59206909ee3c3d1dc`
- staged lifecycle correction `1e7b21df54a74252c3eb91bd255edbd7a0006311`
- exact Phase 12 run `32964728723` / connected job `98164631534` green, including Phase 11 and `npm run build`

Do not reopen Cunning Dash without direct regression evidence.

### Cunning Action Disengage

Remote-owner Cunning Action Disengage is validated on the same staged lifecycle. Concurrent duplicate implementations/tests were reconciled instead of adding another abstraction.

- event-native core `e736114de729964b855c67d181f0f14025aee630`
- opportunity-attack marker alignment `c3bb54c467c43e1940805fac2b0b468cadf9cc92`
- projected runtime state `1074cb6db2a1e917dc0db14bde771350b74b15cb`
- remote action reconstruction `87e8ace567c8eb7e421c582ccbb6150e861e8fee`
- focused proof `134e6a8d7def8711d84bb5be56186f353a4ddeb2`
- staged lifecycle proof fix `2e01cc2e321dbf43dad84e524013ed688e6fa5c9`
- duplicate adapter cleanup `732758391dd18ec52afa65b056185f544c51fe4b`
- exact Phase 12 run `32965968749` / connected-protocol job `98168404394` green, including Phase 11 and production `npm run build`

Do not reopen Disengage without direct regression evidence. `windows-connected-playable` remains R3 packaging/human acceptance and is not an R2 closure gate.

## R2 in progress: Cunning Action Hide

Live investigation found a direct local/event seam rather than only a remote projection gap:

- Standard Hide semantics already exist and are regression-covered in `tests/ui/standardActionLifecycle.test.ts`: ability check, DC 15 success/failure, Hidden application/removal, and attack-reveals-Hidden lifecycle. Do not create a second stealth rules engine.
- `phase09RealResolutionAdapter.ts` applies the legacy Hidden status only when the action id is exactly `action.standard.hide.stealth`. `CUNNING_HIDE_ACTION_ID` therefore did not enter that exact standard-Hide state branch.
- `abilityCheckResolutionEventAdapter.ts` records the canonical d20 event, but that event has no Hidden-state or Bonus Action state changes. That is insufficient by itself for remote-owner convergence.
- concurrent commit `5765534b320f245678edb90173d740d8fb7c0113` adds `rogueCunningHideEventRuntimeAdapter.ts`. It keeps the staged ability-check path, composes the existing d20 event with session-runtime Bonus Action economy plus a tagged Hidden marker effect, and records attack-triggered removal through the same event history instead of inventing a remote-only protocol.
- concurrent commit `3ad7f6a3c1f57495103cfa86fa9f86591eee2f7c` installs that bridge in `offlineRuntimeAdapters.ts` immediately outside the generic ability-check recorder so the canonical check event is composed rather than replaced.
- exact-head Phase 12 run `32966851411` / connected-protocol job `98171137748`: `Verify connected-session authority protocol` green and `Verify Phase 11 offline walkthrough remains green` green; `Verify production frontend gate` (`npm run build`) was still in progress at this checkpoint.
- No focused remote-owner Cunning Hide proof has been accepted at this checkpoint. Do not claim Hide R2 complete yet.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer than this checkpoint.
2. Stay in `R2. Connected remote-owner matrix`; do not reopen R1, Rage, Wild Shape, Cunning Dash, or Cunning Disengage without direct regression evidence.
3. Inspect the exact-head result for Phase 12 run `32966851411`. If red, fix only the first direct Cunning Hide regression. If green, do not rerun validated generic suites unnecessarily.
4. Check whether concurrent work already added a focused remote-owner Cunning Hide proof and Host SessionProjection reconstruction. Reuse it if present; do not create a duplicate test/adapter.
5. If still missing, add the smallest focused proof for a host-unknown level-2 Rogue: deterministic successful Hide check, Host authority, ordered canonical d20 + Bonus Action + Hidden effect convergence, exactly-once Client apply, duplicate event/request safety, no Character-library generation for session-only state, attack-triggered reveal where needed to prove the bridge, and compensating Undo.
6. Reuse standard Hide success/failure semantics. Do not add a new stealth engine, protocol, schema, or generic abstraction.
7. Verify the changed exact SHA with the existing Phase 12 connected gate and production `npm run build`; fix only the first direct regression.
8. Update canonical handoff/checklist only when the overall R2 pointer/status materially changes. Otherwise update this STATE and `control.json` last.
9. Keep Uncanny Dodge separate until Hide is green and checkpointed.
10. R3 Tauri durability/Windows two-instance acceptance, R4 rendered UX/accessibility, and R5 packaging remain separate.
