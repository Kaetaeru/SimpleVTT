# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:41:38+09:00`

## Durable checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). `PLAN.md` unchanged. GitHub live branch is authoritative under concurrent writes.

R1 source/execution matrix remains canonically closed. Canonical R2 pointer is Rogue Uncanny Dodge after Cunning Hide; do not reopen R1 without direct regression evidence.

R2 is active. Reuse existing Host authority, ordered `ResolutionEvent`, Client apply, duplicate-safe replay, connected interrupt transport, Character owner write-back, and compensating Undo. No new connected protocol/schema/reaction engine/remote-only rules path.

## R2 validated slices — do not repeat

- Rage: exact connected checkpoint through `dec4f22178b1256597c140170481025bb26f39e3`; Phase12 `32963492151` / job `98160810148` green.
- Wild Shape: focused proof `a65cbd2926032d70f47495873996653c7622cb1e`; Phase12 `32964082295` / job `98162628731` green.
- Cunning Action Dash: proof/fixes through `1e7b21df54a74252c3eb91bd255edbd7a0006311`; Phase12 `32964728723` / job `98164631534` green.
- Cunning Action Disengage: proof/fixes through `732758391dd18ec52afa65b056185f544c51fe4b`; Phase12 `32965968749` / job `98168404394` green including Phase11 + `npm run build`.
- Cunning Action Hide: exact checkpoint `7f8e9459e433164b916ee8ef12fdf3042492d9d7`; UI `32968629784` / frontend `98176845419` green; Phase12 `32968629791` / connected-protocol `98176845690` green including Phase11 + production `npm run build`.

`windows-connected-playable` is R3 acceptance, not an R2 gate.

## R2 current gap: Uncanny Dodge

Existing R1 `rogueCoreRuntimeAdapter.ts` remains mechanics authority:
- Rogue 5+ `UNCANNY_DODGE_REACTION_ID` projection;
- interrupt acceptance queues existing atomic `0.5` damage multiplier;
- actual rolled damage uses floor-half semantics;
- completion/Activity/Undo remain on existing atomic/event-native paths.
Do not duplicate these mechanics.

Concurrent GitHub work advanced the Uncanny Dodge proof from investigation head `045e7aa53b8478b4219b67c42a2fd545d2ad9b17` to live product/test head `aefb7a890f266e058eeb0c4e4e72d5aee42734dc` before this checkpoint. The five-commit diff adds only the relevant mounted projection/reaction seam, small Rogue runtime support, focused remote-owner proof, and Phase12 gate entry.

Focused proof: `tests/ui/connectedProjectedCharacterUncannyDodgeResolution.test.ts` now exercises a Host-unknown Rogue 5+ through the existing connected primitives:
- mounted Host Scene reconstructs Uncanny Dodge reaction from trusted projection data;
- visible incoming `action.scimitar` hit reaches private owner interrupt prompt;
- owner acceptance routes through existing connected interrupt response transport;
- Host Reaction economy becomes spent;
- existing atomic attack result applies `floor(raw/2)` damage;
- Host permanent Character library stays unchanged while ephemeral projection HP updates;
- one ordered Host event batch contains Reaction economy + HP changes;
- owning Client applies/persists the Host event once; duplicate replay is a no-op;
- stale reconnect projection does not overwrite Host-authoritative HP/Reaction state;
- Host Undo restores projected HP/Reaction and publishes one compensating ordered event;
- owning Client applies/persists inverse once; duplicate Undo replay is a no-op.

Exact-head CI at checkpoint:
- HEAD: `aefb7a890f266e058eeb0c4e4e72d5aee42734dc` (`test: use mounted Uncanny Dodge scene reaction`).
- Phase 12 Connected Session run `32969745056`, connected-protocol job `98180422630`:
  - `Verify connected-session authority protocol`: **success**. This includes the focused Uncanny Dodge remote-owner proof.
  - `Verify Phase 11 offline walkthrough remains green`: **success**.
  - `Verify production frontend gate` (`npm run build`): **in_progress** at checkpoint.
- UI run `32969745069`, frontend job `98180422561`: all earlier UI/regression steps green; `Typecheck and build`: **in_progress** at checkpoint.

Therefore Uncanny Dodge R2 is **not closed yet**. No speculative code change is justified while the exact-head production gates are still running.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Inspect exact-head CI for `aefb7a8` or the newer live descendant; do not rerun already-green connected proof/Phase11 steps.
3. If Phase12 production `npm run build` and UI Typecheck/build are green, record Uncanny Dodge R2 as validated, update canonical handoff/release pointer if not already advanced, then choose the next single R2 remote-owner gap. Do not wait for `windows-connected-playable`; that is R3.
4. If either gate is red, read its first direct failure and fix only that cause. Do not broaden the feature or create new reaction/protocol abstractions.
5. `PLAN.md` remains unchanged unless routing changes. Persist `STATE.md`, then `control.json` LAST.
6. R3 Windows/Tauri durability, R4 rendered UX/accessibility, and R5 packaging remain separate.
