# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:48:00+09:00`

## Durable checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). `PLAN.md` unchanged. GitHub live branch is authoritative under concurrent writes.

R1 source/execution matrix remains canonically closed. Do not reopen R1 without direct regression evidence.

R2 is active. Reuse existing Host authority, ordered `ResolutionEvent`, Client apply, duplicate-safe replay, connected interrupt transport, Character owner write-back, and compensating Undo. No new connected protocol/schema/reaction engine/remote-only rules path.

## R2 validated slices — do not repeat

- Rage: exact connected checkpoint through `dec4f22178b1256597c140170481025bb26f39e3`; Phase12 `32963492151` / job `98160810148` green.
- Wild Shape: focused proof `a65cbd2926032d70f47495873996653c7622cb1e`; Phase12 `32964082295` / job `98162628731` green.
- Cunning Action Dash: proof/fixes through `1e7b21df54a74252c3eb91bd255edbd7a0006311`; Phase12 `32964728723` / job `98164631534` green.
- Cunning Action Disengage: proof/fixes through `732758391dd18ec52afa65b056185f544c51fe4b`; Phase12 `32965968749` / job `98168404394` green including Phase11 + `npm run build`.
- Cunning Action Hide: exact checkpoint `7f8e9459e433164b916ee8ef12fdf3042492d9d7`; UI `32968629784` / frontend `98176845419` green; Phase12 `32968629791` / connected-protocol `98176845690` green including Phase11 + production `npm run build`.

## Current Uncanny Dodge R2 checkpoint

- Base focused remote-owner proof/fix chain is green through `aefb7a890f266e058eeb0c4e4e72d5aee42734dc`:
  - remote Rogue reaction projection uses the existing `rogueCoreRuntimeAdapter` rather than a duplicate remote-only rules implementation;
  - Host-unknown Rogue 5+ receives the existing Uncanny Dodge reaction;
  - private owner interrupt prompt/acceptance routes through existing connected interrupt transport;
  - Host spends Reaction and applies existing atomic `floor(raw/2)` damage;
  - one ordered Host event batch carries Reaction + HP changes;
  - Host permanent Character library stays unchanged;
  - owning Client applies durable HP write-back exactly once; duplicate Host event is a no-op;
  - reconnect preserves Host-authoritative HP/Reaction against stale projection overwrite;
  - compensating Undo restores HP/Reaction and inverse owner write-back; duplicate Undo is a no-op.
- `aefb7a8` validation: Phase12 `32969745056` / connected-protocol `98180422630` success including focused proof, Phase11 walkthrough, production `npm run build`; UI `32969745069` / frontend `98180422561` success including Typecheck/build.
- Ponytail cleanup `d8df984ce868e3ae9bf8a78162e0924120f4f2c3` removes duplicated Rogue rule materialization from `characterSessionProjectionMount.ts`; connected authority step remained green on its exact-head run.
- Test-only head `a1edf6bc869984aaabf5cf5f564f4f11c21399ad` explicitly proves a duplicate owner interrupt response is a no-op: resolution does not advance twice and Reaction is not spent twice.
- Exact-head `a1edf6b` validation is now fully green:
  - Phase12 run `32970182722` / connected-protocol job `98181814527`: connected authority suite, Phase11 walkthrough, and production frontend gate all **success**.
  - UI run `32970182652` / frontend job `98181814250`: all frontend steps including `Typecheck and build` **success**.
- **Uncanny Dodge R2 is closed at the latest tested head `a1edf6b`.** Do not reopen it without direct regression evidence.
- Canonical `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` were still stale at this checkpoint and must receive the exact evidence above before moving the canonical pointer to the next R2 slice.

`windows-connected-playable` is R3 acceptance, not an R2 gate.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Do not repeat validated Rage, Wild Shape, Cunning Dash, Cunning Disengage, Cunning Hide, or Uncanny Dodge.
3. Minimally update `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` with Uncanny Dodge exact head `a1edf6b`, Phase12 `32970182722` / job `98181814527` green, and UI `32970182652` / job `98181814250` green. Preserve unrelated canonical history.
4. Then continue the remaining R1 remote-owner matrix in existing R1 execution order. Inspect **Berserker Intimidating Presence** first (`1df452f` R1): existing domain/runtime action, target/effect/resource/economy/Activity/Undo, connected reconstruction, and whether a focused remote-owner proof already exists. Do not create a second fear engine/protocol/schema.
5. If direct evidence shows a gap, add only the smallest deterministic remote-owner proof/fix using existing Host authority + ordered `ResolutionEvent` + Client apply + duplicate/reconnect + compensating Undo primitives.
6. Verify any changed exact SHA through the existing Phase12 connected gate plus production `npm run build`; fix only the first direct regression.
7. `PLAN.md` remains unchanged unless routing materially changes. Persist `STATE.md`, then `control.json` LAST.
8. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
