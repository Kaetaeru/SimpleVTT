# UX / Structure Gates

## 운영 원칙

각 rules/domain phase 사이에 구조와 사용감을 검증한다.

기본 순서:

```text
Phase N implementation
-> deterministic/domain regression
-> Structure Gate
-> owner UX walkthrough
-> revise contracts/UI if needed
-> Phase N+1
```

UI가 확정됐다고 가정하지 않는다. Domain이 UI를 억지로 굽히거나 UI가 named rule hard-code를 요구하는 징후가 나오면 다음 phase 전에 수정한다.

## Gate 04.5 — Character Creation v0.9

목표: Phase 05 전에 canonical Character Creation v0.9의 실제 사용감을 검증한다.

### 현재 runtime 구조

- Vite pre-transform이 실제 `create` route를 `CharacterCreateScreenV09`으로 교체한다.
- `main.tsx`는 `characterCreationV09Adapter`를 로드한다.
- UI는 `CharacterCreationPlan`을 렌더링한다.
- 현재 데이터/결과는 MockAdapter 기반이며 아직 Real Rules/ContentCatalog integration은 아니다.

### 자동 구조 smoke scenarios

`tests/ui/characterCreationV09Smoke.ts`와 `tests/ui/characterCreationV09.test.mjs`에 다음 시나리오를 고정한다.

- Fighter level-1 draft: 이름 -> 종족 -> 배경 -> 클래스 -> 기술 2개 -> 현재 레벨 Fighting Style -> review -> commit
- Fighter -> Wizard source change: Fighter 전용 Choice 제거, Wizard 장비 갱신, 주문 Choice 활성화, 미래 subclass 미선택 유지
- Guided <-> Quick: 같은 CharacterCreationDraft ID와 입력값 유지

CI wiring은 현재 GitHub connector write filter 때문에 아직 기존 UI workflow에 추가하지 못했다. 테스트 파일은 저장돼 있으며 wiring 전까지 완료로 세지 않는다.

### Owner walkthrough

아래는 코드/데이터 수정 없이 실제 앱에서 수행한다.

1. 내 캐릭터 -> 새 캐릭터
2. 이름 입력
3. 종족 선택 및 상세 확인
4. 배경 선택 및 상세 확인
5. 전사 선택
6. 능력치 방법/배치 확인
7. 자동 숙련과 실제 기술 선택 구분 확인
8. 전투 방식 1개 선택
9. 시작 장비 선택
10. 주문 섹션이 전사에서는 비활성/미적용인지 확인
11. 이전 섹션으로 돌아가 클래스를 마법사로 변경
12. Fighter 전용 선택이 사라지고 Wizard 주문 섹션이 생기는지 확인
13. Guided -> Quick -> Guided 전환 후 입력이 보존되는지 확인
14. Review에서 source / automatic grants / derived / validation 구분 확인
15. 캐릭터 생성 후 시트로 이동하는지 확인

### UX 관찰 항목

- 큰 선택의 구분이 직관적인가
- 좌측 섹션 rail이 진행 상황과 revisiting을 잘 전달하는가
- 우측 persistent summary가 도움이 되는가
- upstream source 변경의 결과가 놀랍지 않은가
- Blocking / Warning 문구가 행동 가능한가
- 선택 카드 정보량이 너무 많거나 적지 않은가
- Guided의 다음 버튼과 직접 섹션 이동이 충돌하지 않는가
- Quick이 실제로 빠르면서 같은 draft라는 느낌을 주는가
- Review가 결정을 검증하기에 충분한가

## 이후 gates

- Gate 05.5: Effect / condition / duration / concentration / rest lifecycle UX
- Gate 06.5: Spellcasting / target / save / concentration UX
- Gate 07.5: Real CharacterCreationPlan + ChoiceDefinition + progression UX
- Gate 08.5: real SRD semantic catalog coverage walkthrough
- Gate 09: RealAdapter end-to-end acceptance
