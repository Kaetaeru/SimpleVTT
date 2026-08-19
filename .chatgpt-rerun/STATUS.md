# Rerun 상태

**연결 상태:** `main` coordination · exact-head Windows 빌드 완료, human 재검수 대기

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 수정 HEAD: `d942d58a83eb2222ffd722d58b19c67c3dc8de13`

## 현재 상태

이전 Windows human acceptance에서 보고된 네 가지 문제에 대한 수정과 exact-head 자동 검증이 완료됐습니다.

수정 범위:
1. **주사위:** production 공용 physics renderer를 UI demo의 브론즈/웜 계열 polyhedral 디자인으로 맞추고 d10 원통형 geometry를 제거했습니다.
2. **demo 공격:** 기본 Aelar가 reference demo에서 실제 공격 가능한 5피트 대상을 가지며 기존 authoritative attack runtime으로 resolve됩니다.
3. **공식 시트:** Character Library에서 기존 `SimpleVTT 시트 / 공식 시트 스타일`을 바로 선택할 수 있습니다.
4. **Character 카드:** 서로 다른 카드가 각각 자기 canonical Character ID를 선택합니다.

## exact-head 자동 검증
`d942d58a...`에서 다음이 모두 success입니다.
- UI `32204865620` / frontend `95926003383`
- Rules Domain `32204865592`
- Contract validation `32204865594`
- Persistence application `95926003457` / Tauri storage `95926003360`
- Main Playable Linux `95926017359`
- Main Windows `95926276820`: Tauri persistence/session transport, executable build, stage, upload 모두 success
- Phase 11 offline `95926003264` / Windows `95926114975`: success
- Phase 12 connected `95926003189` / Windows connected `95926150169`: success

## 전달 artifact
- 이름: `SimpleVTT-Main-Playable-d942d58a83eb2222ffd722d58b19c67c3dc8de13`
- Artifact ID: `9348955693`
- Workflow run: `32204865588`
- SHA256: `441b8eac5a0cea1cf9cbaff6788f2e7e4d0099f07d5d2c6c0deca1a2f3fefc96`
- 현재 대화에 `SimpleVTT-Main-Playable-d942d58a.zip`으로 전달됨

이제 다시 빌드할 필요는 없습니다. 사용자 Windows 재검수에서 다음 네 항목만 확인하면 됩니다: 주사위 디자인, demo 공격, 공식 시트 레이아웃, 서로 다른 Character 카드 선택.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
