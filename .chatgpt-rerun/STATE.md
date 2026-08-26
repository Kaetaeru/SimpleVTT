# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:57:30+09:00`

## Durable checkpoint

Mandatory preflight completed in required order (`README.md` -> `control.json` -> `STATE.md` -> `PLAN.md`). `PLAN.md` unchanged. GitHub live branch is authoritative under concurrent writes.

R1 source/execution matrix remains canonically closed. Do not reopen R1 without direct regression evidence.

R2 is active. Reuse existing Host authority, ordered `ResolutionEvent`, Client apply, duplicate-safe replay, connected interrupt transport, Character owner write-back, and compensating Undo. No new connected protocol/schema/remote-only rules path.

## R2 validated slices — do not repeat

- Rage: `dec4f22178b1256597c140170481025bb26f39e3`; Phase12 `32963492151` / `98160810148` green.
- Wild Shape: `a65cbd2926032d70f47495873996653c7622cb1e`; Phase12 `32964082295` / `98162628731` green.
- Cunning Action Dash: focused remote-owner proof green through `ea96509ee0c01922d0f23926445b5a7271a45ae1`.
- Cunning Action Disengage: focused remote-owner proof green through `134e6a8d7def8711d84bb5be56186f353a4ddeb2`.
- Cunning Action Hide: `7f8e9459e433164b916ee8ef12fdf3042492d9d7`; UI `32968629784` / `98176845419`, Phase12 `32968629791` / `98176845690` green.
- Uncanny Dodge: `a1edf6bc869984aaabf5cf5f564f4f11c21399ad`; UI `32970182652` / `98181814250`, Phase12 `32970182722` / `98181814527` green. Duplicate owner interrupt-response/event, reconnect, owner write-back and compensating Undo are covered. `d8df984ce868e3ae9bf8a78162e0924120f4f2c3` removed duplicate remote Rogue rules materialization. Closed.
- Berserker Intimidating Presence mechanics/protocol proof: tested tree `4644987154266bf5e822e4b69231d66de662ea9f`; Phase12 `32971089719` / connected-protocol `98184748123` success through focused authority proof, Phase11 walkthrough and production frontend gate; UI `32971089807` / frontend `98184747959` success including `Typecheck and build`.

Canonical Uncanny evidence was reconciled before this slice and NEXT advanced to Berserker Intimidating Presence. Do not repeat validated Uncanny work.

## Active exact-head verification — Berserker persisted subclass projection

Focused connected proof exists at `tests/ui/connectedProjectedCharacterBerserkerIntimidatingPresenceResolution.test.ts` and is gated in Phase12.

First direct red on `999c234fcc4f1a1890408e63805f43e0021bc7fe` was not mechanics: missing canonical Berserker subclass content/projection identity.

Minimal forward work:
- `7e8541864f19c1abd22bbe0a32ae0f2dae685fa0`: add the missing canonical `dnd.srd521.subclass.barbarian.path-of-the-berserker` catalog entry only; no second fear engine/protocol/schema.
- fixture corrections through `4644987154266bf5e822e4b69231d66de662ea9f`: mirror persisted Berserker Character shape rather than invent remote-only rules.
- `3d3c9866fd24c15d233e8d8730e70052597e8fec`: strengthen the focused fixture to exercise persisted `subclassName` / `classLevels` subclass metadata against the canonical catalog entry.

The focused proof covers Host-unknown authoritative ActionRequest, feature resource and Bonus Action economy, Frightened effect, Host permanent Character-library isolation, one ordered resource/economy/effect event batch, owning Client durable exactly-once apply, duplicate request/event replay safety, reconnect preservation, and compensating Undo/inverse owner persistence.

Latest exact test head `3d3c986` evidence at checkpoint:
- Phase12 run `32971306050` / connected-protocol job `98185443594`: focused connected authority step success; Phase11 walkthrough success; production frontend gate still in progress.
- UI run `32971305995` / frontend job `98185443299`: all steps through Phase09 real mechanics success; `Typecheck and build` still in progress.
- No direct red observed on `3d3c986` at checkpoint.
- `windows-connected-playable` is R3 acceptance and is not an R2 gate.

Do not add more code while these exact-head production gates are still running. Do not canonically advance to the next feature until `3d3c986` is green or a direct red is resolved.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Do not repeat validated Rage, Wild Shape, Cunning Dash, Cunning Disengage, Cunning Hide, Uncanny Dodge, or the already-green `4644987` Berserker mechanics/protocol proof.
3. Read completion of exact `3d3c986` Phase12 `32971306050` / `98185443594` and UI `32971305995` / `98185443299`; do not rerun already-green focused/Phase11 work.
4. If both production gates are green, minimally record the latest exact evidence in `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`, close Berserker Intimidating Presence R2, then advance NEXT according to live canonical R1 execution order.
5. If a gate is red, read the first actual error and fix only that direct cause; do not broaden subclass catalog/runtime work speculatively.
6. `PLAN.md` remains unchanged unless routing materially changes. Persist `STATE.md`, then `control.json` LAST.
7. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
