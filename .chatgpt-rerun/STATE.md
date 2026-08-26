# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:09:00+09:00`

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

Direct investigation established the real gap:
- Standard Hide semantics are already regression-covered in `tests/ui/standardActionLifecycle.test.ts`: ability check, DC 15 success/failure, Hidden lifecycle, attack reveal. Reuse them.
- `phase09RealResolutionAdapter.ts` legacy Hidden application checks exact id `action.standard.hide.stealth`; Cunning Hide has a different id, so its Hidden state was not covered by that exact branch.
- `abilityCheckResolutionEventAdapter.ts` records the d20 event only; it does not carry Hidden or Bonus Action state changes.

Concurrent live fixes now exist:
- `5765534b320f245678edb90173d740d8fb7c0113` adds `rogueCunningHideEventRuntimeAdapter.ts`: staged Cunning Hide composes the existing d20 event with canonical session Bonus Action economy + tagged Hidden effect, and records attack-triggered Hidden removal in the same event history.
- `3ad7f6a3c1f57495103cfa86fa9f86591eee2f7c` installs the bridge immediately outside the generic ability-check recorder so the d20 event is composed, not replaced.
- `03164a314762c0981bae8c7153f391366b49b6e0` reconstructs remote level-2+ Cunning Hide from canonical Rogue class-level and Stealth skill facts.
- Phase12 run `32966851411` / connected-protocol job `98171137748` for bridge-install head: connected authority suite green; Phase11 offline walkthrough green; production frontend gate was still running at checkpoint.
- No accepted focused remote-owner Cunning Hide proof is recorded yet. Hide R2 is NOT claimed complete.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Stay in R2; do not reopen validated Rage/Wild Shape/Cunning Dash/Cunning Disengage.
3. Inspect exact-head CI after `03164a314762c0981bae8c7153f391366b49b6e0` and any newer concurrent Hide commits. Fix only the first direct Hide regression if red.
4. Check for an already-added focused remote-owner Cunning Hide proof/gate. Reuse it if present; never duplicate it.
5. If missing, add only the smallest deterministic proof: host-unknown level-2 Rogue, successful Cunning Hide check, Host authority, ordered d20 + Bonus Action + Hidden effect convergence, exactly-once Client apply, duplicate event/request safety, no Character-library generation for session-only state, attack reveal if needed, and compensating Undo.
6. Reuse standard Hide semantics. No new stealth engine, protocol, schema, or generic abstraction.
7. Verify changed exact SHA through existing Phase12 connected gate + production `npm run build`; fix only first direct regression.
8. Update canonical handoff/checklist only if the overall R2 pointer/status changes. Otherwise STATE then `control.json` LAST.
9. Keep Uncanny Dodge separate until Hide is green/checkpointed.
10. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
