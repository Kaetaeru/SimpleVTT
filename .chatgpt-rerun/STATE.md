# Rerun State

- run_id: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence: `3`
- task_id: `v1-product-experience-overhaul`
- dispatch state: `continue`
- current milestone: **V0.9**
- repository: `Kaetaeru/SimpleVTT`
- canonical branch: `main`
- work branch: `agent/108-production-play-session-ux`
- issue: #108
- PR #109: open/draft/unmerged; no merge authorized

## Current source checkpoint
`bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

This HEAD remains fully automated-green, but it is **not human-accepted**. The user exercised the delivered Main Playable Windows artifact and found four concrete defects, so the same sequence is re-authorized as `continue`.

## Durable GitHub/watch conventions
- `STATUS.md` and human-facing watcher status text are Korean.
- Invoke the matching GitHub plugin skill first; do not use direct `gh` as the independent/default path.
- For CI, `gh-fix-ci` first; if its `gh` dependency blocks Actions log inspection, the user-authorized connector log fallback may be used.
- No speculative fixes without exact logs or exact human repro.
- Never merge PR #109 without explicit authorization.

## Mandatory preflight completed for this acceptance-failure execution
Read from `main` in exact order:
1. `.chatgpt-rerun/README.md`
2. `.chatgpt-rerun/control.json`
3. `.chatgpt-rerun/STATE.md`
4. `.chatgpt-rerun/PLAN.md`

Reconciled at start:
- run_id `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- sequence `3`
- task `v1-product-experience-overhaul`
- control at start `needs_user`
- main `ac7d39421c5e32bf42aab67506e8295942cade4a`
- PR #109 HEAD `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`, open/draft/unmerged

## Prior automated evidence at `bed3119c...`
All automatic workflows completed success:
- UI `32202359225`
- Rules Domain `32202359177`
- Contract validation `32202359173`
- Persistence `32202359176`, application-contract `95918637454`, tauri-storage `95918637462`
- Phase 11 `32202359213`, offline `95918637574`, Windows `95918778475`
- Phase 12 `32202359183`, connected `95918637353`, Windows connected `95918775214`
- Main Playable `32202359188`, playable-contract `95918637735`, Windows `95918801170`

Do not rerun this historical evidence unless touched by the upcoming fixes. Automated green did not catch the human-facing mismatches below.

## Human acceptance failures — exact observed symptoms
1. **주사위 형태 불일치**: 실제 Windows production에서 보이는 주사위가 이전 UI demo에서 확정했던 형태/디자인이 아니고 완전히 다른 형태로 보임.
2. **demo session 공격 불가**: demo session에서 공격을 실행할 수 없음.
3. **공식 시트 레이아웃 부재**: Character에서 이전에 요구/구현한 official sheet layout 버전이 노출되지 않음.
4. **Character 카드 선택 identity 오류**: 여러 existing Character card 중 어떤 카드를 눌러도 하나의 동일 Character로 진입함.

These four observations are sufficient to fail the human acceptance pass. No claim is made yet about root causes.

## Reopened scope
Only behavior directly implicated by the four observations is reopened:
- production visual dice renderer vs prior UI-demo dice authority;
- demo-session attack/action gating;
- dual Character Sheet layout exposure, specifically the official layout;
- Character Library card -> active canonical Character selection and navigation/session entry.

Unrelated validated session authority, content parity, persistence, image handout, reconnect, Undo, VFX and dead-legacy cleanup remain closed unless a fix actually touches them.

## Next Exact Action
1. Inspect prior UI-demo dice implementation/assets and production dice mount to identify the exact divergence.
2. Trace demo-session attack path from displayed actor/action/target gating through existing authoritative action execution.
3. Trace official-sheet layout switch/mount and determine why production Character no longer exposes it.
4. Trace Character card identity through selection and active Character persistence/routing to reproduce why every card opens one Character.
5. Fix only observed causes; add focused regressions for all four.
6. Before source writes, recheck PR #109 HEAD and use only non-force fast-forward updates.
7. Validate affected UI/Main/Character/session/dice gates and collect exact-head Windows evidence after convergence.
8. Deliver a new Windows artifact for another human acceptance pass.
9. Keep PR #109 draft/unmerged.

## Dispatch recommendation
`continue`
