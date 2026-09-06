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

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
