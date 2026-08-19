# Rerun 상태

**연결 상태:** `main` coordination · dead-legacy cleanup CI 진단 차단됨

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `blocked`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 소스 HEAD: `5c70b3028aed70b0fc5ddafafe119f40174df833`

## 현재 상태

남아 있던 구형 `App.tsx` Sheet/Create/Scene local-only 화면은 현재 production router와 대조한 뒤 `5c70b302...`에서 제거했습니다. 현재 `CharacterSheetPlayScreen`, `CharacterCreateScreenV10`, `ProductionPlayScreen`, LevelUp, Resolution/DM, Content/Rules, Session 경로는 유지했습니다. 관련 구조 테스트도 실제 production play 화면을 검사하고 제거된 legacy 함수가 다시 들어오지 않도록 변경했습니다.

이전 validated HEAD `04d8af30...`에서 대기 중이던 Windows job 3개는 재실행 없이 모두 **success**로 확인됐습니다: Persistence `95877878039`, Phase 12 Windows connected `95878210229`, Main Windows playable `95878131296`.

새 legacy-removal HEAD는 아직 **검증 완료 상태가 아닙니다**. Main Playable run `32189591188`, job `95880814298`의 `Verify full UI, rules, TypeScript, and production frontend` 단계가 실패했고, 관측 근거 없이 소스 수정은 하지 않았습니다.

사용자 지침에 따라 앞으로 watcher의 사람용 상태 설명과 `STATUS.md`는 한국어로 작성합니다. 또한 GitHub 작업은 직접 `gh`를 독립 실행하는 경로보다 **해당 GitHub 플러그인 스킬을 먼저 호출**합니다. CI 실패는 `gh-fix-ci` 스킬을 먼저 사용하며, 스킬 자체가 필수 의존성 때문에 진행할 수 없다고 판단하면 임의 우회나 추측 수정 없이 기술 blocker로 유지합니다.

검증된 boundary 1–9는 touched 되지 않는 한 반복하지 않습니다. 다음 소스 작업은 control이 다시 `continue`로 승인된 뒤, GitHub 플러그인 `gh-fix-ci` 스킬을 먼저 호출해 위 Main Playable 실패의 정확한 원인을 확보하는 것부터 시작합니다. PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시일 뿐입니다. authoritative reconciliation 순서는 계속 `README -> control -> STATE -> PLAN`입니다.
