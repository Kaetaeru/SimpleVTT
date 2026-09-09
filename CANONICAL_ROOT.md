# SimpleVTT canonical development routing

Updated: 2026-09-09 Asia/Tokyo

소유자가 세션 한정 재작성에서 캐릭터·준비·플레이·저장 전반의 개편으로 범위를 확대했다.

```yaml
existing_product_integration: work/v1-composite
renovation_integration_target: work/v2-table
current_status_pointer: docs/CURRENT.md
current_execution_plan: docs/design/v2/PRODUCT_RENOVATION.md
current_roadmap_pointer: docs/roadmap/CURRENT.md
next_work_packet: docs/design/v2/P0_WORK_PACKET.md
historical_landing_branch: main
working_branch_policy: scoped agent/* branches; explicit stacked bases when dependencies are unmerged
```

## Authority

1. 소유자의 최신 대화 지시와 명시적 결정.
2. live GitHub의 branch/PR/CI 상태(문서가 병합이나 테스트 성공을 대신하지 않음).
3. `docs/CURRENT.md`와 `docs/design/v2/PRODUCT_RENOVATION.md`.
4. 새 설계와 충돌하지 않는 기존 domain·콘텐츠·ToTM·저장 계약.
5. 과거 T2·V1·Phase 문서는 증거와 재사용 참고이며 현재 NEXT가 아님.

## Branch / transition

- 새 기능은 `work/v2-table`로 통합한다. `main`을 제품 통합 대상으로 바꾸지 않는다.
- 기존 제품은 `work/v1-composite`에서 유지하고, P6 검증 후 교체 PR을 만든다.
- 현재 설계는 #390의 `agent/t2-01-kernel`에 쌓은 문서 변경이다. #389/#390 자동 병합을 뜻하지 않는다.
- 후속 코딩 전에 live HEAD를 확인하고 의존 PR을 명시한다. 같은 파일의 병렬 작업은 피한다.
- 제품 입력/규칙 변경은 현재 재현 사례 또는 새로 합의한 사용자 여정의 실패 테스트에서 시작한다.
- 새 셸·규칙 엔진·저장 엔진·독립 전송 서비스를 새로 만드는 것보다 기존 인프라와 순수 계산을 재사용한다.
- 두 런타임이 같은 활성 세션/저장본에 동시에 쓰지 않는다. 새 저장 형식은 복사본 이관과 검증을 거친다.
- 이 변경으로 기존 PR 종료·branch 삭제·V1 저장본 초기화를 수행하지 않는다.

이전 V1 완료 기록은 `docs/roadmap/evidence/W9-04.md`와 `V1_EVIDENCE_LEDGER.json`에 남아 있다.
새 개편의 진행률은 별도로 증명한다. `.chatgpt-rerun/` 자기 커밋 자동화는 다시 만들지 않는다.
