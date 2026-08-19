# Rerun 상태

**연결 상태:** `main` coordination · 자동 검증 완료, human Windows acceptance 대기

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 검증 완료 소스 HEAD: `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

## 현재 상태

이번 실행은 `README → control.json → STATE.md → PLAN.md` mandatory preflight를 정확한 순서로 수행하고 `sequence=3 / continue`와 기존 work HEAD `5c70b302...`를 확인한 뒤, 미완료였던 Main Playable CI 실패만 재개했습니다. 이미 검증된 boundary 1–9와 legacy 도달성 감사는 반복하지 않았습니다.

CI 진단은 사용자 지침대로 GitHub 플러그인 `gh-fix-ci` 스킬을 먼저 호출했습니다. 현재 환경에 `gh`가 없어서 스킬 자체의 Actions 로그 경로는 사용할 수 없었고, 사용자가 승인한 connector fallback으로 정확한 job `95880814298` 로그를 읽었습니다.

실제 원인은 runtime 코드가 아니라 `.agents/UI_NAMED_RULE_BASELINE.json`이 이미 삭제된 구형 `App.tsx` Sheet/Create 코드의 named-rule 산술 흔적 4종을 계속 기대하던 baseline drift였습니다. 삭제된 legacy debt 항목만 baseline에서 제거했고, runtime/mechanics/UI 소스는 추가 변경하지 않았습니다. 수정 commit은 `bed3119c...`입니다.

이 exact HEAD에서 자동 검증은 모두 **success**로 종료됐습니다:
- UI `32202359225`
- Rules Domain `32202359177`
- Contract validation `32202359173`
- Persistence `32202359176` — application-contract와 tauri-storage 모두 success
- Phase 11 Playable `32202359213` — offline + Windows executable build/stage/upload success
- Phase 12 Connected Session `32202359183` — connected protocol + Windows connected build/stage/upload success
- Main Playable `32202359188` — 전체 production contract + Windows Tauri/build/stage/upload success

자동 검증 관점에서는 현재 exact HEAD가 수렴했습니다. 남은 V0.9 Definition of Done은 **human Windows acceptance**뿐입니다.

필요한 사람 검증은 두 가지입니다. 첫째, standalone Sheet-at-table에서 일반 시트의 routine rolls, Hit Dice/주문 슬롯·자원/로컬 기록, portrait 편집과 재시작 persistence를 확인합니다. 둘째, Windows 두 인스턴스로 Host/Client direct-IP + content parity + Ready/start를 거친 뒤 intent-first play와 DM 이미지 reveal/dismiss/reopen/withdraw/reconnect 복구를 확인합니다.

두 human pass가 모두 성공하면 같은 exact SHA를 기록하고 V0.9를 `complete`로 닫을 수 있습니다. 실패가 있으면 정확한 UI 동작과 관측 결과를 기록한 뒤 같은 sequence를 `continue`로 되돌려 그 결함만 수정합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
