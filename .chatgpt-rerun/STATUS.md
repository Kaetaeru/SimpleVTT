# Rerun 상태

**연결 상태:** `main` coordination · 자동 검증 완료, human Windows acceptance 대기

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 상태: `needs_user`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 검증 완료 소스 HEAD: `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

## 현재 상태

이번 watcher 호출에서도 `README → control.json → STATE.md → PLAN.md` mandatory preflight를 정확한 순서로 수행했습니다. authoritative control은 시작 시점부터 `sequence=3 / needs_user`였고, STATE/PLAN과 동일하게 자동 검증이 모두 종료된 exact HEAD `bed3119c...`를 가리키고 있습니다.

저장소 재대조 결과 canonical `main`은 preflight 시점에 `50d87cf329577891fdc138e072fbf3c5ee9e6d27`이었고, PR #109는 `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`에서 open/draft/unmerged로 유지되고 있습니다. 검증된 boundary 1–10, 기존 reachability audit, UI/Main/connected/persistence/Windows automation은 반복하지 않았습니다.

현재 미완료 지점은 코드나 CI가 아니라 **human Windows acceptance**입니다. 자동 검증은 exact HEAD `bed3119c...`에서 UI, Rules Domain, Contract validation, Persistence, Phase 11, Phase 12 Connected Session, Main Playable과 각 Windows build/stage/upload까지 모두 success로 닫혀 있습니다.

필요한 사람 검증은 두 가지입니다.

### A. Standalone Sheet-at-table
- Windows playable artifact/build를 실행한다.
- 일반 Character Sheet에서 ability/save/skill/Initiative/attack/damage/common-die rolls를 확인한다.
- Hit Dice, spell slots/resources, local roll history를 확인한다.
- portrait preview/focal 위치/replace/remove와 재시작 후 persistence를 확인한다.
- 두 normal sheet layout이 routine debug/provenance clutter 없이 실제 사용 가능한지 확인한다.

### B. Two-instance Host/Client
- Windows 인스턴스 두 개에서 Host를 시작하고 saved Character로 Client가 join한다.
- direct-IP/session-name 및 required-content parity가 Ready 전에 정상 수렴하는지 확인한다.
- play를 시작하고 freeform/initiative intent-first mechanics와 기존 Host authority를 확인한다.
- Host가 local DM image를 reveal하고 Client가 receive → dismiss → reopen, Host가 withdraw하는 흐름을 확인한다.
- reveal이 활성화된 상태에서 Client를 reconnect하고 현재 reveal이 복원되는지 확인한다.
- tactical grid/token/fog/path/LOS/cloud dependency가 생기지 않았는지 확인한다.

두 human pass가 모두 성공하면 exact SHA와 관측 결과를 기록한 뒤 V0.9를 `complete`로 닫을 수 있습니다. 결함이 발견되면 정확한 UI 동작과 관측 결과를 기록하고 같은 sequence를 `continue`로 되돌려 그 결함만 수정합니다.

이번 watcher 호출에서는 control이 `needs_user`이므로 소스 수정, 자동 검증 재실행, PR merge를 수행하지 않았습니다. PR #109는 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
