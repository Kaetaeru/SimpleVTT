# V1.5 · 전투 피드백 (combat feedback)

Owner mandate (2026-09-06): "공격을 하거나 마법을 쓰거나 했을때 이펙트와, 데미지 숫자표기같은 피드백을 확실하게
만들어줘. 세션 내에서도 그렇고 전체적으로말이야."

## Direction

Every roll that lands must be *seen* the moment it lands, by everyone at the table, without opening 기록:

- **Numbers on the creature** — damage floats off the target's card in the rail (`−7 참격`, tinted by damage type),
  healing floats on (`+6`), temporary HP (`+5 임시`), a new condition as a chip (`넘어짐`), `쓰러짐` when HP hits 0,
  `일어남` on a revive. Misses show `빗나감`, critical hits `치명타!`. Saves and checks show `내성 성공 · 16 vs DC 13`.
- **Impact on the card** — the card shakes and flashes red on damage (harder and gold on a critical), lifts and
  flashes green on healing, sways on a miss, sags and desaturates when down.
- **Result banner on the stage** — one line at the top of the stage, gone in a few seconds: `카엘 · 롱소드 → 고블린 1`
  / `명중 · 6 참격 피해`; `세라 · 신성한 불길 → 늑대 3` / `내성 1 성공 · 0 실패`; `세라 · 치유의 단어` / `카엘 HP 6 회복`.
- **Effects** — the delivery/impact shots between cards (slash, arrow, fire bolt, radiant beam, wave) play in
  자유 진행 as well as Initiative; healing gets its own green delivery.
- **Same everywhere** — all of it is derived from the snapshot (entity deltas + the resolution view) that every peer
  already receives, so the Host and every player see the same numbers at the same time, in the session workspace
  whichever mode it is in. Reduced motion keeps the numbers and the banner (shorter, no travel) and drops the shakes.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `F1-01` | Floating numbers and card impact: damage (typed, tinted), healing, temp HP, conditions, down/revive; card shake/flash by kind | UI | `combatFeedbackEvents` (pure diff) and `combatFeedbackStructure` green; screenshots of damage, heal, critical, miss |
| `F1-02` | Outcome feedback: miss, critical, saving throws, ability checks, and the stage banner for every resolution kind | UI | tests on the outcome events and banner text; screenshots |
| `F1-03` | Effects everywhere: VFX shots in 자유 진행, healing delivery, damage-type semantics shared between shots and numbers | UI | VFX structure suites green; screenshot of a freeform attack |
| `F1-04` | `851d6d110efa98044c086b706b6b77e2d1111efa` | Multiplayer parity on the merge head with the layer mounted: `Theater-of-Mind Scenario Windows Verification` run 34034704990 (H+P1+P2, 잿빛 관문의 늑대들 end to end) and `C1 Clean Play Multiplayer Windows Verification` run 34034706712 both green on `851d6d11`. On the PR head the first dispatched TOM run (34033515232, attempt 1) failed at the 치유의 단어 step (P2 did not reach the terminal presentation within 30 s); attempt 2 on the same commit passed. Cause not established — the runner's `last=undefined` in that message is a runner artefact (webdriverio evaluates `timeoutMsg` when the wait starts), not evidence of a hang. Both workflows are path-filtered and were dispatched by hand for this PR. |
| `F1-04` | Multiplayer parity: the feedback derives only from replicated state; the Windows H+P1+P2 scenario still passes with the layer mounted | acceptance | `Theater-of-Mind Scenario Windows Verification` and the C1-MP run green on the merge head |

## Where it lives

- `src/app/combatFeedback.ts` — pure: `diffCombatFeedback` (entity deltas between two snapshots), `resolutionFeedback`
  (miss / critical / saves / checks, once per resolution, landing at `complete` together with the HP deltas), and
  `combatBannerText` (one banner per completed resolution).
- `src/SessionCombatFeedback.tsx` + `src/combat-feedback.css` — the portal layer: floats anchored to the rail cards
  (stacked downwards, clear of the chrome), impact classes on the card, the banner between the initiative strip and
  the current-turn focus. Mounted once in `main.tsx` beside the VFX bridge, so it covers every session view.
- `src/CombatVfxBridge.tsx` / `src/app/combatVisuals.ts` — the VFX shots no longer require Initiative; healing gets
  the `heal` delivery; `combatDamageSemantic` is shared with the numbers.

Dev-preview capture note: after editing source, restart the Vite dev server before running the capture script — HMR
serves edited modules under `?t=` URLs and a capture script's plain `import("/src/app/mockAdapter.ts")` then drives
a second adapter instance (the symptom is alternating +N/−N floats).

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `F1-01` | `851d6d110efa98044c086b706b6b77e2d1111efa` | PR #383. Floating numbers off the rail cards from snapshot deltas — typed, tinted damage (`−8 참격`), healing (`+10`), temporary HP gain/loss (`+5 임시` / `−5 임시`), new conditions, `쓰러짐` at 0 HP, `+N 일어남` on a revive — with the impact class on the card (red shake on damage, gold on a critical, green lift on healing, sag when down). `tests/ui/combatFeedbackEvents.test.ts` (pure diff) and `tests/ui/combatFeedbackStructure.test.ts` green. Screenshots: `docs/design/ui-ux/v1_5/f1/{dm-hit,dm-critical,dm-heal,player-hit}.png`. |
| `F1-02` | `851d6d110efa98044c086b706b6b77e2d1111efa` | PR #383. Outcome feedback — `빗나감`, `치명타!`, `내성 성공 · 16 vs DC 13`, `판정 실패 · 9 vs DC 12` — keyed once per resolution and landing at `complete` together with the HP deltas; one banner line per completed resolution (attack / save / healing / check) between the initiative strip and the current-turn focus. Screenshots: `docs/design/ui-ux/v1_5/f1/{dm-critical,dm-miss}.png`. |
| `F1-03` | `851d6d110efa98044c086b706b6b77e2d1111efa` | PR #383. The VFX shots play in 자유 진행 as well as Initiative; healing gets the `heal` delivery; `combatDamageSemantic` is shared between the shots and the numbers. `combatVfxStructure` / `combatVfxProjection` green. Screenshots: `docs/design/ui-ux/v1_5/f1/{dm-freeform-shot,dm-freeform-hit}.png`. |
