# V1.6 · 세션 견고성 (session robustness)

Owner mandate (2026-09-06): "아직 세션에서 에러가 많은것같은데? 행동이 이미 쓰인상태에서 행동을 더 쓰면 사용이 안되었다는
피드백도 없고, 좀 전체적으로 조잡해. 시나리오도 대충 만들지 말고, 꼼꼼하고 모든 플레이에 대응해서 잘 되도록 만들어야지..."

## What was found (2026-09-06, reference preview + code)

- The base adapter refuses silently: an unavailable action, an ineligible target, too many targets or an unknown action
  all `return this.getSnapshot()` with nothing recorded. Thirty `resolveAction` overrides sit on top of it and most of
  their guards do the same.
- The dock only shows a reason when the *tile* was already projected unavailable (`disabledReason`), as a small red
  line under the hotbar. When the tile looked available and the adapter refused anyway, nothing is shown.
- A connected player never sees a Host refusal: the Host answers with an `error` wire message and the client stores
  it in `session.compatibilityMessage` (English, shown only in the session status pane), not in the dock.
- As the DM, clicking a target card while the action is refused switches the controlled actor to that card.

## Direction

A refusal is a first-class outcome. Every command the table can issue either commits (a resolution, an activity entry,
a state change) or produces a **refusal** the same peer can see the moment it happens: what was refused, why, in the
rules' words, in Korean, in the dock — on the Host and on every player, in Initiative and 자유 진행.

## Gates

| ID | Gate | Kind | Done when |
| --- | --- | --- | --- |
| `S1-01` | Refusal protocol: `snapshot.refusal` carries `{code, message, actionId, origin}`; the base adapter and the connected client/host paths set it instead of returning silently; a catch-all in the provider turns any remaining silent no-op into a refusal; the dock shows a refusal notice (prominent, auto-clearing) for local and Host refusals alike | runtime + UI | unit tests on the base refusals, the client wire `error` → refusal mapping and the notice structure; screenshots of a local and a Host refusal |
| `S1-02` | Availability truth on every peer: the projected `available`/`disabledReason` of every action tile matches the Host after each commit (turn economy, off-turn, resources, targets, downed) | runtime | parity assertion after every action in the H+P1+P2 runners, red-before/green-after for any drift found |
| `S1-03` | Play matrix on Windows H+P1+P2: every action kind × mode × peer, including the wrong plays (used action, off-turn, no target, too many targets, out of resource, downed actor, pending remote action) — each step asserts a commit or a visible refusal with the expected reason on all three peers | acceptance | `scripts/run-tauri-e2e-play-matrix.mjs` green in CI; every defect it surfaces fixed with a test |
| `S1-04` | Scenario 2: a second theater-of-mind one-shot that exercises every play kind and the DM flows (roster, conditions, HP, rest, XP, session end) with deliberate wrong plays, converging on all peers | acceptance | scenario document + runner green on the merge head |

## What the play matrix found (2026-09-06, PR #385)

- **M7** — the DM's own second attack with a spent action was swallowed silently by the production attack path
  (no refusal, no commit). Fixed: the Host's own path refuses table-economy reasons (turn, action/bonus/reaction spent,
  0 HP, resources) with the projected reason before any production path runs.
- **M8** — a character at 0 HP could still attack. Fixed as a rule: at 0 HP a character may only roll a death save
  ("의식불명 · 죽음 내성 굴림만 할 수 있습니다."); a combatant at 0 HP cannot act.
- **M2 (not a defect)** — a PC attacking another PC with a weapon is a legal play: the projection offers other
  characters as weapon-attack targets on purpose (`characterSessionProjectionMount.eligibleTargetIds`). The Host's
  target pre-check therefore covers only what no path disputes: an enemy-only action aimed at the actor himself, and
  more targets than the action allows. Range/cover/membership stay with their providers (W4-07's
  "적용 거부: beyond range" fact, W9-02D's readied trigger).
- The remote wire code for an invalid target stays `action-rejected` (MP-C21 contract); the reason rides in the
  message.

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `S1-01` | `4e53e37991f5e75bc9dfde6f6f135a7c6e440433` | PR #385. `snapshot.refusal` on every peer; base adapter, connected client (Host `error` → Korean reason), Host pre-checks (origin `remote` so the DM sees the player's refusal) and the provider catch-all; `SessionRefusalNotice` above the dock. `tests/ui/sessionRefusal.test.ts`, `tests/ui/sessionRefusalStructure.test.ts`. Screenshots: `docs/design/ui-ux/v1_6/s1-01/{player-refused,dm-refused}.png` (reference preview), `docs/design/ui-ux/v1_6/s1-03/{p2-action-spent,p1-off-turn,host-dm-refused,p2-down}.png` (real H+P1+P2). |
| `S1-02` | `4e53e37991f5e75bc9dfde6f6f135a7c6e440433` | PR #385. Play matrix M4: after 카엘's attack commits, his own projection shows 대검 `available:false` with "행동을 이미 사용했습니다." before he tries again, and `expectUiParity` (Host vs P2 action bar on his turn) holds; M5/M8 the same for 세컨드 윈드 and the 0-HP rule. `docs/design/ui-ux/v1_6/s1-03/matrix-summary.json`. |
| `S1-03` | `4e53e37991f5e75bc9dfde6f6f135a7c6e440433` | PR #385. `Play Matrix Windows Verification` run 34040263364 on the PR head (M1 자유 진행 연속 공격, M2 자기 자신 대상, M3 대상 초과, M4 행동 소진, M5 추가 행동 소진, M6 남의 턴, M7 DM 행동 소진, M8 쓰러짐, M9 정리 — all PASS on H+P1+P2, each refusal asserted on the acting peer's dock and on the DM, with nothing committed on the Host). Launcher `-Matrix`, workflow `play-matrix-windows.yml`. |
