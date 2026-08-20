# Owner Review — Session / Authority / DM / Rules & Add-ons

Sheets: `SES-01`, `SES-02`, `DM-01`, `DM-02`, `CONTENT-02`

Existing role/privacy/Handout Reviewed decisions remain binding. Candidate options never authorize Player delivery of DM-only secret data or UI-side authority/rules inference.

Instructions: choose one candidate code in `OWNER SELECT`, or use `CUSTOM` and describe the desired behavior in `OWNER NOTE`. Candidate options are scaffolding only. `AI STATUS` is AI-managed.

---

# SES-01 — Session UX

### SES-01-01 — Direct Host Setup

**질문:** direct Host Setup에 어떤 fields/actions가 필요한가?

**선택지**
- `A` — Session name/basic identity + network/address setup + active content summary + Create/Host action.
- `B` — 최소 session identity + Create first, network/share/content settings는 Lobby에서 조정.
- `C` — Host Setup을 Basics / Content / Connection의 짧은 staged flow로 구성.
- `CUSTOM` — 실제 required fields를 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-02 — Host start readiness

**질문:** Host가 Play를 시작하기 전에 어떤 participant/readiness 조건이 필요한가?

**선택지**
- `A` — 모든 connected Player가 Character 선택 + Ready여야 Start 가능.
- `B` — Host는 언제든 Start 가능하되 준비되지 않은 Player가 있으면 명확한 warning/summary 표시.
- `C` — 최소 한 명의 valid Player/Character가 준비되면 Start 가능, 나머지는 join/rejoin 가능.
- `CUSTOM` — readiness 조건 직접 정의. UI가 domain legality를 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-03 — Direct Join Setup / Character Select

**질문:** direct Join Setup과 Character Select에 어떤 fields/actions가 필요한가?

**선택지**
- `A` — Host address/session code → connection validation → Character Select → Join/Ready.
- `B` — connection target + Character Select를 한 화면에서 구성하고 Connect/Join 한 번으로 진행.
- `C` — Join target 입력 → handshake/compatibility → Character Select → Player Lobby의 staged flow.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-04 — Join with no valid Character

**질문:** Join 시 valid Character가 하나도 없으면 어떻게 할 것인가?

**선택지**
- `A` — Join flow 안에서 Create / Import Character로 이동하고 완료 후 같은 Join context로 복귀.
- `B` — Player Lobby까지 연결은 허용하되 Play 참여 전 Character 생성/선택을 요구.
- `C` — no-Character 상태에서 Join은 block하고 명확한 Create/Import CTA + 완료 후 Join resume.
- `CUSTOM` — 직접 정의. Spectator 역할로 자동 전환하는 선택은 v1 role 결정과 충돌.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-05 — Player Lobby / Ready contents

**질문:** Player Lobby/Ready에 어떤 정보/action을 보여줄 것인가?

**선택지**
- `A` — Session/Host identity + own Character + participant roster/ready + compatibility/content status + Ready/Leave.
- `B` — own Character/connection/Ready만 primary, participant roster/content detail은 secondary.
- `C` — roster-centric lobby + own Character card + readiness/connection status, Rules/content summary는 contextual.
- `CUSTOM` — role-visible 정보 범위에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-06 — Complete Play Workspace composition

**질문:** Freeform/Initiative의 완전한 Play Workspace composition은?

**선택지**
- `A` — top tracker when Initiative + upper opposing Actor Board + central Scene/Table + lower allied Actor Board + bottom Command Center + contextual utility launchers.
- `B` — A + role/status strip를 top/edge에 persistent하게 추가.
- `C` — Reviewed core topology는 A와 동일하되 utilities/identity/status를 Command Center와 scene edge에 더 통합.
- `CUSTOM` — 기존 Reviewed Actor Board/Dual Anchor/Initiative decisions를 유지하며 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-07 — Session utilities / launch points

**질문:** Quick Sheet, Full Sheet, Rules, Activity, Encounter, Participants, Session Share, Connection utilities 중 무엇이 존재하고 어디서 여는가?

**선택지**
- `A` — common utility rail/launcher에서 역할에 따라 available utilities를 열고 contextual pane/full layer로 표시.
- `B` — Player utilities는 Command Center/identity에서, DM utilities는 별도 DM Tools launcher에서 분리.
- `C` — common launcher family는 공유하되 Character/Rules/Activity는 common, Encounter/Participants/Share는 DM role-specific group.
- `CUSTOM` — utility별 존재/launch point 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-08 — Handout Overlay / Upper / Full UI

**질문:** Handout 세 mode의 close/reopen/zoom/pan UI는?

**선택지**
- `A` — Overlay=local close/minimize+reopen launcher, Upper/Full=DM withdraw 전까지 유지; 모든 mode에서 local zoom/pan.
- `B` — Overlay=modal-like viewer, Upper=scene upper replacement, Full=full workspace; common Handout toolbar에서 zoom/pan/status.
- `C` — mode별 layout은 다르지만 동일 Handout controller/toolbar를 공유하고 Player dismissibility는 기존 Reviewed rule 그대로 적용.
- `CUSTOM` — 직접 정의. Mode를 UI가 임의 변경하면 안 됨.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-09 — Session / Character / Actor / connection / mode identity

**질문:** Session identity, Character/Actor identity, connection state, current mode를 어디에 어떻게 보여줄 것인가?

**선택지**
- `A` — compact persistent session/status strip + Command Center actor identity.
- `B` — top workspace header에 session/connection/mode, Command Center에 controlled Actor/Character.
- `C` — connection/session은 utility/status control, controlled Actor/mode는 scene/Command Center에 contextually 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-10 — Freeform with no Players / no Combatants

**질문:** connected Player나 Combatant가 없을 때 normal Freeform은 어떻게 보여야 하는가?

**선택지**
- `A` — Play Workspace skeleton은 유지하고 relevant Actor Board에 empty-state CTA/DM setup guidance 표시.
- `B` — Scene/Table + Command Center/DM tools는 유지, 비어 있는 Actor Board는 collapse 가능한 empty placeholder.
- `C` — DM preparation-style empty state를 scene 안에 표시하되 Play topology는 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-11 — Player Leave vs Host End

**질문:** Player Leave와 Host End Session의 user-visible flow는 어떻게 다른가?

**선택지**
- `A` — Player Leave=자기 연결만 종료 후 Home/Session으로 복귀; Host End=모든 participant에 종료 projection 후 Product Shell로 이동.
- `B` — Player Leave는 rejoin affordance를 남기고, Host End는 session closed state와 summary를 보여준 뒤 exit.
- `C` — 둘 다 consequence review/confirm을 거치되 Host End는 stronger destructive flow와 participant impact summary.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-01-12 — Reconnect-visible continuity

**질문:** reconnect 후 interaction을 재개하기 전에 어떤 user-visible context가 복원되어야 하는가?

**선택지**
- `A` — same Session/Play mode + controlled Actor + Initiative/turn + Handout shared mode + authoritative resolution state를 복원, ephemeral popovers/hover는 reset 가능.
- `B` — canonical session state 전부 복원 후 local utilities/presentation은 닫힌 기본 상태로 시작.
- `C` — A + reconnect summary를 잠깐 보여주고 reconciliation 완료 후 interaction enable.
- `CUSTOM` — 직접 정의. Canonical game/session state의 silent reset은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# SES-02 — Multiplayer Authority UX

### SES-02-01 — Effective authority context

**질문:** fixed Host=DM / Client=Player와 Actor-control assignment를 effective authority context로 어떻게 표현할 것인가?

**선택지**
- `A` — Connection Role이 Play Role을 고정 결정하고 별도 Actor-control assignment가 command scope를 추가하는 단순 모델.
- `B` — explicit authority context object를 사용: connection role + play role + controlled Actor IDs + session permissions.
- `C` — role은 fixed identity, 각 command/data projection은 capability/permission set으로 authorized scope를 제공.
- `CUSTOM` — architecture contract에 맞춰 직접 정의. Offline은 role-free.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-02 — Player vs DM command/data permission model

**질문:** Player/DM이 무엇을 see/receive/control/mutate할 수 있는지 어떤 contract로 정의할 것인가?

**선택지**
- `A` — explicit role/Actor-control permission matrix + data visibility/delivery matrix.
- `B` — server/runtime가 role-scoped capability/data projection을 제공하고 UI는 available projection만 렌더.
- `C` — A의 audit matrix를 planning/verification에 유지하고 runtime은 B처럼 capability projection으로 실행.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-03 — DM-only zero-leakage event/projection contract

**질문:** DM-only roll/adjudication을 Player에게 existence metadata도 전달하지 않고 어떻게 projection할 것인가?

**선택지**
- `A` — authoritative private event/state는 Host/DM scope에만 존재하고 Client projection에는 생성 자체를 하지 않음; disclosure 시 별도 public projection 생성.
- `B` — private host-only channel/projection과 public session projection을 구조적으로 분리.
- `C` — event store는 authoritative visibility scope를 갖고 Client별 projector가 unauthorized event를 완전히 제외.
- `CUSTOM` — architecture 방식 직접 정의. Client로 secret payload를 보내고 숨기는 방식은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-04 — Later disclosure projection

**질문:** full-adjudication reveal vs result-only reveal은 어떤 public projection으로 나갈 것인가?

**선택지**
- `A` — original private event를 변경하지 않고 disclosure event가 new public projection을 생성; mode가 full/result-only를 지정.
- `B` — sanitized disclosure snapshot을 새 public Activity/result event로 생성하고 original private provenance를 DM side에만 유지.
- `C` — shared disclosure record가 original event ID를 참조하고 authorized public fields만 projection.
- `CUSTOM` — 직접 정의. Reroll이 아니라 원 adjudication의 disclosure여야 함.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-05 — Shared Handout state contract

**질문:** Handout image/mode/reconnect를 어떤 shared state/projection으로 표현할 것인가?

**선택지**
- `A` — session Handout state object: asset/reference + mode + revision/status; reconnect snapshot에 포함.
- `B` — reveal/change-mode/withdraw events + current Handout projection을 runtime이 유지.
- `C` — B의 event history + A의 current-state snapshot을 함께 사용.
- `CUSTOM` — architecture contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-06 — Reconnect cursor / reconciliation

**질문:** reconnect 시 어떤 state/event cursor를 복원하고 stale state를 어떻게 reconcile할 것인가?

**선택지**
- `A` — authoritative session snapshot + event/revision cursor, 이후 missed events를 적용.
- `B` — fresh authoritative full snapshot으로 교체하고 local ephemeral state만 별도 복원.
- `C` — last acknowledged cursor 기반 incremental replay, mismatch 시 full snapshot fallback.
- `CUSTOM` — runtime architecture에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-07 — Version/content incompatibility gate

**질문:** unsafe Play 전에 incompatible version/content를 어떻게 판정/표시할 것인가?

**선택지**
- `A` — handshake가 required protocol/product/content compatibility를 판정하고 mismatch면 Join/Play block + remediation 표시.
- `B` — capability/feature compatibility negotiation을 사용해 critical mismatch만 block하고 safe differences는 warning.
- `C` — required session manifest/version contract와 Client manifest를 비교하는 explicit compatibility gate.
- `CUSTOM` — architecture contract에 맞춰 직접 정의. UI가 호환성을 추측하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-08 — Unauthorized command rejection

**질문:** unauthorized command를 private information leakage 없이 어떻게 reject할 것인가?

**선택지**
- `A` — generic authorization failure + safe public recovery action만 반환.
- `B` — canonical public-safe reason code가 있을 때만 구체 reason, 그 외 generic denial.
- `C` — command family별 public-safe error contract를 정의하고 secret state/reason은 Host/DM log에만 남김.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-09 — Participant information visibility

**질문:** participant connection/ready/identity 정보는 role별로 어디까지 보이는가?

**선택지**
- `A` — DM은 full participant/connection/ready/Character assignment, Player는 public roster + ready/connection summary.
- `B` — DM은 full, Player는 자기 정보 + 다른 Player의 public display name/ready 정도만.
- `C` — roster field별 visibility contract를 두고 session setup/privacy policy가 공개 범위를 결정.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### SES-02-10 — Live role-switch reconciliation

**질문:** live role switching이 허용될 때 reconciliation은?

**선택지**
- `N/A` — `UX-02-06`에서 live DM↔Player role switching을 금지했으므로 v1 condition false.
- `CUSTOM` — UX-02-06을 명시적으로 다시 열고 역할 전환을 허용하기로 변경하는 경우에만 작성.

**OWNER SELECT:** `N/A`

**OWNER NOTE:** `UX-02-06 condition false in v1.`

**AI STATUS:** `PROCESSED`

---

# DM-01 — DM Controls

### DM-01-01 — Public / DM Only default and persistence

**질문:** roll visibility의 initial value와 persistence lifetime은?

**선택지**
- `A` — 새 session은 Public default, DM이 바꾼 값은 해당 session 동안 유지.
- `B` — 새 session은 DM Only default, 변경값은 session 동안 유지.
- `C` — session creation/default preference가 initial value를 정하고 live session에서는 마지막 DM 선택을 유지.
- `CUSTOM` — default/persistence 직접 정의. Context에 따른 자동 switching은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-02 — DM switches controlled Actor

**질문:** DM이 selected/controlled Actor를 어떻게 바꿀 것인가?

**선택지**
- `A` — Actor Card context menu의 `Control/Take Control` + Command Center에서 현재 controlled Actor 표시.
- `B` — dedicated DM Actor picker/selector + Actor Card click은 일반 selection/targeting semantics 유지.
- `C` — Actor Card context action과 compact controlled-Actor switcher를 둘 다 제공.
- `CUSTOM` — 직접 정의. Targeting과 ordinary selection을 혼동하지 않아야 함.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-03 — Encounter management / spatial relation controls

**질문:** preparation/Freeform/Initiative에서 어떤 Encounter management controls를 productize할 것인가?

**선택지**
- `A` — Combatant add/remove/side/initiative setup + canonical status controls + explicit spatial relation authoring을 advanced DM tool로 포함.
- `B` — Encounter roster/initiative/control만 productize하고 current spatial relation editor는 v1에서 제외.
- `C` — 기본 Encounter controls + spatial relation은 contextual advanced section으로 유지, domain support가 없는 relation은 노출하지 않음.
- `CUSTOM` — control categories 직접 정의. UI가 rules relation을 계산하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-04 — Participants / Session Share organization

**질문:** participant/session-share controls를 persistent vs contextual DM utilities에 어떻게 배치할 것인가?

**선택지**
- `A` — Participants와 Session Share를 별도 contextual DM panes로 제공.
- `B` — 하나의 Session Management pane 안에 Participants / Share / Compatibility / End Session sections.
- `C` — compact persistent participant/connection indicator + 상세 controls는 contextual Session Management pane.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-05 — Handout authoring/control location

**질문:** Handout file/preview/reveal/withdraw/mode control은 어디에 둘 것인가?

**선택지**
- `A` — dedicated DM Handout contextual pane.
- `B` — DM utility launcher → Handout pane, live handout 중에는 persistent mode/status chip/control을 추가.
- `C` — scene/DM toolbar에서 Reveal/Withdraw/Mode primary controls, asset selection/preview는 pane.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-06 — Live lifecycle controls

**질문:** live Play 중 어떤 lifecycle control을 항상 접근 가능하게 하고 무엇을 confirmation 뒤에 둘 것인가?

**선택지**
- `A` — Session/Participants/Share access는 항상 available, End Session은 contextual destructive control + confirm.
- `B` — lifecycle controls를 Session Management pane에 모으고 connection/status entry만 persistent.
- `C` — common session menu에서 share/reconnect/status/end를 제공하되 destructive controls는 분리된 section.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-07 — Persistent DM-only indicators

**질문:** DM tools가 닫혀 있어도 어떤 DM-only state를 persistent하게 보여야 하는가?

**선택지**
- `A` — Public/DM Only visibility + currently controlled Actor + session connection/problem status.
- `B` — privacy state만 반드시 persistent, 나머지 DM state는 contextual.
- `C` — privacy + active Handout + current controlled Actor/Encounter mode를 compact status group으로 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-01-08 — DM utility surface organization

**질문:** DM utility가 Command Center를 중복하지 않도록 어떤 조직 구조를 사용할 것인가?

**선택지**
- `A` — dedicated contextual DM Tools pane with Encounter / Participants / Handout / Session sections.
- `B` — compact DM utility rail + 각 tool의 별도 pane, Command Center에는 gameplay actions/현재 Actor만 유지.
- `C` — role-specific utility launcher group + task-specific panes; persistent Command Center는 공통 skeleton 유지.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# DM-02 — Adjudication & Undo

### DM-02-01 — Private Activity before disclosure

**질문:** private roll/adjudication을 disclosure 전 DM Activity에서 어떻게 보여줄 것인가?

**선택지**
- `A` — DM Activity에 명확한 DM-only/private entries로 정상 chronology 안에 표시.
- `B` — Activity 안의 별도 Private section/filter에 표시하고 public chronology와 구분.
- `C` — 하나의 Activity list를 유지하되 visibility badge/filter로 private/public을 구분; Player projection에는 private entry 자체가 없음.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-02 — Adjudication operation categories

**질문:** 어떤 adjudication operation category를 v1에서 지원할 것인가?

**선택지**
- `A` — canonical state correction + roll/result correction/override + visibility/disclosure correction의 기본 category.
- `B` — state/resource/condition/HP 등 domain-supported state adjustment + result/disclosure control을 별도 category로 제공.
- `C` — generic canonical adjudication command framework를 사용하고 UI는 domain이 제공하는 supported operation catalog만 렌더.
- `CUSTOM` — supported category 직접 정의. UI가 unsupported mutation을 발명하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-03 — Adjudication scope / lifetime / preview

**질문:** adjudication의 scope/lifetime 선택과 preview는?

**선택지**
- `A` — operation마다 affected Actor/event/state + before/after preview + one-time/persistent scope를 explicit하게 표시.
- `B` — current resolution/event correction과 durable state correction을 두 major scope로 분리.
- `C` — domain command가 scope/lifetime choices를 제공하고 UI는 선택/preview만 수행.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-04 — Reason / provenance requirement

**질문:** adjudication reason/provenance를 required/optional로 할 것인가?

**선택지**
- `A` — public/durable/high-impact adjudication은 reason required, private/reversible low-impact는 optional.
- `B` — 모든 adjudication에 short reason required.
- `C` — reason은 optional이지만 UI가 항상 입력칸을 제공하고 system provenance는 자동 기록.
- `CUSTOM` — operation별 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-05 — Undo vs corrective adjudication

**질문:** 무엇을 Undo할 수 있고 무엇은 correction event로 처리할 것인가?

**선택지**
- `A` — 아직 외부 dependency/disclosure가 없는 recent reversible event만 Undo; 이미 공개/연쇄된 결과는 corrective adjudication.
- `B` — domain event가 reversible flag를 제공하면 어느 시점이든 explicit Undo 가능, 불가하면 correction.
- `C` — destructive history deletion형 Undo는 사용하지 않고 모든 변경을 compensating/correction event로 기록.
- `CUSTOM` — authoritative event model에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-06 — Adjudication / Undo confirmation

**질문:** consequence/visibility에 따라 어떤 confirmation이 필요한가?

**선택지**
- `A` — public/durable/multi-Actor impact는 confirm, private/reversible low-impact는 direct with feedback.
- `B` — 모든 adjudication/Undo에 explicit confirm.
- `C` — 항상 preview, confirm은 domain-provided consequence level에 따라 요구.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-07 — Disclosure control location

**질문:** full-adjudication vs result-only disclosure를 어디서 선택할 것인가?

**선택지**
- `A` — private Activity entry의 `공개` action에서 mode 선택.
- `B` — current Result/Adjudication panel에서 primary disclosure control 제공, Activity에서도 later disclosure 가능.
- `C` — disclosure는 Activity를 canonical user-facing control surface로 두고 immediate result에는 shortcut만 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-08 — Correct already-disclosed result

**질문:** 이미 공개된 결과를 audit history를 지우지 않고 어떻게 수정할 것인가?

**선택지**
- `A` — original event 유지 + new correction event 추가 + UI에서 “corrected” link/relationship 표시.
- `B` — original을 superseded/corrected로 표시하고 latest correction을 current truth로 강조.
- `C` — immutable history + compensating adjudication event; Activity가 before/after chain을 보여줌.
- `CUSTOM` — event/history contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### DM-02-09 — Immediate controls vs Activity detail

**질문:** adjudicated/undone event에서 immediate result control과 Activity detail을 어떻게 나눌 것인가?

**선택지**
- `A` — immediate: current outcome + 필요한 DM action/visibility control. Activity: reason/provenance/history/corrections/full detail.
- `B` — immediate에는 result summary만, 모든 adjudication/Undo/disclosure control은 Activity에서 수행.
- `C` — current resolution에는 active controls, 완료된 후에는 Activity가 유일한 durable management surface.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

---

# CONTENT-02 — Rules & Add-on UX

### CONTENT-02-01 — Rules Browser categories / metadata

**질문:** Rules Browser가 어떤 content category와 source metadata를 검색/노출할 것인가?

**선택지**
- `A` — Rules / Actions / Spells / Features / Conditions / Items 등 canonical categories + source/provenance.
- `B` — category보다 unified search 중심, result마다 type/source badge만 제공.
- `C` — canonical category navigation + unified search를 함께 제공.
- `CUSTOM` — categories/source metadata 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-02 — Rules search/filter/detail flow

**질문:** Search, Filter, No Results, Detail, related rules, return-to-results flow는?

**선택지**
- `A` — search/filter list + side/detail pane, detail 닫으면 query/scroll 그대로 복귀.
- `B` — search results route → full detail route → Back으로 exact results context 복원.
- `C` — Product Rules는 master-detail, in-session Rules는 contextual compact search/detail로 두 presentation 사용.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-03 — Source / provenance / relationships

**질문:** source/provenance/relationship 정보를 어떻게 보여줄 것인가?

**선택지**
- `A` — title/type 아래 source/add-on/version metadata + related rule/content links.
- `B` — source는 compact badge, full provenance/version/relationships는 expandable detail.
- `C` — official/local/add-on provenance를 명확히 구분하고 dependency/override relationship이 있으면 별도 section.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-04 — Productized add-on file/package support

**질문:** v1에서 어떤 add-on import package/file boundary를 productize할 것인가?

**선택지**
- `A` — 하나의 canonical SimpleVTT package format만 공식 지원.
- `B` — canonical package + documented JSON/data import 형식 몇 가지를 공식 지원.
- `C` — internal canonical package로 변환 가능한 import adapters를 허용하되 각 adapter는 명시적 supported format이어야 함.
- `CUSTOM` — 지원 format 직접 정의. 임의 파일 추측 parsing은 하지 않음.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-05 — Preview / Validation before install

**질문:** install/activation 전에 Preview/Validation에서 무엇을 보여줄 것인가?

**선택지**
- `A` — package identity/source/version + content counts/categories + warnings/errors/unsupported + conflicts/dependencies + final Install action.
- `B` — compact summary + blocking/warning list, 상세 item diff는 expandable.
- `C` — full change preview: new/replaced/conflicting/unsupported items를 category별로 표시.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-06 — Validation severity / conflicts

**질문:** validation severity와 conflict representation은?

**선택지**
- `A` — Info / Warning / Blocking Error. Conflict는 affected items와 resolution requirement를 별도 표시.
- `B` — Warning / Error 두 단계, Error만 install block.
- `C` — Validation / Compatibility / Conflict를 category로 분리하고 각 category에 blocking 여부를 canonical validator가 제공.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-07 — Unsupported mechanics/extensions

**질문:** imported content가 unsupported mechanic/extension을 요구하면 어떻게 할 것인가?

**선택지**
- `A` — unsupported 부분이 material하면 install block; 안전하게 분리 가능한 supported data만 별도 import 가능하다고 명시.
- `B` — package에 unsupported required mechanic이 하나라도 있으면 전체 install reject.
- `C` — content를 disabled/read-only state로 import할 수 있지만 unsupported mechanic은 실행 불가로 명확히 표시.
- `CUSTOM` — 직접 정의. Rule approximation은 금지.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-08 — Install/catalog save failure recovery

**질문:** install/catalog save 실패 후 persistence/recovery는?

**선택지**
- `A` — staged package/preview를 보존하고 Retry/Cancel, durable catalog는 성공 전 변경되지 않음.
- `B` — atomic install/rollback을 요구하고 실패 시 이전 catalog로 완전 복귀.
- `C` — recoverable local import snapshot을 저장해 app restart 후 다시 Review/Retry 가능.
- `CUSTOM` — storage architecture에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-09 — Update / replace / remove / disable

**질문:** v1에서 add-on lifecycle action을 어디까지 지원할 것인가?

**선택지**
- `A` — Install / Update / Replace / Disable / Remove 모두 지원, dependency/conflict preview 필수.
- `B` — v1은 Install / Remove만 공식 지원, update/replace/disable은 future.
- `C` — Install / Update / Disable 지원, destructive Remove/Replace는 제한적으로 또는 future.
- `CUSTOM` — lifecycle action 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-10 — Combatant import relationship

**질문:** Combatant import를 general Content import와 어떻게 통합/구분할 것인가?

**선택지**
- `A` — 같은 parsing/preview/validation pipeline 사용, Combatant-specific review/commit destination만 다름.
- `B` — Combatant import는 Encounter/DM contextual flow로 별도 productize, general Content import와 UX 분리.
- `C` — Content import가 Combatant-containing package를 인식하고 install 후 Encounter에서 사용할 수 있게 함; ad-hoc Combatant import는 DM flow에서 별도 shortcut.
- `CUSTOM` — 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`

### CONTENT-02-11 — Active Session content changes

**질문:** live Session 중 active content를 어떻게 보여주고 어떤 변경을 허용할 것인가?

**선택지**
- `A` — active content manifest는 Session Share에서 보이지만 live 중 install/update/remove는 금지; 다음 session에 적용.
- `B` — DM이 nonbreaking/additive content를 canonical compatibility check 후 live 추가 가능, replace/remove는 금지.
- `C` — live session content set은 immutable snapshot으로 고정하고 모든 변경은 staged for next session.
- `CUSTOM` — session/content authority contract에 맞춰 직접 정의.

**OWNER SELECT:** ``

**OWNER NOTE:** ``

**AI STATUS:** `PENDING`
