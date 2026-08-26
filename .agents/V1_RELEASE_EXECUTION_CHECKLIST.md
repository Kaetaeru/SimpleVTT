# SimpleVTT V1 Release Execution Checklist

Status: **CANONICAL AI EXECUTION ROUTER**
Target: **실제 로컬/연결 세션을 처음부터 끝까지 플레이할 수 있는 Windows V1**
Updated: 2026-08-26

이 문서는 작업 AI가 다음 구현 작업, 의존성, 검증 및 출시 차단 조건을 빠르게 결정하기 위한 단일 마스터 체크리스트다.

- 현재 exact head, 활성 구현 작업 및 바로 다음 체크박스는 `.agents/V1_CURRENT_HANDOFF.md`를 먼저 읽는다.
- `.agents/PHASE14_CHECKLIST.md`는 과거 구현/CI 증거 원장이다. 다음 작업 선택에는 이 문서를 우선한다.
- `.agents/CURRENT_WORK.md`와 `.agents/SHORT_TERM_CHECKLIST.md`의 Phase 09 표시는 역사적 문맥이다.
- 제품 계약은 `docs/design/` 문서가 우선하며, 이 체크리스트가 제품 계약을 재정의하지 않는다.

## 2026-08-23 exact-head delta

- Recorded head: `dc4bca6 feat(session): project ready lifecycle events`
- V1-21/V1-31/V1-32: 기본 행동 수명주기, Ready 설정/반응, connected 요청 전달, Host `ready-action` lifecycle event와 Client projection까지 구현됨.
- Immediate NEXT: 다음 자기 턴 시작과 initiative 종료로 발생하는 Ready 해제를 Host event로 전파하고 reconnect replay까지 검증.
- Structural follow-up: Ready 설정 actor별 저장, session reset 정리, capability 협상, two-instance 증거.
- V1-13: 기존 `TODO` 표시는 최근 Party Stash/DM Library 구현보다 오래되었다. exact-head 회귀와 walkthrough 증거를 확보한 뒤 상태를 정식 조정한다.

---

# 0. AI 실행 규칙

## 상태 문법

- `DONE`: 현재 canonical Git head에서 코드와 검증 증거가 모두 존재한다.
- `PARTIAL`: 코드/테스트 일부는 있으나 전체 사용자 경로, 연결 경계 또는 현재 head 증거가 부족하다.
- `TODO`: 구현 또는 검증이 시작되지 않았다.
- `BLOCKED`: 선행 조건 없이는 완료 판정을 할 수 없다.

Canonical workspace는 Git worktree `work/SimpleVTT-v1`, branch `work/v1-composite`다. 원본 source snapshot은 비교/복구 증거로만 유지하며 이후 release evidence는 canonical worktree의 SHA를 사용한다.

## 작업 단위 규칙

AI는 한 번에 하나의 `V1-*` 작업을 선택한다.

1. `depends_on`이 모두 DONE인지 확인한다.
2. 계약 문서를 읽는다.
3. deterministic failing test 또는 acceptance fixture를 먼저 만든다.
4. UI에 rules/authority/persistence 계산을 넣지 않는다.
5. 대상 gate의 focused tests를 실행한다.
6. 관련 회귀를 실행한다.
7. 체크박스에는 exact Git SHA, 명령, 결과를 기록한다.
8. 다음 unblocked 작업을 `NEXT`에 한 개만 기록한다.

## 완료 증거 형식

```text
EVIDENCE
head: <exact SHA>
tests: <exact commands and pass counts>
human: <walkthrough id or N/A>
artifact: <workflow/run/digest or N/A>
notes: <known limitation; empty only when none>
```

코드 존재, 오래된 CI run, 브랜치가 다른 test result, 브라우저 preview만으로 DONE 처리하지 않는다.

---

# 1. V1 Definition of Playable

V1은 아래 사용자 여정이 한 exact Git SHA 및 그 SHA의 Windows artifact에서 모두 성공해야 한다.

| Journey | 필수 결과 |
| --- | --- |
| J1 First run / Character | 새 사용자가 Character 생성·저장·재실행·시트 사용 |
| J2 Campaign preparation | DM이 Campaign 생성/열기, 파티/달력/식량/보관함/DM Library 준비 |
| J3 Local session | 실제 Character로 Freeform/Initiative, 행동·기술·주문·인벤토리 사용 |
| J4 Connected session | 두 앱 Host/Join, Host-unknown Character, Ready, authoritative action, reconnect |
| J5 DM live operation | Combatant, 지급/회수, 보관함, 달력/식량, 판정/Undo, handout |
| J6 Persistence | Character와 Campaign durable state는 보존되고 Session transient state는 제거 |
| J7 Mapless/module behavior | 모듈 없이는 거리 blocker 없음; provider facts만 적용; 제거 시 stale facts 무효화 |
| J8 Dice/presentation | 실제 WebGL physics dice, 뒤에서 날아와 굴러감, 결과 권위 불변 |
| J9 Release | exact-head 전체 회귀, Windows build, digest, human acceptance, canonical main |

---

# 2. 의존성 그래프

```text
V1-00 Git baseline
  └─ V1-01 Foundation audit
      ├─ V1-10 Campaign persistence
      │   └─ V1-11 Campaign product UI
      │       └─ V1-12 Calendar / Rations / Roster / History
      │           └─ V1-13 Party Stash / Campaign DM Library
      ├─ V1-20 Real Character local play
      │   └─ V1-21 Complete local play loop
      └─ V1-30 Session lifecycle / authority
          └─ V1-31 Connected projection and actions
              └─ V1-32 Connected durable write-back / reconnect

V1-12 + V1-13 + V1-21 + V1-32
  └─ V1-40 Complete DM live operation

V1-21 + V1-31
  ├─ V1-41 Spatial capability fallback
  └─ V1-42 Dice presentation

V1-40 + V1-41 + V1-42
  └─ V1-50 UX/error/accessibility
      └─ V1-60 Full regression
          └─ V1-70 Windows two-instance acceptance
              └─ V1-80 Release artifact / main
```

---

# 3. 현재 상태 요약

| Workstream | 현재 판단 | 이유 |
| --- | --- | --- |
| V1-00 Git baseline | DONE | remote 개발 계보와 로컬 Session Inventory 변경을 `work/v1-composite`에 보존하고 exact-head 검증 완료 |
| V1-01 Foundation audit | PARTIAL | production build와 full TS matrix 1303/1303 green; Rust 증거 대기 |
| V1-10 Campaign persistence | PARTIAL | TS/application source green; Cargo/Tauri filesystem 실행 증거 대기 |
| V1-11 Campaign product UI | PARTIAL | route/dashboard/empty/destructive/recovery source 존재; rendered error/migration acceptance 대기 |
| V1-12 Campaign systems | PARTIAL | roster/providers/calendar/rations/compound Long Rest source와 TS gate green; two-instance 증거 대기 |
| V1-13 Stash/DM Library | PARTIAL | source-complete, campaign/connected focused tests green; exact checkpoint와 two-instance 증거 대기 |
| V1-20 Real Character local play | PARTIAL | persisted Character projection, 339 spells, inventory/sheet source 존재; exact artifact walkthrough 대기 |
| V1-21 Complete local loop | PARTIAL | R1 source/execution action matrix는 완료; 실제 Windows local journey, durable restart, human walkthrough 증거 대기 |
| V1-30 Session lifecycle | PARTIAL | Host/Ready/end/restart source와 TS regression green; Tauri 증거 대기 |
| V1-31~32 Connected play | PARTIAL | 핵심 connected suites + remote-owner Rage/Wild Shape/Cunning Action Dash/Disengage/Hide/Uncanny Dodge/Berserker Intimidating Presence/Open Hand Wholeness of Body forward·exactly-once·Undo focused evidence green; 나머지 R1 remote-owner/reconnect matrix 및 two-instance proof 대기 |
| V1-40 DM live operation | PARTIAL | DM Library/Stash/handout/campaign operation source 존재; connected action matrix 및 end-to-end acceptance 대기 |
| V1-41 Spatial fallback | PARTIAL | mapless/provider source와 regression 존재; exact-head provider mount/unmount human proof 대기 |
| V1-42 Dice | PARTIAL | Three/Cannon, rear-entry, authoritative projection, remote dedup source 존재; human motion proof 대기 |
| V1-50~80 Quality/release | TODO | Campaign/connected 경로 완료 뒤 수행 |

세부 섹션의 오래된 unchecked 항목은 요구사항 목록이며 현재 source credit이 아니다. 현재 구현 상태와 다음 작업은 `V1_CURRENT_HANDOFF.md`를 우선한다.

---

# G0. Canonical source baseline

## V1-00 Git baseline — DONE

`depends_on: none`

- [x] 실제 `Kaetaeru/SimpleVTT` Git clone을 확보한다.
- [x] bundled Git으로 remote URL, branches, tags, commit graph를 확인한다.
- [x] 오늘 새벽 개발 commit과 이후 integration commit의 분기 관계를 확인한다.
- [x] 현재 snapshot의 실질 변경분(Session Inventory, Campaign docs)을 line-ending noise 없이 추출한다.
- [x] 최신 통합 개발 head `518210bb29b3dd2050a2554ca12bd6f9bb3411c1` 위에 변경분을 적용한다.
- [x] canonical branch `work/v1-composite`와 baseline commit을 기록한다.
- [x] 이후 모든 evidence가 canonical worktree의 SHA를 사용하게 한다.

```text
EVIDENCE
head: 9b81ae8d058a78bc39ba49843c30ae5b5ba4c939
tests: tsc --noEmit (pass); node -r ./tests/tsx-os-userinfo-bootstrap.cjs --import tsx --test tests/ui/{browserSessionDebugPreviewStructure,sessionQuickPaletteStructure,sessionFullSheetWorkspace,sessionInventoryRuntimeAdapter,physicsDice3DStructure,visualDiceProjection,visualDiceStructure}.test.ts (40 pass, 0 fail); vite build (410 modules, pass)
human: browser-session-preview-dm-inventory-2026-08-22
artifact: dist/ development production bundle; release artifact N/A
notes: remote branch agent/108-production-play-session-ux@5618c7b diverges before dice-presentation-integration@518210b; composite baseline intentionally uses 518210b plus recovered local changes. Full G1 regression and Windows artifact remain pending.
```

**Exit:** source provenance가 복구되고 현재 작업이 실제 최신 개발 계보 위에 존재한다.

---

# G1. Foundation and contract audit

## V1-01 Foundation audit — PARTIAL

`depends_on: V1-00`

- [ ] `npm install`/lockfile 상태가 canonical source와 일치한다.
- [ ] `npm run build`가 통과한다.
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`가 통과한다.
- [x] Character immutable-generation persistence 및 corruption/stale-writer tests가 통과한다.
- [x] installed content/addon validation/persistence tests가 통과한다.
- [x] Rules Domain과 UI named-rule boundary가 통과한다.
- [x] existing connected protocol/projection suites가 통과한다.
- [x] Debug/reference fixture가 production authority로 주입되는 경로를 `.agents/V1_FOUNDATION_AUDIT.md`에 목록화한다.
- [x] 중복 store/resolver/protocol/event ledger를 감사하고 현재 소유권 및 prototype composition 위험을 `.agents/V1_FOUNDATION_AUDIT.md`에 기록한다.

**Exit:** 새 Campaign/session 작업을 올릴 수 있는 깨끗한 exact-head baseline.

---

# G2. Campaign durable foundation

계약: `docs/design/campaign-runtime.md`, `docs/design/campaign-systems.md`

## V1-10 Campaign persistence — PARTIAL

`depends_on: V1-01`

- [x] `CampaignRecord` schema/version/revision 계약.
- [x] Campaign aggregate에 roster, session defaults, calendar, supply ledger, stash refs, DM Library namespace, summaries 포함.
- [x] immutable-generation local store 및 Tauri store command 소스.
- [x] create/read/update/archive/restore/duplicate/delete application service.
- [x] stale writer reject, corrupt-newest recovery, newer-schema blocker, atomic failure rollback.
- [x] Campaign A/B namespace isolation tests.
- [x] Character Library와 Installed Content store를 복사하거나 소유하지 않음.

```text
EVIDENCE
head: 2384edc6d93efb893fc6b1ad1d17df5b1aa02219
tests: campaignPersistence + campaignFailureRecovery + campaignIsolation + campaignTauriStoreStructure (10 pass, 0 fail); tsc --noEmit (pass); vite build (410 modules, pass)
human: N/A
artifact: dist/ development production bundle; Windows artifact N/A
notes: Rust campaign generation-store tests are implemented but cargo/rustc are unavailable. V1-10 remains PARTIAL until cargo test passes.
```

**Required tests:** `campaignPersistence`, `campaignFailureRecovery`, `campaignIsolation`, Tauri generation-store tests.

## V1-11 Campaign product UI — PARTIAL

`depends_on: V1-10`

- [x] Home/global navigation에서 Campaign 접근.
- [x] Campaign 목록: recent/active/archived/create.
- [x] Campaign dashboard: party, calendar, rations, stash, DM Library, session history.
- [x] Campaign 선택 없이는 Host start 불가; Player Join은 계속 가능.
- [x] `세션 시작` 설정 화면과 Campaign identity 고정.
- [ ] empty/loading/error/corrupt/migration/destructive confirmation 상태.
- [x] Debug Dock 없이 전 경로 접근.

```text
EVIDENCE
head: 2e812bb
tests: campaignRuntimeAdapter + campaignProductUiStructure (8 pass, 0 fail); product shell regression (29 pass, 0 fail); tsc --noEmit (pass); vite build (418 modules, pass)
human: browser-campaign-create-calendar-rations-session-binding-2026-08-22
artifact: dist/ development production bundle; Windows artifact N/A
notes: Home/전역 Campaign 진입, 목록·생성·대시보드, Session setup, 직접 네트워크 Host의 Campaign 필수 조건, immutable CampaignSessionSnapshot을 검증했다. loading/corrupt/migration/destructive confirmation UX가 남아 PARTIAL이다.
```

## V1-12 Roster / Calendar / Rations / Session history — PARTIAL

`depends_on: V1-11`

### Roster

- [x] Character ref/host preset/companion 구성원.
- [x] active, countsForRations, unitsPerDay, stash permission.
- [x] Host-unknown connected Character를 소유권 이전 없이 roster reference로 추가.
- [x] reconnect는 동일 roster member를 재사용하고 DM의 식량·보관함 정책을 보존.
- [x] Campaign write 실패 시 Join 거부, 임시 Character projection과 Scene 흔적 제거.

### Calendar

- [ ] provider: off/simple-day/Gregorian/declarative module profile.
- [x] 연호, 연, 월, 일, 시, 분의 구조화 입력과 한국어 표시.
- [x] Gregorian 월별 일수, 윤년, 자정/월/연도 경계 계산.
- [x] absoluteMinute canonical storage; display string을 계산 입력으로 사용하지 않음.
- [x] advance minute/hour/day, next day, DM correction, note, safe recent undo.
- [x] 24시간을 심야/새벽/아침/오전/한낮/오후/해질녘/저녁/밤으로 결정론적 projection.
- [x] OFF 상태가 Rest/Action/Session 진행을 막지 않고 저장값 유지.
- [x] Campaign clock과 Session effect clock을 무조건 결합하지 않음.

### Rations

- [ ] provider: off/tracking-only/declarative module profile.
- [x] integer ration balance와 consumption history.
- [x] roster 기반 daily consumption preview, 예외 수정, commit, undo.
- [x] shortage는 warning/pending adjudication; 기본 제품이 damage/Exhaustion 발명 금지.
- [x] OFF 상태에서 counter/automation/blocker 없음; 저장값 유지.

### Session integration

- [x] Session utility rail과 quick palette에서 Campaign 달력·식량 현황 진입.
- [x] DM은 분/시간/일 진행, 직접 날짜·시간 수정, 메모, Undo, 식량 조정·소비·Undo 수행.
- [x] Player는 동일한 Campaign 시간을 읽기 전용으로 확인하고 DM 조작 command를 받지 않음.
- [x] Session setup의 식량 공개 정책에 따라 Player projection에서 잔량·필요량·부족량 제거.
- [x] 연결 Session은 sessionId/revision envelope로 projection을 전송하고 compatible reconnect 뒤 재전송.
- [x] Session Campaign 패널과 브라우저 DM/Player 미리보기에서 roster 참조·접속 상태 표시.
- [x] Session chrome에 Campaign 시간/시간대를 상시 표시하고 DM hover/focus 직접 수정 제공.
- [ ] Windows 2-instance에서 DM 변경 → Player 반영, reconnect 복구, 숨김 식량 비노출 수동 검증.

### Compound behavior

- [ ] Long Rest + optional time advance + optional ration consumption을 하나의 preview/batch로 처리.
- [ ] 어느 Character/Campaign write-back 실패 시 partial success 없음.
- [x] 시간 진행만으로 Rest 회복 금지; Rest만으로 날짜 진행 강제 금지.

### Session history

- [x] end 시 bounded summary 작성.
- [x] calendar before/after, ration delta, stash transaction count, participant labels, DM note.
- [x] full ResolutionEvent ledger, Ready, Initiative, projection, active handout 저장 금지.

```text
EVIDENCE
head: 0defe4e
tests: Campaign clock/Session chrome focused suites (18 pass, 0 fail); Session clock structure (6 pass, 0 fail); tsc --noEmit (pass); vite build (425 modules, pass)
human: browser-session-campaign-pane-dm-player-role-projection-2026-08-22
artifact: dist/ development production bundle; Windows artifact N/A
notes: Host-unknown Join Character의 reference-only roster 편입, reconnect idempotency, Session 상시 Campaign 시계와 9단계 시간대, DM hover/focus 직접 시·분 수정, preview-local 시계 반영, 파티/접속 상태, write 실패 시 Join/projection rollback, 연호·연월일·24시간 Gregorian calendar, Player 식량 공개 정책, reconnect projection protocol, OFF preservation, next-day+optional-ration atomic commit을 검증했다. 실제 Windows 2-instance acceptance, declarative module profile validation, authoritative Long Rest compound가 남아 PARTIAL이다.
```

## V1-13 Party Stash / Campaign DM Library — TODO

`depends_on: V1-12`

### Party Stash

- [ ] Campaign-owned ItemInstances/wallet/revision/policy.
- [ ] shared/dm-approval/dm-managed 정책.
- [ ] Character ↔ stash item/GP atomic transfer.
- [ ] partial stack/unique item/provenance/idempotency/stale revision.
- [ ] equipped/wielded/attuned transfer explicit reject 또는 compound unequip flow.
- [ ] Session 종료/재시작 후 committed state 유지, pending reservation 정리.
- [ ] compatible food ItemInstance → ration ledger 명시적 전환 transaction.

### Campaign DM Library

- [ ] Images, PC presets, NPC definitions, Custom Item definitions CRUD.
- [ ] folders/tags/favorites/recents/search.
- [ ] installed rulebook definitions와 Campaign custom definition 출처 구분.
- [ ] Quick actions: Actor +1, Item 지급/회수/보관함, Image preview/reveal.
- [ ] Campaign 간 암묵적 공유 금지; 명시적 duplicate/import만 허용.
- [ ] Client payload에 private index/note/existence metadata 없음.
- [ ] definition 삭제가 materialized Actor/ItemInstance를 소급 삭제하지 않음.

**Exit G2:** Campaign을 만들고 닫고 다시 열어 모든 Campaign durable state를 독립적으로 복구할 수 있다.

---

# G3. Real Character local session

## V1-20 Real Character materialization — PARTIAL

`depends_on: V1-01`

Workspace evidence:

- `characterLibraryProductionPlayIntegration.test.ts`
- `productionFreshCharacterSkills.test.ts`
- `productionFreshCharacterInventory.test.ts`
- `productionFreshCharacterSpells.test.ts`
- `sessionInventoryRuntimeAdapter.test.ts`

Release credit requirements:

- [ ] production UI에서 persisted Character를 선택해 local Session 진입.
- [ ] identity/portrait/HP/temp HP/AC/speed/resources/items/spells/features projection.
- [ ] fixture Aelar/Mira identity 또는 fixture distance가 production path에 없음.
- [ ] Character 전환 시 이전 actor transient state가 누수되지 않음.
- [ ] restart 후 같은 Character와 durable runtime 복구.

## V1-21 Complete local play loop — PARTIAL

`depends_on: V1-20`

R1 source/execution action matrix is complete at the canonical handoff. This release item remains PARTIAL because the requirements below include actual Windows local-session journey, durable restart, and human acceptance evidence.

### Session lifecycle

- [ ] Campaign에서 local Session preparation 시작.
- [ ] Freeform 시작/종료.
- [ ] live actor set으로 Initiative 시작, turn advance, Initiative 종료.
- [ ] Session end 후 Campaign dashboard 복귀.

### Player operations

- [ ] 행동: attack, representative feature action, common action intents.
- [ ] 기술: modifier/proficiency 표시, ability/skill roll, advantage state.
- [x] 주문: 339/339 executable catalog, cantrip + slotted spell, target/cost/save/attack/concentration, partial placeholder 0.
  - Deterministic combat/health/save/condition/modifier rules are automatic.
  - Mapless world/scene interactions commit as authoritative tracked effects; optional spatial module facts are never invented.
- [ ] 인벤토리: 읽기, use, equip/unequip, attune/unattune where canonical, quantity/charges.
- [ ] full Character sheet를 Session 안에서 read/open.
- [ ] result/activity/provenance 및 safe Undo.
- [ ] unsupported mechanic은 explicit reason이며 dead button이 아님.

### Durable boundary

- [ ] authoritative commit 전 preview가 durable Character를 변경하지 않음.
- [ ] HP/resource/item/spell-slot durable write-back exactly once.
- [ ] target/Initiative/pending Resolution은 Character source에 저장하지 않음.

**Exit G3:** 한 Windows 앱에서 새 Character로 최소 한 번의 탐험 판정과 한 라운드 전투를 UI만으로 완료하고 재실행 후 상태가 맞다.

---

# G4. Session lifecycle and connected authority

## V1-30 Host / preparation / Ready / end — PARTIAL

`depends_on: V1-01, V1-11`

- [ ] 실제 Tauri transport bind/start/stop UI.
- [ ] shareable address/port 및 actionable bind error.
- [ ] Campaign/content/session snapshot 표시.
- [ ] connected participant + selected Character + Ready 상태.
- [ ] unready/incompatible/pending 상태에서 Start reject.
- [ ] prepared actor/combatant set으로 Freeform/Initiative 시작.
- [ ] explicit end가 모든 Client에 전달.
- [ ] Host restart가 stale participant/projection/turn/pending state를 되살리지 않음.

## V1-31 Connected Character projection and actions — PARTIAL

`depends_on: V1-30, V1-20`

Existing workspace tests to reconcile, not automatically credit:

- `connectedCharacterProjectionHandshake.test.ts`
- `characterSessionProjectionReconstruction.test.ts`
- `connectedProjectedCharacterSkillResolution.test.ts`
- `connectedProjectedCharacterInventoryResolution.test.ts`
- `connectedProjectedCharacterSpellResolution.test.ts`
- `connectedTwoPeerResolution.test.ts`
- `connectedProjectedCharacterRageResolution.test.ts`

- [ ] Client가 Host에 영구 저장되지 않은 persisted Character 선택.
- [ ] manifest/compatible projection handshake.
- [ ] Host는 필요한 ephemeral projection만 재구성.
- [ ] Client intent → Host authoritative validate/resolve/commit → ordered event.
- [ ] skill/action/spell/item/target/turn requests가 같은 authority path 사용.
- [ ] Host와 Client가 committed revision/result에 수렴.
- [ ] private Character source 및 DM private Campaign data 과다 전송 금지.

R2 focused evidence now includes remote-owner Rage (`dec4f22`), Wild Shape (`a65cbd2` proof), Cunning Action Dash (`ea96509` proof), Cunning Action Disengage (`134e6a8` proof), Cunning Action Hide (exact green tree `7f8e945`), Uncanny Dodge (exact green test head `a1edf6b`), Berserker Intimidating Presence (exact green test head `3d3c986`), and Open Hand Wholeness of Body (exact green test/content head `d03adbe`). Cunning Hide is green in UI run `32968629784` / frontend job `98176845419` and Phase 12 run `32968629791` / connected-protocol job `98176845690`. Uncanny Dodge is green in UI run `32970182652` / frontend job `98181814250` and Phase 12 run `32970182722` / connected-protocol job `98181814527`. Berserker Intimidating Presence is green in UI run `32971305995` / frontend job `98185443299` and Phase 12 run `32971306050` / connected-protocol job `98185443594`. Open Hand Wholeness of Body is green in UI run `32972536815` / frontend job `98189406605` and Phase 12 run `32972594009` / connected-protocol job `98189595694`, including canonical Open Hand content identity, Host-unknown healing/resource/economy authority proof, Phase11 walkthrough and production build. These slices prove Host-unknown projection/authority and ordered event convergence without transferring permanent Host Character ownership. They are focused evidence only; V1-31 remains PARTIAL until the remaining R1 remote-owner/reconnect matrix is covered.

## V1-32 Connected durable write-back / reconnect — PARTIAL

`depends_on: V1-31`

- [ ] committed request/event idempotency.
- [ ] duplicate/reordered/replayed packet 안전.
- [ ] disconnect 중 durable overwrite 금지.
- [ ] reconnect hello/projection/event replay 후 정확한 수렴.
- [ ] owning Client만 Character durable write-back.
- [ ] Host Campaign store만 Campaign durable write-back.
- [ ] 어느 durable side 실패 시 explicit failure 및 partial commit 금지.
- [ ] Session end/restart 후 stale projection/Ready/turn 없음.

R2 focused slices through Open Hand Wholeness of Body reuse the same duplicate-safe event ledger and compensating Undo foundations. Rage confirms owning-Client durable forward/inverse write-back with Host permanent-library isolation; Wild Shape and Cunning Action slices extend Host-unknown authoritative execution through class feature state/economy/effects; Cunning Hide proves d20 + Bonus Action + tagged Hidden effect convergence. Uncanny Dodge additionally proves private owner interrupt acceptance, authoritative Reaction + HP ordered events, atomic floor-half damage, owner HP durable apply exactly once, duplicate Host event and duplicate owner response no-op, stale reconnect preservation, compensating Undo, inverse owner write-back and duplicate Undo safety at exact green test head `a1edf6b`. Berserker Intimidating Presence adds canonical subclass reconstruction, target/resource/Bonus Action/Frightened event convergence, owner durable apply exactly once, duplicate request/event safety, reconnect preservation and compensating inverse persistence at exact green head `3d3c986`. Open Hand Wholeness of Body adds canonical subclass reconstruction, HP/resource/Bonus Action ordered events, owner durable apply exactly once, duplicate request/event safety, reconnect/rebind preservation and compensating inverse persistence at exact green head `d03adbe`. The remaining R1 matrix and actual two-instance/restart proof are still pending, so V1-32 remains PARTIAL.

**Exit G4:** 두 실제 Windows app instance가 Host-unknown Character로 Join하고 action/item/spell 중 하나를 commit한 뒤 reconnect/restart까지 정확히 수렴한다.

---

# G5. Complete DM live operation

## V1-40 DM play loop — PARTIAL

`depends_on: V1-13, V1-21, V1-32`

### Preparation

- [ ] Campaign roster와 실제 participants 대응.
- [ ] NPC/PC preset 검색 및 Combatant instantiate/remove.
- [ ] empty-by-default Encounter.
- [ ] session mode/content/calendar/ration/stash policy review.

### Live

- [ ] Combatant action, target, HP/status, turn control.
- [ ] DM adjudication/correction and event-native Undo.
- [ ] Campaign custom/rulebook Item 검색 후 Player에게 +N/-N 지급/회수.
- [ ] item 지급/회수가 connected authority와 owning-client write-back 사용.
- [ ] Party Stash 입출고/승인.
- [ ] calendar advance/ration consumption preview/commit.
- [ ] handout private preview/reveal/withdraw/reconnect convergence.
- [ ] Activity는 공개/DM-only/private detail을 구분.

Workspace local inventory evidence:

- `SessionInventoryPane.tsx`
- `sessionInventoryRuntimeAdapter.ts`
- local item/GP grant/revoke/undo tests

남은 핵심: Campaign catalog/store, connected protocol, owner-client durable write-back.

**Exit G5:** DM이 한 Campaign 세션에서 Combatant를 추가하고, 플레이어에게 아이템을 지급하고, 식량/시간/보관함을 갱신하고, 판정을 Undo한 뒤 세션을 끝낼 수 있다.

---

# G6. Spatial module safety

## V1-41 Mapless fallback / provider lifecycle — PARTIAL

`depends_on: V1-21, V1-31`

Existing foundation:

- `movementRuntimeContracts.ts`
- `phase09RealTurnRuntimeAdapter.ts`
- `docs/design/movement-modules.md`

Required cleanup:

- [ ] `realSpatialRuntimeService`가 presentation label/fixture distance를 authoritative fact로 생성하지 않음.
- [ ] `ProductionSessionWorkspaceBridge` / `ProductionSessionLifecycleBridge`의 기본 `5ft` 입력 제거 또는 explicit manual provider로 이동.
- [ ] `productionAcceptanceRuntimeAdapter`가 active provider/manual fact에만 range/visibility/cover blocker 적용.
- [ ] provider 없음: unknown distance/visibility/cover, target selectable, 관련 disabled reason 없음.
- [ ] provider capability가 일부이면 제공되지 않은 capability는 unknown 유지.
- [ ] facts에 provider id/version/generation provenance.
- [ ] unmount/disconnect/failure 시 provider facts 즉시 invalidation.
- [ ] stale provider facts가 action legality에 사용되지 않음.

Required tests:

- [ ] no provider + ranged attack target remains eligible.
- [ ] active provider + out-of-range fact disables target.
- [ ] provider removal restores eligibility immediately.
- [ ] distance-only provider does not invent visibility/cover.

**Exit G6:** Core는 완전히 mapless로 플레이 가능하고 모듈이 있을 때만 그 모듈이 제공한 공간 사실을 사용한다.

---

# G7. Dice and combat presentation

## V1-42 WebGL physics dice — PARTIAL

`depends_on: V1-21, V1-31`

- [ ] d4/d6/d8/d10/d12/d20 actual mesh + Cannon physics.
- [ ] 카메라 뒤/화면 바깥에서 앞으로 날아와 표면에 충돌하고 굴러가는 trajectory.
- [ ] 단순 spawn/pop 또는 CSS pseudo-3D fallback이 정상 모드에 나타나지 않음.
- [ ] translation, rotation, bounce, friction, settling이 눈에 보임.
- [ ] authoritative face/result는 animation이 변경하지 않음.
- [ ] local sheet roll은 local result 생성 가능; connected dice는 committed result만 표현.
- [ ] multi-die roll, repeated roll, resize, WebGL context recovery.
- [ ] reduced motion은 짧은 대체 연출과 즉시 읽을 수 있는 결과 제공.
- [ ] sandbox와 실제 Character/Session 경로에서 같은 renderer 사용.
- [ ] automated structure/result-projection tests + human motion recording.

**Exit G7:** 사용자가 주사위가 뒤에서 날아와 굴러 정지한다고 확인하고, 표시 결과가 authoritative event와 일치한다.

---

# G8. Product UX, errors, accessibility

## V1-50 Production-quality pass — TODO

`depends_on: V1-40, V1-41, V1-42`

- [ ] Home에서 Character/Campaign/Host/Join/Content/Rules/Settings 접근.
- [ ] routine flow에 Debug Dock, query preview route, fixture selector 불필요.
- [ ] loading/empty/disabled/error/reconnecting/ended/migration states에 recovery action.
- [ ] Host bind, incompatible content, stale revision, durable write failure, asset failure가 구체적.
- [ ] keyboard focus, tab order, dialog/drawer close, focus restore.
- [ ] constrained Windows viewport에서 주요 action/scroll 접근 가능.
- [ ] selected/focus/disabled/warning/error가 색상만으로 구분되지 않음.
- [ ] reduced motion과 OS preference.
- [ ] Korean-first 용어 일관성.
- [ ] private DM data가 Player UI/ARIA/live region에도 누수되지 않음.

**Exit G8:** UI structure/accessibility tests와 사람의 100%/125% scaling walkthrough가 모두 통과한다.

---

# G9. Automated release candidate

## V1-60 Full regression — TODO

`depends_on: V1-50`

한 exact SHA에서 실행:

- [ ] `npm run build`
- [ ] focused Campaign persistence/domain/UI tests
- [ ] focused calendar/ration/stash/DM Library tests
- [ ] local production Character play tests
- [ ] connected protocol/projection/action/reconnect tests
- [ ] spatial provider lifecycle tests
- [ ] dice structure/result tests
- [ ] addon/content install/validation/persistence tests
- [ ] Character create/edit/level-up/persistence tests
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `npm run tauri:build`

Release workflow는 위 행렬을 명명된 jobs로 실행하고 exact checked-out SHA를 `BUILD.txt`에 기록한다.

**Exit G9:** failure/skip 없이 전체 행렬 green; flaky retry로 숨긴 실패 없음.

---

# G10. Human Windows acceptance

## V1-70 Two-instance end-to-end — TODO

`depends_on: V1-60`

### Clean first-run / local

- [ ] 깨끗한 앱 데이터로 launch.
- [ ] Character 생성, portrait, 저장.
- [ ] Campaign 생성, roster, calendar/ration toggle, custom item, stash 준비.
- [ ] local Session 시작.
- [ ] skill/action/item/spell 수행.
- [ ] Initiative 한 round, dice 확인, Undo.
- [ ] Session 종료, app restart, Character/Campaign durable state 확인.

### Connected

- [ ] Windows app 두 instance 실행.
- [ ] Host가 Campaign에서 bind/start.
- [ ] Client가 Host-unknown persisted Character로 Join/Ready.
- [ ] Host가 start; Client action commit; 양측 수렴.
- [ ] DM item/GP grant/revoke; Client inventory/write-back 확인.
- [ ] Party Stash transfer 및 calendar/ration commit.
- [ ] Client reconnect; duplicate 없음.
- [ ] Handout reveal/withdraw.
- [ ] explicit end; transient clear; 새 Session restart.
- [ ] 앱 재실행 후 owning Character와 Host Campaign 상태 확인.

### Spatial / dice

- [ ] provider 없이 distance blocker 없음.
- [ ] test provider mount/unmount 시 fact 적용/무효화.
- [ ] 주사위가 뒤에서 날아와 굴러가며 authoritative result와 일치.

**Exit G10:** 화면 녹화/스크린샷, exact SHA, artifact digest, 실행 환경이 기록된다.

---

# G11. Release and canonical main

## V1-80 Artifact / merge / release — TODO

`depends_on: V1-70`

- [ ] release candidate branch가 최신 `main`과 reconcile됨.
- [ ] user가 요청한 merge 전략과 명시적 승인 확인.
- [ ] accepted source가 canonical `main`에 존재.
- [ ] merge로 SHA가 바뀌면 exact-main G9/G10 증거 재확인.
- [ ] Windows artifact에 `SimpleVTT.exe`, `BUILD.txt`, walkthrough 문서 포함.
- [ ] artifact metadata head SHA와 `BUILD.txt` SHA 일치.
- [ ] ZIP SHA-256/digest 확인 및 contents 검사.
- [ ] version/tag/release notes에 V1 scope와 non-goals 명시.
- [ ] known critical blocker 0.

**V1 COMPLETE:** V1-80까지 DONE이고 같은 SHA의 artifact가 사람 검증을 통과했을 때만 선언한다.

---

# 4. Hard invariants — 모든 작업에서 재검증

- [ ] Core는 built-in tactical map/token/grid/pathfinding/LOS를 소유하지 않는다.
- [ ] missing spatial fact는 negative/out-of-range fact가 아니다.
- [ ] UI는 named rule arithmetic 또는 authority 결정을 소유하지 않는다.
- [ ] Character ownership과 Session Actor control은 분리된다.
- [ ] Campaign ownership과 Player Character write-back은 분리된다.
- [ ] DM Library private source는 Client catalog로 전달되지 않는다.
- [ ] Session은 Campaign/Character의 두 번째 durable source가 아니다.
- [ ] connected retries/reconnect는 exactly-once/idempotent다.
- [ ] preview/animation은 authoritative result를 변경하지 않는다.
- [ ] disabled optional system은 저장 데이터를 삭제하거나 일반 플레이를 막지 않는다.
- [ ] unsupported mechanic/capability는 추측하지 않고 명시한다.
- [ ] 모든 persisted contract 변경은 schema/version/migration/recovery test를 동반한다.

---

# 5. NEXT

현재 단일 실행 포인터:

```text
R2 Open Hand Fleet Step remote-owner gap
```

1. R1 source/execution action matrix는 canonical handoff에서 DONE이다. 이 판정은 V1-21 release DONE이나 Windows/human acceptance가 아니다.
2. R2에서 remote-owner Rage, Wild Shape, Cunning Action Dash/Disengage/Hide, Uncanny Dodge, Berserker Intimidating Presence, Open Hand Wholeness of Body는 focused evidence와 exact production gates가 green이다. Wholeness exact test/content head는 `d03adbe11c10aa394628c025c36bea9d5c27f9c5`; UI `32972536815` / frontend `98189406605`, Phase 12 `32972594009` / connected-protocol `98189595694`가 success다. 이 slice들을 반복하지 않는다.
3. 다음은 Open Hand Fleet Step remote-owner gap이다. 기존 R1 resolver, Focus Point resource, authoritative turn-runtime history, post-non-Step-Bonus-Action trigger, free/focused variants, movement/effect semantics, Activity, event-native write-back/Undo와 current connected authority/event primitives를 재사용한다.
4. eligible Host-unknown Open Hand Monk의 직전 non-Step Bonus Action trigger와 free/focused Fleet Step intent를 Host가 authoritative resolve하고 movement/resource/effect ordered events로 수렴하는지 focused deterministic proof로 대조한다.
5. Host permanent Character library 불변, owning Client exactly-once apply, duplicate request/event replay no-op, reconnect/fresh projection 수렴, event-native Undo의 Host projection + owner inverse convergence를 확인한다.
6. 실제 red가 있으면 첫 원인 하나만 최소 수정하고 exact SHA production frontend/connected gate를 확인한다. 새 movement engine, protocol, schema, remote-only rules path는 추가하지 않는다.
7. V1-31/V1-32는 전체 R1 matrix와 reconnect/two-instance exit가 충족될 때까지 PARTIAL 유지한다. R3 Windows/Tauri durability, R4 rendered UX/accessibility, R5 packaging은 별도다.

상세 완료 조건과 검증 명령은 `V1_CURRENT_HANDOFF.md`를 따른다.