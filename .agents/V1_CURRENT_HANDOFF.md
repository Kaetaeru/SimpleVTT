# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-26 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항과 출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 최신 D&D 구현 내역은 `CURRENT_WORK.md`, 제품 계약은 `docs/design/`을 따른다.

## 1. 현재 canonical 기준선

- canonical GitHub branch: `work/v1-composite`
- 검증된 통합 baseline: `4a4cdb195ff4544adbb3bfd49487042238b112c1`
- 2026-08-26 GitHub compare에서 `4a4cdb1`은 `work/v1-composite`의 merge-base ancestor로 확인됨.
- 같은 compare에서 branch는 `4a4cdb1`보다 ahead, behind 0으로 확인됨.
- Druid Wild Shape exact execution checkpoint: `11bc8581a04678e33796054117f05b5455a25db3`.
- `11bc858`은 현재 branch exact head에서 기존 UI / Rules Domain Actions가 모두 green이다. 이는 Wild Shape R1 실행 증거이며 전체 release DONE 판정은 아니다.

따라서 과거의 "4a4cdb1이 로컬에만 있고 push되지 않았다"는 blocker는 해소됐다. 현재 GitHub `work/v1-composite`가 repository-side canonical ref다. 검증된 `4a4cdb1` 제품 작업, 완료된 Rage, Wild Shape 구현을 재구현하거나 전체 검증을 단순 resume 이유로 반복하지 않는다.

## 2. 실행 증거

### Green — exact product checkpoint `4a4cdb1`

- `npm run build`
  - UI named-rule boundary: 3 pass
  - Character creation/progression structure: 111 pass
  - Rules domain: 329 pass
  - Campaign/Long Rest: 94 pass
  - TypeScript and Vite production build: pass, 508 modules
- `npm run test:connected-ui`: 19 pass
- `npm run test:spellcasting`: 42 pass
- 전체 UI matrix: **965 tests / 965 pass / 0 fail**
- open ability-check/DC/preview focused regression: **38 tests / 38 pass / 0 fail**
- Fighter Indomitable + saving-throw/connected focused regression: **16 tests / 16 pass / 0 fail**
- 전체 TS matrix: **1303 tests / 1303 pass / 0 fail**
- rendered browser 검증: **PARTIAL**
  - HMR preview server와 DM preview URL은 HTTP 200 확인.
  - 현재 Codex in-app Browser의 localhost URL 보안 정책이 재탐색을 차단해 새 DC UI의 실제 클릭 검증은 미완료.

### Open validation debt

- `cargo test --manifest-path src-tauri/Cargo.toml`: 당시 agent shell에 Cargo가 없어 미실행.
- Tauri two-instance와 Windows artifact 검증은 최신 제품 checkpoint에서 미실행.

### 2026-08-26 Rage incremental source checkpoint

- spellcasting prohibition remains checkpointed from `1e23038fe314b109eaecef75aeca8e67c2462ccf` with deterministic coverage in `spellcastingKernel.test.ts`.
- product source head `b939f892e80b1c37b97ad23b65204d5665ea4739` completes the remaining SRD 5.2.1 Rage lifecycle source:
  - initial duration through end of the Barbarian's next turn;
  - extension on the Barbarian's turn from an enemy attack roll, forcing an enemy saving throw, or the dedicated `격노 연장` Bonus Action;
  - no extension from arbitrary Bonus Actions;
  - 10-minute/100-round maximum guard;
  - Heavy armor donning automatically ends Rage through the actual equipment toggle boundary;
  - existing Incapacitated/dead effect termination remains reused;
  - Rage-linked special effects expire with the core marker;
  - no voluntary `End Rage` production action was restored.
- `tests/domain/barbarianRage.test.ts` covers duration, attack/save extension, dedicated Bonus Action extension, and maximum duration.
- `tests/ui/barbarianRageActionRuntime.test.ts` covers the production extension action and Heavy armor automatic termination.
- Rage는 이미 source-complete다. resume만을 이유로 다시 구현하지 않는다.

### Green — Druid Wild Shape exact checkpoint `11bc858`

- 기존 product/source head `12834c74ee0b997d9cd28f1d6c9227e326c1fe60`의 Wild Shape 구현은 이미 완성돼 있었다.
- 당시 `test:druid-wild-shape` 실패 3건은 product runtime 결함이 아니라 test fixture 불일치였다:
  - fixture가 `activeCharacter.tempHp`만 설정하고 동일 Character의 Scene entity `tempHp`를 갱신하지 않았다.
  - `MockAdapter.syncChar()`가 다음 snapshot에서 Scene 기본 temp HP `5`를 Character로 다시 투영했다.
  - 이 때문에 explicit keep/take 임시 HP 선택이 생기며 exact Wild Shape action lookup과 temp HP 기대값이 깨졌다.
- `11bc8581a04678e33796054117f05b5455a25db3`에서 `tests/ui/druidWildShapeActionRuntime.test.ts` fixture만 Scene temp HP와 Character temp HP를 동기화했다. 제품 코드 변경 없음, 최소 diff `+3/-1`.
- exact SHA `11bc858` GitHub Actions:
  - UI run `32917949237` / job `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Rules Domain run `32917949368` / job `connected-protocol`: **success**, `Production frontend gate`, connected protocol tests, offline play walkthrough tests green.
- `npm run build`가 `npm run test:druid-wild-shape`를 포함하므로 Wild Shape focused gate와 production build가 exact SHA에서 green이다.
- 결론: **Druid Wild Shape R1 local/source lifecycle은 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect/Undo는 R2에서 별도 검증한다.

## 3. Source-complete로 취급하고 재구현하지 않을 것

- 339/339 spell executable definitions, multi-target targeting, condition/concentration lifecycle
- Three/Cannon visual dice, authoritative result projection, remote replay deduplication
- mapless spatial fallback과 manual movement/opportunity trigger
- Calendar/Rations providers, compound day/rest/ration transactions
- Party Stash policy/approval/owner journal/compensation/recovery
- DM Library item/image/NPC/PC preset/note/JSON/search/drag invocation paths
- official Character + Spellcasting sheet composition
- Character/Host authority split, connected projection, inventory write-back, reconnect and event-native Undo foundation
- Ready lifecycle, death save, Stabilize, Unarmed Strike, Extra Attack, Action Surge
- Bardic Inspiration/Tactical Mind/Fighter Indomitable follow-up 완료 범위
- Cleric Divine Spark/Turn Undead와 Paladin Lay On Hands/Divine Sense/Abjure Foes
- Barbarian core Rage source through `b939f892`: start/resource/economy, resistance, Rage Damage, Strength Advantage, Concentration/spellcasting restrictions, SRD 5.2.1 duration/extension/automatic termination, production extension action, and Heavy armor termination
- Druid Wild Shape through `11bc858`: known-form selection, transform/exit actions, resource/Bonus Action economy, transformed attack projection, explicit temporary-HP keep/take choice, spellcasting restriction, event-native write-back and Undo
- existing Barbarian Berserker mechanics

Source-complete는 release DONE이 아니다. R2 connected remote-owner matrix, R3 Tauri durability, R4 rendered UX/accessibility, R5 release gates는 별도다.

## 4. 남은 작업 — 실행 순서

### R0. 통합 기준선 잠금 — DONE

- [x] 16개 전체 matrix 실패를 최신 계약에 맞게 분류·수정한다.
- [x] 전체 TS matrix를 1303/1303 green으로 만든다.
- [x] npm 11 + tracked `package-lock.json`을 V1 package-manager 기준으로 확정하고 pnpm 메타데이터를 제외한다.
- [x] generated output, launcher, source, tests를 검토하고 `e5223da` 통합 checkpoint로 commit했다.
- [x] `4a4cdb1`이 GitHub `work/v1-composite`의 ancestor이며 branch가 behind 0임을 repository-side compare로 확인했다.
- [x] 전체 matrix와 production build를 exact SHA `4a4cdb1`에서 재검증했다.

Exit: clean/reviewed checkpoint + full TS green + canonical ref 관계 설명 가능.

### R1. D&D Session Action Matrix 완성

- [x] open ability-check DM DC contract와 일반 능력/기술 판정 UI.
- [x] Tactical Mind를 모든 적격 실패 능력 판정에 재사용.
- [x] Fighter Indomitable failed saving-throw follow-up.
- [x] Barbarian core Rage lifecycle integration source. 기존 Rage resource/Berserker mechanics를 재사용하고 start/economy/state/resistance/damage/Strength Advantage/Concentration/spellcasting/duration/extension/automatic termination을 authoritative paths에 연결했다.
- [x] Druid Wild Shape 선택/변신/해제/HP·행동·자원 lifecycle. exact checkpoint `11bc858`에서 focused gate와 production build를 GitHub Actions로 검증했다.
- [ ] Monk Focus actions와 자원/행동 경제.
- [ ] Rogue Cunning Action 및 Uncanny Dodge reaction.
- [ ] 이미 domain resolver가 있는 subclass action만 mechanics-complete 상태로 action bar에 노출.
- [ ] 각 신규 행동에 local/freeform/initiative/Activity/Undo를 연결.

Exit: 대표 12-class Character가 UI에서 사용 가능한 핵심 행동을 dead button 없이 실행한다.

### R2. Connected remote-owner matrix 완성

R1의 모든 신규 행동마다 다음을 검증한다.

- [ ] Client intent -> Host authoritative resolve -> ordered event.
- [ ] private owner choice와 public result 분리.
- [ ] exactly-once, duplicate/reorder/retry 안전.
- [ ] reconnect replay와 fresh projection 수렴.
- [ ] Character owner write-back / Campaign Host write-back 분리.
- [ ] event-native Undo와 양 Client 보상 수렴.

Exit: 신규 행동 전체가 Host, acting Client, observing Client에서 같은 최종 상태를 가진다.

### R3. Tauri durability와 owner acceptance

- [ ] Cargo/Rust toolchain이 있는 환경에서 `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] `npm run tauri:build`와 V1 executable 생성.
- [ ] Character/Campaign/owner journal/Stash/Long Rest를 실제 filesystem restart로 검증.
- [ ] owner progression walkthrough: Monk 1->2, 2->3, 3->4와 Fighter/Rogue/caster representative.
- [ ] 최신 build 두 instance Host/Client acceptance.
- [ ] reconnect, session end, app restart 후 durable/transient 경계 확인.

Exit: 실제 Windows Tauri 두 앱에서 세션 시작부터 종료·재실행까지 데이터가 정확하다.

### R4. UX/error/accessibility 마감

- [ ] loading/empty/disabled/error/reconnecting/ended/migration/corrupt recovery path.
- [ ] keyboard focus, Tab order, Escape, drawer/dialog focus restore.
- [ ] 1920x1080, Windows 100%/125% scaling, 주요 pane scroll.
- [ ] selected/focus/disabled/error가 색상만으로 구분되지 않음.
- [ ] reduced motion과 remote dice/VFX의 non-blocking interaction.
- [ ] Player DOM/ARIA/live region에 DM private data 없음.

Exit: 코드가 아니라 rendered Host/Player 경로로 확인한다.

### R5. Release gates

- [ ] exact SHA full regression: TS, Rust, Tauri build.
- [ ] exact SHA Windows two-instance recording/screenshots.
- [ ] provider 없음/연결/제거 spatial acceptance.
- [ ] dice rear-entry/roll/settle authoritative-result human proof.
- [ ] version metadata를 V1로 확정하고 `BUILD.txt`에 exact SHA 기록.
- [ ] artifact contents와 SHA-256 digest 검사.
- [ ] 최신 `main` reconcile, 승인된 merge, tag/release notes.
- [ ] known critical blocker 0.

Exit: 같은 SHA의 source, tests, Windows artifact, human acceptance가 모두 일치한다.

## 5. Next exact action

R1의 다음 미완료 항목인 **Monk Focus actions/resource/economy**로 이동한다.

```text
existing Monk Focus domain + progression + resource/action primitives 확인
-> 이미 구현된 Focus Point 소비/회복과 class action behavior는 source-complete로 인정하고 재구현하지 않음
-> 실제 빠진 production action/resource/economy seam만 최소 구현
-> focused deterministic tests/fixtures 추가
-> npm run build로 관련 gate 확인
-> canonical handoff 갱신 후 다음 R1 항목으로 이동
```

Rage와 Wild Shape는 재구현하지 않는다. connected Host/Client/reconnect/exactly-once는 direct R1 regression이 아니면 R2에서 다룬다. resume만을 이유로 과거 1303/1303 전체 matrix를 반복하지 않는다.

중요: 이 문서가 현재 V1 실행 포인터다. `.chatgpt-rerun/PLAN.md`나 `.chatgpt-rerun/STATE.md`에 별도 제품 작업 목록을 복사하지 않는다.

## 6. 검증 명령

Windows Node `uv_os_get_passwd ENOMEM` 발생 시 repository의 기존 bootstrap만 command-local로 사용한다.

```powershell
$env:NODE_OPTIONS='--require=./tests/tsx-os-userinfo-bootstrap.cjs'
npm run test:druid-wild-shape
npm run build
npm run test:connected-ui
npm run test:spellcasting
node node_modules/tsx/dist/cli.mjs --test 'tests/**/*.test.ts'
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

테스트 통과만으로 rendered UX 또는 two-instance acceptance를 DONE 처리하지 않는다. Resume만을 이유로 이미 기록된 full matrix를 반복하지 않는다.
