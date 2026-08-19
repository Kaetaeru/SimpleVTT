# Rerun 상태

**연결 상태:** `main` coordination · human Windows acceptance 실패, sequence 3 재개

- 저장소: `Kaetaeru/SimpleVTT`
- canonical watcher branch: `main`
- 활성 작업 브랜치: `agent/108-production-play-session-ux`
- Run: `b7f27a61-29d8-4ba2-9f93-8e66722d5f41`
- Sequence: `3`
- Task: `v1-product-experience-overhaul`
- Control 목표: `continue`
- Issue: #108
- PR: #109 open/draft/unmerged
- 현재 source checkpoint: `bed3119c3e7ae5ac8663b29e7202fc0bdbd64994`

## 현재 상태

Windows human acceptance에서 실제 제품 결함 4개가 확인됐습니다. 따라서 `bed3119c...`는 자동 검증은 모두 green이지만 최종 V0.9 acceptance HEAD로 인정하지 않습니다.

확인된 증상:
1. production 주사위가 이전 UI demo에서 확정한 형태/디자인과 완전히 다르게 보입니다.
2. demo session에서 공격을 실행할 수 없습니다.
3. Character에서 official sheet layout 버전이 노출되지 않습니다.
4. existing Character card를 서로 다르게 눌러도 항상 하나의 동일 Character로 진입합니다.

이 네 가지는 human acceptance 실패로 기록됐고 같은 sequence `3`을 다시 `continue`로 열어 해당 범위만 수정합니다. 기존 UI/Main/Rules/Persistence/Phase11/Phase12/Windows 자동 검증은 `bed3119c...`에서 모두 success였으며, 수정으로 실제 영향을 받는 gate만 다시 검증합니다.

다음 작업은 UI-demo dice와 production renderer 비교, demo attack gating 추적, official sheet layout mount/switch 추적, Character card id → active canonical Character selection 흐름 추적입니다. 원인을 확인하기 전에는 추측 수정하지 않습니다.

PR #109는 계속 draft/unmerged이며 명시적 승인 없이 merge하지 않습니다.

`STATUS.md`는 사람용 표시입니다. authoritative reconciliation 순서는 `README -> control -> STATE -> PLAN`입니다.
