# SimpleVTT Codex Validation Queue

Status: **ACTIVE VALIDATION QUEUE**  
Owner of this file: **ChatGPT development loop**  
Canonical product branch: **`work/v1-composite`**

이 파일은 제품 개발과 검증을 분리하기 위한 큐다. ChatGPT는 구현을 계속 진행하면서 검증이 필요한 exact SHA와 명령을 이 파일에 누적한다. Codex는 제품 구현을 대신 수정하지 않고, 별도 검증 worktree에서 큐를 실행한 뒤 결과 파일만 남긴다.

## Validator contract

1. **Primary Live worktree에서 테스트하지 않는다.** Live Development의 Git auto-sync를 dirty하게 만들 수 있기 때문이다.
2. 검증할 때는 큐 항목의 `target_sha`를 exact checkout한 별도 detached worktree를 사용한다.
3. Primary Live worktree에서 `reset --hard`, `clean`, stash, checkout을 실행하지 않는다.
4. 테스트 실패가 나도 제품 코드를 수정하지 않는다. 재현 정보와 실패 로그만 결과에 기록한다.
5. 결과는 `.agents/codex-validation-results/<validation_id>.md`에 기록한다.
6. 결과 파일에는 `target_sha`, 실제 실행 명령, PASS/FAIL/BLOCKED, 실패 단계, 핵심 stderr/stdout, 의심 파일을 기록한다.
7. 동일 `validation_id`의 결과가 이미 있으면 새 결과를 덮어쓰지 말고 재검증 이유와 새 timestamp를 추가한다.
8. 검증 도중 생성되는 `node_modules`, `target`, generated content는 validation worktree 안에서만 생성한다.
9. Windows에서 system Node/Rust가 없으면 Primary Live worktree의 `.live-dev/runtime` 툴체인을 재사용할 수 있지만, 그 디렉터리 자체를 수정하거나 커밋하지 않는다.
10. 검증 결과가 없는 항목은 ChatGPT가 개발을 계속하는 것을 막지 않는다. Release/DONE 판정 시에만 결과를 gate로 사용한다.

## Recommended isolated worktree

Validation worktree는 Primary Live worktree의 바깥 sibling 디렉터리를 사용한다.

```text
SimpleVTT/                  <- Live Development, 건드리지 않음
SimpleVTT-codex-validation/ <- Codex exact-SHA validation
```

Codex는 각 항목을 시작할 때 canonical remote를 fetch하고 `target_sha`가 실제로 존재하는지 확인한다. worktree가 이전 검증에서 남아 있다면 **validation worktree만** 정리/재생성한다.

---

## VAL-READY-20260823-01

status: **PENDING**  
target_sha: **`61a30196069dcc91a1f38ab985f32c4573387827`**  
scope: Ready lifecycle + actor ownership + capability negotiation + Live/acceptance tooling regression

### Required checks

```powershell
npm run generate:content
npx tsx --test tests/ui/connectedSessionProtocol.test.ts tests/ui/connectedReadyActionProjection.test.ts tests/ui/connectedTurnProjection.test.ts tests/ui/readyActionActorState.test.ts tests/ui/standardActionLifecycle.test.ts tests/ui/connectedSessionRuntimeAdapter.test.ts tests/ui/twoInstanceAcceptanceLauncherStructure.test.ts
npx tsc --noEmit
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
node --check scripts/live-dev-sync.mjs
```

### Expected invariants

- Ready configuration은 actor별로 독립 유지된다.
- A actor의 clear/trigger가 B actor의 Ready를 제거하지 않는다.
- 다음 자기 턴 시작 및 initiative 종료 만료가 deterministic `ready-action: cleared` ledger event로 전파된다.
- duplicate/catch-up replay가 Ready 상태를 두 번 적용하지 않는다.
- session reset/new Host/new Join에서 session-transient Ready configuration과 visible `준비 행동` 표시가 제거된다.
- current connected manifest에는 `ready-action-v1`이 포함되고, 해당 capability가 없는 peer는 protocol version이 같아도 incompatible이다.
- `Start SimpleVTT Acceptance Pair.cmd` 구조가 Host/Client 데이터 루트를 격리한다.
- `scripts/live-dev-sync.mjs`가 문법 오류 없이 로드 가능하다.
- TypeScript production build 및 Rust library tests가 통과한다.

### Human-only follow-up

Codex 자동 검증과 별도로 아래는 실제 두 창 acceptance가 필요하다.

- Acceptance Host + Acceptance Client 두 창 실행.
- Host local actor Ready + remote Player actor Ready 동시 보유.
- 한 actor만 trigger한 뒤 다른 actor Ready 유지.
- 다음 자기 턴/initiative 종료 만료 확인.
- Client disconnect/reconnect 후 state/config/economy가 Host와 동일한지 확인.

---

## Queue append rule

ChatGPT는 이후 기능 슬라이스마다 새 `VAL-...` 섹션을 **아래에 추가**한다. 이전 항목의 정의는 검증 재현성을 위해 수정하지 않는다. 잘못된 명령이 발견되면 원 항목을 지우지 말고 `correction:` 메모를 추가하고 새 validation id를 만든다.
