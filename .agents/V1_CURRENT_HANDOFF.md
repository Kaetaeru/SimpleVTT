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
- Berserker Mindless Rage production integration checkpoint: `b82e9048618ab3c105f2f99e148d2e5d2198c5dc` (product integration source `8bbd21a0ff4b20bef4c0232f175785c5f7633312`).
- Open Hand Wholeness of Body R1 exact execution checkpoint: `f26092033673622c7c15755ac304678441a1eda3`.
- Open Hand Fleet Step R1 exact execution checkpoint: `21b5ab830442318e5c5b499464a746fb4370cd4b`.
- Devotion Holy Nimbus R1 exact execution checkpoint: `21b5ab830442318e5c5b499464a746fb4370cd4b`.
- Open Hand Quivering Palm R1 exact execution checkpoint: `126cd848b1b7896eaa09f8775e60dcd9638fdf72`.
- Devotion Smite of Protection R1 exact execution checkpoint: `ec89fa251d969a250c20e11f0abe6d7a4f13d58e`.
- Fiend Dark One's Own Luck R1 exact execution checkpoint: `95042b2ef3c65aef3619334c0bec1ad243d165f2`.
- Lore Peerless Skill R1 exact execution checkpoint: `88bb72dc3d725af049025728003ab6e6b8db1eb0`.
- Lore Cutting Words R1 exact execution checkpoint: `90514e44a21840070bb77ea17561036a86b2e5ca`; temporary diagnostic cleanup head: `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`.
- R2 remote-owner Rage exact checkpoint: `dec4f22178b1256597c140170481025bb26f39e3`; focused connected source `5585e6be35b96a46a702cd877c32078ff677f97e`, projected inverse write-back `9738b425d908399885f9ade1424d38294db2110a`, connected projected Undo context `0f17a4d5cb9319776b66fb9909b12808b165a13b`.
- R2 remote-owner Wild Shape exact proof: `a65cbd2926032d70f47495873996653c7622cb1e`; source/projection preservation `657f7ea850350758bd5b0f5ac49977cd533d6df2` + `b9a666c772820432bc024fa0b9fb503110111e15`; Phase 12 run `32964082295` / job `98162628731` green.
- R2 remote-owner Cunning Action Dash exact proof: `ea96509ee0c01922d0f23926445b5a7271a45ae1`; event-native core `cbbda07dd7c11ba126e79c26cba99586905e7dce`; remote reconstruction `922cfd1f9b53ba4c14e4fe957b5bcc0e397cdce6`; Phase 12 run `32964728723` / job `98164631534` green.
- R2 remote-owner Cunning Action Disengage exact proof: `134e6a8d7def8711d84bb5be56186f353a4ddeb2`; event-native core `e736114de729964b855c67d181f0f14025aee630`; remote runtime/reconstruction `1074cb6db2a1e917dc0db14bde771350b74b15cb` + `87e8ace567c8eb7e421c582ccbb6150e861e8fee`; Phase 12 run `32965968749` / job `98168404394` green.
- R2 remote-owner Cunning Action Hide exact checkpoint: `7f8e9459e433164b916ee8ef12fdf3042492d9d7`; event/runtime bridge `5765534b320f245678edb90173d740d8fb7c0113`; remote reconstruction `03164a314762c0981bae8c7153f391366b49b6e0`; turn-runtime initialization repair `726081e1a7beb9c5c2769da62a1cea3b3da5c4ec`; UI run `32968629784` / frontend job `98176845419` success; Phase 12 run `32968629791` / connected-protocol job `98176845690` success through production frontend gate.
- `21b5ab8`은 Fleet Step과 Holy Nimbus focused gate를 포함한 UI frontend job과 Phase 12 connected-protocol production frontend gate가 green이다.
- `126cd84`는 Quivering Palm focused gate를 포함한 UI run `32942627369`가 success이고 Phase 12 run `32942627376`의 connected-protocol job `98096599197`이 success다. 이는 Quivering Palm R1 실행 증거이며 전체 subclass-action umbrella 또는 release DONE 판정은 아니다.
- `ec89fa2`는 Smite of Protection focused gate를 포함한 UI run `32950193461` / frontend job `98119645421`과 Phase 12 run `32950193590` / connected-protocol job `98119646335`가 success다.
- `95042b2`는 Fiend Dark One's Own Luck 3개 focused case를 포함한 UI run `32952470669` / frontend job `98126755335`와 Phase 12 run `32952470663` / connected-protocol job `98126755397`이 success다.
- `88bb72d`는 Lore Peerless Skill 4개 focused case를 포함한 UI run `32953773211` / frontend job `98130829740`과 Phase 12 run `32953773099` / connected-protocol job `98130829706`이 success다.
- `90514e4`는 Lore Cutting Words ability-check/attack/staged-damage/below-level focused slices를 포함한 UI run `32960806646` / frontend job `98152495174`와 Phase 12 run `32960806633` / connected-protocol job `98152494916`이 success다. `c7aee31`은 임시 diagnostic steps만 제거했고 UI run `32961013657` / frontend job `98153136326`도 success다.
- `b82e904`는 Berserker Mindless Rage production Rage 합성, 기존 Charmed/Frightened 제거, immunity marker, Activity, Undo, Rage-end lifecycle을 focused production test로 검증했고 UI run `32961779455` / frontend job `98155486715`과 Phase 12 run `32961779556` / connected-protocol job `98155487334`가 success다.
- `dec4f22`는 remote-owner Rage ActionRequest/Host authoritative resolve/ordered event, Host permanent Character library 불변, owning Client durable exactly-once, duplicate request/event no-op, Host projected Undo와 owning Client inverse write-back을 검증했다. UI run `32963492157`은 success이고 Phase 12 run `32963492151` / connected-protocol job `98160810148`은 production frontend gate까지 success다. `windows-connected-playable`은 R3이므로 이 R2 gap의 exit 조건이 아니다.

따라서 과거의 "4a4cdb1이 로컬에만 있고 push되지 않았다"는 blocker는 해소됐다. 현재 GitHub `work/v1-composite`가 repository-side canonical ref다. 검증된 `4a4cdb1` 제품 작업, 완료된 Rage/Mindless Rage, Wild Shape, Monk Focus, Rogue R1, Berserker Intimidating Presence R1, Open Hand Wholeness of Body R1, Open Hand Fleet Step R1, Devotion Holy Nimbus R1, Open Hand Quivering Palm R1, Devotion Smite of Protection R1, Fiend Dark One's Own Luck R1, Lore Peerless Skill R1, Lore Cutting Words R1 구현을 재구현하거나 전체 검증을 단순 resume 이유로 반복하지 않는다.

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
- `8bbd21a0ff4b20bef4c0232f175785c5f7633312` composes existing Berserker Mindless Rage operations into the same authoritative Rage transaction for Berserker 6+, without a fake extra button. Existing Charmed/Frightened effects are removed, the Rage-linked charm/fear immunity marker is applied, and the same Rage lifecycle owns termination.
- `b82e9048618ab3c105f2f99e148d2e5d2198c5dc` adds production lifecycle coverage through the existing `test:berserker-presence` build gate: UI run `32961779455` / frontend job `98155486715` and Phase 12 run `32961779556` / connected-protocol job `98155487334` are **success**.
- Rage + Mindless Rage R1 source/execution 범위는 완료다. resume만을 이유로 다시 구현하지 않는다.

### Green — R2 remote-owner Rage exact checkpoint `dec4f22`

- `5585e6be35b96a46a702cd877c32078ff677f97e` adds focused host-unknown Barbarian Rage connected evidence using the existing ActionRequest/SessionProjection/ResolutionEvent primitives.
- forward commit keeps the Host permanent Character library unchanged while the owning Client persists Rage resource use exactly once; duplicate ActionRequest and duplicate event replay are no-ops.
- `e5cfbe886d896f2f4add4ce39540fee46931ec6c` exposed the real remote projected Undo gap instead of masking it.
- `9738b425d908399885f9ade1424d38294db2110a` makes the existing Character write-back guard resolve ephemeral projected event targets even after Host actor context restoration.
- `0f17a4d5cb9319776b66fb9909b12808b165a13b` reactivates the existing projected Character context around connected Undo so generic event-native inverse persistence restores the Host ephemeral projection before the inverse event is published.
- `dec4f22178b1256597c140170481025bb26f39e3` applies the minimal TypeScript target-id narrowing needed by that existing guard; no new protocol or rules engine was added.
- exact SHA `dec4f22` GitHub Actions:
  - UI run `32963492157`: **success**.
  - Phase 12 Connected Session run `32963492151` / connected-protocol job `98160810148`: **success**, connected authority suite, offline walkthrough and production frontend gate all green.
- 결론: **Rage representative R2 remote-owner forward/exactly-once/owner-write-back/event-native Undo gap은 완료**. R2 전체 matrix, reconnect/fresh-projection coverage for every R1 feature, observer-specific coverage and R3 Windows evidence는 아직 남는다.

### Green — R2 Rogue Cunning Action Hide exact checkpoint `7f8e945`

- 기존 표준 Hide semantics와 connected ActionRequest/SessionProjection/ResolutionEvent primitives를 재사용했다. 새 stealth engine, protocol, schema를 추가하지 않았다.
- `a357d596981a312f3f41f9344fa9b62f4c2da66d`가 Cunning Hide 자체에 canonical DC 15를 feature-local로 고정하고 generic ability-check DM DC contract는 그대로 둔다.
- `726081e1a7beb9c5c2769da62a1cea3b3da5c4ec`가 fresh Host-unknown projected Rogue에서도 기존 `ensureAdapterTurnRuntimeState` primitive로 TurnRuntime을 초기화해 Hidden effect/economy event commit을 보장한다.
- focused remote-owner proof는 Host permanent Character library 불변, authoritative d20/effect/economy ordering, owning Client apply exactly-once, duplicate request/event no-op, Host event-native Undo와 Client inverse convergence를 검증한다.
- `e2107025fb1fd4a896559decc1ee191c033e9b2a`에서 broad fixed-DC 실험을 제거해 Cunning Hide에만 scope를 남겼고, `7f8e9459e433164b916ee8ef12fdf3042492d9d7`의 source tree는 그 green tree와 동일하다.
- exact SHA `7f8e945` GitHub Actions:
  - UI run `32968629784` / frontend job `98176845419`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32968629791` / connected-protocol job `98176845690`: **success**, focused Cunning Hide proof, connected authority suite, Phase 11 offline walkthrough, production frontend gate all green.
- 결론: **Cunning Action Hide R2 remote-owner forward/effect/economy/exactly-once/event-native Undo gap은 완료**. Uncanny Dodge와 나머지 R1 feature matrix는 별도 R2 slice다.

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

### Green — Open Hand Fleet Step R1 exact checkpoint `21b5ab8`

- existing `resolveOpenHandFleetStep` domain resolver와 Focus Point/turn-runtime history를 재사용해 Open Hand Monk 11+의 직전 Bonus Action 후속 action을 production projection으로 연결했다.
- 무료 Fleet Step은 추가 Bonus Action이나 Focus를 소비하지 않고 즉시 추가 이동을 제공한다.
- focused Fleet Step은 Focus 1을 소비하고 기존 domain effect를 통해 기회 공격 회피/도약 거리 2배 marker를 적용한다.
- Step of the Wind 자체는 trigger에서 제외하고, 같은 turn의 authoritative `use-economy` history가 확인된 직전 비-Step Bonus Action만 허용한다.
- `test:open-hand-fleet-step`은 노출 eligibility, 무료 이동, focused resource/effect/Activity/Undo, 레벨 gate를 **4/4 green**으로 검증한다.
- `21b5ab830442318e5c5b499464a746fb4370cd4b`에서 test-only helper export를 제거해 adapter surface를 mechanics에 필요한 최소 범위로 유지했다.
- exact SHA `21b5ab8` GitHub Actions:
  - UI run `32939892234` / job `98088532407` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32939892195` / job `98088532135` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- 결론: **Open Hand Fleet Step R1 local/initiative/trigger/economy/resource/effect/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Devotion Holy Nimbus R1 exact checkpoint `21b5ab8`

- 기존 `paladinDevotion` domain resolver/resource를 재사용해 Paladin 20+ Devotion에 Holy Nimbus production action을 노출한다.
- initiative에서는 기존 Bonus Action economy를 쓰고 freeform에서는 stranded turn economy를 남기지 않는다.
- resource 1/long rest, self target, Activity, generic/event-native Undo 경계를 기존 primitives로 유지한다.
- `npm run build`의 `test:devotion-holy-nimbus` gate가 exact `21b5ab8` UI frontend와 Phase 12 connected-protocol production frontend gate에서 green이다.
- Life Domain Preserve Life와 Circle of the Land Land's Aid처럼 현재 `resolveAction(actionId,targetIds)`보다 richer choice input이 필요한 기능은 자동할당/가짜 버튼으로 노출하지 않는다.
- 결론: **Devotion Holy Nimbus R1 local/freeform/initiative/resource/economy/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Open Hand Quivering Palm R1 exact checkpoint `126cd84`

- 기존 `src/domain/monkOpenHand.ts`의 Quivering Palm seed와 Action detonation resolver를 재사용하고 production adapter만 얇게 연결했다.
- completed Unarmed Strike hit 뒤 Focus 4를 소비하는 ephemeral seed follow-up을 제공하며 Monk당 기존 marker는 새 target으로 교체된다.
- marker가 있으면 해당 target에만 Action detonation을 노출한다. Constitution save, 10d12 force damage, 성공 시 절반, marker 종료를 domain resolver가 소유한다.
- initiative에서는 Action economy를 소비하고 freeform에서는 같은 mechanics를 사용하되 turn economy를 남기지 않는다. `activation: "replace-attack"`은 domain에서 unsupported이므로 노출하지 않는다.
- focused test는 level/subclass eligibility, seed/resource/marker replacement, freeform detonation/save/damage/Undo, initiative Action economy/Undo를 검증한다.
- gate red의 마지막 원인은 product runtime이 아니라 test fixture였다. `MockAdapter` 기본 mode가 initiative인데 freeform fixture가 mode를 전환하지 않아 두 번째 seed와 freeform detonation이 Action economy에 막혔다. `126cd848b1b7896eaa09f8775e60dcd9638fdf72`에서 test setup만 `freeform`으로 정렬했다.
- exact SHA `126cd84` GitHub Actions:
  - UI run `32942627369` / job `98096599031` `frontend`: **success**, `Typecheck and build`와 `test:open-hand-quivering-palm` 포함 전 단계 green.
  - Phase 12 Connected Session run `32942627376` / job `98096599197` `connected-protocol`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- 결론: **Open Hand Quivering Palm R1 supported seed + Action detonation local/freeform/initiative/resource/economy/Activity/Undo 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect와 attack-replacement activation은 R2/향후 지원에서 별도 검증한다.

### Green — Devotion Smite of Protection R1 exact checkpoint `ec89fa2`

- 기존 Devotion Smite of Protection production/runtime path를 새 bridge 없이 유지하고 focused deterministic coverage를 복구했다.
- `test:devotion-smite-protection`은 보호 적용, public Undo 복원, effect expiry와 below-level gate를 검증한다.
- exact SHA `ec89fa251d969a250c20e11f0abe6d7a4f13d58e` GitHub Actions:
  - UI run `32950193461` / job `98119645421` `frontend`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32950193590` / connected-protocol job `98119646335`: **success**, production frontend gate와 connected protocol green.
- 결론: **Devotion Smite of Protection R1 local mechanics/Activity/Undo/expiry/level-gate 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Fiend Dark One's Own Luck R1 exact checkpoint `95042b2`

- 기존 `warlockFiendDarkOnesOwnLuckFollowUpRuntimeAdapter.ts`와 domain resolver를 재사용했다. 중복 follow-up bridge를 추가하지 않았다.
- ability-check path는 DM DC 뒤 실패 판정에서 interrupt를 제공하고, accept 시 d10 결과를 authoritative check에 반영하며 사용 횟수 1회 소비, Activity 기록, event-native Undo 복원을 검증한다.
- saving-throw path는 실패 내성을 같은 resolver/event path로 성공으로 전환할 수 있음을 검증한다.
- Warlock 5 이하에는 resource/interrupt가 노출되지 않는 level gate를 검증한다.
- bisection 중 `c93a008`까지 ability-check response/resource/Activity를, `8ed1d60`에서 Undo까지 green으로 좁힌 뒤 `23019e7`과 `95042b2`에서 saving-throw와 below-level coverage를 순서대로 복구했다.
- exact SHA `95042b2ef3c65aef3619334c0bec1ad243d165f2` GitHub Actions:
  - UI run `32952470669` / job `98126755335` `frontend`: **success**, `Typecheck and build` 및 `test:fiend-luck` 포함 전 단계 green.
  - Phase 12 Connected Session run `32952470663` / connected-protocol job `98126755397`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- 결론: **Fiend Dark One's Own Luck R1 ability-check/saving-throw/resource/Activity/Undo/level-gate 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Lore Peerless Skill R1 exact checkpoint `88bb72d`

- 기존 `resolveLorePeerlessSkill` domain resolver와 Bardic Inspiration resource를 재사용하고 production follow-up adapter만 얇게 연결했다.
- College of Lore Bard 14+의 실패한 ability check와 missed attack에만 후속 사용을 노출하며, Bardic Inspiration die를 더해 성공으로 전환되는 경우에만 자원을 소비한다.
- ability-check path와 attack path 모두 Activity를 남기며, attack follow-up의 누락 Activity는 `88bb72dc3d725af049025728003ab6e6b8db1eb0`에서 최소 수정으로 복구했다.
- focused test 4개는 ability-check 성공 전환/Undo, 여전히 실패할 때 자원 보존, missed attack 성공 전환/피해/Activity/Undo, below-level 비노출을 검증한다.
- exact SHA `88bb72dc3d725af049025728003ab6e6b8db1eb0` GitHub Actions:
  - UI run `32953773211` / frontend job `98130829740`: **success**, `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32953773099` / connected-protocol job `98130829706`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- `npm run build`가 `npm run test:lore-peerless-skill`를 포함하므로 focused Peerless Skill gate와 production build가 exact SHA에서 green이다.
- 결론: **Lore Peerless Skill R1 ability-check/attack/resource/Activity/Undo/level-gate 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

### Green — Lore Cutting Words R1 exact checkpoint `90514e4`

- 기존 College of Lore Cutting Words domain resolver/resource/follow-up reuse, another-creature ability-check/attack/damage reduction, resource/reaction economy, Activity, Undo and below-level gate; non-spell runtime router passthrough fixed at `d39d599`.
- connected projected Character actor context를 깨는 과한 currentActor 우선순위 실험은 `90514e44a21840070bb77ea17561036a86b2e5ca`에서 원복해 기존 remote projection contract를 보존했다.
- exact SHA `90514e4` GitHub Actions:
  - UI run `32960806646` / frontend job `98152495174`: **success**, Cutting Words 4 focused slices와 `Typecheck and build` 포함 전 단계 green.
  - Phase 12 Connected Session run `32960806633` / connected-protocol job `98152494916`: **success**, connected-session authority protocol, Phase 11 offline walkthrough, production frontend gate green.
- `npm run build`가 `npm run test:lore-cutting-words`를 포함한다. 임시 workflow 진단 step은 `c7aee31cf0d8ee0b9e1b70359eaac7bcf55db928`에서 제거했고 cleanup UI run `32961013657` / frontend job `98153136326`도 **success**다.
- 결론: **Lore Cutting Words R1 ability-check/attack/damage/resource/reaction/Activity/Undo/level-gate 범위는 source-complete + execution-validated**. Connected remote-owner exactly-once/reconnect matrix는 R2에서 별도 검증한다.

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
- Barbarian core Rage source through `b939f892` plus Berserker Mindless Rage production composition through `b82e904`: start/resource/economy, resistance, Rage Damage, Strength Advantage, Concentration/spellcasting restrictions, duration/extension/automatic termination, existing Charmed/Frightened removal, charm/fear immunity marker, Activity and Undo
- Druid Wild Shape through `11bc858`: known-form selection, transform/exit actions, resource/Bonus Action economy, transformed attack projection, explicit temporary-HP keep/take choice, spellcasting restriction, event-native write-back and Undo
- Monk Focus R1 through `c282a1e`: Focus actions, resource/Bonus Action economy, Flurry extra attacks, Patient Defense/Step effects, local/freeform/initiative Activity and one-call snapshot Undo
- Rogue R1 through `5bb8bfb`: Cunning Action Dash/Disengage/Hide projection, Bonus Action economy, standard action mechanics reuse, Uncanny Dodge reaction with atomic floor-half damage, Activity and local/event-native Undo boundaries
- Berserker Intimidating Presence R1 through `1df452f`: existing domain resolver reuse, production action projection, initiative/freeform economy split, feature resource, authoritative targeting, Frightened, Activity and Undo boundaries
- Open Hand Wholeness of Body R1 through `f260920`: existing resolver/resource reuse, initiative/freeform economy split, healing, Activity, event-native write-back and Undo.
- Open Hand Fleet Step R1 through `21b5ab8`: existing resolver/turn-history/resource reuse, post-Bonus-Action projection, free/focused variants, movement/effect semantics, Activity and Undo.
- Devotion Holy Nimbus R1 through `21b5ab8`: existing resolver/resource reuse, level/subclass projection, initiative/freeform economy split, Activity and Undo.
- Open Hand Quivering Palm R1 through `126cd84`: post-Unarmed-hit seed, Focus 4, single-target marker replacement, Action detonation, Constitution save, 10d12 force/save-half, freeform/initiative economy, Activity and Undo. `replace-attack` remains unsupported and unexposed.
- Devotion Smite of Protection R1 through `ec89fa2`: existing protection runtime, public Undo, expiry and below-level gate focused coverage.
- Fiend Dark One's Own Luck R1 through `95042b2`: existing follow-up/domain resolver reuse, failed ability-check/saving-throw recovery, resource spend, Activity, event-native Undo and below-level gate.
- Lore Peerless Skill R1 through `88bb72d`: existing Lore resolver/resource reuse, failed ability-check and missed-attack follow-up, success-only resource spend, Activity, Undo and below-level gate.
- Lore Cutting Words R1 through `90514e4`: existing Lore resolver/resource/follow-up reuse, another-creature ability-check/attack/damage reduction, resource/reaction economy, Activity, Undo and below-level gate; non-spell runtime router passthrough fixed at `d39d599`.
- Remaining subclass inventory was reconciled after Mindless Rage. Preserve Life, Land's Aid and Retaliation need richer explicit player input; Hunter/Champion/Thief/Draconic/Fiend/Evocation remainder is passive, rest-choice, item-runtime, automatic trigger/reaction or progression/spell integration rather than an honest standalone action-bar command. Do not invent dead/fake buttons to exhaust the list.

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

### R1. D&D Session Action Matrix 완성 — DONE (source/execution scope)

- [x] open ability-check DM DC contract와 일반 능력/기술 판정 UI.
- [x] Tactical Mind를 모든 적격 실패 능력 판정에 재사용.
- [x] Fighter Indomitable failed saving-throw follow-up.
- [x] Barbarian core Rage lifecycle integration source. 기존 Rage resource/Berserker mechanics를 재사용하고 start/economy/state/resistance/damage/Strength Advantage/Concentration/spellcasting/duration/extension/automatic termination을 authoritative paths에 연결했다.
- [x] Druid Wild Shape 선택/변신/해제/HP·행동·자원 lifecycle. exact checkpoint `11bc858`에서 focused gate와 production build를 GitHub Actions로 검증했다.
- [x] Monk Focus actions와 자원/행동 경제. exact checkpoint `c282a1e`에서 focused Monk gate, one-call local Undo, production build, connected-protocol frontend gate를 검증했다.
- [x] Rogue Cunning Action 및 Uncanny Dodge reaction. exact checkpoint `5bb8bfb`에서 focused Rogue gate, production build, connected-protocol frontend gate를 검증했다.
- [x] 이미 domain resolver가 있는 subclass action만 mechanics-complete 상태로 action bar/기존 feature action에 노출.
  - [x] Berserker Intimidating Presence: exact checkpoint `1df452f`, focused build gate + UI/Phase12 green.
  - [x] Berserker Mindless Rage: 별도 가짜 action 없이 기존 Rage activation에 합성. source `8bbd21a`, production lifecycle checkpoint `b82e904`, UI/Phase12 green.
  - [x] Open Hand Wholeness of Body: exact checkpoint `f260920`, focused 4/4 + UI/Phase12 connected-protocol green.
  - [x] Open Hand Fleet Step: exact checkpoint `21b5ab8`, focused 4/4 + UI/Phase12 connected-protocol green.
  - [x] Devotion Holy Nimbus: exact checkpoint `21b5ab8`, focused build gate + UI/Phase12 connected-protocol green.
  - [x] Open Hand Quivering Palm supported seed + Action detonation: exact checkpoint `126cd84`, focused build gate + UI/Phase12 connected-protocol green.
  - [x] Devotion Smite of Protection: exact checkpoint `ec89fa2`, focused build gate + UI/Phase12 connected-protocol green.
  - [x] Fiend Dark One's Own Luck: exact checkpoint `95042b2`, 3 focused cases + UI/Phase12 connected-protocol green.
  - [x] Lore Peerless Skill: exact checkpoint `88bb72d`, 4 focused cases + UI/Phase12 connected-protocol green.
  - [x] Lore Cutting Words: exact checkpoint `90514e4`, focused ability-check/attack/damage/level gate + UI/Phase12 connected-protocol green; diagnostic cleanup UI green at `c7aee31`.
  - [x] 남은 subclass resolver inventory 재대조 완료. richer explicit input이 필요한 Preserve Life/Land's Aid/Retaliation과 passive/rest-choice/item-runtime/trigger/reaction-only mechanics는 dead/auto-selected button으로 노출하지 않는다.
- [x] 각 신규 행동/기능 통합에 local/freeform/initiative/Activity/Undo의 적용 가능한 기존 primitive를 연결.
  - [x] Berserker Intimidating Presence R1 범위.
  - [x] Berserker Mindless Rage: 기존 Rage Activity/Undo/Rage-end lifecycle 공유.
  - [x] Open Hand Wholeness of Body R1 범위.
  - [x] Open Hand Fleet Step R1 범위.
  - [x] Devotion Holy Nimbus R1 범위.
  - [x] Open Hand Quivering Palm supported R1 범위.
  - [x] Devotion Smite of Protection R1 범위.
  - [x] Fiend Dark One's Own Luck R1 범위.
  - [x] Lore Peerless Skill R1 범위.
  - [x] Lore Cutting Words R1 범위.

Exit: 대표 12-class Character가 UI에서 사용 가능한 핵심 행동을 dead button 없이 실행한다. **R1 source/execution scope 충족.** 이는 V1-21 release DONE이나 Windows/human acceptance를 의미하지 않는다.

### R2. Connected remote-owner matrix 완성

R1의 모든 신규 행동마다 다음을 검증한다.

- [ ] Client intent -> Host authoritative resolve -> ordered event.
- [ ] private owner choice와 public result 분리.
- [ ] exactly-once, duplicate/reorder/retry 안전.
- [ ] reconnect replay와 fresh projection 수렴.
- [ ] Character owner write-back / Campaign Host write-back 분리.
- [ ] event-native Undo와 양 Client 보상 수렴.
- [x] **Representative remote-owner Rage gap**: Host-unknown Barbarian Rage forward commit, Host permanent-library isolation, owning Client exactly-once write-back, duplicate request/event no-op, Host projected Undo와 owner inverse write-back. exact checkpoint `dec4f22`; UI `32963492157` success; Phase 12 `32963492151` / connected-protocol `98160810148` success.
- [x] **Druid Wild Shape remote-owner gap**: known-form source/projection preservation + Host-authoritative transform/resource/state convergence. proof `a65cbd2`; Phase 12 `32964082295` / `98162628731` green.
- [x] **Rogue Cunning Action Dash remote-owner gap**: existing movement/economy event path, remote reconstruction, exactly-once/Undo. proof `ea96509`; Phase 12 `32964728723` / `98164631534` green.
- [x] **Rogue Cunning Action Disengage remote-owner gap**: existing effect/economy path, opportunity marker alignment, remote reconstruction, exactly-once/Undo. proof `134e6a8`; Phase 12 `32965968749` / `98168404394` green.
- [x] **Rogue Cunning Action Hide remote-owner gap**: canonical d20/DC15, Hidden effect/economy events, Host permanent-library isolation, owner apply exactly-once, duplicate safety, event-native Undo. exact checkpoint `7f8e945`; UI `32968629784` / `98176845419` green; Phase 12 `32968629791` / `98176845690` green.

Exit: 신규 행동 전체가 Host, acting Client, observing Client에서 같은 최종 상태를 가진다. **위 focused gaps 완료만으로 R2 전체 완료가 아니다.**

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

R2에서 Rage, Wild Shape, Cunning Action Dash/Disengage/Hide는 focused remote-owner evidence와 exact-head production gates가 green이다. 검증된 slice를 반복하지 않는다. 다음은 **Rogue Uncanny Dodge remote-owner gap**이다.

```text
live branch와 current Uncanny Dodge reaction/runtime/connected projection 상태 재대조
-> Rogue R1의 existing reaction + atomic floor-half damage + event-native Undo primitive 재사용
-> Host-unknown Rogue 5+가 공격에 명중됐을 때 Host authoritative interrupt/accept/Reaction spend/half-damage를 focused connected proof로 검증
-> Host permanent Character library 불변 + owning Client durable HP/economy write-back exactly once 확인
-> duplicate ActionRequest/event replay no-op 확인
-> current reconnect/fresh projection primitives로 reaction/economy/HP 수렴 확인
-> Host event-native Undo가 projected Host state와 owner durable Character를 함께 보상하는지 확인
-> 실제 red가 있으면 첫 원인 하나만 최소 수정
-> production frontend/connected gate exact SHA green 확인
-> canonical handoff 갱신 후 다음 R2 gap 선택
```

R3 Tauri durability/실제 Windows two-instance acceptance, R4 rendered UX/accessibility, R5 release packaging은 R2와 분리한다. Resume만을 이유로 과거 전체 matrix를 반복하지 않는다.

중요: 이 문서가 현재 V1 실행 포인터다. `.chatgpt-rerun/PLAN.md`나 `.chatgpt-rerun/STATE.md`에 별도 제품 작업 목록을 복사하지 않는다.

## 6. 검증 명령

Windows Node `uv_os_get_passwd ENOMEM` 발생 시 repository의 기존 bootstrap만 command-local로 사용한다.

```powershell
$env:NODE_OPTIONS='--require=./tests/tsx-os-userinfo-bootstrap.cjs'
npm run test:rogue-core
npm run test:berserker-presence
npm run test:open-hand-wholeness
npm run test:open-hand-fleet-step
npm run test:devotion-holy-nimbus
npm run test:open-hand-quivering-palm
npm run test:devotion-smite-protection
npm run test:fiend-luck
npm run test:lore-peerless-skill
npm run test:lore-cutting-words
npm run build
npm run test:connected-ui
npm run test:spellcasting
node node_modules/tsx/dist/cli.mjs --test 'tests/**/*.test.ts'
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri:build
```

테스트 통과만으로 rendered UX 또는 two-instance acceptance를 DONE 처리하지 않는다. Resume만을 이유로 이미 기록된 full matrix를 반복하지 않는다.
