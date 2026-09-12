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
[기능 인벤토리](../design/v2/CAPABILITY_INVENTORY.md) 절 단위로 채웠다. 모든 검증은 Linux 오프라인 테스트(`npm run test:table`, 28건)와
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

## Evidence

| Gate | SHA | Evidence |
| --- | --- | --- |
| `T2-01`+ | 이 브랜치 head | `tests/table/{kernel,engagement,objects,reactions,improvise,spells,rest}.test.ts` 22건 green (Linux) |
| `T2-03` (커널) | 이 브랜치 head | `tests/table/connected.test.ts` 4건, `tests/table/facade.test.ts` 2건 green (메모리 전송) |
