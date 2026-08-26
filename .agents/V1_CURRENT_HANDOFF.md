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
- Monk Focus R1 exact execution checkpoint: `c282a1e4fd6929dc56079d811021dcfe160d51f5`.
- Rogue R1 exact execution checkpoint: `5bb8bfbc4753dcc15f1198a04c0982817176c644`.
- Berserker Intimidating Presence R1 exact execution checkpoint: `1df452fcd951525242631e2cb345e6ee390251fd`.
- Open Hand Wholeness of Body R1 exact execution checkpoint: `f26092033673622c7c15755ac304678441a1eda3`.
- `f260920`은 UI frontend job과 Phase 12 connected-protocol production frontend gate가 green이다. 이는 Wholeness of Body R1 실행 증거이며 전체 subclass-action umbrella 또는 release DONE 판정은 아니다.

따라서 과거의 "4a4cdb1이 로컬에만 있고 push되지 않았다"는 blocker는 해소됐다. 현재 GitHub `work/v1-composite`가 repository-side canonical ref다. 검증된 `4a4cdb1` 제품 작업, 완료된 Rage, Wild Shape, Monk Focus, Rogue R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1 구현을 재구현하거나 전체 검증을 단순 resume 이유로 반복하지 않는다.

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

### Green — Monk Focus R1 exact checkpoint `c282a1e`

- 기존 Monk Focus projection/runtime은 이미 다음을 제공했다:
  - Flurry of Blows, Patient Defense free/focused, Step of the Wind free/focused production actions;
  - Focus Point resource 소비와 Bonus Action economy;
  - Flurry의 추가 맨손 타격 2회와 실제 extra-attack 소비 경로;
  - Patient Defense의 이탈/회피, Step of the Wind의 이동 증가/이탈;
  - zero-Focus availability와 free/focused variant 분리.
- 남은 실패는 focused Patient Defense 이후 `undoLastResolution()` 1회가 snapshot 복원 대신 generic safe-undo preview만 여는 경계였다.
- `c282a1e4fd6929dc56079d811021dcfe160d51f5`에서 Monk 완료 resolution ID만 `WeakMap`으로 기억하고, 바로 그 resolution과 `lastResolutionId`가 일치할 때만 기존 preview를 이미 armed 상태로 넘겨 기존 snapshot Undo를 1회 호출로 재사용했다.
- stale Monk marker는 첫 Undo 호출에서 삭제되고 resolution ID 불일치 시 preview를 건너뛰지 않으므로 다른 action의 safe-undo semantics는 유지된다.
- R2 event-native mechanics로 확대하지 않고 R1 local seam만 수정했다.
- exact SHA `c282a1e` GitHub Actions:
  - UI run `32927666548` / job `98053688070` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32927666546` / job `98053687822` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- `npm run build`가 `npm run test:monk-focus`를 포함하므로 focused Monk gate와 production build가 exact SHA에서 green이다.
- 결론: **Monk Focus R1 local/freeform/initiative/resource/economy/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect/event-native Undo는 R2에서 별도 검증한다.

### Green — Rogue R1 exact checkpoint `5bb8bfb`

- Cunning Action은 기존 표준 Dash/Disengage/Hide mechanics를 재사용해 Rogue 2+에 Bonus Action variant만 projection한다.
- focused fixture는 실제 Rogue turn으로 맞추며 제품 turn gate를 우회하지 않는다.
- Cunning Action Dash/Disengage는 Bonus Action economy, 기존 movement/status effect, Activity, one-call local snapshot Undo를 검증한다. Hide는 기존 ability-check primitive를 그대로 재사용한다.
- Uncanny Dodge는 Rogue 5+ reaction으로 projection하고, accept 시 기존 atomic attack transaction의 `NumericOperand` multiplier/`floor` rounding을 재사용해 실제 rolled damage를 절반으로 만든다. display average를 mechanics authority로 사용하지 않는다.
- `07c68ab43404c590a408d3673439fe0ea147d289`에서 Uncanny Dodge Undo를 기존 ResolutionEvent 경로에 남기고 Cunning Action의 local snapshot Undo와 분리했다.
- `5bb8bfbc4753dcc15f1198a04c0982817176c644`에서 atomic damage multiplier seam과 deterministic focused expectation을 연결했다.
- exact SHA `5bb8bfb` GitHub Actions:
  - UI run `32932781542` / job `98068084958` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32932781591` / job `98068085017` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- `npm run build`가 `npm run test:rogue-core`를 포함하므로 Rogue focused gate와 production build가 exact SHA에서 green이다.
- 결론: **Rogue Cunning Action/Uncanny Dodge R1 local/freeform/initiative/economy/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Berserker Intimidating Presence R1 exact checkpoint `1df452f`

- 기존 `src/domain/barbarianBerserker.ts`의 Intimidating Presence resolver를 재사용하고 production action projection/runtime만 최소 연결했다.
- initiative에서는 Bonus Action economy를 소비하고, freeform에서는 같은 domain resolver에 `useBonusActionEconomy: false`를 전달해 전투 turn economy를 남기지 않는다.
- 기존 feature resource, 실패 내성의 Frightened 적용, Activity, generic/event-native Undo 경계를 재사용한다.
- focused test는 35 ft out-of-range spatial fact를 `module:test:` provenance로 명시해 production targeting이 실제 authoritative module fact로 인식하게 한다. 제품 range 규칙을 test에 복제하지 않는다.
- exact SHA `1df452fcd951525242631e2cb345e6ee390251fd` GitHub Actions:
  - UI run `32934223691` / job `98072253329` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32934223675` / job `98072253248` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- `npm run build`가 `npm run test:berserker-presence`를 포함하므로 focused Berserker gate와 production build가 exact SHA에서 green이다.
- 결론: **Berserker Intimidating Presence R1 local/freeform/initiative/resource/economy/targeting/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Open Hand Wholeness of Body R1 exact checkpoint `f260920`

- 기존 Open Hand domain/runtime resolver와 Focus Point resource를 재사용해 Monk 6+ Wholeness of Body를 production action으로 노출한다.
- initiative에서는 Bonus Action을 소비하고, freeform에서는 같은 healing/resource 경로를 사용하되 turn economy를 소비하지 않는다.
- heal amount는 기존 Focus Die와 Wisdom modifier를 사용하고, Focus Point 1 소비, Activity, ResolutionEvent write-back, Undo 경계를 재사용한다.
- `test:open-hand-wholeness` focused evidence는 initiative와 freeform의 healing/resource/economy/Activity/Undo를 **4/4 green**으로 검증한다.
- shared full-build blocker였던 freeform runtime-effect Undo는 newer source `f26092033673622c7c15755ac304678441a1eda3`에서 기존 `snapshotAdapterTurnRuntimeState`/`undoResolutionEvents` 경로를 모든 session mode에 재사용하는 최소 수정으로 해소됐다.
- exact SHA `f260920` GitHub Actions:
  - UI run `32938958220` / job `98085775444` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32938958204` / job `98085775486` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- 결론: **Open Hand Wholeness of Body R1 local/freeform/initiative/resource/economy/healing/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

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
- Monk Focus R1 through `c282a1e`: Focus actions, resource/Bonus Action economy, Flurry extra attacks, Patient Defense/Step effects, local/freeform/initiative Activity and one-call snapshot Undo
- Rogue R1 through `5bb8bfb`: Cunning Action Dash/Disengage/Hide projection, Bonus Action economy, standard action mechanics reuse, Uncanny Dodge reaction with atomic floor-half damage, Activity and local/event-native Undo boundaries
- Berserker Intimidating Presence R1 through `1df452f`: existing domain resolver reuse, production action projection, initiative/freeform economy split, feature resource, authoritative targeting, Frightened, Activity and Undo boundaries
- Open Hand Wholeness of Body R1 through `f260920`: existing resolver/resource reuse, initiative/freeform economy split, healing, Activity, event-native write-back and Undo.
- remaining existing Barbarian Berserker mechanics outside the exposed R1 action are not reimplemented unless the inventory identifies a real production projection gap.

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
- [x] Monk Focus actions와 자원/행동 경제. exact checkpoint `c282a1e`에서 focused Monk gate, one-call local Undo, production build, connected-protocol frontend gate를 검증했다.
- [x] Rogue Cunning Action 및 Uncanny Dodge reaction. exact checkpoint `5bb8bfb`에서 focused Rogue gate, production build, connected-protocol frontend gate를 검증했다.
- [ ] 이미 domain resolver가 있는 subclass action만 mechanics-complete 상태로 action bar에 노출.
  - [x] Berserker Intimidating Presence: exact checkpoint `1df452f`, focused build gate + UI/Phase12 green.
  - [x] Open Hand Wholeness of Body: exact checkpoint `f260920`, focused 4/4 + UI/Phase12 connected-protocol green.
  - [ ] 남은 subclass domain resolver inventory에서 다음 mechanics-complete production projection gap 식별.
- [ ] 각 신규 행동에 local/freeform/initiative/Activity/Undo를 연결.
  - [x] Berserker Intimidating Presence R1 범위.
  - [x] Open Hand Wholeness of Body R1 범위.

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

Open Hand Wholeness of Body R1은 `f260920`에서 execution-validated 됐다. R1의 같은 미완료 umbrella에서 **남은 subclass domain resolver inventory를 계속해 다음 mechanics-complete production projection gap 하나를 식별**한다.

```text
live branch와 existing subclass domain resolver / production action projection inventory 재대조
-> Berserker Intimidating Presence, Open Hand Wholeness of Body, Rage, Wild Shape, Monk Focus, Rogue R1 및 이미 노출된 actions는 재구현하지 않음
-> domain resolver가 실제 mechanics를 소유하지만 production action bar에 빠진 다음 action 하나만 식별
-> unsupported/partial feature는 dead button으로 노출하지 않음
-> 선택한 action의 local/freeform/initiative/economy/Activity/Undo 기존 primitives를 우선 재사용
-> focused deterministic evidence 추가 또는 기존 증거 재사용
-> npm run build로 관련 gate 확인
-> green이면 canonical handoff 갱신 후 inventory를 계속하거나 마지막 R1 integration 항목으로 이동
```

Connected Host/Client/reconnect/exactly-once는 direct R1 regression이 아니면 R2에서 다룬다. resume만을 이유로 과거 1303/1303 전체 matrix를 반복하지 않는다.

중요: 이 문서가 현재 V1 실행 포인터다. `.chatgpt-rerun/PLAN.md`나 `.chatgpt-rerun/STATE.md`에 별도 제품 작업 목록을 복사하지 않는다.

## 6. 검증 명령

Windows Node `uv_os_get_passwd ENOMEM` 발생 시 repository의 기존 bootstrap만 command-local로 사용한다.

```powershell
$env:NODE_OPTIONS='--require=./tests/tsx-os-userinfo-bootstrap.cjs'
npm run test:rogue-core
npm run test:berserker-presence
npm run test:open-hand-wholeness
npm run build
npm run test:connected-ui
npm run test:spellcasting
node node_modules/tsx/dist/cli.mjs --test 'tests/**/*.test.ts'
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

테스트 통과만으로 rendered UX 또는 two-instance acceptance를 DONE 처리하지 않는다. Resume만을 이유로 이미 기록된 full matrix를 반복하지 않는다.
