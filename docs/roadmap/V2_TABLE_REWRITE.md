# V2 · Table Rewrite (세션 플레이 층 재작성 + DM Workspace)

> 2026-09-09: 범위·우선순위·충돌 시 기준은 [제품 전면 개편 설계](../design/v2/PRODUCT_RENOVATION.md)를 따른다.
> 이 문서의 T2 순서와 전체 상태 방송/복원 설명은 그대로 구현할 지시가 아니다. 기존 세션 설계 참고로 유지한다.

Owner decisions (2026-09-07):

- "지금 파악안된 오류가 너무 많을게 뻔해서 전면 재작성을 해보자고 했던거야." → rewrite the session/play layer.
- Accepted: Host single authority · keep domain and UI · core-first switch-over · same repo, branch `work/v2-table`.
- "FVTT와 Roll20의 호스트와 비슷한 형태의 DM UI … 전부 한번에 편하게 등록 가능하고 사용 가능하면 좋겠어. UX를 꼼꼼하게
  고려해줘." → DM Workspace redesign.

Design: `docs/design/v2/TABLE_RUNTIME.md`, `docs/design/v2/DM_WORKSPACE.md`. V1.7 "DM 재량과 자유도" is absorbed
into this program (T2-01 ruling commands, T2-05 player freedom, T2-07 scenario 3); it is not built on the old chain.

Branching: gate branches `agent/t2-xx-*` → PR into `work/v2-table`. Switch-over (T2-07) → PR into `work/v1-composite`.
The old app keeps running on `work/v1-composite` until then.

## Gates

| ID | Gate | Done when |
| --- | --- | --- |
| `T2-00` | Design: runtime architecture, DM workspace UX, this roadmap | merged |
| `T2-01` | Table kernel, offline: `TableState`, `dispatch`, events + `applyEvent`, `project()` to `AppSnapshot`; actors (SRD monsters, characters), modes/initiative/turns, weapon/unarmed attacks, checks/saves, damage/heal, the 14 canonical 2024 conditions with mechanics and durations, engagement, the DM ruling palette (damage/heal/temp/max HP, conditions, adv/dis, 영감, prone/stand, life state, resources, badges), post-hoc corrections, undo. Old play screens render the new snapshot in the reference preview | `tests/table` green (handlers, replay property, availability truth); preview screenshots of a fight played end-to-end on the new runtime |
| `T2-02` | Spells, reactions, questions, standard actions: spell cast via the domain kernel (slots, components incl. hands, concentration, upcast), reaction windows as questions (opportunity attack, shield, counterspell), ready, dodge/disengage/help/hide/search, death saves/stabilize, short/long rest, item use | `tests/table` green; the fixture cleric and fighter play scenario 1's beats offline |
| `T2-03` | Connected: wire (hello/command/event-batch/snapshot/question), `TableHost`/`TableClient`, reconnect by cursor, owner write-back, parity by construction | play matrix M1–M9 green on Windows H+P1+P2 against the new runtime (runner header re-targeted); C1-MP green |
| `T2-04` | DM Workspace UI: sidebar tabs (기록·전투·액터·아이템·자료·규칙·세션), token cards + HUD, ruling bar, Ctrl+K unified search, 준비실 on the campaign screen, host-owned library, bulk registration, 장면 묶음; player skeleton | screenshots of the eight prototype scenes in `DM_WORKSPACE.md` §8; structure tests; owner review |
| `T2-05` | Player freedom: hands (stow/draw/don/doff with the 2024 free-interaction and action costs), prone/stand, object interaction, improvised action → DM DC question, Korean component refusals with guidance; DM read-only PC sheet with true level/HP/resources | `tests/table` green; TOM1 + TOM2 green on the new runtime |
| `T2-06` | Feature families port: rage, wild shape, monk (focus/open hand), paladin (lay on hands, abjure, auras), rogue, cleric (spark, turn undead), bard, warlock pact, druid land, summons, zones/artifacts, weapon mastery, monster multiattack/timing/legendary | each family's existing domain tests plus a table handler test; TOM1/TOM2/C1-MP still green |
| `T2-07` | Switch-over: `main.tsx` on the table facade, old session adapters deleted, legacy boundary updated, scenario 3 "DM 재량" (nat-1 rulings, improvised actions, hands, mass conditions, undo) green on Windows H+P1+P2; PR into `work/v1-composite`; release artifact | all runners green on the merge head; roadmap evidence rows |

## 2026-09-11 상태 — 기능 인벤토리 기준 커널 확장 (브랜치 `claude/practical-newton-rye61w`)

소유자 지시 "인벤토리와 SRD 5.2.1을 기준으로 멀티 세션·솔로·생성까지 전부 가능하게"에 따라 T2 게이트를 순서대로가 아니라
[기능 인벤토리](../design/v2/CAPABILITY_INVENTORY.md) 절 단위로 채웠다. 모든 검증은 Linux 오프라인 테스트(`npm run test:table`, 당시 28건 → 2026-09-14 45건)와
`tsc`/`vite build`/경계 검사다. **Windows H+P1+P2 실행과 새 화면(T2-04)은 하지 않았다.**

| 게이트 | 상태 | 이 브랜치에서 한 것 |
| --- | --- | --- |
| `T2-01` | 확장 | 교전 기록(P0b), 자세, 손/바닥/물건, 투척·즉흥 무기, 아군 대상(D7), 붙잡기/밀치기/탈출, 비치명(D9), 준비 행동, 휴식, 안정화, 숨기, 열린 판정 |
| `T2-02` | 부분 | 주문은 도메인 커널로 시전(슬롯·상위 시전·구성요소·집중·턴당 슬롯 1회). 반응 창은 질문 큐(기회공격·준비 발동). 방패/역마법 같은 명중 시점 반응 주문은 아직 없음 |
| `T2-03` | 커널만 | `TableHost`/`TableClient`/wire/수신자별 필터/재접속/명령 중복 제거/소유자 write-back 훅. 메모리 전송으로 검증. 데스크톱 전송 바인딩(`tauriTableTransport`)은 코드만 있고 실기기 미검증 |
| `T2-04` | 미착수 | DM 워크스페이스 화면 없음. 옛 화면이 facade로 새 런타임을 렌더링한다 |
| `T2-05` | 부분 | 손/자세/물건 상호작용/즉흥 행동→DM 판정(§13)은 커널에 있음. 화면 없음 |
| `T2-06` | 미착수 | 직업 기능군 이식 없음 (기존 도메인 테스트는 그대로) |
| `T2-07` | 미착수 | `main.tsx`는 여전히 `?table=v2` 또는 `localStorage.simplevtt.table="v2"`로만 V2를 켠다 |

## 2026-09-14 공식 규칙 대조 — 게이트별 남은 일

구현 명세와 순서: [RULES_RUNTIME_SPECS.md](../design/v2/RULES_RUNTIME_SPECS.md) §5.

[인벤토리 §22](../design/v2/CAPABILITY_INVENTORY.md)의 감사 결과를 게이트에 대응시키면 다음과 같다. 위 표의 "확장/부분"은 공식 규칙 기준 완료가 아니다.

| 게이트 | §22가 요구하는 것 |
| --- | --- |
| `T2-01` | 시계(라운드·휴식·DM 시간 경과), 시야·엄폐·공포·속도 0 사실 공급, 교전 종료 규칙, 이니셔티브 기습·동률, 턴 경계 효과 정리, 피해 유형 ID 통일, PC 저항 |
| `T2-02` | 명중·시전·피해 시점 반응 창(방패·역마법·지옥의 질책), 대상 없는 주문·부활·의식·계약 마법, 죽음 내성 자동화, 물약 추가 행동, 준비 주문 시전 시점 |
| `T2-03` | 소유자 write-back 전체(HP·자원·슬롯·죽음 내성), 세션 저장, 재접속 후 질문 답변, 몬스터 정보 비공개, 1대1 채널 |
| `T2-06` | 직업·종족·특기 기능군 전부와 자원 풀·짧은 휴식 회복, 무기 숙련, 몬스터 재충전·전설·다중 공격·부가 효과·주문 시전, 소환·변신 액터 |
| `T2-05`/`T2-04` | 결과 카드 사후 토글, 장면 엔티티·장면 조건, 물체 액터, DM 아이템 지급·화폐, 시간 경과 명령 |

## 2026-09-14 진행 — 규칙 런타임 명세 네 슬라이스 GREEN (같은 브랜치)

[RULES_RUNTIME_SPECS.md](../design/v2/RULES_RUNTIME_SPECS.md) §1~§4를 순서대로 구현했다 (`0e160b3d` 시계, `1b8eb7d3` 반응 창·D42 팔레트, `01d7d148` 직업 기능 원장, `66bb2053` 장면·액터 종류·저장). 요약은 [인벤토리 §0.2](../design/v2/CAPABILITY_INVENTORY.md). 게이트별로는:

| 게이트 | 상태 | 이번에 들어온 것 | 남은 것 |
| --- | --- | --- | --- |
| `T2-01` | 확장 | 한 시계(라운드·휴식·시간 경과·타이머), 교전 종료 규칙(D25), 물체 액터, 장면 전환·대기석, 공포·투명·숨음 공격 수정(슬라이스 5) | 이니셔티브 기습, 피해 유형 ID 통일 |
| `T2-02` | 대부분 | 명중·시전·피해·내성 시점 반응 창(방패·역마법·지옥의 질책·전설적 저항), 보류 해결의 같은 눈 재생, 휴식 제안/완료(D30) | 대상 없는 주문·부활·의식, 죽음 내성 자동화, 준비 주문 시전 시점 |
| `T2-03` | 커널 | 스냅샷 저장·재개, 새 피어 id 재접속 후 카드 답변, write-back(HP·임시 HP·자원), 몬스터 정의 비공개·HP 단계(D22), 귓속말, 원장 무결 | write-back 나머지(슬롯·히트 다이스·죽음 내성), Windows H+P1+P2 |
| `T2-05` | 부분 | 결과 카드 사후 토글(D42 `override`), `award`, `advance-time` | 화면 |
| `T2-06` | 대부분 | 핵심 직업 자원 풀·회복, 기능 행동 14종, 분노·암습 부가 효과, 계약 마법, 소환 액터; 슬라이스 5·6: 바드의 영감(부여·사용), 불굴, 표식·강타 부가 효과, 무기 숙련 6종, 야생 변신, 몬스터 재충전·전설 행동·다중공격 루틴·명중 부가 효과 | 베어가르기·찌르기 숙련, 몬스터 주문 시전, 야생 변신 속도·감각 |
| `T2-04` | 슬라이스 A·B | A: 워크스페이스 뼈대 (`src/table/ui/`): 상단 바·테이블(토큰 카드, 초점 카드, D42 판정 메뉴, 질문)·사이드바 7탭·명령 센터(대상 지정)·재량 바·토큰 HUD·Ctrl+K·시트 서랍. B: 호스트 라이브러리(내 NPC·PC 프리셋·내 아이템·장면 묶음, 캠페인 없이 유지)·준비실·묶음 소환·드래그 소환·아이템 지급(`grant-item`)·토큰 드롭. 증거 [T2-04.md](evidence/T2-04.md) | 호스트 소유 이미지·노트, 이미지 토큰 드롭, 소유자 검토, Windows |
| `T2-07` | 미착수 | — | 전환 |

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `T2-01`+ | 이 브랜치 head | `tests/table/{kernel,engagement,objects,reactions,improvise,spells,rest}.test.ts` 22건 green (Linux) |
| `T2-03` (커널) | 이 브랜치 head | `tests/table/connected.test.ts` 4건, `tests/table/facade.test.ts` 2건 green (메모리 전송) |
| 명세 §1~§4 | `66bb2053` | `tests/table/{clock,windows,features,scene}.test.ts` 17건 포함 `npm run test:table` 45건 green; `tsc`, `check-legacy-execution-boundary`, `test:ui-rule-boundary`, `vite build` green (Linux) |
| `T2-04` 슬라이스 A·B | 이 브랜치 head | `tests/table/workspace.test.ts` 4건 (`npm run test:workspace`), `tests/table/library.test.ts` 3건, [evidence/T2-04.md](evidence/T2-04.md)의 Chromium 캡처 13장 (dev 미리보기, Linux) |
| 슬라이스 5·6 | `72fa7dd8` | `tests/table/{statblock,mastery}.test.ts` 14건과 `features.test.ts` 2건 추가, `npm run test:table` 61건 green; `tsc`, 경계 검사 둘, `vite build` green (Linux) |
