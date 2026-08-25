# SimpleVTT V1 Current Handoff

Status: **CURRENT CANONICAL HANDOFF**
Updated: **2026-08-25 Asia/Seoul**
Repository: **`Kaetaeru/SimpleVTT`**
Canonical target branch: **`work/v1-composite`**

이 문서는 다음 작업자가 V1 남은 일만 이어가기 위한 현재 실행 포인터다. 전체 요구사항과 출시 Gate는 `V1_RELEASE_EXECUTION_CHECKLIST.md`, 최신 D&D 구현 내역은 `CURRENT_WORK.md`, 제품 계약은 `docs/design/`을 따른다.

## 1. 현재 로컬 기준선

- 실제 작업 브랜치: `codex/v1-multiplayer`
- 검증된 제품 checkpoint: `e12727d84078471893612e5fecd18095b84b3a73`
- 로컬 HEAD: 캐시된 `origin/work/v1-composite`보다 21 commits ahead
- 마지막 확인된 원격 ref: `a2e5f3f5e342e57fbe8bb6925b071bcb6a563c98`
- 원격 재확인: checkpoint 생성 후에도 Windows Git credential `SEC_E_NO_CREDENTIALS`로 fetch 실패
- 작업 트리: clean

따라서 현재 최신 제품은 로컬 exact checkpoint **`e12727d`**로 보존됐지만 아직 GitHub `work/v1-composite`에 push됐다고 주장할 수 없다.

## 2. 2026-08-25 실행 증거

### Green — exact checkpoint `e12727d`

- `npm run build`
  - UI named-rule boundary: 3 pass
  - Character creation/progression structure: 111 pass
  - Rules domain: 329 pass
  - Campaign/Long Rest: 94 pass
  - TypeScript and Vite production build: pass, 505 modules
- `npm run test:connected-ui`: 19 pass
- `npm run test:spellcasting`: 42 pass
- 전체 UI matrix: **962 tests / 962 pass / 0 fail**
- open ability-check/DC/preview focused regression: **38 tests / 38 pass / 0 fail**
- rendered browser 검증: **PARTIAL**
  - HMR preview server와 DM preview URL은 HTTP 200 확인.
  - 현재 Codex in-app Browser의 localhost URL 보안 정책이 재탐색을 차단해 새 DC UI의 실제 클릭 검증은 미완료.

### Open validation debt

- 전체 TS matrix: **1303 tests / 1303 pass / 0 fail**
- 과거 구조/count/stable ID/workspace 기대값과 Session end fixture 16건을 현재 제품 계약에 맞게 갱신했다.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 현재 agent shell에 Cargo가 없어 미실행.
- Tauri two-instance와 Windows artifact 검증은 최신 작업 트리에서 미실행.

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
- Bardic Inspiration/Tactical Mind의 현재 완료 범위
- Cleric Divine Spark/Turn Undead와 Paladin Lay On Hands/Divine Sense/Abjure Foes

Source-complete는 release DONE이 아니다. 아래 acceptance와 exact-head 증거가 남아 있다.

## 4. 남은 작업 — 실행 순서

### R0. 통합 기준선 잠금 — NEXT

- [x] 16개 전체 matrix 실패를 최신 계약에 맞게 분류·수정한다.
- [x] 전체 TS matrix를 1303/1303 green으로 만든다.
- [x] npm 11 + tracked `package-lock.json`을 V1 package-manager 기준으로 확정하고 pnpm 메타데이터를 제외한다.
- [x] generated output, launcher, source, tests를 검토하고 `e5223da` 통합 checkpoint로 commit했다.
- [ ] `work/v1-composite`와 원격을 자격 증명이 가능한 환경에서 reconcile한다.
- [x] 전체 matrix와 production build를 exact SHA `e12727d`에서 재검증했다.

Exit: clean/reviewed checkpoint + full TS green + canonical ref 관계가 설명 가능하다.

### R1. D&D Session Action Matrix 완성

- [x] open ability-check DM DC contract와 일반 능력/기술 판정 UI.
- [x] Tactical Mind를 모든 적격 실패 능력 판정에 재사용.
- [ ] Fighter Indomitable failed saving-throw follow-up.
- [ ] Barbarian Rage 시작/종료/피해·상태·자원 lifecycle.
- [ ] Druid Wild Shape 선택/변신/해제/HP·행동·자원 lifecycle.
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

다음 구현 작업은 Fighter Indomitable failed saving-throw follow-up이다.

```text
Fighter Indomitable failed saving-throw follow-up
-> owner-private 선택
-> 재굴림/자원 소모/공개 결과 atomic commit
-> connected exactly-once/reconnect/Undo
```

별도 외부 blocker: GitHub credential 복구 후 `git fetch origin work/v1-composite`와 fast-forward 확인, `git push origin HEAD:work/v1-composite`가 필요하다.

## 6. 검증 명령

Windows Node `uv_os_get_passwd ENOMEM` 발생 시 repository의 기존 bootstrap만 command-local로 사용한다.

```powershell
$env:NODE_OPTIONS='--require=./tests/tsx-os-userinfo-bootstrap.cjs'
npm run build
npm run test:connected-ui
npm run test:spellcasting
node node_modules/tsx/dist/cli.mjs --test 'tests/**/*.test.ts'
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

테스트 통과만으로 rendered UX 또는 two-instance acceptance를 DONE 처리하지 않는다.
