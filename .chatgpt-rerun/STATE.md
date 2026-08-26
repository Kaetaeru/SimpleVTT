# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `1`
- task_id: `phase14-production-play-session-ux`
- dispatch status to publish: `continue`
- repository: `Kaetaeru/SimpleVTT`
- canonical branch/ref: `work/v1-composite`
- control path: `.chatgpt-rerun/control.json`
- checkpointed_at: `2026-08-26T22:11:00+09:00`

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
- Uncanny Dodge: `a1edf6bc869984aaabf5cf5f564f4f11c21399ad`; UI `32970182652` / `98181814250`, Phase12 `32970182722` / `98181814527` green. Duplicate owner interrupt-response/event, reconnect, owner write-back and compensating Undo are covered. Ponytail cleanup `d8df984ce868e3ae9bf8a78162e0924120f4f2c3` removed duplicate remote Rogue rules materialization.
- Berserker Intimidating Presence R2: exact test head `3d3c9866fd24c15d233e8d8730e70052597e8fec`; Phase12 `32971306050` / connected-protocol `98185443594` success through focused authority proof, Phase11 walkthrough and production frontend gate; UI `32971305995` / frontend `98185443299` success including `Typecheck and build`. `windows-connected-playable` is R3, not an R2 gate.

## Berserker Intimidating Presence R2 closure

- Focused proof: `tests/ui/connectedProjectedCharacterBerserkerIntimidatingPresenceResolution.test.ts`.
- Direct connected gap was canonical Berserker subclass projection/content identity, not mechanics.
- `7e8541864f19c1abd22bbe0a32ae0f2dae685fa0` added canonical `dnd.srd521.subclass.barbarian.path-of-the-berserker` identity without a second fear engine/protocol/schema.
- `3d3c9866fd24c15d233e8d8730e70052597e8fec` proves Host-unknown authoritative resolve, resource/Bonus Action/Frightened ordered events, Host permanent-library isolation, owning Client durable exactly-once apply, duplicate safety, reconnect preservation, and compensating Undo/inverse owner persistence.
- Canonical handoff/checklist commit `c0275f10b17834fafcabb8afe3fdf6c46e8d0d7a` records exact evidence, closes Berserker Intimidating Presence R2, and advances NEXT.

## Active R2 slice — Open Hand Wholeness of Body

Canonical NEXT is **Open Hand Wholeness of Body remote-owner gap**. R1 exact checkpoint `f26092033673622c7c15755ac304678441a1eda3` is already source/execution green; do not reimplement or rerun it merely because R2 started.

Current connected proof work:
- `b621ede2f64b9be50e814104f7bdf7c56cfa7e0d` added `tests/ui/connectedProjectedCharacterWholenessResolution.test.ts` covering Host-unknown authority, HP/resource/Bonus Action ordered events, Host permanent-library isolation, owning Client durable exactly-once apply, duplicate request/event safety, reconnect/rebind, and compensating Undo/inverse write-back.
- `d2923455f1de8e0368258b8d53ed3da7e3362925` wired that proof into Phase12. Exact run `32972457970` exposed the first direct red only: production catalog missing `dnd.srd521.subclass.monk.warrior-of-the-open-hand`.
- `81baf37690f0e36758e4eabe5d5244f8163cdaec` added the canonical Open Hand subclass catalog identity. No second healing engine/protocol/schema was added.
- `d03adbe11c10aa394628c025c36bea9d5c27f9c5` added `content/**` to the Phase12 trigger so catalog identity changes cannot bypass the connected gate.
- Exact Phase12 run `32972594009` / `connected-protocol` job `98189595694`: Wholeness connected authority proof is green and Phase11 offline walkthrough is green; production frontend `npm run build` is still in progress at this checkpoint. Do not claim R2 closure until that exact build step succeeds.

Reuse the existing Wholeness resolver, Focus Point resource, healing path, initiative/freeform economy split, Activity, generic `ResolutionEvent`, Character owner write-back, duplicate/reconnect primitives, and event-native Undo. Do not create a second healing engine, protocol, schema, or remote-only rules path.

## Next Exact Action

1. Reconcile live `work/v1-composite`; GitHub wins if newer.
2. Do not repeat validated Rage, Wild Shape, Cunning Dash/Disengage/Hide, Uncanny Dodge, Berserker Intimidating Presence, or Wholeness focused authority proof.
3. Read exact Phase12 run `32972594009`, job `98189595694`. If production frontend `npm run build` is green, close Wholeness R2 from `d03adbe11c10aa394628c025c36bea9d5c27f9c5` evidence and advance canonical NEXT to the next R2 item. If red, fix only the first direct Wholeness-related red.
4. `windows-connected-playable` remains R3 acceptance and is not an R2 closure gate.
5. `PLAN.md` remains unchanged unless routing materially changes. Persist `STATE.md`, then `control.json` LAST.
6. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging remain separate.
