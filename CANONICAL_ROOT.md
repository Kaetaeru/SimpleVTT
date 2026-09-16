# SimpleVTT canonical development routing

Updated: 2026-09-16 Asia/Seoul

제품은 `client/`의 새 클라이언트다. 소유자 지시(2026-09-14)로 전면 재작성했고, 2026-09-15 지시로 격자를 삭제해
장면(Theatre of the Mind) 전용이 됐다. 옛 `src/` 앱은 기록과 부품으로만 남는다.

```yaml
product_root: client/                       # 새 클라이언트 (npm run dev / npm run build)
product_entry: client/app/main.tsx
gate: npm run gate                          # gate:client(타입·경계·단위) + gate:e2e(브라우저 17개)
#                                             ⚠ 둘을 동시에 돌리지 말 것 — 자원 부족으로 가짜 FAIL이 난다
unit_gate: npm run gate:client
e2e_gate: npm run gate:e2e                  # scripts/run-client-e2e.mjs
exe: npm run tauri:build                    # src-tauri/tauri.conf.json → dist-client
current_status_pointer: docs/CURRENT.md
current_spec: docs/design/v3/ROLL20_TABLE_SPEC.md   # 요소 전수 + 결정 기록 D1~D203, 로드맵 R1~R68
handoff: docs/HANDOFF.md                    # 새 세션이 먼저 읽을 것 — 진행 방식·현재 상태·막힌 것들
current_plan: docs/design/v3/NEW_CLIENT.md
scenarios: docs/design/v3/SESSION_SCENARIOS.md      # SC-1~SC-62, 증거 스크린샷과 짝
legacy_app_root: src/                       # 옛 V2 앱: npm run dev:legacy / build:legacy
legacy_status: docs/V1_CURRENT_HANDOFF.md
working_branch: claude/practical-newton-rye61w
```

## 무엇이 어디에 있나

- `client/{app,catalog,character,campaign,compendium,data,rules,screens,session,storage,ui}` — 제품. `src/`를 import하지
  않는다(`npm run check:client-boundary`가 강제). 바깥에서 가져오는 것은 생성된 SRD 카탈로그(`src/generated/*.json`)와
  `content/`뿐이다.
- `client/rules/` — 규칙 엔진(순수). 공격·주문·행동·통달·소환·두루마리. 호스트가 이걸 돌리고 결과만 문서에 쓴다.
- `client/session/` — 호스트 권위(`TableHost`)와 거울(`TableClient`), 프로토콜(현재 v30). 판정은 전부 호스트에서 난다.
- `tests/client/*.test.ts` — 단위 322개. `scripts/capture-client-*.mjs` — 브라우저 E2E 17개, 증거는
  `docs/evidence/new-client-m1/`.

## Authority

1. 소유자의 최신 대화 지시와 명시적 결정.
2. live GitHub의 branch/PR/CI 상태(문서가 병합이나 테스트 성공을 대신하지 않음).
3. `docs/HANDOFF.md`, `docs/CURRENT.md`와 `docs/design/v3/ROLL20_TABLE_SPEC.md`의 결정 기록(D1~D203).
4. SRD 5.2.1(2024) 원문. 데이터에 없는 것은 발명하지 않고, 필요하면 저작한 사실을 결정 기록에 남긴다(D113).
5. 과거 T2·V1·Phase 문서와 `docs/design/v2/`는 증거와 재사용 참고이며 현재 NEXT가 아니다.

## Branch / transition

- 작업은 `claude/practical-newton-rye61w`에서 진행하고 슬라이스마다 커밋·푸시한다. PR은 소유자가 요청할 때만 만든다.
- 슬라이스 하나는 "코드 + 단위 시험 + 필요하면 E2E + 결정 기록 + 커밋" 한 벌이다. `npm run gate`가 초록이어야 끝난다.
- 규칙을 바꾸는 변경은 실패하는 단위 시험에서 시작한다. 화면만 바꾸는 변경도 E2E 스크립트로 증거를 남긴다.
- 옛 `src/` 앱은 건드리지 않는다. 필요하면 `npm run dev:legacy`로 열어 보고 부품만 가져온다.
- 새 셸·규칙 엔진·저장 엔진을 또 만들지 않는다. `client/rules/`와 `client/session/`을 늘린다.

이전 V1 완료 기록은 `docs/roadmap/evidence/W9-04.md`와 `V1_EVIDENCE_LEDGER.json`에 남아 있다.
새 개편의 진행률은 별도로 증명한다. `.chatgpt-rerun/` 자기 커밋 자동화는 다시 만들지 않는다.
