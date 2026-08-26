# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T21:56:55+09:00`

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
- Berserker Intimidating Presence: exact tested head `4644987154266bf5e822e4b69231d66de662ea9f`; Phase12 `32971089719` / connected-protocol `98184748123` **success** through focused authority proof, Phase11 walkthrough and production frontend gate; UI `32971089807` / frontend `98184747959` **success** including `Typecheck and build`. Connected mechanics/protocol gate closed.

Canonical Uncanny evidence was reconciled before this slice and NEXT advanced to Berserker Intimidating Presence. Do not repeat validated Uncanny work.

## Berserker Intimidating Presence R2 closure evidence

Focused connected proof exists at `tests/ui/connectedProjectedCharacterBerserkerIntimidatingPresenceResolution.test.ts` and is gated in Phase12.

First direct red on `999c234fcc4f1a1890408e63805f43e0021bc7fe` was not mechanics: `missing canonical host/client content for subclass: 광전사의 길` from `characterSessionProjection.ts`.

Minimal forward fixes on the tested tree:
- `7e8541864f19c1abd22bbe0a32ae0f2dae685fa0`: add the missing canonical `dnd.srd521.subclass.barbarian.path-of-the-berserker` catalog entry only; no second fear engine/protocol/schema.
- fixture corrections through `4644987154266bf5e822e4b69231d66de662ea9f`: mirror persisted Berserker Character shape rather than invent remote-only rules.

The focused proof covers Host-unknown authoritative ActionRequest, feature resource and Bonus Action economy, Frightened effect, Host permanent Character-library isolation, one ordered resource/economy/effect event batch, owning Client durable exactly-once apply, duplicate request/event replay safety, reconnect preservation, and compensating Undo/inverse owner persistence.

Exact-head `4644987` evidence is fully green:
- Phase12 run `32971089719` / connected-protocol job `98184748123`: connected authority **success**, Phase11 walkthrough **success**, production frontend gate **success**.
- UI run `32971089807` / frontend job `98184747959`: **success**, including `Typecheck and build`.
- `windows-connected-playable` is still R3 acceptance and is not an R2 gate.

Canonical `.agents/V1_CURRENT_HANDOFF.md` / `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md` may still point to Berserker because the 20-minute execution checkpoint arrived immediately after the exact-head gates completed. Reconcile those docs before starting another R2 slice.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Do not repeat validated Rage, Wild Shape, Cunning Dash, Cunning Disengage, Cunning Hide, Uncanny Dodge, or Berserker Intimidating Presence.
3. Read only current `.agents/V1_CURRENT_HANDOFF.md` and `.agents/V1_RELEASE_EXECUTION_CHECKLIST.md`. If they still point to Berserker, minimally record exact head `4644987`, Phase12 `32971089719` / `98184748123` green, and UI `32971089807` / `98184747959` green, then advance NEXT according to the existing R1 execution order.
4. Do not start the next feature before that canonical reconciliation. The likely next candidate is Open Hand Wholeness of Body (`f26092033673622c7c15755ac304678441a1eda3` R1), but live canonical ordering wins.
5. For the next slice, reuse existing Host authority + ordered `ResolutionEvent` + Client apply + duplicate/reconnect + compensating Undo primitives. Add only the smallest deterministic proof/fix if direct evidence shows a gap.
6. `PLAN.md` remains unchanged unless routing materially changes. Persist `STATE.md`, then `control.json` LAST.
7. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
