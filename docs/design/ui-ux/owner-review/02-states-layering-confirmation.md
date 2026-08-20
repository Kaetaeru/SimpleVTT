# Owner Review — States / Layering / Confirmation

Sheets: `STATE-01`, `STATE-02`, `INT-02`, `INT-03`

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# STATE-01 — UI States

### STATE-01-01 — Reusable interactive-state vocabulary

**질문:** 공통 control/component가 기본적으로 지원해야 하는 UI state vocabulary는?

**선택지**
- `A` — Default / Hover / Focus / Pressed-Active / Selected / Disabled / Unavailable / Pending / Error.
- `B` — Default / Focus / Active / Selected / Disabled / Pending만 공통으로 두고 나머지는 component-specific.
- `C` — A + Current / Controlled / Targetable 같은 product semantic state까지 공통 vocabulary에 포함.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-02 — Disabled / Unavailable / Pending / Selected / Current semantics

**질문:** 이 상태들을 의미상 어떻게 구분할 것인가?

**선택지**
- `A` — Disabled=interaction 불가, Unavailable=현재 canonical 조건상 실행 불가+이유, Pending=처리 중, Selected=사용자 선택, Current=시스템/turn의 현재 대상.
- `B` — Disabled와 Unavailable을 하나로 합치고 이유가 있는 경우에만 설명 추가. Pending/Selected/Current는 분리.
- `C` — Disabled는 UI 자체 비활성, Unavailable은 domain/rules 비가용으로 엄격히 분리하고 visual treatment도 별도.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-03 — When unavailable reason is mandatory

**질문:** disabled/unavailable 상태는 언제 반드시 이유를 보여줘야 하는가?

**선택지**
- `A` — 사용자가 정상적으로 시도할 법한 기능이 현재 막힌 경우에는 항상 이유 제공; 명백한 정적 disabled만 생략 가능.
- `B` — 모든 Unavailable에는 이유 필수, 단순 Disabled에는 선택.
- `C` — task를 막거나 중요한 action인 경우만 explicit reason; 사소한 controls는 tooltip/focus help로 충분.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-04 — Empty vs No Results

**질문:** 빈 상태와 검색 결과 없음 상태를 어떻게 구분할 것인가?

**선택지**
- `A` — Empty=아직 데이터가 없음 + 생성/시작 CTA, No Results=검색/필터 결과 없음 + query/filter 수정 action.
- `B` — 하나의 Empty State component를 사용하되 원인/CTA만 context별로 변경.
- `C` — large surface에는 A처럼 구분, compact pane/list에는 하나의 inline empty treatment 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-05 — Validation severity model

**질문:** form/import/builder validation severity와 presentation state는?

**선택지**
- `A` — Info / Warning / Error / Blocking Error의 4단계. Field-level + 필요 시 summary.
- `B` — Warning / Error 두 단계. Error만 진행 차단.
- `C` — Field Hint / Field Error / Section Warning / Blocking Summary처럼 위치 중심으로 구분.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-06 — Stale local selection recovery

**질문:** canonical state가 선택된 action/target/item을 더 이상 유효하지 않게 만들면 local selection을 어떻게 복구할 것인가?

**선택지**
- `A` — 즉시 selection을 clear하고 왜 해제됐는지 짧게 설명.
- `B` — selection을 유지하되 Unavailable로 전환하고 사용자가 직접 변경/취소하게 함.
- `C` — 실행 불가능한 selection은 clear, 단순 target/state 변화는 disabled selection으로 유지하는 혼합 정책.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-07 — Feedback surface selection

**질문:** 언제 inline message, toast, banner, Activity를 사용할 것인가?

**선택지**
- `A` — current task 문제=inline, 짧은 비차단 결과=toast, 지속적/system issue=banner, durable/auditable event=Activity.
- `B` — 대부분의 결과/이벤트를 Activity로 보내고 toast/inline은 최소화.
- `C` — workflow는 inline 중심, global/system만 banner, toast는 거의 사용하지 않고 Activity는 history 전용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-01-08 — Pending operation interaction lock

**질문:** pending operation 중 duplicate submission을 막으면서 unrelated controls는 어떻게 유지할 것인가?

**선택지**
- `A` — initiating control/충돌 actions만 pending+disabled, unrelated controls는 계속 사용 가능.
- `B` — 해당 local form/pane 전체를 잠그되 app/다른 pane은 사용 가능.
- `C` — optimistic UI를 허용하는 operation은 즉시 반영, irreversible/authority-critical action만 local lock.
- `CUSTOM` — 직접 정의. Entire HUD global disable은 기존 Reviewed 방향과 충돌.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# STATE-02 — System States

### STATE-02-01 — Bootstrap / restore presentation

**질문:** app bootstrap/restore 중 product state가 준비되기 전에 무엇을 보여줄 것인가?

**선택지**
- `A` — Product Shell skeleton + restore/loading status, interactive controls는 준비된 범위만 활성.
- `B` — 짧은 dedicated loading/splash screen 후 준비되면 전체 Product Shell 진입.
- `C` — 마지막 safe UI snapshot을 read-only로 보여주고 restore overlay/status를 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-02 — Durable save failure recovery

**질문:** Character/content durable save가 실패하면 어떤 recovery contract가 필요한가?

**선택지**
- `A` — unsaved edits를 메모리에 보존하고 Retry / Save As Copy 또는 안전한 export path 제공; 성공 전 저장됐다고 표시 금지.
- `B` — local recovery snapshot을 자동 보존하고 재시도/복원 entry 제공.
- `C` — save failure 동안 해당 editor/task 이탈을 막고 Retry/Discard를 명시적으로 선택하게 함.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-03 — Unsupported content/mechanic

**질문:** unsupported 상태를 일반 error와 어떻게 구분할 것인가?

**선택지**
- `A` — 명시적 `Unsupported` 상태/label + 무엇이 지원되지 않는지와 가능한 안전한 다음 행동을 표시.
- `B` — task-blocking error family 안에서 `Unsupported` reason code/heading으로 구분.
- `C` — 지원 가능한 부분만 안전하게 읽기 전용으로 보여주고 unsupported 부분은 명시적 blocker로 표시. Rule approximation은 하지 않음.
- `CUSTOM` — 직접 정의. Unsupported mechanics를 추정 구현하는 선택은 허용되지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-04 — Reconnecting / Disconnected / Unrecoverable

**질문:** 연결 상태 세 종류를 어떻게 구분하고 상호작용을 제한할 것인가?

**선택지**
- `A` — Reconnecting=자동 복구 중, Disconnected=수동 Rejoin 가능, Unrecoverable=세션/호스트를 다시 선택해야 하는 명확한 별도 state.
- `B` — Reconnecting과 Disconnected를 하나의 Recovery state로 합치고 recoverable/unrecoverable action만 구분.
- `C` — 기존 Play context를 read-only로 유지하며 상태 banner/strip에서 reconnect→rejoin→exit 단계를 보여줌.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-05 — Incompatible session/content

**질문:** version/content incompatibility를 어떻게 보여주고 어떤 recovery를 허용할 것인가?

**선택지**
- `A` — unsafe Play 전에 blocking compatibility screen/alert + 원인 + update/change content/exit actions.
- `B` — critical incompatibility만 block, noncritical 차이는 warning으로 진입 허용.
- `C` — compatibility severity를 canonical contract가 제공하고 UI는 Block / Warn / Inform 세 수준으로 투영.
- `CUSTOM` — 직접 정의. UI가 compatibility를 임의 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-06 — Permission / authority denial

**질문:** unauthorized command를 private state leakage 없이 어떻게 보여줄 것인가?

**선택지**
- `A` — 사용자에게 허용된 범위의 generic denial만 표시; secret object/reason/existence metadata는 노출 금지.
- `B` — 공개 가능한 canonical reason이 있을 때만 contextual reason을 보여주고 그 외에는 generic denial.
- `C` — role-specific denial copy를 사용하되 payload/detail은 authorization contract가 허용한 것만 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-07 — Stale / reconciliation presentation

**질문:** canonical state를 재동기화하는 동안 stale state를 어떻게 보여줄 것인가?

**선택지**
- `A` — stale/reconciling indicator + authority-sensitive mutations 일시 정지, current projection은 read-only로 유지.
- `B` — 안전한 local presentation/navigation은 계속 허용하고 canonical mutation controls만 잠금.
- `C` — 짧은 자동 reconciliation은 조용히 처리하되 기준 시간을 넘거나 conflict가 생기면 explicit stale state로 승격.
- `CUSTOM` — 직접 정의. 임의 timeout 값은 별도 결정 없이 만들지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-08 — Error taxonomy

**질문:** recoverable local error, blocking task error, global/system blocker를 어떻게 구분할 것인가?

**선택지**
- `A` — Local Recoverable / Task Blocking / Global Blocking 3단계 taxonomy를 명시적으로 사용.
- `B` — severity보다 placement 중심: inline / surface-blocking / app-level banner-screen으로 구분.
- `C` — A의 severity taxonomy + B의 presentation mapping을 함께 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### STATE-02-09 — Persistence degradation

**질문:** content/session presentation preference 등이 정상적으로 지속되지 못할 때 어떻게 알릴 것인가?

**선택지**
- `A` — affected surface에 persistent warning + 재시도/복구 가능 여부 표시.
- `B` — preference 같은 noncritical persistence는 local inline warning, session/shared state persistence 문제는 banner/blocker로 승격.
- `C` — 다음 launch/restore 때만 recovery notice를 보여주고 현재 task는 계속 진행.
- `CUSTOM` — data criticality별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# INT-02 — Layering

### INT-02-01 — Supported layer categories

**질문:** SimpleVTT가 공식적으로 지원하는 layer category는?

**선택지**
- `A` — Inline / Popover / Context Pane / Drawer / Modal / Full Workspace Layer / System Overlay.
- `B` — Inline / Popover / Pane / Modal / Full Workspace의 단순 5단계.
- `C` — A + Resolution / Interrupt를 authority-critical special layer category로 별도 분리.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-02 — Modal vs nonmodal

**질문:** 어떤 layer category가 modal이어야 하는가?

**선택지**
- `A` — confirmation/destructive/required response만 기본 modal; panes/drawers/full workspace는 nonmodal unless specific contract requires.
- `B` — modal dialog + full workspace layer 모두 interaction modal로 취급, contextual pane/drawer만 nonmodal.
- `C` — category보다 task consequence로 결정: authority-critical required response/confirmation은 modal, 나머지는 nonmodal 우선.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-03 — Layer stack priority

**질문:** utility, full sheet, handout, resolution, interrupt, confirmation이 겹칠 때 stack priority는?

**선택지**
- `A` — Confirmation/Required Interrupt > Resolution > DM-controlled Handout > Full Sheet > Utility Pane > Popover.
- `B` — Required Interrupt > Confirmation > DM-controlled Handout > Resolution > Full Sheet > Utilities.
- `C` — authority-critical blocking layer가 최상위, 그 아래는 explicit z-order family: Resolution/Handout → Full Workspace → Utility → Popover.
- `CUSTOM` — 정확한 priority 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-04 — Dismiss / Escape / focus-return defaults

**질문:** layer category별 outside-click, Escape, Close, focus-return 기본 규칙은?

**선택지**
- `A` — Popover는 outside/Escape, Pane/Drawer는 Close/Escape, Modal은 명시 action/Escape only if safe, Full Workspace는 explicit Close/Return; 항상 logical invoker로 focus return.
- `B` — outside-click dismissal은 Popover에만 허용하고 나머지는 explicit Close/Back/Escape.
- `C` — dismissibility를 각 contract가 선언하되 focus trap/return만 category-level default로 표준화.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-05 — Multiple contextual panes

**질문:** Session/DM contextual pane을 여러 개 동시에 열 수 있는가?

**선택지**
- `A` — 한 번에 하나만. 새 pane을 열면 기존 contextual pane 닫힘.
- `B` — 서로 충돌하지 않는 pane은 여러 개 허용, available width/overlap policy로 제한.
- `C` — 하나의 pinned primary pane + 하나의 transient secondary pane까지 허용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-06 — Full Character Sheet coexistence

**질문:** Full Character Sheet가 열려 있을 때 ongoing Play/session state와 utilities는 어떻게 공존하는가?

**선택지**
- `A` — session state는 계속 살아 있고 Full Sheet가 full workspace layer를 차지; unrelated contextual utilities는 닫힘.
- `B` — Full Sheet 위/옆에서도 일부 Session utilities/connection status에 접근 가능.
- `C` — wide desktop에서는 split/overlay coexistence, narrow에서는 full workspace 단독.
- `CUSTOM` — 직접 정의. Leaving/returning이 session state를 reset하면 안 됨.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-07 — Handout layer rules

**질문:** Handout의 어떤 부분을 general layer rule로 처리하고 어떤 부분을 SES-specific으로 처리할 것인가?

**선택지**
- `A` — Overlay는 general overlay/dialog primitives 활용, Upper/Full은 SES-specific shared presentation mode.
- `B` — Overlay/Upper/Full 모두 SES-specific layer family로 통일.
- `C` — 모두 common layer primitives를 사용하되 shared/dismissibility authority만 SES contract가 제공.
- `CUSTOM` — 직접 정의. 기존 Handout mode/dismissibility Reviewed 결정은 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-02-08 — Resolution coexistence with other layers

**질문:** resolution/result 중 unrelated interaction layers를 어떻게 유지/억제할 것인가?

**선택지**
- `A` — conflicting interactions/layers만 잠그고 unrelated utilities/presentation은 유지.
- `B` — resolution이 top operational layer로 올라오지만 unrelated utility는 닫지 않고 background로 유지.
- `C` — resolution 시작 시 transient popover/pane은 정리하고 persistent/global layers만 유지.
- `CUSTOM` — 직접 정의. Entire HUD disable은 허용되지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# INT-03 — Confirmation

### INT-03-01 — Confirmation principle

**질문:** 어떤 action이 explicit confirmation을 요구하는가?

**선택지**
- `A` — irreversible/destructive, 큰 권한/세션 영향, 또는 사용자가 결과를 쉽게 예상하기 어려운 action만 confirm.
- `B` — 모든 authoritative durable mutation을 confirm하고 local/reversible action은 confirm 없음.
- `C` — consequence risk tier에 따라 No Confirm / Preview / Confirm / Strong Confirm으로 구분.
- `CUSTOM` — 직접 정의. 이미 Reviewed된 valid single-target action의 no-extra-confirm 규칙은 유지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-02 — Unsaved Character flow exits

**질문:** Character create/edit/level-up에서 어떤 exit가 unsaved-change confirmation을 요구하는가?

**선택지**
- `A` — dirty material changes가 있을 때 task를 완전히 떠나는 경우만 confirm; 내부 step 이동은 confirm 없음.
- `B` — reliable autosave/draft가 있으면 confirm 없이 떠나고, autosave 실패/불가능할 때만 prompt.
- `C` — dirty 상태에서 Builder/Edit/Level Up을 벗어나는 모든 exit에 confirm.
- `CUSTOM` — flow별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-03 — Player leaves live session

**질문:** Player가 live session을 떠날 때 confirmation/consequence model은?

**선택지**
- `A` — 항상 confirm + “세션 연결 종료/재참여 가능 여부”를 명확히 설명.
- `B` — 정상 Freeform에서는 direct leave, Initiative/active resolution 등 중요한 context에서만 confirm.
- `C` — first click opens compact consequence sheet, explicit Leave가 실제 command 역할.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-04 — Host ends session

**질문:** Host가 session을 종료할 때 confirmation/consequence model은?

**선택지**
- `A` — 항상 destructive confirmation + 모든 Client 영향/저장/종료 결과 명시.
- `B` — connected participants가 있거나 active Play일 때 strong confirm, 비어 있는 준비 세션은 normal confirm.
- `C` — two-step control: End Session 선택 → consequence review → final End.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-05 — Import / install / replace / remove confirmation

**질문:** content import/install/remove 중 preview만으로 충분한 것과 추가 confirmation이 필요한 것은?

**선택지**
- `A` — safe new install은 preview+Install action으로 충분; replace/remove/dependency-impact action은 confirm.
- `B` — install/replace/remove 모두 preview 뒤 explicit confirm.
- `C` — conflicts/dependency/durable destructive impact가 있을 때만 confirm; 그 외 preview의 primary action이 commit.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-06 — Adjudication / Undo confirmation

**질문:** 어떤 DM adjudication/Undo operation이 authoritative mutation 전에 confirmation을 요구하는가?

**선택지**
- `A` — public/durable/high-impact mutation만 confirm; private/reversible low-impact는 direct with clear feedback.
- `B` — 모든 adjudication/Undo command를 confirm.
- `C` — preview를 항상 보여주되 실제 confirm은 scope/visibility/consequence가 threshold를 넘는 경우만 요구.
- `CUSTOM` — operation category별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-07 — Cancel / Back / Retry / Close semantics

**질문:** pending/failed operation에서 Cancel, Back, Retry, Close를 어떻게 구분할 것인가?

**선택지**
- `A` — Cancel=현재 operation/task 취소, Back=이전 step/context, Retry=같은 operation 재시도, Close=message/layer만 닫기.
- `B` — Back과 Close를 대부분 하나로 단순화하고 Cancel/Retry만 명확히 분리.
- `C` — workflow에서는 Back/Cancel/Retry를 사용, passive feedback/layer에서는 Close만 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### INT-03-08 — Movement-reaction declaration confirmation

**질문:** manual movement-reaction declaration은 explicit Submit 뒤 추가 confirmation이 필요한가?

**선택지**
- `A` — Submit 자체가 명시적 commit이므로 추가 confirm 없음.
- `B` — 항상 Submit 후 최종 confirmation.
- `C` — canonical/domain layer가 high-consequence 상태로 표시한 경우에만 추가 confirm; UI가 자체 판단하지 않음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
