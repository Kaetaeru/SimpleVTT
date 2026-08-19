# Rerun 상태

**연결 상태:** `main` coordination · human acceptance 결함 수정 완료, Windows artifact 검증 진행 중

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 수정 HEAD: `d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## 현재 상태

이전 Windows human acceptance에서 보고된 네 가지 문제를 모두 수정 범위로 반영했습니다.

1. **주사위:** production 공용 physics renderer를 UI demo의 브론즈/웜 계열 facet 디자인으로 맞추고, d10의 원통형 geometry를 제거해 전용 polyhedral geometry로 변경했습니다.
2. **demo 공격:** 기본 Aelar가 reference demo에서 실제로 공격 가능한 5피트 대상이 있도록 하고, 기존 spatial runtime의 거리/가시성 fact로 합법 target만 노출합니다. 공격 resolution authority는 기존 runtime 그대로입니다.
3. **공식 시트:** Character Library 헤더에서 기존 `SimpleVTT 시트 / 공식 시트 스타일` preference를 바로 선택할 수 있게 노출했습니다. 기존 dual-sheet 구현을 재사용합니다.
4. **Character 카드:** 각 카드가 자기 `character.id`를 기존 `selectProductionCharacter`로 전달하도록 연결했고, reference Mira 카드도 별도 playable Character로 선택됩니다.

네 증상을 직접 고정하는 regression을 추가했습니다. 현재 exact HEAD의 UI run `32204865620`은 **전체 success**이며, 새 human-acceptance regression, Character/session 통합, Phase 09 mechanics, TypeScript, production build가 모두 통과했습니다. Main Playable Linux `95926017359`, Phase 11 offline `95926003264`, Phase 12 connected `95926003189`, Persistence application/Tauri, Rules Domain, Contract validation도 모두 success입니다.

중간 HEAD에서 기존 중복 테스트 하나가 d10에 `CylinderGeometry`를 요구해 실패했지만, `gh-fix-ci` 우선 + 승인된 connector log 경로로 정확한 원인을 확인했고 test-only로 정렬했습니다. 현재 UI 전체는 green입니다.

현재 남은 것은 이미 실행 중인 Windows jobs입니다:
- Main Windows `95926276820`: Tauri persistence/session transport 검증 후 executable build/stage/upload 진행 중.
- Phase 11 Windows `95926114975`: executable build 진행 중.
- Phase 12 Windows connected `95926150169`: Tauri transport/persistence 검증 후 build/stage/upload 진행 중.

다음 watcher 실행은 이 jobs를 **재실행하지 않고 결과만 회수**합니다. Main Windows가 성공하면 exact HEAD `d942d58a...`의 Main Playable artifact를 다운로드해 사용자에게 전달하고, 그때 control을 `needs_user`로 바꿔 네 항목만 다시 human acceptance 합니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
